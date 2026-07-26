import React, { useState, useEffect, type ChangeEvent } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../supabaseClient";

type Executive = {
  id: number;
  executive_code: string;
  full_name: string;
  area: string;
};

type CaseRecord = {
  caseNo: string;
  customer: string;
  mobile: string;
  area: string;
  address: string;
  assignedExecCode: string;
  assignedExecName: string;
  isExisting: boolean;
};

type MarketSummary = {
  area: string;
  currentExcelCount: number;
  newCasesCount: number;
  alreadyAssignedCount: number;
  activeExecs: string;
  importResult: string;
};

function BankImportPage(): React.ReactElement {
  const [selectedBank, setSelectedBank] = useState<string>("Bank of Baroda (BOB)");
  const [fileName, setFileName] = useState<string>("");
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [dbCaseNumbers, setDbCaseNumbers] = useState<Set<string>>(new Set());

  const [excelRecords, setExcelRecords] = useState<CaseRecord[]>([]);
  const [marketSummaries, setMarketSummaries] = useState<MarketSummary[]>([]);
  const [missingAddressCount, setMissingAddressCount] = useState<number>(0);
  const [isImporting, setIsImporting] = useState<boolean>(false);

  // Load Active Executives & Existing DB Cases
  useEffect(() => {
    async function loadInitialData() {
      try {
        const { data: execData } = await supabase
          .from("executives")
          .select("*")
          .or("status.eq.active,status.eq.Active");

        if (execData) {
          setExecutives(
            execData.map((e: any) => ({
              id: e.id,
              executive_code: e.executive_code || e.agent_code || `SS00${e.id}`,
              full_name: e.full_name || e.name || "",
              area: e.area || "",
            }))
          );
        }

        const { data: caseData } = await supabase
          .from("cases")
          .select("case_no, case_number");

        if (caseData) {
          const setOfCases = new Set<string>();
          caseData.forEach((c: any) => {
            if (c.case_no) setOfCases.add(String(c.case_no).trim().toLowerCase());
            if (c.case_number) setOfCases.add(String(c.case_number).trim().toLowerCase());
          });
          setDbCaseNumbers(setOfCases);
        }
      } catch (err) {
        console.error("Data load error:", err);
      }
    }
    loadInitialData();
  }, []);

  // Clean String for Flexible Matching
  const cleanAreaString = (str: string): string => {
    return str
      .toLowerCase()
      .replace(/madhya\s*pradesh|mp|road|street|chouraha|mandi|bajar|station/g, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();
  };

  const findValue = (rowObj: Record<string, any>, possibleKeys: string[]): string => {
    const keys = Object.keys(rowObj);
    for (const key of keys) {
      const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      for (const pk of possibleKeys) {
        if (cleanKey.includes(pk)) {
          return String(rowObj[key] || "").trim();
        }
      }
    }
    return "";
  };

  // Explicit return type defined to avoid 'type never' inference issue
  const matchExecutiveByArea = (areaStr: string, execsList: Executive[]): Executive | null => {
    if (!areaStr || execsList.length === 0) return null;

    const rawTarget = areaStr.toLowerCase().trim();
    const cleanTarget = cleanAreaString(areaStr);

    let bestExec: Executive | null = null;
    let highestScore = 0;

    execsList.forEach((exec) => {
      if (!exec.area) return;

      const rawExecArea = exec.area.toLowerCase().trim();
      const cleanExecArea = cleanAreaString(exec.area);

      if (!cleanExecArea && !rawExecArea) return;

      let score = 0;

      // 1. Exact Match
      if (rawTarget === rawExecArea || cleanTarget === cleanExecArea) {
        score = 1000 + cleanExecArea.length;
      }
      // 2. Specific Substring Match
      else if (
        rawTarget.includes(rawExecArea) ||
        cleanTarget.includes(cleanExecArea)
      ) {
        score = 500 + cleanExecArea.length;
      }
      // 3. Broad Containment Match
      else if (
        rawExecArea.includes(rawTarget) ||
        cleanExecArea.includes(cleanTarget)
      ) {
        score = 100 + cleanExecArea.length;
      }

      if (score > highestScore) {
        highestScore = score;
        bestExec = exec;
      }
    });

    return bestExec;
  };

  function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        const rawData: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

        if (rawData.length === 0) {
          alert("Excel file khali lag rahi hai.");
          return;
        }

        const parsedCases: CaseRecord[] = [];
        const marketMap: Record<string, { current: number; newCases: number; existing: number }> = {};
        let missingAddr = 0;

        rawData.forEach((row, index) => {
          const caseNo = findValue(row, ["case", "account", "loan", "caseno", "accno"]) || `CASE-${index + 1}`;
          const customer = findValue(row, ["customer", "name", "borrower", "party"]) || "Unknown";
          const mobile = findValue(row, ["mobile", "phone", "contact", "cell"]) || "";
          const area = findValue(row, ["area", "market", "city", "location", "branch"]) || "Unassigned";
          const address = findValue(row, ["address", "add", "residence"]) || "";

          if (!address) missingAddr++;

          const isExisting = dbCaseNumbers.has(caseNo.toLowerCase());

          // Safely resolve type
          const matchingExec: Executive | null = matchExecutiveByArea(area, executives);

          const execCode = matchingExec ? matchingExec.executive_code : "Unassigned";
          const execName = matchingExec ? matchingExec.full_name : "Unassigned";

          parsedCases.push({
            caseNo,
            customer,
            mobile,
            area,
            address,
            assignedExecCode: execCode,
            assignedExecName: execName,
            isExisting,
          });

          if (!marketMap[area]) {
            marketMap[area] = { current: 0, newCases: 0, existing: 0 };
          }
          marketMap[area].current++;
          if (isExisting) {
            marketMap[area].existing++;
          } else {
            marketMap[area].newCases++;
          }
        });

        // Market Summaries
        const summaries: MarketSummary[] = Object.keys(marketMap).map((marketName) => {
          const stats = marketMap[marketName];
          const matchingExec: Executive | null = matchExecutiveByArea(marketName, executives);

          const execNamesStr = matchingExec
            ? `${matchingExec.executive_code} ${matchingExec.full_name}`
            : "No Active Executive";

          return {
            area: marketName,
            currentExcelCount: stats.current,
            newCasesCount: stats.newCases,
            alreadyAssignedCount: stats.existing,
            activeExecs: execNamesStr,
            importResult: stats.newCases > 0 ? `${stats.newCases} New Cases` : "No new case",
          };
        });

        setExcelRecords(parsedCases);
        setMarketSummaries(summaries);
        setMissingAddressCount(missingAddr);
      } catch (err) {
        alert("Excel File Read Error. Make sure file format is valid.");
        console.error(err);
      }
    };

    reader.readAsBinaryString(file);
  }

  const totalUniqueExcelCases = excelRecords.length;
  const alreadyExistingCount = excelRecords.filter(r => r.isExisting).length;
  const newCasesCount = totalUniqueExcelCases - alreadyExistingCount;

  async function handleImportNewCases() {
    if (newCasesCount === 0) {
      alert("Koi naya case nahi hai import karne ke liye!");
      return;
    }

    setIsImporting(true);

    try {
      const newRecordsToInsert = excelRecords
        .filter(r => !r.isExisting)
        .map(r => ({
          case_no: r.caseNo,
          customer_name: r.customer,
          phone: r.mobile,
          area: r.area,
          address: r.address,
          assigned_executive: r.assignedExecCode !== "Unassigned" ? r.assignedExecCode : null,
          bank_name: selectedBank,
          status: "Pending"
        }));

      const { error } = await supabase.from("cases").insert(newRecordsToInsert);

      if (error) throw error;

      alert(`Akyos CRM: ${newCasesCount} new cases successfully imported!`);
      
      setDbCaseNumbers(prev => new Set([...prev, ...newRecordsToInsert.map(r => r.case_no.toLowerCase())]));
      setExcelRecords([]);
      setMarketSummaries([]);
      setFileName("");
    } catch (err: any) {
      alert("Import Error: " + err.message);
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div style={{ padding: "24px", backgroundColor: "#f8fafc", minHeight: "100vh", fontFamily: "sans-serif" }}>
      {/* Page Header */}
      <div style={{ marginBottom: "20px" }}>
        <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a", margin: 0 }}>
          🏦 Bank Excel Case Import
        </h2>
        <p style={{ fontSize: "13px", color: "#64748b", margin: "4px 0 0 0" }}>
          Powered by Akyos Development
        </p>
      </div>

      {/* Upload Controls */}
      <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px 20px", marginBottom: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "12px", fontWeight: "700", color: "#475569" }}>Select Target Bank</label>
          <select
            value={selectedBank}
            onChange={(e) => setSelectedBank(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", backgroundColor: "#fff", fontSize: "14px", outline: "none" }}
          >
            <option value="Bank of Baroda (BOB)">Bank of Baroda (BOB)</option>
            <option value="State Bank of India (SBI)">State Bank of India (SBI)</option>
            <option value="HDFC Bank">HDFC Bank</option>
            <option value="ICICI Bank">ICICI Bank</option>
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "12px", fontWeight: "700", color: "#475569" }}>Upload Excel File (.xlsx, .xls)</label>
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileUpload}
            style={{ fontSize: "13px", color: "#334155" }}
          />
        </div>
      </div>

      {/* Summary Card */}
      {excelRecords.length > 0 && (
        <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px", marginBottom: "24px", boxShadow: "0 2px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "16px" }}>
            <div>
              <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: "700" }}>Selected Bank</span>
              <strong style={{ display: "block", fontSize: "15px", color: "#0f172a", marginTop: "2px" }}>{selectedBank}</strong>
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: "700" }}>File Name</span>
              <strong style={{ display: "block", fontSize: "15px", color: "#0f172a", marginTop: "2px" }}>{fileName}</strong>
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: "700" }}>Total Excel Records</span>
              <strong style={{ display: "block", fontSize: "15px", color: "#0f172a", marginTop: "2px" }}>{totalUniqueExcelCases}</strong>
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: "700" }}>Already In DB</span>
              <strong style={{ display: "block", fontSize: "15px", color: "#d97706", marginTop: "2px" }}>{alreadyExistingCount}</strong>
            </div>
          </div>

          <hr style={{ border: "none", borderTop: "1px solid #f1f5f9", margin: "16px 0" }} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <span style={{ fontSize: "18px", fontWeight: "800", color: "#2563eb" }}>{newCasesCount} New Cases Ready</span>
              {missingAddressCount > 0 && (
                <span style={{ marginLeft: "12px", fontSize: "12px", color: "#e11d48", fontWeight: "600" }}>
                  ({missingAddressCount} missing address)
                </span>
              )}
            </div>

            <button
              onClick={handleImportNewCases}
              disabled={isImporting || newCasesCount === 0}
              style={{
                padding: "10px 24px",
                backgroundColor: newCasesCount > 0 && !isImporting ? "#2563eb" : "#cbd5e1",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                fontWeight: "700",
                fontSize: "14px",
                cursor: newCasesCount > 0 && !isImporting ? "pointer" : "not-allowed",
              }}
            >
              {isImporting ? "Importing Data..." : `Import ${newCasesCount} New Cases`}
            </button>
          </div>
        </div>
      )}

      {/* Market Preview Table */}
      {marketSummaries.length > 0 && (
        <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px", boxShadow: "0 2px 4px rgba(0,0,0,0.04)" }}>
          <h3 style={{ fontSize: "15px", fontWeight: "800", color: "#1e293b", marginBottom: "16px" }}>
            Market-wise Assignment Preview
          </h3>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8fafc", borderBottom: "2px solid #e2e8f0", color: "#475569" }}>
                  <th style={{ padding: "12px" }}>Market / Area</th>
                  <th style={{ padding: "12px" }}>Current Excel</th>
                  <th style={{ padding: "12px" }}>New Cases</th>
                  <th style={{ padding: "12px" }}>Already Assigned</th>
                  <th style={{ padding: "12px" }}>Mapped Active Executive</th>
                  <th style={{ padding: "12px" }}>Import Action</th>
                </tr>
              </thead>
              <tbody>
                {marketSummaries.map((summary, idx) => {
                  const isUnassigned = summary.activeExecs === "No Active Executive";
                  return (
                    <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "12px", fontWeight: "700", color: "#0f172a" }}>{summary.area}</td>
                      <td style={{ padding: "12px", color: "#334155" }}>{summary.currentExcelCount}</td>
                      <td style={{ padding: "12px", fontWeight: "800", color: "#2563eb" }}>{summary.newCasesCount}</td>
                      <td style={{ padding: "12px", color: "#d97706" }}>{summary.alreadyAssignedCount}</td>
                      <td style={{ padding: "12px", fontWeight: "700", color: isUnassigned ? "#e11d48" : "#059669" }}>
                        {summary.activeExecs}
                      </td>
                      <td style={{ padding: "12px", color: "#64748b" }}>{summary.importResult}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default BankImportPage;