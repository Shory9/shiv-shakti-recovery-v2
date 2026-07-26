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

  // Load Active Executives & Existing Cases
  useEffect(() => {
    async function loadInitialData() {
      try {
        const { data: execData } = await supabase
          .from("executives")
          .select("id, executive_code, full_name, area")
          .eq("status", "active");

        if (execData) {
          setExecutives(
            execData.map((e: any) => ({
              id: e.id,
              executive_code: e.executive_code || `SS00${e.id}`,
              full_name: e.full_name || e.name || "",
              area: e.area || "",
            }))
          );
        }

        const { data: caseData } = await supabase
          .from("cases")
          .select("case_no");

        if (caseData) {
          setDbCaseNumbers(new Set(caseData.map((c: any) => String(c.case_no).trim().toLowerCase())));
        }
      } catch (err) {
        console.error("Error loading initial data:", err);
      }
    }
    loadInitialData();
  }, []);

  // Safe field extractor for flexible excel formats
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
        
        // Read Excel as JSON Objects (Uses header names)
        const rawData: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

        if (rawData.length === 0) {
          alert("Excel file khali lag rahi hai.");
          return;
        }

        const parsedCases: CaseRecord[] = [];
        const marketMap: Record<string, { current: number; newCases: number; existing: number }> = {};
        let missingAddr = 0;

        rawData.forEach((row, index) => {
          // Flexible key searching to match various Bank formats
          const caseNo = findValue(row, ["case", "account", "loan", "caseno", "accno"]) || `CASE-${index + 1}`;
          const customer = findValue(row, ["customer", "name", "borrower", "party"]) || "Unknown";
          const mobile = findValue(row, ["mobile", "phone", "contact", "cell"]) || "";
          const area = findValue(row, ["area", "market", "city", "location", "branch"]) || "Unassigned";
          const address = findValue(row, ["address", "add", "location", "residence"]) || "";

          if (!address) missingAddr++;

          const isExisting = dbCaseNumbers.has(caseNo.toLowerCase());

          // Match Executive by Area
          const cleanArea = area.toLowerCase().trim();
          const matchingExec = executives.find((exec) => {
            if (!exec.area) return false;
            const cleanExecArea = exec.area.toLowerCase().trim();
            return cleanArea.includes(cleanExecArea) || cleanExecArea.includes(cleanArea);
          });

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

          // Market Summary Tracking
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

        // Build Summaries
        const summaries: MarketSummary[] = Object.keys(marketMap).map((marketName) => {
          const stats = marketMap[marketName];
          const cleanMarket = marketName.toLowerCase().trim();

          const matchingExecs = executives.filter((exec) => {
            if (!exec.area) return false;
            const cleanExecArea = exec.area.toLowerCase().trim();
            return cleanMarket.includes(cleanExecArea) || cleanExecArea.includes(cleanMarket);
          });

          const execNamesStr = matchingExecs.length > 0
            ? matchingExecs.map(e => `${e.executive_code} ${e.full_name}`).join(", ")
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
        alert("Excel File Read Error: Make sure file format is correct.");
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
          address: r.address, // Added Address insertion fix
          assigned_executive: r.assignedExecCode !== "Unassigned" ? r.assignedExecCode : null,
          bank_name: selectedBank,
          status: "Pending"
        }));

      const { error } = await supabase.from("cases").insert(newRecordsToInsert);

      if (error) throw error;

      alert(`Akyos CRM: Successfully imported ${newCasesCount} new cases!`);
      
      // Update local existing state
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
    <div className="p-6 bg-slate-50 min-h-screen font-sans">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">🏦 Bank Excel Case Import</h2>
          <p className="text-xs text-slate-500">Powered by Akyos Development</p>
        </div>
      </div>

      {/* Upload Controls */}
      <div className="flex flex-wrap gap-4 mb-6 items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-600">Select Target Bank</label>
          <select
            value={selectedBank}
            onChange={(e) => setSelectedBank(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="Bank of Baroda (BOB)">Bank of Baroda (BOB)</option>
            <option value="State Bank of India (SBI)">State Bank of India (SBI)</option>
            <option value="HDFC Bank">HDFC Bank</option>
            <option value="ICICI Bank">ICICI Bank</option>
            <option value="Kotak Mahindra Bank">Kotak Mahindra Bank</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-600">Upload Excel File (.xlsx, .xls)</label>
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileUpload}
            className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
          />
        </div>
      </div>

      {/* Header File Stats Card */}
      {excelRecords.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
            <div>
              <span className="text-slate-400 block text-xs">Bank:</span>
              <span className="font-semibold text-slate-800">{selectedBank}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-xs">File:</span>
              <span className="font-semibold text-slate-800">{fileName}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-xs">Total Records:</span>
              <span className="font-semibold text-slate-800">{totalUniqueExcelCases}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-xs">Already In System:</span>
              <span className="font-semibold text-amber-600">{alreadyExistingCount}</span>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <div>
              <span className="text-lg font-bold text-blue-600">{newCasesCount} New Cases</span>
              {missingAddressCount > 0 && (
                <span className="ml-3 text-xs text-rose-500 font-medium">
                  ({missingAddressCount} cases missing full address)
                </span>
              )}
            </div>

            <button
              onClick={handleImportNewCases}
              disabled={isImporting || newCasesCount === 0}
              className={`px-6 py-2.5 rounded-lg text-white font-bold text-sm shadow-md transition-all ${
                newCasesCount > 0 && !isImporting
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-slate-300 cursor-not-allowed"
              }`}
            >
              {isImporting ? "Processing Import..." : `Import ${newCasesCount} New Cases`}
            </button>
          </div>
        </div>
      )}

      {/* Market-wise Assignment Preview Table */}
      {marketSummaries.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-4">
            Market-wise Assignment Preview
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <th className="p-3">Market / Area</th>
                  <th className="p-3">Current Excel Count</th>
                  <th className="p-3">New Cases</th>
                  <th className="p-3">Already Assigned</th>
                  <th className="p-3">Mapped Active Executive</th>
                  <th className="p-3">Import Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {marketSummaries.map((summary, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-3 font-semibold text-slate-800">{summary.area}</td>
                    <td className="p-3 text-slate-600">{summary.currentExcelCount}</td>
                    <td className="p-3 font-bold text-blue-600">{summary.newCasesCount}</td>
                    <td className="p-3 text-amber-600">{summary.alreadyAssignedCount}</td>
                    <td className={`p-3 font-medium ${summary.activeExecs === "No Active Executive" ? "text-rose-500" : "text-emerald-600"}`}>
                      {summary.activeExecs}
                    </td>
                    <td className="p-3 text-slate-500">{summary.importResult}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default BankImportPage;