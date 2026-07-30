import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

type CaseStatus = "Pending" | "Visited" | "Paid" | "Overdue";

type SupabaseCase = {
  id: number;
  case_no?: string | null;
  case_number?: string | null;
  account_no?: string | null;
  customer_name?: string | null;
  customer?: string | null;
  phone?: string | null;
  mobile?: string | null;
  bank_name?: string | null;
  bank?: string | null;
  area?: string | null;
  assigned_executive?: string | null;
  assigned_agent?: number | string | null;
  executive_id?: number | string | null;
  executive?: string | null;
  loan_amount?: number | string | null;
  outstanding_amount?: number | string | null;
  amount?: number | string | null;
  status?: string | null;
};

type ProfileRow = {
  id: number | string;
  executive_code?: string | null;
  name?: string | null;
  full_name?: string | null;
  executive_name?: string | null;
  area?: string | null;
  status?: string | null;
};

type CaseItem = {
  id: number;
  accountNo: string;
  customer: string;
  mobile: string;
  bank: string;
  area: string;
  executiveCode: string;
  executive: string;
  amount: number;
  status: CaseStatus;
};

type EditForm = {
  customer: string;
  mobile: string;
  bank: string;
  area: string;
  executiveCode: string;
  amount: string;
  status: CaseStatus;
};

const statusOptions: Array<CaseStatus | "All"> = [
  "All",
  "Pending",
  "Visited",
  "Paid",
  "Overdue",
];

const PAGE_SIZE = 100;
const FETCH_BATCH_SIZE = 1000;

function normalizeStatus(value: unknown): CaseStatus {
  const text = String(value ?? "Pending").trim().toLowerCase();
  if (text === "visited") return "Visited";
  if (text === "paid") return "Paid";
  if (text === "overdue") return "Overdue";
  return "Pending";
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function CasesPage() {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [executives, setExecutives] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CaseStatus | "All">("All");
  const [area, setArea] = useState("All");
  const [page, setPage] = useState(1);

  const [viewCase, setViewCase] = useState<CaseItem | null>(null);
  const [editCase, setEditCase] = useState<CaseItem | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    customer: "",
    mobile: "",
    bank: "",
    area: "",
    executiveCode: "",
    amount: "",
    status: "Pending",
  });

  // Map for display names (Strict single executive_code standard)
  const executiveNameMap = useMemo(() => {
    const map = new Map<string, string>();
    executives.forEach((item) => {
      const name =
        item.full_name?.trim() ||
        item.name?.trim() ||
        item.executive_name?.trim() ||
        "Unknown Executive";

      const code = item.executive_code?.trim() || "";
      if (code) {
        map.set(code.toLowerCase(), `${code} - ${name}`);
        map.set(String(item.id), `${code} - ${name}`);
      }
    });
    return map;
  }, [executives]);

  async function loadExecutives() {
    const { data, error: executiveError } = await supabase
      .from("profiles")
      .select("*")
      .order("id", { ascending: true });

    if (executiveError) throw executiveError;

    const profileRows = (data ?? []) as ProfileRow[];
    const executiveRows = profileRows.filter((item) => {
      const role = String((item as ProfileRow & { role?: string | null }).role ?? "")
        .trim()
        .toLowerCase();

      return Boolean(item.executive_code?.trim()) || role === "executive" || role === "agent";
    });

    setExecutives(executiveRows);
    return executiveRows;
  }

  async function loadAllCases(executiveRows?: ProfileRow[]) {
    const rows: SupabaseCase[] = [];
    let from = 0;

    while (true) {
      const { data, error: caseError } = await supabase
        .from("cases")
        .select("*")
        .order("id", { ascending: false })
        .range(from, from + FETCH_BATCH_SIZE - 1);

      if (caseError) throw caseError;

      const batch = (data ?? []) as SupabaseCase[];
      rows.push(...batch);

      if (batch.length < FETCH_BATCH_SIZE) break;
      from += FETCH_BATCH_SIZE;
    }

    const activeExecutives = executiveRows ?? executives;
    const nameMap = new Map<string, string>();
    activeExecutives.forEach((item) => {
      const name = item.full_name?.trim() || item.name?.trim() || "Unknown Executive";
      const code = item.executive_code?.trim() || "";
      if (code) {
        nameMap.set(code.toLowerCase(), `${code} ${name}`);
        nameMap.set(String(item.id), `${code} ${name}`);
      }
    });

    const mapped: CaseItem[] = rows.map((item) => {
      const assigned = item.assigned_executive ?? item.assigned_agent ?? item.executive_id ?? "";
      const assignedKey = String(assigned ?? "").trim();
      const directExecutive = item.executive?.trim() || "";

      return {
        id: Number(item.id),
        accountNo: String(item.case_no ?? item.case_number ?? item.account_no ?? "-"),
        customer: String(item.customer_name ?? item.customer ?? "Unknown"),
        mobile: String(item.phone ?? item.mobile ?? "-"),
        bank: String(item.bank_name ?? item.bank ?? "-"),
        area: String(item.area ?? "Unassigned"),
        executiveCode: assignedKey,
        executive:
          directExecutive ||
          (assignedKey ? nameMap.get(assignedKey.toLowerCase()) || nameMap.get(assignedKey) || assignedKey : "Unassigned"),
        amount: toNumber(
          item.loan_amount ?? item.outstanding_amount ?? item.amount ?? 0
        ),
        status: normalizeStatus(item.status),
      };
    });

    setCases(mapped);
  }

  async function refreshData() {
    setLoading(true);
    setError("");

    try {
      const executiveRows = await loadExecutives();
      await loadAllCases(executiveRows);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Cases load nahi ho paaye.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshData();

    const channel = supabase
      .channel("cases-page-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cases" },
        () => void refreshData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => void refreshData()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, status, area]);

  const areas = useMemo(() => {
    return [
      "All",
      ...Array.from(
        new Set(
          cases
            .map((item) => item.area.trim())
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b))
        )
      ),
    ];
  }, [cases]);

  const filteredCases = useMemo(() => {
    const query = search.trim().toLowerCase();

    return cases.filter((item) => {
      const matchesSearch =
        !query ||
        item.customer.toLowerCase().includes(query) ||
        item.accountNo.toLowerCase().includes(query) ||
        item.mobile.toLowerCase().includes(query) ||
        item.executive.toLowerCase().includes(query) ||
        item.bank.toLowerCase().includes(query) ||
        item.area.toLowerCase().includes(query);

      const matchesStatus = status === "All" || item.status === status;
      const matchesArea = area === "All" || item.area === area;

      return matchesSearch && matchesStatus && matchesArea;
    });
  }, [cases, search, status, area]);

  const totalPages = Math.max(1, Math.ceil(filteredCases.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageCases = filteredCases.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const totalAmount = filteredCases.reduce((sum, item) => sum + item.amount, 0);
  const pendingCount = filteredCases.filter((item) => item.status === "Pending").length;
  const visitedCount = filteredCases.filter((item) => item.status === "Visited").length;
  const paidCount = filteredCases.filter((item) => item.status === "Paid").length;

  function openEdit(item: CaseItem) {
    setEditCase(item);
    setEditForm({
      customer: item.customer,
      mobile: item.mobile === "-" ? "" : item.mobile,
      bank: item.bank === "-" ? "" : item.bank,
      area: item.area === "Unassigned" ? "" : item.area,
      executiveCode: item.executiveCode,
      amount: String(item.amount),
      status: item.status,
    });
    setError("");
    setSuccess("");
  }

  async function saveCase() {
    if (!editCase) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const execCode = editForm.executiveCode.trim() || null;

      const payload = {
        customer_name: editForm.customer.trim(),
        phone: editForm.mobile.trim() || null,
        mobile: editForm.mobile.trim() || null,
        bank_name: editForm.bank.trim() || null,
        area: editForm.area.trim() || null,
        assigned_executive: execCode,
        assigned_agent: execCode,
        loan_amount: toNumber(editForm.amount),
        status: editForm.status,
      };

      const { error: updateError } = await supabase
        .from("cases")
        .update(payload)
        .eq("id", editCase.id);

      if (updateError) throw updateError;

      const executiveName = execCode
        ? executiveNameMap.get(execCode.toLowerCase()) || execCode
        : "Unassigned";

      setCases((current) =>
        current.map((item) =>
          item.id === editCase.id
            ? {
                ...item,
                customer: payload.customer_name || "Unknown",
                mobile: payload.phone || "-",
                bank: payload.bank_name || "-",
                area: payload.area || "Unassigned",
                executiveCode: execCode || "",
                executive: executiveName,
                amount: payload.loan_amount,
                status: payload.status,
              }
            : item
        )
      );

      setSuccess("Case successfully update ho gaya.");
      setEditCase(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Case update nahi ho paaya.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cases-page">
      <style>{`
        .cases-page{min-height:100%;padding:26px;background:radial-gradient(circle at top right,rgba(37,99,235,.08),transparent 28%),#f5f7fb;color:#0f172a;box-sizing:border-box}.cases-page *{box-sizing:border-box}
        .cases-hero{position:relative;display:flex;align-items:center;justify-content:space-between;gap:20px;overflow:hidden;padding:28px;border-radius:22px;color:#fff;background:linear-gradient(135deg,rgba(255,255,255,.06),transparent),linear-gradient(135deg,#07192d 0%,#0d2f55 56%,#12497b 100%);box-shadow:0 18px 45px rgba(7,25,45,.18)}
        .cases-hero::after{content:"";position:absolute;top:-90px;right:-70px;width:220px;height:220px;border:32px solid rgba(255,255,255,.06);border-radius:999px}.cases-kicker{display:inline-flex;align-items:center;gap:8px;margin-bottom:9px;color:#bfdbfe;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.cases-hero h1{margin:0;font-size:clamp(27px,3vw,38px);line-height:1.08;letter-spacing:-.03em}.cases-hero p{max-width:720px;margin:12px 0 0;color:#dbeafe;font-size:15px;line-height:1.65}.cases-hero-badge{position:relative;z-index:1;min-width:170px;padding:16px 18px;border:1px solid rgba(255,255,255,.18);border-radius:16px;background:rgba(255,255,255,.08);backdrop-filter:blur(8px)}.cases-hero-badge span{display:block;color:#bfdbfe;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.cases-hero-badge strong{display:block;margin-top:6px;font-size:20px}
        .cases-alert{margin-top:16px;padding:13px 15px;border-radius:12px;font-size:13px;font-weight:700}.cases-alert.error{color:#b91c1c;background:#fef2f2;border:1px solid #fecaca}.cases-alert.success{color:#047857;background:#ecfdf5;border:1px solid #a7f3d0}
        .cases-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:15px;margin-top:20px}.cases-stat{padding:18px;border:1px solid #e2e8f0;border-radius:18px;background:#fff;box-shadow:0 10px 30px rgba(15,23,42,.06)}.cases-stat span{display:block;color:#64748b;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase}.cases-stat strong{display:block;margin-top:7px;font-size:25px;letter-spacing:-.03em}
        .cases-panel{margin-top:20px;padding:22px;border:1px solid #e2e8f0;border-radius:20px;background:#fff;box-shadow:0 12px 35px rgba(15,23,42,.07)}.cases-panel-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:18px}.cases-panel-head h2{margin:0;font-size:19px;letter-spacing:-.02em}.cases-panel-head p{margin:5px 0 0;color:#64748b;font-size:13px}.cases-count-badge{display:inline-flex;align-items:center;padding:8px 11px;border-radius:999px;color:#1d4ed8;background:#eff6ff;font-size:12px;font-weight:800;white-space:nowrap}
        .cases-filter-grid{display:grid;grid-template-columns:minmax(250px,1.5fr) repeat(2,minmax(170px,.6fr));gap:14px}.cases-field{display:flex;flex-direction:column;gap:8px}.cases-field label{color:#334155;font-size:12px;font-weight:800}.cases-input,.cases-select{width:100%;height:48px;padding:0 14px;border:1px solid #cbd5e1;border-radius:13px;background:#fff;color:#0f172a;font-size:14px;outline:none;transition:.2s ease}.cases-input:focus,.cases-select:focus{border-color:#2563eb;box-shadow:0 0 0 4px rgba(37,99,235,.11)}
        .cases-table-wrap{width:100%;max-height:600px;overflow:auto;border:1px solid #e2e8f0;border-radius:15px}.cases-table{width:100%;min-width:1120px;border-collapse:separate;border-spacing:0;background:#fff;font-size:13px}.cases-table th{position:sticky;top:0;z-index:2;padding:13px 14px;border-bottom:1px solid #e2e8f0;background:#f8fafc;color:#475569;text-align:left;font-size:11px;font-weight:850;letter-spacing:.045em;text-transform:uppercase;white-space:nowrap}.cases-table td{padding:14px;border-bottom:1px solid #eef2f7;color:#334155;vertical-align:middle}.cases-table tbody tr:hover td{background:#fbfdff}.case-customer{min-width:190px}.case-customer strong{display:block;color:#0f172a;font-size:13px}.case-customer span{display:block;margin-top:4px;color:#64748b;font-size:12px}.case-account{color:#0f172a;font-weight:800;font-variant-numeric:tabular-nums}.case-money{color:#0f172a;font-weight:850;white-space:nowrap}
        .case-status{display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;font-size:11px;font-weight:850;white-space:nowrap}.case-status.pending{color:#b45309;background:#fffbeb}.case-status.visited{color:#1d4ed8;background:#eff6ff}.case-status.paid{color:#047857;background:#ecfdf5}.case-status.overdue{color:#b91c1c;background:#fef2f2}.case-actions{display:flex;gap:7px}.case-action-btn{min-height:34px;padding:0 10px;border:1px solid #cbd5e1;border-radius:999px;background:#fff;color:#334155;font-size:11px;font-weight:800;cursor:pointer}.case-action-btn.primary{border-color:#bfdbfe;background:#eff6ff;color:#1d4ed8}.case-action-btn:disabled{opacity:.55;cursor:not-allowed}.cases-empty{padding:45px 20px;color:#64748b;text-align:center}
        .cases-pagination{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:16px}.cases-pagination-info{color:#64748b;font-size:13px}.cases-pagination-buttons{display:flex;align-items:center;gap:8px}.cases-pagination button{height:36px;padding:0 13px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;color:#334155;font-weight:800;cursor:pointer}.cases-pagination button:disabled{opacity:.45;cursor:not-allowed}
        .cases-modal-backdrop{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(2,6,23,.58)}.cases-modal{width:min(720px,100%);max-height:92vh;overflow:auto;padding:22px;border-radius:20px;background:#fff;box-shadow:0 30px 80px rgba(2,6,23,.35)}.cases-modal-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px}.cases-modal-head h3{margin:0}.cases-close{border:0;background:#f1f5f9;width:36px;height:36px;border-radius:9px;cursor:pointer;font-size:18px}.cases-detail-grid,.cases-edit-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.cases-detail{padding:13px;border:1px solid #e2e8f0;border-radius:12px}.cases-detail span{display:block;color:#64748b;font-size:11px;font-weight:800;text-transform:uppercase}.cases-detail strong{display:block;margin-top:6px;color:#0f172a}.cases-modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}.cases-modal-actions button{height:42px;padding:0 16px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;font-weight:800;cursor:pointer}.cases-modal-actions .save{border-color:#2563eb;background:#2563eb;color:#fff}
        @media(max-width:1050px){.cases-stats{grid-template-columns:repeat(2,1fr)}.cases-filter-grid{grid-template-columns:1fr}}@media(max-width:720px){.cases-page{padding:14px}.cases-hero,.cases-panel-head,.cases-pagination{align-items:flex-start;flex-direction:column}.cases-hero-badge{width:100%}.cases-detail-grid,.cases-edit-grid{grid-template-columns:1fr}}@media(max-width:480px){.cases-stats{grid-template-columns:1fr}}
      `}</style>

      <section className="cases-hero">
        <div>
          <div className="cases-kicker"><span>◆</span>Powered by Akyos</div>
          <h1>Recovery Cases V2</h1>
          <p>Customer cases ko search, filter, monitor aur executive-wise manage karein.</p>
        </div>
        <div className="cases-hero-badge">
          <span>Total Records</span>
          <strong>{loading ? "..." : cases.length.toLocaleString("en-IN")}</strong>
        </div>
      </section>

      {error && <div className="cases-alert error">{error}</div>}
      {success && <div className="cases-alert success">{success}</div>}

      <section className="cases-stats">
        <article className="cases-stat"><span>Visible Cases</span><strong>{filteredCases.length.toLocaleString("en-IN")}</strong></article>
        <article className="cases-stat"><span>Pending</span><strong>{pendingCount.toLocaleString("en-IN")}</strong></article>
        <article className="cases-stat"><span>Visited / Paid</span><strong>{(visitedCount + paidCount).toLocaleString("en-IN")}</strong></article>
        <article className="cases-stat"><span>Total Outstanding</span><strong>₹{totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</strong></article>
      </section>

      <section className="cases-panel">
        <div className="cases-panel-head">
          <div><h2>Search & Filters</h2><p>Account number, customer, mobile, bank, area ya executive se search karein.</p></div>
          <span className="cases-count-badge">{filteredCases.length.toLocaleString("en-IN")} results</span>
        </div>
        <div className="cases-filter-grid">
          <div className="cases-field"><label htmlFor="case-search">Search Case</label><input id="case-search" className="cases-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer, account, mobile..." /></div>
          <div className="cases-field"><label htmlFor="case-status">Status</label><select id="case-status" className="cases-select" value={status} onChange={(event) => setStatus(event.target.value as CaseStatus | "All")}>{statusOptions.map((item) => <option key={item}>{item}</option>)}</select></div>
          <div className="cases-field"><label htmlFor="case-area">Market / Area</label><select id="case-area" className="cases-select" value={area} onChange={(event) => setArea(event.target.value)}>{areas.map((item) => <option key={item}>{item}</option>)}</select></div>
        </div>
      </section>

      <section className="cases-panel">
        <div className="cases-panel-head"><div><h2>All Recovery Cases</h2><p>Case details, executive assignment aur current recovery status.</p></div><button className="case-action-btn primary" onClick={() => void refreshData()} disabled={loading}>{loading ? "Loading..." : "Refresh"}</button></div>
        <div className="cases-table-wrap">
          <table className="cases-table">
            <thead><tr><th>Account No.</th><th>Customer</th><th>Bank</th><th>Market</th><th>Executive</th><th>Outstanding</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={8}><div className="cases-empty">Cases load ho rahe hain...</div></td></tr> : pageCases.length > 0 ? pageCases.map((item) => (
                <tr key={item.id}>
                  <td><span className="case-account">{item.accountNo}</span></td>
                  <td><div className="case-customer"><strong>{item.customer}</strong><span>{item.mobile}</span></div></td>
                  <td>{item.bank}</td><td>{item.area}</td><td>{item.executive}</td>
                  <td><span className="case-money">₹{item.amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span></td>
                  <td><span className={`case-status ${item.status.toLowerCase()}`}>{item.status}</span></td>
                  <td><div className="case-actions"><button className="case-action-btn primary" onClick={() => setViewCase(item)}>View</button><button className="case-action-btn" onClick={() => openEdit(item)}>Edit</button></div></td>
                </tr>
              )) : <tr><td colSpan={8}><div className="cases-empty">No matching cases found.</div></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="cases-pagination">
          <div className="cases-pagination-info">Page {safePage} of {totalPages} · Showing {pageCases.length} records</div>
          <div className="cases-pagination-buttons"><button disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button><button disabled={safePage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button></div>
        </div>
      </section>

      {viewCase && <div className="cases-modal-backdrop" onMouseDown={() => setViewCase(null)}><div className="cases-modal" onMouseDown={(event) => event.stopPropagation()}><div className="cases-modal-head"><h3>Case Details</h3><button className="cases-close" onClick={() => setViewCase(null)}>×</button></div><div className="cases-detail-grid"><div className="cases-detail"><span>Account Number</span><strong>{viewCase.accountNo}</strong></div><div className="cases-detail"><span>Customer</span><strong>{viewCase.customer}</strong></div><div className="cases-detail"><span>Mobile</span><strong>{viewCase.mobile}</strong></div><div className="cases-detail"><span>Bank</span><strong>{viewCase.bank}</strong></div><div className="cases-detail"><span>Area</span><strong>{viewCase.area}</strong></div><div className="cases-detail"><span>Executive</span><strong>{viewCase.executive}</strong></div><div className="cases-detail"><span>Outstanding</span><strong>₹{viewCase.amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong></div><div className="cases-detail"><span>Status</span><strong>{viewCase.status}</strong></div></div></div></div>}

      {editCase && <div className="cases-modal-backdrop" onMouseDown={() => !saving && setEditCase(null)}><div className="cases-modal" onMouseDown={(event) => event.stopPropagation()}><div className="cases-modal-head"><h3>Edit Case</h3><button className="cases-close" disabled={saving} onClick={() => setEditCase(null)}>×</button></div><div className="cases-edit-grid">
        <div className="cases-field"><label>Customer Name</label><input className="cases-input" value={editForm.customer} onChange={(event) => setEditForm((current) => ({ ...current, customer: event.target.value }))} /></div>
        <div className="cases-field"><label>Mobile</label><input className="cases-input" value={editForm.mobile} onChange={(event) => setEditForm((current) => ({ ...current, mobile: event.target.value }))} /></div>
        <div className="cases-field"><label>Bank</label><input className="cases-input" value={editForm.bank} onChange={(event) => setEditForm((current) => ({ ...current, bank: event.target.value }))} /></div>
        <div className="cases-field"><label>Area</label><input className="cases-input" value={editForm.area} onChange={(event) => setEditForm((current) => ({ ...current, area: event.target.value }))} /></div>
        <div className="cases-field"><label>Assigned Executive</label><select className="cases-select" value={editForm.executiveCode} onChange={(event) => setEditForm((current) => ({ ...current, executiveCode: event.target.value }))}><option value="">Unassigned</option>{executives.map((item) => { const code = item.executive_code || ""; if (!code) return null; return <option key={String(item.id)} value={code}>{code} - {item.full_name || item.name || "Unknown Executive"}</option>; })}</select></div>
        <div className="cases-field"><label>Outstanding Amount</label><input type="number" min="0" step="0.01" className="cases-input" value={editForm.amount} onChange={(event) => setEditForm((current) => ({ ...current, amount: event.target.value }))} /></div>
        <div className="cases-field"><label>Status</label><select className="cases-select" value={editForm.status} onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as CaseStatus }))}>{statusOptions.filter((item) => item !== "All").map((item) => <option key={item}>{item}</option>)}</select></div>
      </div><div className="cases-modal-actions"><button disabled={saving} onClick={() => setEditCase(null)}>Cancel</button><button className="save" disabled={saving || !editForm.customer.trim()} onClick={() => void saveCase()}>{saving ? "Saving..." : "Save Changes"}</button></div></div></div>}
    </div>
  );
}

export default CasesPage;