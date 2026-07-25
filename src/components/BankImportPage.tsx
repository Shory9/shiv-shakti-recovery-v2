import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import * as XLSX from "xlsx";

type DbRow = Record<string, unknown>;
type ExcelRow = Record<string, unknown>;

type ExecutiveOption = {
  id: number;
  name: string;
  area: string;
};

type BankOption = {
  id: number | string;
  name: string;
};

type PreviewCase = {
  case_number: string;
  customer_name: string;
  mobile: string;
  alternate_mobile: string;
  address: string;
  city: string;
  area: string;
  pincode: string;
  assigned_executive_id: number | null;
  assigned_executive_name: string;
  status: string;
  bank_id: number | string;
};

const text = (value: unknown): string => String(value ?? "").trim();

const normalized = (value: unknown): string =>
  text(value).toLowerCase().replace(/\s+/g, " ");

const accountNumber = (value: unknown): string =>
  text(value).replace(/\.0$/, "");

const firstValue = (row: ExcelRow, keys: string[]): unknown => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && text(value) !== "") {
      return value;
    }
  }
  return "";
};

const AREA_RULES: Array<{ area: string; keywords: string[] }> = [
  { area: "Petlawad", keywords: ["petlawad", "petlawada"] },
  { area: "Thandla", keywords: ["thandla", "thandala"] },
  { area: "Manawar", keywords: ["manawar"] },
  { area: "Dhar", keywords: ["dhar"] },
  { area: "Jaora", keywords: ["jaora"] },
  { area: "Manasa", keywords: ["manasa"] },
  { area: "Sailana", keywords: ["sailana"] },
  { area: "Mandsaur", keywords: ["mandsaur", "mandsour"] },
  { area: "Jawad", keywords: ["jawad"] },
  { area: "Neemuch", keywords: ["neemuch"] },
  { area: "Ratlam", keywords: ["ratlam"] },
];

const SOL_AREA_MAP: Record<string, string> = {
  "1528": "Ratlam",
  "8790": "Mandsaur",
  "2494": "Mandsaur",
  "3896": "Jaora",
  "4134": "Manasa",
  "2653": "Jawad",
  "4449": "Sailana",
  "6478": "Neemuch",
};

function BankImportPage() {
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [selectedBankId, setSelectedBankId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void loadBanks();
  }, []);

  const loadBanks = async () => {
    const { data, error } = await supabase.from("banks").select("*");

    if (error) {
      setMessage(`Banks load error: ${error.message}`);
      return;
    }

    const options = ((data ?? []) as DbRow[]).map<BankOption>((row) => ({
      id: (row.id as number | string) ?? "",
      name: text(row.bank_name ?? row.name ?? row.code ?? row.id),
    }));

    setBanks(options);

    const bob = options.find((bank) => {
      const name = normalized(bank.name);
      return name.includes("bank of baroda") || name.includes("baroda") || name === "bob";
    });

    if (bob) setSelectedBankId(String(bob.id));
    else if (options.length === 1) setSelectedBankId(String(options[0].id));
  };

  const loadActiveExecutives = async (): Promise<ExecutiveOption[]> => {
    const { data, error } = await supabase.from("executives").select("*");

    if (error) throw new Error(`Executives load error: ${error.message}`);

    return ((data ?? []) as DbRow[])
      .filter((row) => normalized(row.status) === "active")
      .map((row) => ({
        id: Number(row.id),
        name: text(row.name ?? row.executive_name ?? row.full_name),
        area: text(row.area ?? row.assigned_area ?? row.market),
      }))
      .filter((row) => Number.isFinite(row.id) && row.name !== "" && row.area !== "");
  };

  const areaFromText = (value: unknown): string => {
    const source = normalized(value);

    for (const rule of AREA_RULES) {
      if (rule.keywords.some((keyword) => source.includes(keyword))) {
        return rule.area;
      }
    }

    return "Unassigned";
  };

  const resolveArea = (
    explicitArea: unknown,
    city: unknown,
    address: unknown,
    branch: unknown,
    solId: unknown
  ): string => {
    for (const value of [explicitArea, city, address, branch]) {
      const area = areaFromText(value);
      if (area !== "Unassigned") return area;
    }

    const sol = text(solId).replace(/^0+/, "");
    if (SOL_AREA_MAP[sol]) return SOL_AREA_MAP[sol];

    // SOL 575 contains both Petlawad and Thandla, therefore address is mandatory.
    // SOL 4467 contains both Manawar and Dhar, therefore address is mandatory.
    if (sol === "575" || sol === "4467") return "Unassigned";

    return "Unassigned";
  };

  const parseExcel = async (selectedFile: File) => {
    if (!selectedBankId) {
      setMessage("Pehle bank select karein.");
      return;
    }

    setLoading(true);
    setMessage("");
    setPreview([]);

    try {
      const activeExecutives = await loadActiveExecutives();
      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });

      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new Error("Workbook me koi sheet nahi mili.");

      const rows = XLSX.utils.sheet_to_json<ExcelRow>(workbook.Sheets[sheetName], {
        defval: "",
        raw: false,
      });

      const parsed: PreviewCase[] = [];

      for (const row of rows) {
        const number = accountNumber(
          firstValue(row, ["A/C No", "A/C NO", "Account No", "ACCOUNT NO"])
        );

        const customer = text(
          firstValue(row, ["A/C Name", "A/C NAME", "Customer Name", "CUSTOMER NAME"])
        );

        if (!number || !customer) continue;

        const address = text(firstValue(row, ["ADDRESS", "Address"]));
        const city = text(firstValue(row, ["CITY", "City", "TEHSIL", "Tehsil"]));
        const branch = firstValue(row, ["Branch", "BRANCH"]);
        const solId = firstValue(row, ["SOL ID", "Sol ID", "SOLID"]);

        const area = resolveArea(
          firstValue(row, ["AREA", "Area", "MARKET", "Market"]),
          city,
          address,
          branch,
          solId
        );

        const executive =
          area === "Unassigned"
            ? null
            : activeExecutives.find(
                (item) => normalized(item.area) === normalized(area)
              ) ?? null;

        parsed.push({
          case_number: number,
          customer_name: customer,
          mobile: text(firstValue(row, ["MOBILE NO", "Mobile No", "MOBILE", "Mobile"])),
          alternate_mobile: "",
          address,
          city,
          area,
          pincode: text(firstValue(row, ["PINCODE", "Pincode", "PIN CODE", "Pin Code"])),
          assigned_executive_id: executive?.id ?? null,
          assigned_executive_name: executive?.name ?? "Unassigned",
          status: "Pending",
          bank_id: selectedBankId,
        });
      }

      setPreview(parsed);

      const unassigned = parsed.filter(
        (item) => item.area === "Unassigned" || item.assigned_executive_id === null
      ).length;

      if (parsed.length === 0) {
        setMessage("Excel me A/C No aur A/C Name wale valid records nahi mile.");
      } else if (unassigned > 0) {
        setMessage(
          `${parsed.length} records read hue. ${unassigned} records ka exact area/executive assign nahi hua, isliye import disabled hai.`
        );
      } else {
        setMessage(`${parsed.length} records read hue aur sabhi cases assign ho gaye.`);
      }
    } catch (error) {
      console.error("Bank Excel error:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : `Excel error: ${String(error)}`
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingCaseNumbers = async (): Promise<Set<string>> => {
    const existing = new Set<string>();
    const pageSize = 1000;
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from("cases")
        .select("case_number")
        .range(from, from + pageSize - 1);

      if (error) throw error;

      const rows = (data ?? []) as Array<{ case_number?: string | null }>;

      rows.forEach((row) => {
        const value = accountNumber(row.case_number);
        if (value) existing.add(value);
      });

      if (rows.length < pageSize) break;
      from += pageSize;
    }

    return existing;
  };

  const importCases = async () => {
    const unassigned = preview.filter(
      (item) => item.area === "Unassigned" || item.assigned_executive_id === null
    ).length;

    if (preview.length === 0 || unassigned > 0) {
      setMessage("Import se pehle sabhi records ka executive assigned hona chahiye.");
      return;
    }

    setImporting(true);
    setProgress(0);
    setMessage("");

    try {
      const existing = await fetchExistingCaseNumbers();
      const unique = new Map<string, PreviewCase>();

      preview.forEach((item) => {
        const key = accountNumber(item.case_number);
        if (key && !unique.has(key)) unique.set(key, item);
      });

      const newCases = Array.from(unique.values()).filter(
        (item) => !existing.has(accountNumber(item.case_number))
      );

      if (newCases.length === 0) {
        setMessage("Sabhi records pehle se database me maujood hain.");
        return;
      }

      const rows = newCases.map((item) => ({
        case_number: item.case_number,
        bank_id: item.bank_id,
        customer_name: item.customer_name,
        mobile: item.mobile || null,
        alternate_mobile: item.alternate_mobile || null,
        address: item.address || null,
        city: item.city || null,
        area: item.area,
        pincode: item.pincode || null,
        assigned_executive_id: item.assigned_executive_id,
        status: item.status,
        allocation_date: new Date().toISOString().slice(0, 10),
        remarks: "Imported from Bank Excel",
      }));

      const batchSize = 500;
      let imported = 0;

      for (let index = 0; index < rows.length; index += batchSize) {
        const batch = rows.slice(index, index + batchSize);
        const { error } = await supabase.from("cases").insert(batch);

        if (error) throw error;

        imported += batch.length;
        setProgress(Math.round((imported / rows.length) * 100));
      }

      setMessage(`${imported} new cases successfully import hue.`);
      setPreview([]);
      setFile(null);

      const input = document.getElementById("bank-excel-input") as HTMLInputElement | null;
      if (input) input.value = "";
    } catch (error) {
      console.error("Import error:", error);
      setMessage(error instanceof Error ? `Import error: ${error.message}` : "Import fail hua.");
    } finally {
      setImporting(false);
    }
  };

  const unassignedCount = useMemo(
    () =>
      preview.filter(
        (item) => item.area === "Unassigned" || item.assigned_executive_id === null
      ).length,
    [preview]
  );

  return (
    <div style={{ minHeight: "100%", padding: 26, background: "#f5f7fb", color: "#0f172a" }}>
      <section style={{ padding: 30, borderRadius: 22, color: "white", background: "linear-gradient(135deg,#07192d,#12497b)" }}>
        <h1 style={{ margin: 0, fontSize: 36 }}>Bank Import</h1>
        <p style={{ margin: "12px 0 0", color: "#dbeafe" }}>
          Bank Excel se cases import karke exact area ke Active Executive ko assign karein.
        </p>
      </section>

      <section style={{ marginTop: 20, padding: 22, borderRadius: 20, background: "white", border: "1px solid #e2e8f0" }}>
        <label style={{ display: "block", marginBottom: 8, fontWeight: 800 }}>Select Bank</label>
        <select
          value={selectedBankId}
          onChange={(event) => {
            setSelectedBankId(event.target.value);
            setPreview([]);
            setMessage("");
          }}
          style={{ width: "100%", maxWidth: 430, height: 46, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 10, background: "white" }}
        >
          <option value="">Select bank</option>
          {banks.map((bank) => (
            <option key={String(bank.id)} value={String(bank.id)}>
              {bank.name}
            </option>
          ))}
        </select>

        <label style={{ display: "block", marginTop: 22, marginBottom: 8, fontWeight: 800 }}>Select Bank Excel</label>
        <input
          id="bank-excel-input"
          type="file"
          accept=".xlsx,.xls"
          disabled={!selectedBankId || loading || importing}
          onChange={(event) => {
            const selectedFile = event.target.files?.[0];
            if (!selectedFile) return;
            setFile(selectedFile);
            void parseExcel(selectedFile);
          }}
        />

        {file && <p>Selected: <strong>{file.name}</strong></p>}
        {loading && <p><strong>Excel read ho rahi hai...</strong></p>}

        {message && (
          <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "#f8fafc", fontWeight: 700 }}>
            {message}
          </div>
        )}

        {preview.length > 0 && (
          <>
            <div style={{ display: "flex", gap: 14, marginTop: 16, flexWrap: "wrap" }}>
              <strong>Total: {preview.length}</strong>
              <strong style={{ color: "#047857" }}>Assigned: {preview.length - unassignedCount}</strong>
              <strong style={{ color: "#dc2626" }}>Unassigned: {unassignedCount}</strong>
            </div>

            <button
              onClick={() => void importCases()}
              disabled={unassignedCount > 0 || importing}
              style={{ marginTop: 16, padding: "12px 22px", border: 0, borderRadius: 10, background: unassignedCount > 0 ? "#94a3b8" : "#2563eb", color: "white", fontWeight: 800, cursor: unassignedCount > 0 ? "not-allowed" : "pointer" }}
            >
              Import {preview.length} Cases
            </button>
          </>
        )}

        {importing && <p style={{ marginTop: 14, fontWeight: 800 }}>Importing... {progress}%</p>}
      </section>

      {preview.length > 0 && (
        <section style={{ marginTop: 20, padding: 22, borderRadius: 20, background: "white", border: "1px solid #e2e8f0", overflow: "auto" }}>
          <h2 style={{ marginTop: 0 }}>Preview — First 50 Records</h2>
          <table style={{ width: "100%", minWidth: 940, borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Case No.", "Customer", "Mobile", "Area", "Executive", "Status"].map((heading) => (
                  <th key={heading} style={{ padding: 11, textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.slice(0, 50).map((item, index) => (
                <tr key={`${item.case_number}-${index}`}>
                  <td style={{ padding: 11, borderBottom: "1px solid #eef2f7", fontFamily: "monospace", fontWeight: 800 }}>{item.case_number}</td>
                  <td style={{ padding: 11, borderBottom: "1px solid #eef2f7" }}>{item.customer_name}</td>
                  <td style={{ padding: 11, borderBottom: "1px solid #eef2f7" }}>{item.mobile || "-"}</td>
                  <td style={{ padding: 11, borderBottom: "1px solid #eef2f7" }}>{item.area}</td>
                  <td style={{ padding: 11, borderBottom: "1px solid #eef2f7" }}>{item.assigned_executive_name}</td>
                  <td style={{ padding: 11, borderBottom: "1px solid #eef2f7" }}>{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

export default BankImportPage;