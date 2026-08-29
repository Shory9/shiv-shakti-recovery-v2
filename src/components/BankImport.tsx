import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import * as XLSX from "xlsx";
import { supabase } from "../supabaseClient";
import { normalizeText, resolveCaseArea } from "../utils/caseImport";
import { bankContext, type BankCode } from "../types/bank";
import "./BankImport.css";

type ExcelRow = Record<string, unknown>;

type Executive = {
  id: string;
  executive_code: string | null;
  full_name: string | null;
  area: string | null;
  status: string | null;
};

type ExistingCase = {
  account_number: string | null;
  assigned_executive_id: string | null;
};

type ImportCase = {
  sn: number | null;
  caseType: string | null;
  alpha: string | null;
  solId: string | null;
  branch: string | null;
  customerId: string | null;
  accountNumber: string;
  accountName: string;
  sanctionLimit: number;
  sanctionDate: string | null;
  schemeCode: string | null;
  revSeg: string | null;
  balanceInr: number;
  customerBalance: number;
  ecgcReceivable: number;
  assetClass: string | null;
  npaDate: string | null;
  two: string | null;
  fraud: string | null;
  totalProvision: number;
  address: string | null;
  mobileNumber: string | null;
  village: string | null;
  resolvedArea: string;
  isExisting: boolean;
};

type MarketSummary = {
  area: string;
  total: number;
  newCases: number;
  alreadyAssigned: number;
  executives: Executive[];
};

// Allocation files supplied by the bank can be either the complete 22-column
// NPA export or a smaller allocation sheet. Only these two fields are needed
// to create a valid case; every other supported field is imported when present.
const REQUIRED_HEADERS = ["A/C No", "A/C Name"] as const;

const normalizeHeader = (value: unknown): string =>
  String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

const normalizeAccount = (value: unknown): string =>
  String(value ?? "").trim().toLowerCase();

const textValue = (value: unknown): string | null => {
  const text = String(value ?? "").trim();
  return text || null;
};

const numberValue = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value ?? "")
    .replace(/,/g, "")
    .replace(/[^0-9.-]/g, "")
    .trim();
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const integerValue = (value: unknown): number | null => {
  const parsed = numberValue(value);
  return Number.isFinite(parsed) && parsed !== 0 ? Math.trunc(parsed) : null;
};

const excelDateValue = (value: unknown): string | null => {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }

  const raw = String(value).trim();
  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (match) {
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  }

  const parsedDate = new Date(raw);
  return Number.isNaN(parsedDate.getTime())
    ? null
    : parsedDate.toISOString().slice(0, 10);
};

const getExactValue = (row: ExcelRow, expectedHeader: string): unknown => {
  const expected = normalizeHeader(expectedHeader);
  const matchingKey = Object.keys(row).find(
    (key) => normalizeHeader(key) === expected
  );
  return matchingKey ? row[matchingKey] : "";
};

const getFirstValue = (row: ExcelRow, headers: string[]): unknown => {
  for (const header of headers) {
    const value = getExactValue(row, header);
    if (String(value ?? "").trim()) return value;
  }
  return "";
};

const inferSbiBranch = (
  fileName: string,
  matrix: unknown[][],
  headerRowIndex: number
): string | null => {
  const headingText = matrix
    .slice(0, Math.max(headerRowIndex, 0))
    .flat()
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" ");
  const fileStem = fileName.replace(/\.[^.]+$/, "");
  const match = [fileStem, headingText]
    .map((sourceText) =>
      sourceText.match(/\bAVCA\s+(.+?)(?:\s+SBI\b|\s*\(\d+\)|$)/i)
    )
    .find(Boolean);
  const branch = match?.[1]
    ?.replace(/[^a-z0-9 ]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return branch ? branch.toUpperCase() : null;
};

function isActiveExecutive(executive: Executive): boolean {
  const status = String(executive.status ?? "").trim().toLowerCase();
  return status === "active" || status === "approved";
}

function formatExecutive(executive: Executive): string {
  return `${executive.executive_code || "NO CODE"} ${executive.full_name || "Executive"}`;
}

function assignmentAreaKey(value: unknown): string {
  const normalized = normalizeText(value);
  const aliases: Record<string, string> = {
    MANDSOUR: "MANDSAUR",
    NEMUCH: "NEEMUCH",
    MANAWAR: "MANAVAR",
    DBMANDSAUR: "DBMANDSAUR",
    MENDBMANDSAUR: "DBMANDSAUR",
  };

  return aliases[normalized] || normalized;
}

type BankImportProps = {
  directExecutiveId?: string | null;
  directExecutiveName?: string | null;
  directBank?: BankCode | null;
  onClearDirectExecutive?: () => void;
};

function BankImport({ directExecutiveId, directExecutiveName, directBank, onClearDirectExecutive }: BankImportProps): React.ReactElement {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedBank, setSelectedBank] = useState<BankCode>(directBank || "BOB");
  const selectedBankContext = bankContext(selectedBank);

  const [fileName, setFileName] = useState("");
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [existingAccounts, setExistingAccounts] = useState<Set<string>>(new Set());
  const [existingAssignedByArea, setExistingAssignedByArea] =
    useState<Record<string, number>>({});
  const [records, setRecords] = useState<ImportCase[]>([]);
  const [invalidRows, setInvalidRows] = useState(0);
  const [duplicateRowsInExcel, setDuplicateRowsInExcel] = useState(0);
  const [missingAddressCount, setMissingAddressCount] = useState(0);
  const [missingMobileCount, setMissingMobileCount] = useState(0);
  const [isLoadingExisting, setIsLoadingExisting] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [manualExecutiveByArea, setManualExecutiveByArea] = useState<Record<string, string>>({});

  useEffect(() => {
    void loadInitialData();
  }, [selectedBank]);

  async function loadInitialData(): Promise<void> {
    setIsLoadingExisting(true);

    try {
      const { data: executiveData, error: executiveError } = await supabase
        .from(selectedBankContext.tables.executives)
        .select("id, executive_code, full_name, area, status")
        .order("created_at", { ascending: true });

      if (executiveError) throw executiveError;

      const activeExecutives = ((executiveData ?? []) as Executive[]).filter(
        isActiveExecutive
      );
      setExecutives(activeExecutives);

      const allAccounts = new Set<string>();
      const assignedCounts: Record<string, number> = {};
      const executiveAreaById = new Map<string, string>();

      activeExecutives.forEach((executive) => {
        const areaKey = assignmentAreaKey(executive.area);
        if (areaKey) executiveAreaById.set(executive.id, areaKey);
      });

      const pageSize = 1000;
      let from = 0;

      while (true) {
        const { data, error } = await supabase
          .from(selectedBankContext.tables.cases)
          .select("account_number, assigned_executive_id")
          .range(from, from + pageSize - 1);

        if (error) throw error;

        const rows = (data ?? []) as ExistingCase[];

        rows.forEach((row) => {
          const account = normalizeAccount(row.account_number);
          if (account) allAccounts.add(account);

          if (row.assigned_executive_id) {
            const areaKey = executiveAreaById.get(row.assigned_executive_id);
            if (areaKey) {
              assignedCounts[areaKey] = (assignedCounts[areaKey] || 0) + 1;
            }
          }
        });

        if (rows.length < pageSize) break;
        from += pageSize;
      }

      setExistingAccounts(allAccounts);
      setExistingAssignedByArea(assignedCounts);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Initial data load nahi hua.";
      setStatusMessage(`Database error: ${message}`);
    } finally {
      setIsLoadingExisting(false);
    }
  }

  async function handleFileUpload(
    event: ChangeEvent<HTMLInputElement>
  ): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setRecords([]);
    setInvalidRows(0);
    setDuplicateRowsInExcel(0);
    setMissingAddressCount(0);
    setMissingMobileCount(0);
    setImportProgress(0);
    setStatusMessage("Excel read ho rahi hai...");
    setManualExecutiveByArea({});

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, {
        type: "array",
        cellDates: true,
        raw: false,
      });

      const sheetName = workbook.SheetNames.includes("NPA LIST")
        ? "NPA LIST"
        : workbook.SheetNames[0];

      if (!sheetName) throw new Error("Excel me sheet nahi mili.");

      const worksheet = workbook.Sheets[sheetName];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: "", raw: false });
      const requiredAliases = selectedBank === "SBI"
        ? [["ACCOUNT"], ["CUST NAME"]]
        : [["A/C No"], ["A/C Name"]];
      const headerRowIndex = matrix.slice(0, 20).findIndex((row) => {
        const headers = row.map(normalizeHeader);
        return requiredAliases.every((aliases) => aliases.some((alias) => headers.includes(normalizeHeader(alias))));
      });
      if (headerRowIndex < 0) {
        throw new Error(selectedBank === "SBI" ? "ACCOUNT aur CUST NAME columns nahi mili." : "A/C No aur A/C Name columns nahi mili.");
      }
      const rows = XLSX.utils.sheet_to_json<ExcelRow>(worksheet, {
        defval: "",
        raw: false,
        range: headerRowIndex,
      });

      if (rows.length === 0) throw new Error("Excel file khali hai.");

      const inferredSbiBranch = selectedBank === "SBI"
        ? inferSbiBranch(file.name, matrix, headerRowIndex)
        : null;

      const actualHeaders = Object.keys(rows[0]).map(normalizeHeader);
      const requiredHeaders = selectedBank === "SBI" ? ["ACCOUNT", "CUST NAME"] : [...REQUIRED_HEADERS];
      const missingRequiredHeaders = requiredHeaders.filter(
        (header) => !actualHeaders.includes(normalizeHeader(header))
      );

      if (missingRequiredHeaders.length > 0) {
        throw new Error(`Ye zaroori columns nahi mili: ${missingRequiredHeaders.join(", ")}`);
      }

      const uniqueCases = new Map<string, ImportCase>();
      let invalid = 0;
      let duplicates = 0;
      let missingAddress = 0;
      let missingMobile = 0;

      rows.forEach((row) => {
        const accountNumber = String(getFirstValue(row, ["A/C No", "ACCOUNT"]) ?? "").trim();
        const accountName = String(getFirstValue(row, ["A/C Name", "CUST NAME"]) ?? "").trim();
        const normalizedAccount = normalizeAccount(accountNumber);

        if (!normalizedAccount || !accountName) {
          invalid += 1;
          return;
        }

        if (uniqueCases.has(normalizedAccount)) {
          duplicates += 1;
          return;
        }

        const alpha = textValue(getExactValue(row, "Alpha"));
        const village = textValue(getFirstValue(row, ["VIILAGE", "VILLAGE"]));
        const explicitBranch = textValue(getExactValue(row, "Branch"));
        const branch = selectedBank === "SBI"
          ? explicitBranch || inferredSbiBranch
          : explicitBranch;
        const address = textValue(getFirstValue(row, ["ADDRESS", "VIILAGE", "VILLAGE"]));
        const mobileNumber = textValue(getExactValue(row, "MOBILE NO"));

        if (!address) missingAddress += 1;
        if (!mobileNumber) missingMobile += 1;

        const resolvedArea = resolveCaseArea(
          alpha || "",
          branch || "",
          address || "",
          accountNumber
        );

        uniqueCases.set(normalizedAccount, {
          sn: integerValue(getExactValue(row, "SN")),
          caseType: textValue(getExactValue(row, "TYPE")),
          alpha,
          solId: textValue(getExactValue(row, "SOL ID")),
          branch,
          customerId: textValue(getExactValue(row, "Cust ID")),
          accountNumber,
          accountName,
          sanctionLimit: numberValue(getFirstValue(row, ["Sanction Limit", "LIMIT"])),
          sanctionDate: excelDateValue(getExactValue(row, "Sanction Date")),
          schemeCode: textValue(getExactValue(row, "Scheme Code")),
          revSeg: textValue(getExactValue(row, "REV SEG")),
          balanceInr: numberValue(getFirstValue(row, ["Balance [INR]", "OUTSTAND"])),
          customerBalance: numberValue(getFirstValue(row, ["Cust. Bal", "OUTSTAND"])),
          ecgcReceivable: numberValue(getExactValue(row, "ECGC Rece")),
          assetClass: textValue(getExactValue(row, "Class")),
          npaDate: excelDateValue(getExactValue(row, "NPA Date")),
          two: textValue(getExactValue(row, "TWO")),
          fraud: textValue(getExactValue(row, "Fraud")),
          totalProvision: numberValue(getExactValue(row, "Total Provision")),
          address,
          mobileNumber,
          village,
          resolvedArea,
          isExisting: existingAccounts.has(normalizedAccount),
        });
      });

      const parsedRecords = Array.from(uniqueCases.values());
      setRecords(parsedRecords);
      setInvalidRows(invalid);
      setDuplicateRowsInExcel(duplicates);
      setMissingAddressCount(missingAddress);
      setMissingMobileCount(missingMobile);
      setStatusMessage(`${parsedRecords.length} unique cases ready hain.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Excel read nahi hui.";
      setStatusMessage(`Excel error: ${message}`);
      setRecords([]);
    }
  }

  const newRecords = useMemo(
    () => records.filter((record) => !record.isExisting),
    [records]
  );

  const marketSummaries = useMemo<MarketSummary[]>(() => {
    const map = new Map<string, MarketSummary>();

    records.forEach((record) => {
      const area = record.resolvedArea || record.branch || "Unmatched Area";
      const areaKey = assignmentAreaKey(area);
      const current = map.get(areaKey) ?? {
        area,
        total: 0,
        newCases: 0,
        alreadyAssigned:
          existingAssignedByArea[areaKey] || 0,
        executives:
          selectedBank === "SBI"
            ? executives
            : executives.filter(
                (executive) =>
                  assignmentAreaKey(executive.area) === areaKey
              ),
      };

      current.total += 1;
      if (!record.isExisting) current.newCases += 1;
      map.set(areaKey, current);
    });

    executives.forEach((executive) => {
      const area = executive.area?.trim();
      const areaKey = assignmentAreaKey(area);
      if (!area || map.has(areaKey)) return;

      map.set(areaKey, {
        area,
        total: 0,
        newCases: 0,
        alreadyAssigned:
          existingAssignedByArea[areaKey] || 0,
        executives: executives.filter(
          (item) => assignmentAreaKey(item.area) === areaKey
        ),
      });
    });

    return Array.from(map.values()).sort(
      (a, b) => b.total + b.alreadyAssigned - (a.total + a.alreadyAssigned)
    );
  }, [records, executives, existingAssignedByArea, selectedBank]);

  const autoAssignedPreview = marketSummaries.reduce(
    (total, summary) =>
      total +
      (summary.executives.length > 0 ||
      Boolean(manualExecutiveByArea[assignmentAreaKey(summary.area)])
        ? summary.newCases
        : 0),
    0
  );

  async function handleImportNewCases(): Promise<void> {
    if (newRecords.length === 0 || isImporting) return;

    setIsImporting(true);
    setImportProgress(0);
    setStatusMessage("Import start ho gaya...");

    try {
      const workload = new Map<string, number>();

      executives.forEach((executive) => {
        workload.set(
          executive.id,
          existingAssignedByArea[assignmentAreaKey(executive.area)] || 0
        );
      });

      const payload = newRecords.map((record) => {
        const areaKey = assignmentAreaKey(record.resolvedArea || record.branch || "Unmatched Area");
        const manualExecutiveId = manualExecutiveByArea[areaKey];
        const matchingExecutives = executives.filter(
          (executive) =>
            assignmentAreaKey(executive.area) ===
            assignmentAreaKey(record.resolvedArea)
        );
        const automaticAssignmentPool =
          selectedBank === "SBI" && matchingExecutives.length === 0
            ? executives
            : matchingExecutives;

        const selectedExecutive = executives.find(
          (executive) =>
            directExecutiveId &&
            String(executive.id) === String(directExecutiveId)
        ) ?? executives.find(
          (executive) =>
            manualExecutiveId &&
            String(executive.id) === String(manualExecutiveId)
        ) ?? [...automaticAssignmentPool].sort((a, b) => {
          const aLoad = workload.get(a.id) || 0;
          const bLoad = workload.get(b.id) || 0;
          return aLoad !== bLoad
            ? aLoad - bLoad
            : String(a.executive_code || "").localeCompare(
                String(b.executive_code || "")
              );
        })[0];

        if (selectedExecutive) {
          workload.set(
            selectedExecutive.id,
            (workload.get(selectedExecutive.id) || 0) + 1
          );
        }

        return {
          sn: record.sn,
          case_type: record.caseType,
          alpha: record.alpha,
          sol_id: record.solId,
          branch: record.branch,
          customer_id: record.customerId,
          account_number: record.accountNumber,
          account_name: record.accountName,
          sanction_limit: record.sanctionLimit,
          sanction_date: record.sanctionDate,
          scheme_code: record.schemeCode,
          rev_seg: record.revSeg,
          balance_inr: record.balanceInr,
          customer_balance: record.customerBalance,
          ecgc_receivable: record.ecgcReceivable,
          asset_class: record.assetClass,
          npa_date: record.npaDate,
          two: record.two,
          fraud: record.fraud,
          total_provision: record.totalProvision,
          address: record.address,
          mobile_number: record.mobileNumber,
          ...(selectedBank === "SBI" ? { village: record.village } : {}),
          bank_name: selectedBankContext.label,
          status: "pending",
          assigned_executive_id: selectedExecutive?.id ?? null,
          assigned_executive: selectedExecutive
            ? formatExecutive(selectedExecutive)
            : null,
          executive_code: selectedExecutive?.executive_code ?? null,
          remarks: `Resolved Area: ${
            record.resolvedArea || "Unmatched"
          } | Source File: ${fileName}`,
        };
      });

      const batchSize = 200;
      let imported = 0;

      for (let index = 0; index < payload.length; index += batchSize) {
        const batch = payload.slice(index, index + batchSize);

        const { error } = await supabase
          .from(selectedBankContext.tables.cases)
          .upsert(batch, {
            onConflict: "account_number",
            ignoreDuplicates: true,
          });

        if (error) throw error;

        imported += batch.length;
        setImportProgress(
          Math.round((imported / payload.length) * 100)
        );
        setStatusMessage(
          `${imported} / ${payload.length} cases imported...`
        );
      }

      const importedAccounts = payload.map((row) =>
        normalizeAccount(row.account_number)
      );

      setExistingAccounts(
        (previous) => new Set([...previous, ...importedAccounts])
      );
      setRecords((previous) =>
        previous.map((record) =>
          importedAccounts.includes(
            normalizeAccount(record.accountNumber)
          )
            ? { ...record, isExisting: true }
            : record
        )
      );

      await loadInitialData();

      setImportProgress(100);
      setStatusMessage(
        `${payload.length} cases successfully imported.`
      );
      alert(
        [
          "Import complete.",
          `Imported: ${payload.length}`,
          `Auto assigned: ${autoAssignedPreview}`,
          `Unassigned: ${payload.length - autoAssignedPreview}`,
        ].join("\n")
      );
    } catch (error) {
      const value = error as {
        code?: string;
        message?: string;
        details?: string;
        hint?: string;
      };

      const message = [
        value.code ? `Code: ${value.code}` : "",
        value.message ? `Message: ${value.message}` : "",
        value.details ? `Details: ${value.details}` : "",
        value.hint ? `Hint: ${value.hint}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      setStatusMessage(
        `Import error: ${message || "Unknown import error"}`
      );
      alert(`Import Error:\n${message || "Unknown import error"}`);
    } finally {
      setIsImporting(false);
    }
  }

  function resetImport(): void {
    setFileName("");
    setRecords([]);
    setInvalidRows(0);
    setDuplicateRowsInExcel(0);
    setMissingAddressCount(0);
    setMissingMobileCount(0);
    setImportProgress(0);
    setStatusMessage("");
    setManualExecutiveByArea({});
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="bank-import-page" style={{ padding: 24, background: "#f8fafc", minHeight: "100vh" }}>
      <div className="bank-import-hero" style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>🏦 Safe Bank Excel Import</h2>
        <p style={{ color: "#64748b" }}>
          Full NPA list aur short allocation Excel dono supported hain
        </p>
        <small style={{ color: "#64748b" }}>
          Zaroori columns: A/C No aur A/C Name. Baaki details available hone par import hongi.
        </small>
      </div>

      <div className="bank-import-upload" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 20 }}>
        {directExecutiveId && (
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: "12px 14px", marginBottom: 16, borderRadius: 10, background: "#eff6ff", border: "1px solid #93c5fd", color: "#1e3a8a" }}>
            <strong>Direct assignment: {directExecutiveName || "Selected executive"}</strong>
            <button type="button" onClick={onClearDirectExecutive}>Change</button>
          </div>
        )}
        <div className="bank-import-controls" style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "end" }}>
          <label>
            Target Bank
            <br />
            <select value={selectedBank} onChange={(event) => { resetImport(); setSelectedBank(event.target.value as BankCode); }} disabled={isImporting || Boolean(directBank)}>
              <option value="BOB">Bank of Baroda (BOB)</option>
              <option value="SBI">State Bank of India (SBI)</option>
            </select>
          </label>

          <label>
            Excel File
            <br />
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              disabled={isImporting || isLoadingExisting}
            />
          </label>

          {records.length > 0 && (
            <button type="button" onClick={resetImport} disabled={isImporting}>
              Clear
            </button>
          )}
        </div>

        <p style={{ color: statusMessage.includes("error") ? "#dc2626" : "#475569" }}>
          {isLoadingExisting
            ? "Database aur executives load ho rahe hain..."
            : statusMessage}
        </p>
      </div>

      {records.length > 0 && (
        <>
          <div className="bank-import-summary" style={{ background: "#fff", borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <p><b>File:</b> {fileName}</p>
            <p><b>Unique Excel Cases:</b> {records.length}</p>
            <p><b>New Cases:</b> {newRecords.length}</p>
            <p><b>Already In DB:</b> {records.length - newRecords.length}</p>
            <p><b>Excel Duplicates:</b> {duplicateRowsInExcel}</p>
            <p><b>Invalid Rows:</b> {invalidRows}</p>
            <p><b>Missing Address:</b> {missingAddressCount}</p>
            <p><b>Missing Mobile:</b> {missingMobileCount}</p>
            <p><b>Auto Assigned Preview:</b> {autoAssignedPreview}</p>
            <p><b>Unassigned Preview:</b> {newRecords.length - autoAssignedPreview}</p>

            {isImporting && <p><b>Progress:</b> {importProgress}%</p>}

            <button
              type="button"
              onClick={handleImportNewCases}
              disabled={isImporting || newRecords.length === 0}
            >
              {isImporting
                ? `Importing ${importProgress}%`
                : `Import ${newRecords.length} New Cases`}
            </button>
          </div>

          <div className="bank-import-table-card" style={{ background: "#fff", borderRadius: 12, padding: 20 }}>
            <h3>Market-wise Assignment Preview</h3>
            <div style={{ overflowX: "auto" }}>
              <table className="bank-import-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th>Market / Area</th>
                    <th>Current Excel</th>
                    <th>New Cases</th>
                    <th>Already Assigned</th>
                    <th>Active Executives</th>
                    <th>Direct Executive</th>
                    <th>Import Result</th>
                  </tr>
                </thead>
                <tbody>
                  {marketSummaries.map((summary) => (
                    <tr key={summary.area}>
                      <td>{summary.area}</td>
                      <td>{summary.total}</td>
                      <td>{summary.newCases}</td>
                      <td>{summary.alreadyAssigned}</td>
                      <td>
                        {summary.executives.length > 0
                          ? summary.executives
                              .map(formatExecutive)
                              .join(", ")
                          : "No Active Executive"}
                      </td>
                      <td>
                        <select
                          value={manualExecutiveByArea[assignmentAreaKey(summary.area)] || ""}
                          onChange={(event) =>
                            setManualExecutiveByArea((current) => ({
                              ...current,
                              [assignmentAreaKey(summary.area)]: event.target.value,
                            }))
                          }
                          disabled={isImporting || summary.newCases === 0 || Boolean(directExecutiveId)}
                          className="bank-import-executive-select"
                          style={{ minWidth: 190, padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                        >
                          <option value="">{directExecutiveId ? `Direct: ${directExecutiveName || "Selected executive"}` : "Auto / Unassigned"}</option>
                          {executives.map((executive) => (
                            <option key={executive.id} value={executive.id}>
                              {formatExecutive(executive)} ({executive.area || "No area"})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {summary.newCases === 0
                          ? "No new case"
                          : summary.executives.length > 0 ||
                            Boolean(manualExecutiveByArea[assignmentAreaKey(summary.area)])
                            ? `✅ ${summary.newCases} assigned`
                            : `⚠️ ${summary.newCases} unassigned`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default BankImport;
