import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

type ReportType = "Overview" | "Recovery" | "Executive" | "Bank" | "Cases";
type ReportPeriod = "Today" | "Last 7 Days" | "Last 30 Days" | "This Month" | "Custom";
type DbRow = Record<string, unknown>;

type ReportRecord = {
  id: string;
  date: string;
  customerName: string;
  caseNumber: string;
  bankName: string;
  executiveName: string;
  status: string;
  recoveryAmount: number;
  loanAmount: number;
};

type SummaryRow = { label: string; cases: number; recovery: number };

const text = (value: unknown, fallback = "") =>
  value === null || value === undefined ? fallback : String(value);

const numberValue = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const firstValue = (row: DbRow | undefined, keys: string[]) => {
  if (!row) return undefined;
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return undefined;
};

const rowId = (row: DbRow | undefined) =>
  text(firstValue(row, ["id", "case_id", "payment_id", "executive_id", "bank_id"]));

const normalizeDate = (value: unknown) => {
  if (!value) return "";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

const formatDate = (value: string) => {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

const escapeCsv = (value: unknown) => {
  const raw = String(value ?? "");
  return `"${raw.replace(/"/g, '""')}"`;
};

function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>("Overview");
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("This Month");
  const [search, setSearch] = useState("");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [cases, setCases] = useState<DbRow[]>([]);
  const [payments, setPayments] = useState<DbRow[]>([]);
  const [executives, setExecutives] = useState<DbRow[]>([]);
  const [banks, setBanks] = useState<DbRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAllRows = async (table: string) => {
    const pageSize = 1000;
    let from = 0;
    const rows: DbRow[] = [];

    while (true) {
      const { data, error: queryError } = await supabase
        .from(table)
        .select("*")
        .range(from, from + pageSize - 1);

      if (queryError) throw queryError;
      const batch = (data ?? []) as DbRow[];
      rows.push(...batch);
      if (batch.length < pageSize) break;
      from += pageSize;
    }

    return rows;
  };

  const loadReports = async () => {
    setLoading(true);
    setError("");

    try {
      const [caseRows, paymentRows, executiveRows, bankRows] = await Promise.all([
        loadAllRows("cases"),
        loadAllRows("payments"),
        loadAllRows("executives"),
        loadAllRows("banks"),
      ]);

      setCases(caseRows);
      setPayments(paymentRows);
      setExecutives(executiveRows);
      setBanks(bankRows);
    } catch (loadError) {
      console.error("Reports load error:", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Reports data load nahi ho saka."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReports();
  }, []);

  const executiveMap = useMemo(() => {
    const map = new Map<string, string>();
    executives.forEach((row) => {
      const id = rowId(row);
      const name = text(
        firstValue(row, ["name", "executive_name", "full_name", "employee_name"]),
        "Unassigned"
      );
      if (id) map.set(id, name);
    });
    return map;
  }, [executives]);

  const bankMap = useMemo(() => {
    const map = new Map<string, string>();
    banks.forEach((row) => {
      const id = rowId(row);
      const name = text(firstValue(row, ["name", "bank_name", "title"]), "Unknown Bank");
      if (id) map.set(id, name);
    });
    return map;
  }, [banks]);

  const dateRange = useMemo(() => {
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let start = new Date(end);

    if (reportPeriod === "Last 7 Days") start.setDate(start.getDate() - 6);
    else if (reportPeriod === "Last 30 Days") start.setDate(start.getDate() - 29);
    else if (reportPeriod === "This Month") start = new Date(end.getFullYear(), end.getMonth(), 1);
    else if (reportPeriod === "Custom") {
      return {
        from: customFrom ? new Date(`${customFrom}T00:00:00`) : null,
        to: customTo ? new Date(`${customTo}T23:59:59`) : null,
      };
    }

    return { from: start, to: new Date(end.getTime() + 86399999) };
  }, [reportPeriod, customFrom, customTo]);

  const reportRecords = useMemo<ReportRecord[]>(() => {
    const paymentByCase = new Map<string, { total: number; date: string }>();

    payments.forEach((payment) => {
      const caseId = text(firstValue(payment, ["case_id", "caseId", "loan_case_id", "case"]));
      const amount = numberValue(
        firstValue(payment, ["amount", "payment_amount", "paid_amount", "recovery_amount", "collection_amount"])
      );
      const paymentDate = normalizeDate(
        firstValue(payment, ["payment_date", "paid_at", "date", "created_at", "updated_at"])
      );
      if (!caseId) return;
      const previous = paymentByCase.get(caseId) ?? { total: 0, date: "" };
      paymentByCase.set(caseId, {
        total: previous.total + amount,
        date: !previous.date || (paymentDate && paymentDate > previous.date) ? paymentDate : previous.date,
      });
    });

    return cases.map((caseRow, index) => {
      const id = rowId(caseRow) || String(index + 1);
      const payment = paymentByCase.get(id);
      const executiveId = text(
        firstValue(caseRow, ["assigned_agent", "assigned_executive", "executive_id", "agent_id"])
      );
      const bankId = text(firstValue(caseRow, ["bank_id", "bank"]));
      const directExecutive = text(
        firstValue(caseRow, ["executive_name", "agent_name", "assigned_agent_name"])
      );
      const directBank = text(firstValue(caseRow, ["bank_name", "bank"]));
      const createdDate = normalizeDate(
        firstValue(caseRow, ["created_at", "case_date", "assigned_date", "date"])
      );

      return {
        id,
        date: payment?.date || createdDate,
        customerName: text(
          firstValue(caseRow, ["customer_name", "customer", "borrower_name", "name"]),
          "Unknown Customer"
        ),
        caseNumber: text(
          firstValue(caseRow, ["case_number", "case_no", "account_number", "loan_account_number", "reference_no"]),
          id
        ),
        bankName: directBank || bankMap.get(bankId) || "Unknown Bank",
        executiveName: directExecutive || executiveMap.get(executiveId) || executiveId || "Unassigned",
        status: text(firstValue(caseRow, ["status", "case_status"]), "Pending"),
        recoveryAmount: payment?.total ?? 0,
        loanAmount: numberValue(
          firstValue(caseRow, ["loan_amount", "outstanding_amount", "total_due", "due_amount"])
        ),
      };
    });
  }, [cases, payments, executiveMap, bankMap]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    return reportRecords.filter((record) => {
      const matchesSearch =
        !query ||
        record.customerName.toLowerCase().includes(query) ||
        record.caseNumber.toLowerCase().includes(query) ||
        record.bankName.toLowerCase().includes(query) ||
        record.executiveName.toLowerCase().includes(query) ||
        record.status.toLowerCase().includes(query);

      const date = record.date ? new Date(`${record.date}T12:00:00`) : null;
      const matchesPeriod =
        !date ||
        ((!dateRange.from || date >= dateRange.from) && (!dateRange.to || date <= dateRange.to));

      if (!matchesSearch || !matchesPeriod) return false;
      if (reportType === "Recovery") return record.recoveryAmount > 0;
      return true;
    });
  }, [reportRecords, search, reportType, dateRange]);

  const totalCases = filteredRecords.length;
  const totalRecovery = filteredRecords.reduce((sum, record) => sum + record.recoveryAmount, 0);
  const totalPortfolio = filteredRecords.reduce((sum, record) => sum + record.loanAmount, 0);
  const recoveredCases = filteredRecords.filter((record) => {
    const status = record.status.toLowerCase();
    return record.recoveryAmount > 0 || ["paid", "recovered", "closed"].includes(status);
  }).length;
  const pendingCases = filteredRecords.filter(
    (record) => !["paid", "recovered", "closed"].includes(record.status.toLowerCase())
  ).length;
  const recoveryRate = totalCases > 0 ? Math.round((recoveredCases / totalCases) * 100) : 0;

  const summaryRows = useMemo<SummaryRow[]>(() => {
    const group = new Map<string, SummaryRow>();
    filteredRecords.forEach((record) => {
      let label = "All Records";
      if (reportType === "Executive") label = record.executiveName;
      if (reportType === "Bank") label = record.bankName;
      if (reportType === "Cases") label = record.status;
      if (reportType === "Recovery") label = record.date ? formatDate(record.date) : "No Date";
      const current = group.get(label) ?? { label, cases: 0, recovery: 0 };
      current.cases += 1;
      current.recovery += record.recoveryAmount;
      group.set(label, current);
    });
    return Array.from(group.values())
      .sort((a, b) => b.recovery - a.recovery || b.cases - a.cases)
      .slice(0, 10);
  }, [filteredRecords, reportType]);

  const maxSummaryRecovery = Math.max(1, ...summaryRows.map((row) => row.recovery));

  const exportCsv = () => {
    const headers = ["Date", "Customer", "Case Number", "Bank", "Executive", "Status", "Loan Amount", "Recovery Amount"];
    const rows = filteredRecords.map((record) => [
      record.date,
      record.customerName,
      record.caseNumber,
      record.bankName,
      record.executiveName,
      record.status,
      record.loanAmount,
      record.recoveryAmount,
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `shiv-shakti-${reportType.toLowerCase()}-report-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="reports-page">
      <style>{`
        .reports-page{min-height:100%;padding:26px;background:#f5f7fb;color:#0f172a;box-sizing:border-box}.reports-page *{box-sizing:border-box}
        .reports-hero{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:30px;border-radius:22px;color:#fff;background:linear-gradient(135deg,#07192d,#172554 55%,#312e81);box-shadow:0 18px 45px rgba(7,25,45,.18)}
        .reports-kicker{margin-bottom:10px;color:#c7d2fe;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.reports-hero h1{margin:0;font-size:clamp(28px,3vw,38px)}.reports-hero p{max-width:720px;margin:12px 0 0;color:#e0e7ff;font-size:15px;line-height:1.65}
        .reports-hero-status{min-width:210px;padding:17px 19px;border:1px solid rgba(255,255,255,.18);border-radius:16px;background:rgba(255,255,255,.08)}.reports-hero-status span{display:block;color:#c7d2fe;font-size:11px;font-weight:800;text-transform:uppercase}.reports-hero-status strong{display:block;margin-top:7px;font-size:20px}
        .reports-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:15px;margin-top:20px}.reports-stat-card,.reports-panel{border:1px solid #e2e8f0;background:#fff;box-shadow:0 10px 30px rgba(15,23,42,.06)}.reports-stat-card{padding:19px;border-radius:18px}.reports-stat-top{display:flex;align-items:center;justify-content:space-between}.reports-stat-card span{color:#64748b;font-size:11px;font-weight:800;text-transform:uppercase}.reports-stat-icon{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;background:#eef2ff;font-size:18px}.reports-stat-card strong{display:block;margin-top:10px;font-size:25px}
        .reports-panel{margin-top:20px;padding:22px;border-radius:20px}.reports-panel-heading{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:18px}.reports-panel-heading h2{margin:0;font-size:19px}.reports-panel-heading p{margin:5px 0 0;color:#64748b;font-size:13px}.reports-status-badge{display:inline-flex;padding:8px 12px;border-radius:999px;color:#047857;background:#ecfdf5;font-size:11px;font-weight:800}.reports-error{margin-top:20px;padding:14px 16px;border:1px solid #fecaca;border-radius:14px;color:#b91c1c;background:#fef2f2}
        .reports-toolbar{display:grid;grid-template-columns:minmax(220px,1fr) 180px 180px 150px;gap:12px}.reports-input,.reports-select,.reports-button{width:100%;height:46px;padding:0 14px;border:1px solid #cbd5e1;border-radius:13px;background:#fff;color:#0f172a;font-size:13px;outline:none}.reports-button{border:0;color:#fff;background:#4f46e5;font-weight:800;cursor:pointer}.reports-button.secondary{background:#0f172a}.reports-custom-range{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}
        .reports-dashboard-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(300px,.65fr);gap:20px}.reports-chart-box{min-height:390px;padding:22px;border:1px solid #e2e8f0;border-radius:18px;background:#f8fafc}.reports-bar-row{display:grid;grid-template-columns:minmax(110px,180px) 1fr auto;align-items:center;gap:12px;margin-bottom:14px}.reports-bar-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:700}.reports-bar-track{height:12px;overflow:hidden;border-radius:999px;background:#e2e8f0}.reports-bar-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#4f46e5,#7c3aed)}.reports-bar-value{font-size:11px;font-weight:800}.reports-empty{min-height:280px;display:grid;place-items:center;text-align:center;color:#64748b}
        .reports-summary-list{display:flex;flex-direction:column;gap:12px}.reports-summary-card{padding:16px;border:1px solid #e2e8f0;border-radius:15px;background:#f8fafc}.reports-summary-card span{color:#64748b;font-size:10px;font-weight:800;text-transform:uppercase}.reports-summary-card strong{display:block;margin-top:7px;font-size:19px}.reports-table-wrapper{overflow-x:auto;border:1px solid #e2e8f0;border-radius:16px}.reports-table{width:100%;min-width:1100px;border-collapse:collapse}.reports-table th{padding:13px 15px;border-bottom:1px solid #e2e8f0;color:#64748b;background:#f8fafc;font-size:10px;font-weight:900;text-align:left;text-transform:uppercase}.reports-table td{padding:15px;border-bottom:1px solid #eef2f7;color:#475569;font-size:12px}.reports-table td strong{color:#0f172a}.reports-loading{padding:70px 20px;text-align:center;color:#64748b}
        @media(max-width:1100px){.reports-stats{grid-template-columns:repeat(2,1fr)}.reports-dashboard-grid{grid-template-columns:1fr}}@media(max-width:820px){.reports-toolbar{grid-template-columns:1fr 1fr}}@media(max-width:650px){.reports-page{padding:14px}.reports-hero,.reports-panel-heading{align-items:flex-start;flex-direction:column}.reports-hero-status{width:100%}.reports-toolbar,.reports-custom-range{grid-template-columns:1fr}}@media(max-width:500px){.reports-stats{grid-template-columns:1fr}}
      `}</style>

      <section className="reports-hero">
        <div><div className="reports-kicker">◆ Business Intelligence Center</div><h1>Reports & Analytics</h1><p>Recovery performance, executive productivity, bank-wise collection aur case status ka live Supabase report.</p></div>
        <div className="reports-hero-status"><span>Analytics Database</span><strong>{loading ? "Connecting..." : error ? "Connection Error" : "Live Connected"}</strong></div>
      </section>

      {error && <div className="reports-error">{error}</div>}

      <section className="reports-stats">
        <article className="reports-stat-card"><div className="reports-stat-top"><span>Total Cases</span><div className="reports-stat-icon">▣</div></div><strong>{totalCases}</strong></article>
        <article className="reports-stat-card"><div className="reports-stat-top"><span>Total Recovery</span><div className="reports-stat-icon">₹</div></div><strong>{formatCurrency(totalRecovery)}</strong></article>
        <article className="reports-stat-card"><div className="reports-stat-top"><span>Recovery Rate</span><div className="reports-stat-icon">%</div></div><strong>{recoveryRate}%</strong></article>
        <article className="reports-stat-card"><div className="reports-stat-top"><span>Pending Cases</span><div className="reports-stat-icon">⌛</div></div><strong>{pendingCases}</strong></article>
      </section>

      <section className="reports-panel">
        <div className="reports-panel-heading"><div><h2>Report Controls</h2><p>Report type, period aur search filter select karein.</p></div><span className="reports-status-badge">{filteredRecords.length} records</span></div>
        <div className="reports-toolbar">
          <input className="reports-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer, case, bank, executive..." />
          <select className="reports-select" value={reportType} onChange={(event) => setReportType(event.target.value as ReportType)}><option value="Overview">Overview Report</option><option value="Recovery">Recovery Report</option><option value="Executive">Executive Report</option><option value="Bank">Bank-wise Report</option><option value="Cases">Case Status Report</option></select>
          <select className="reports-select" value={reportPeriod} onChange={(event) => setReportPeriod(event.target.value as ReportPeriod)}><option value="Today">Today</option><option value="Last 7 Days">Last 7 Days</option><option value="Last 30 Days">Last 30 Days</option><option value="This Month">This Month</option><option value="Custom">Custom Range</option></select>
          <button className="reports-button" type="button" onClick={exportCsv} disabled={!filteredRecords.length}>Export CSV</button>
        </div>
        {reportPeriod === "Custom" && <div className="reports-custom-range"><input className="reports-input" type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} /><input className="reports-input" type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} /></div>}
      </section>

      <section className="reports-dashboard-grid">
        <article className="reports-panel">
          <div className="reports-panel-heading"><div><h2>{reportType} Analytics</h2><p>Top performance summary based on selected filters.</p></div><button className="reports-button secondary" style={{ width: 110 }} onClick={() => void loadReports()}>Refresh</button></div>
          <div className="reports-chart-box">
            {loading ? <div className="reports-loading">Reports load ho rahe hain...</div> : summaryRows.length ? summaryRows.map((row) => <div className="reports-bar-row" key={row.label}><div className="reports-bar-label" title={row.label}>{row.label}</div><div className="reports-bar-track"><div className="reports-bar-fill" style={{ width: `${Math.max(4, Math.round((row.recovery / maxSummaryRecovery) * 100))}%` }} /></div><div className="reports-bar-value">{formatCurrency(row.recovery)} · {row.cases}</div></div>) : <div className="reports-empty"><div><h3>No matching analytics data</h3><p>Filter ya date period change karke dekhein.</p></div></div>}
          </div>
        </article>

        <article className="reports-panel">
          <div className="reports-panel-heading"><div><h2>Report Summary</h2><p>Current filtered report ka quick summary.</p></div></div>
          <div className="reports-summary-list"><div className="reports-summary-card"><span>Selected Report</span><strong>{reportType}</strong></div><div className="reports-summary-card"><span>Selected Period</span><strong>{reportPeriod}</strong></div><div className="reports-summary-card"><span>Recovered Cases</span><strong>{recoveredCases}</strong></div><div className="reports-summary-card"><span>Total Portfolio</span><strong>{formatCurrency(totalPortfolio)}</strong></div><div className="reports-summary-card"><span>Available Records</span><strong>{filteredRecords.length}</strong></div></div>
        </article>
      </section>

      <section className="reports-panel">
        <div className="reports-panel-heading"><div><h2>Detailed Report Records</h2><p>Customer, bank, executive aur recovery amount ka live report.</p></div></div>
        <div className="reports-table-wrapper">
          {loading ? <div className="reports-loading">Database se records load ho rahe hain...</div> : filteredRecords.length ? <table className="reports-table"><thead><tr><th>Date</th><th>Customer</th><th>Case Number</th><th>Bank</th><th>Executive</th><th>Status</th><th>Loan Amount</th><th>Recovery Amount</th></tr></thead><tbody>{filteredRecords.map((record) => <tr key={record.id}><td>{formatDate(record.date)}</td><td><strong>{record.customerName}</strong></td><td>{record.caseNumber}</td><td>{record.bankName}</td><td>{record.executiveName}</td><td>{record.status}</td><td>{formatCurrency(record.loanAmount)}</td><td><strong>{formatCurrency(record.recoveryAmount)}</strong></td></tr>)}</tbody></table> : <div className="reports-empty"><div><h3>No report records found</h3><p>Supabase data, RLS policy ya selected filters check karein.</p></div></div>}
        </div>
      </section>
    </div>
  );
}

export default ReportsPage;