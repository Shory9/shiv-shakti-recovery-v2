import React, { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../supabaseClient";

type ExcelRow = Record<string, unknown>;

type ImportCase = {
  sn: number | null;
  type: string | null;
  alpha: string | null;
  solId: string | null;
  branch: string | null;
  custId: string | null;
  caseNumber: string;
  customerName: string;
  sanctionLimit: number;
  sanctionDate: string | null;
  schemeCode: string | null;
  revSeg: string | null;
  balanceInr: number;
  customerBalance: number;
  ecgcReceivable: number;
  classification: string | null;
  npaDate: string | null;
  two: string | null;
  fraud: string | null;
  totalProvision: number;
  address: string | null;
  mobile: string | null;
  isExisting: boolean;
};

type BranchSummary = {
  branch: string;
  total: number;
  newCases: number;
  existing: number;
};

const EXPECTED_HEADERS = [
  "SN",
  "TYPE",
  "Alpha",
  "SOL ID",
  "Branch",
  "Cust ID",
  "A/C No",
  "A/C Name",
  "Sanction Limit",
  "Sanction Date",
  "Scheme Code",
  "REV SEG",
  "Balance [INR]",
  "Cust. Bal",
  "ECGC Rece",
  "Class",
  "NPA Date",
  "TWO",
  "Fraud",
  "Total Provision",
  "ADDRESS",
  "MOBILE NO",
] as const;

const normalizeHeader = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const normalizeCaseNumber = (value: unknown): string =>
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
      const month = String(parsed.m).padStart(2, "0");
      const day = String(parsed.d).padStart(2, "0");
      return `${parsed.y}-${month}-${day}`;
    }
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const ddmmyyyy = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, "0");
    const month = ddmmyyyy[2].padStart(2, "0");
    const year = ddmmyyyy[3].length === 2 ? `20${ddmmyyyy[3]}` : ddmmyyyy[3];
    return `${year}-${month}-${day}`;
  }

  const parsedDate = new Date(raw);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString().slice(0, 10);
};

const getExactValue = (row: ExcelRow, expectedHeader: string): unknown => {
  const expected = normalizeHeader(expectedHeader);
  const matchingKey = Object.keys(row).find((key) => normalizeHeader(key) === expected);
  return matchingKey ? row[matchingKey] : "";
};

function BankImportPage(): React.ReactElement {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedBank, setSelectedBank] = useState("Bank of Baroda (BOB)");
  const [fileName, setFileName] = useState("");
  const [existingCaseNumbers, setExistingCaseNumbers] = useState<Set<string>>(new Set());
  const [records, setRecords] = useState<ImportCase[]>([]);
  const [invalidRows, setInvalidRows] = useState(0);
  const [duplicateRowsInExcel, setDuplicateRowsInExcel] = useState(0);
  const [missingAddressCount, setMissingAddressCount] = useState(0);
  const [missingMobileCount, setMissingMobileCount] = useState(0);
  const [isLoadingExisting, setIsLoadingExisting] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    void loadExistingCases();
  }, []);

  async function loadExistingCases(): Promise<void> {
    setIsLoadingExisting(true);

    try {
      const allCaseNumbers = new Set<string>();
      const pageSize = 1000;
      let from = 0;

      while (true) {
        const { data, error } = await supabase
          .from("cases")
          .select("case_number")
          .range(from, from + pageSize - 1);

        if (error) throw error;

        const rows = data ?? [];
        rows.forEach((row: { case_number?: unknown }) => {
          const normalized = normalizeCaseNumber(row.case_number);
          if (normalized) allCaseNumbers.add(normalized);
        });

        if (rows.length < pageSize) break;
        from += pageSize;
      }

      setExistingCaseNumbers(allCaseNumbers);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Existing cases load nahi hue.";
      setStatusMessage(`Database error: ${message}`);
    } finally {
      setIsLoadingExisting(false);
    }
  }

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>): Promise<void> {
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
      const worksheet = workbook.Sheets[sheetName];

      const rows = XLSX.utils.sheet_to_json<ExcelRow>(worksheet, {
        defval: "",
        raw: false,
      });

      if (rows.length === 0) {
        throw new Error("Excel file khali hai.");
      }

      const actualHeaders = Object.keys(rows[0]).map(normalizeHeader);
      const missingHeaders = EXPECTED_HEADERS.filter(
        (header) => !actualHeaders.includes(normalizeHeader(header))
      );

      if (missingHeaders.length > 0) {
        throw new Error(`Ye columns nahi mili: ${missingHeaders.join(", ")}`);
      }

      const uniqueExcelCases = new Map<string, ImportCase>();
      let invalid = 0;
      let duplicateInExcel = 0;
      let missingAddress = 0;
      let missingMobile = 0;

      rows.forEach((row) => {
        const caseNumber = String(getExactValue(row, "A/C No") ?? "").trim();
        const customerName = String(getExactValue(row, "A/C Name") ?? "").trim();
        const normalizedCase = normalizeCaseNumber(caseNumber);

        if (!normalizedCase || !customerName) {
          invalid += 1;
          return;
        }

        if (uniqueExcelCases.has(normalizedCase)) {
          duplicateInExcel += 1;
          return;
        }

        const address = textValue(getExactValue(row, "ADDRESS"));
        const mobile = textValue(getExactValue(row, "MOBILE NO"));

        if (!address) missingAddress += 1;
        if (!mobile) missingMobile += 1;

        uniqueExcelCases.set(normalizedCase, {
          sn: integerValue(getExactValue(row, "SN")),
          type: textValue(getExactValue(row, "TYPE")),
          alpha: textValue(getExactValue(row, "Alpha")),
          solId: textValue(getExactValue(row, "SOL ID")),
          branch: textValue(getExactValue(row, "Branch")),
          custId: textValue(getExactValue(row, "Cust ID")),
          caseNumber,
          customerName,
          sanctionLimit: numberValue(getExactValue(row, "Sanction Limit")),
          sanctionDate: excelDateValue(getExactValue(row, "Sanction Date")),
          schemeCode: textValue(getExactValue(row, "Scheme Code")),
          revSeg: textValue(getExactValue(row, "REV SEG")),
          balanceInr: numberValue(getExactValue(row, "Balance [INR]")),
          customerBalance: numberValue(getExactValue(row, "Cust. Bal")),
          ecgcReceivable: numberValue(getExactValue(row, "ECGC Rece")),
          classification: textValue(getExactValue(row, "Class")),
          npaDate: excelDateValue(getExactValue(row, "NPA Date")),
          two: textValue(getExactValue(row, "TWO")),
          fraud: textValue(getExactValue(row, "Fraud")),
          totalProvision: numberValue(getExactValue(row, "Total Provision")),
          address,
          mobile,
          isExisting: existingCaseNumbers.has(normalizedCase),
        });
      });

      const parsedRecords = Array.from(uniqueExcelCases.values());
      setRecords(parsedRecords);
      setInvalidRows(invalid);
      setDuplicateRowsInExcel(duplicateInExcel);
      setMissingAddressCount(missingAddress);
      setMissingMobileCount(missingMobile);
      setStatusMessage(`${parsedRecords.length} unique cases ready hain.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Excel read nahi hui.";
      setStatusMessage(`Excel error: ${message}`);
      setRecords([]);
    }
  }

  const newRecords = useMemo(
    () => records.filter((record) => !record.isExisting),
    [records]
  );

  const existingCount = records.length - newRecords.length;

  const branchSummaries = useMemo<BranchSummary[]>(() => {
    const map = new Map<string, BranchSummary>();

    records.forEach((record) => {
      const branch = record.branch || "Branch Missing";
      const current = map.get(branch) ?? {
        branch,
        total: 0,
        newCases: 0,
        existing: 0,
      };

      current.total += 1;
      if (record.isExisting) current.existing += 1;
      else current.newCases += 1;

      map.set(branch, current);
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [records]);

  async function handleImportNewCases(): Promise<void> {
    if (newRecords.length === 0 || isImporting) return;

    setIsImporting(true);
    setImportProgress(0);
    setStatusMessage("Import start ho gaya...");

    try {
      const payload = newRecords.map((record) => ({
        sn: record.sn,
        type: record.type,
        alpha: record.alpha,
        sol_id: record.solId,
        branch: record.branch,
        cust_id: record.custId,
        case_number: record.caseNumber,
        customer_name: record.customerName,
        sanction_limit: record.sanctionLimit,
        sanction_date: record.sanctionDate,
        scheme_code: record.schemeCode,
        rev_seg: record.revSeg,
        balance_inr: record.balanceInr,
        customer_balance: record.customerBalance,
        ecgc_receivable: record.ecgcReceivable,
        classification: record.classification,
        npa_date: record.npaDate,
        two: record.two,
        fraud: record.fraud,
        total_provision: record.totalProvision,
        address: record.address,
        mobile: record.mobile,
        bank_name: selectedBank,
      }));

      const batchSize = 200;
      let imported = 0;

      for (let index = 0; index < payload.length; index += batchSize) {
        const batch = payload.slice(index, index + batchSize);
        const { error } = await supabase
          .from("cases")
          .upsert(batch, {
            onConflict: "case_number",
            ignoreDuplicates: true,
          });

        if (error) throw error;

        imported += batch.length;
        setImportProgress(Math.round((imported / payload.length) * 100));
        setStatusMessage(`${imported} / ${payload.length} cases imported...`);
      }

      const importedCaseNumbers = payload.map((row) => normalizeCaseNumber(row.case_number));
      setExistingCaseNumbers((previous) => new Set([...previous, ...importedCaseNumbers]));
      setRecords((previous) =>
        previous.map((record) =>
          importedCaseNumbers.includes(normalizeCaseNumber(record.caseNumber))
            ? { ...record, isExisting: true }
            : record
        )
      );

      setImportProgress(100);
      setStatusMessage(`${payload.length} cases successfully imported.`);
      alert(`${payload.length} cases successfully imported!`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown import error";
      setStatusMessage(`Import error: ${message}`);
      alert(`Import Error: ${message}`);
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
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div style={{ padding: 24, background: "#f8fafc", minHeight: "100vh", fontFamily: "sans-serif" }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a" }}>
          🏦 Bank Excel Case Import
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
          Original 22-column NPA Excel import
        </p>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Target Bank</label>
            <select
              value={selectedBank}
              onChange={(event) => setSelectedBank(event.target.value)}
              disabled={isImporting}
              style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff" }}
            >
              <option value="Bank of Baroda (BOB)">Bank of Baroda (BOB)</option>
              <option value="State Bank of India (SBI)">State Bank of India (SBI)</option>
              <option value="HDFC Bank">HDFC Bank</option>
              <option value="ICICI Bank">ICICI Bank</option>
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Excel File</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              disabled={isImporting || isLoadingExisting}
            />
          </div>

          {records.length > 0 && (
            <button
              type="button"
              onClick={resetImport}
              disabled={isImporting}
              style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", fontWeight: 700, cursor: "pointer" }}
            >
              Clear
            </button>
          )}
        </div>

        <div style={{ marginTop: 14, fontSize: 13, color: statusMessage.startsWith("Import error") || statusMessage.startsWith("Excel error") || statusMessage.startsWith("Database error") ? "#dc2626" : "#475569" }}>
          {isLoadingExisting ? "Database ke existing cases load ho rahe hain..." : statusMessage}
        </div>
      </div>

      {records.length > 0 && (
        <>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 }}>
              {[
                ["File", fileName],
                ["Unique Excel Cases", records.length],
                ["New Cases", newRecords.length],
                ["Already In DB", existingCount],
                ["Excel Duplicates", duplicateRowsInExcel],
                ["Invalid Rows", invalidRows],
                ["Missing Address", missingAddressCount],
                ["Missing Mobile", missingMobileCount],
              ].map(([label, value]) => (
                <div key={String(label)} style={{ padding: 12, borderRadius: 9, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>{label}</div>
                  <div style={{ marginTop: 4, fontSize: 17, fontWeight: 800, color: "#0f172a", wordBreak: "break-word" }}>{value}</div>
                </div>
              ))}
            </div>

            {isImporting && (
              <div style={{ marginTop: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>
                  <span>Import Progress</span>
                  <span>{importProgress}%</span>
                </div>
                <div style={{ height: 10, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ width: `${importProgress}%`, height: "100%", background: "#2563eb", transition: "width 0.2s ease" }} />
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
              <button
                type="button"
                onClick={handleImportNewCases}
                disabled={isImporting || newRecords.length === 0}
                style={{
                  padding: "11px 24px",
                  border: 0,
                  borderRadius: 8,
                  background: isImporting || newRecords.length === 0 ? "#cbd5e1" : "#2563eb",
                  color: "#fff",
                  fontWeight: 800,
                  cursor: isImporting || newRecords.length === 0 ? "not-allowed" : "pointer",
                }}
              >
                {isImporting ? `Importing ${importProgress}%` : `Import ${newRecords.length} New Cases`}
              </button>
            </div>
          </div>

          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 800, color: "#1e293b" }}>
              Branch-wise Preview
            </h3>

            <div style={{ overflowX: "auto", maxHeight: 430 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead style={{ position: "sticky", top: 0, background: "#f8fafc" }}>
                  <tr style={{ borderBottom: "2px solid #e2e8f0", textAlign: "left", color: "#475569" }}>
                    <th style={{ padding: 12 }}>Branch</th>
                    <th style={{ padding: 12 }}>Total</th>
                    <th style={{ padding: 12 }}>New</th>
                    <th style={{ padding: 12 }}>Already In DB</th>
                  </tr>
                </thead>
                <tbody>
                  {branchSummaries.map((summary) => (
                    <tr key={summary.branch} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: 12, fontWeight: 700, color: "#0f172a" }}>{summary.branch}</td>
                      <td style={{ padding: 12 }}>{summary.total}</td>
                      <td style={{ padding: 12, fontWeight: 800, color: "#2563eb" }}>{summary.newCases}</td>
                      <td style={{ padding: 12, color: "#d97706" }}>{summary.existing}</td>
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

export default BankImportPage;