import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

type ExecutiveRow = {
  id: number;
  code: string | null;
  name: string | null;
  mobile: string | null;
  area: string | null;
  status: string | null;
  is_online?: boolean | null;
  last_seen?: string | null;
  created_at?: string | null;
};

type CaseRow = {
  id: number;
  assigned_executive_id: number | null;
  status: string | null;
  customer_name?: string | null;
  mobile?: string | null;
  area?: string | null;
  loan_amount?: number | null;
};

type ExecutiveCard = {
  id: number;
  code: string;
  name: string;
  mobile: string;
  area: string;
  status: string;
  appStatus: "Online" | "Offline";
  lastSeen: string;
  assignedCases: number;
  pendingCases: number;
  visitedCases: number;
  completedCases: number;
  completionPercent: number;
  cases: CaseRow[];
};

type AppFilter = "All" | "Online" | "Offline";
type WorkFilter = "All" | "With Cases" | "No Cases";

const PAGE_SIZE = 1000;
const AUTO_REFRESH_MS = 30_000;

function normalizeStatus(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function isCompletedStatus(value: string | null | undefined) {
  return ["completed", "paid", "closed", "settled"].includes(
    normalizeStatus(value)
  );
}

function isVisitedStatus(value: string | null | undefined) {
  return ["visited", "visit completed", "customer visited"].includes(
    normalizeStatus(value)
  );
}

function formatDateTime(value: string) {
  if (!value) return "Last seen data unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Last seen data unavailable";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(name: string) {
  const value = name.trim();
  if (!value) return "EX";

  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function money(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

function ExecutiveAppPage() {
  const [executives, setExecutives] = useState<ExecutiveCard[]>([]);
  const [search, setSearch] = useState("");
  const [appStatus, setAppStatus] = useState<AppFilter>("All");
  const [workFilter, setWorkFilter] = useState<WorkFilter>("All");
  const [selectedExecutiveId, setSelectedExecutiveId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchAllCases = useCallback(async () => {
    const rows: CaseRow[] = [];
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from("cases")
        .select("id,assigned_executive_id,status,customer_name,mobile,area,loan_amount")
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;

      const page = (data ?? []) as CaseRow[];
      rows.push(...page);

      if (page.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    return rows;
  }, []);

  const loadData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    setMessage("");

    try {
      const [executiveResult, cases] = await Promise.all([
        supabase.from("executives").select("*").order("created_at", { ascending: false }),
        fetchAllCases(),
      ]);

      if (executiveResult.error) throw executiveResult.error;

      const rows = (executiveResult.data ?? []) as ExecutiveRow[];
      const casesByExecutive = new Map<number, CaseRow[]>();

      for (const item of cases) {
        const executiveId = Number(item.assigned_executive_id);
        if (!Number.isFinite(executiveId)) continue;

        const current = casesByExecutive.get(executiveId) ?? [];
        current.push(item);
        casesByExecutive.set(executiveId, current);
      }

      const mapped: ExecutiveCard[] = rows.map((row) => {
        const assigned = casesByExecutive.get(Number(row.id)) ?? [];
        const completed = assigned.filter((item) => isCompletedStatus(item.status)).length;
        const visited = assigned.filter((item) => isVisitedStatus(item.status)).length;
        const pending = Math.max(0, assigned.length - completed);

        return {
          id: Number(row.id),
          code: row.code?.trim() || `EXE-${String(row.id).padStart(3, "0")}`,
          name: row.name?.trim() || "Unnamed Executive",
          mobile: row.mobile?.trim() || "Not available",
          area: row.area?.trim() || "Not assigned",
          status: row.status?.trim() || "Active",
          appStatus: row.is_online ? "Online" : "Offline",
          lastSeen: row.last_seen ?? "",
          assignedCases: assigned.length,
          pendingCases: pending,
          visitedCases: visited,
          completedCases: completed,
          completionPercent: assigned.length > 0 ? Math.round((completed / assigned.length) * 100) : 0,
          cases: assigned,
        };
      });

      mapped.sort((a, b) => {
        if (a.appStatus !== b.appStatus) return a.appStatus === "Online" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      setExecutives(mapped);
      setLastRefresh(new Date());
      setSelectedExecutiveId((current) =>
        current && mapped.some((item) => item.id === current) ? current : mapped[0]?.id ?? null
      );
    } catch (error) {
      console.error("Executive App load error:", error);
      setMessage(
        error instanceof Error
          ? `Executive App load error: ${error.message}`
          : "Executive App data load nahi hua."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchAllCases]);

  useEffect(() => {
    void loadData();

    const timer = window.setInterval(() => void loadData(true), AUTO_REFRESH_MS);

    const channel = supabase
      .channel("executive-app-admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "executives" }, () => void loadData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "cases" }, () => void loadData(true))
      .subscribe();

    return () => {
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [loadData]);

  const filteredExecutives = useMemo(() => {
    const query = search.trim().toLowerCase();

    return executives.filter((executive) => {
      const matchesSearch =
        !query ||
        executive.name.toLowerCase().includes(query) ||
        executive.code.toLowerCase().includes(query) ||
        executive.mobile.toLowerCase().includes(query) ||
        executive.area.toLowerCase().includes(query) ||
        executive.status.toLowerCase().includes(query);

      const matchesAppStatus = appStatus === "All" || executive.appStatus === appStatus;
      const matchesWork =
        workFilter === "All" ||
        (workFilter === "With Cases" && executive.assignedCases > 0) ||
        (workFilter === "No Cases" && executive.assignedCases === 0);

      return matchesSearch && matchesAppStatus && matchesWork;
    });
  }, [executives, search, appStatus, workFilter]);

  const selectedExecutive = useMemo(
    () => executives.find((executive) => executive.id === selectedExecutiveId) ?? null,
    [executives, selectedExecutiveId]
  );

  const onlineCount = executives.filter((item) => item.appStatus === "Online").length;
  const assignedCount = executives.reduce((sum, item) => sum + item.assignedCases, 0);
  const completedCount = executives.reduce((sum, item) => sum + item.completedCases, 0);
  const pendingCount = executives.reduce((sum, item) => sum + item.pendingCases, 0);

  return (
    <div className="executive-app-page">
      <style>{`
        .executive-app-page{min-height:100%;padding:26px;background:radial-gradient(circle at top right,rgba(37,99,235,.08),transparent 28%),#f5f7fb;color:#0f172a;box-sizing:border-box}.executive-app-page *{box-sizing:border-box}
        .executive-hero{position:relative;overflow:hidden;padding:30px;border-radius:22px;color:#fff;background:linear-gradient(135deg,rgba(255,255,255,.06),transparent),linear-gradient(135deg,#07192d 0%,#0d2f55 56%,#12497b 100%);box-shadow:0 18px 45px rgba(7,25,45,.18)}
        .executive-hero::after{content:"";position:absolute;width:240px;height:240px;top:-110px;right:-85px;border:34px solid rgba(255,255,255,.06);border-radius:50%}.executive-hero-row{position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap}
        .executive-kicker{color:#bfdbfe;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.executive-hero h1{margin:10px 0 0;font-size:clamp(28px,3vw,38px);line-height:1.1;letter-spacing:-.03em}.executive-hero p{max-width:680px;margin:12px 0 0;color:#dbeafe;font-size:15px;line-height:1.6}
        .executive-refresh{height:44px;padding:0 18px;border:1px solid rgba(255,255,255,.25);border-radius:11px;background:rgba(255,255,255,.1);color:#fff;font-weight:800;cursor:pointer}.executive-refresh:disabled{opacity:.7;cursor:wait}
        .executive-message{margin-top:16px;padding:13px 15px;border:1px solid #fecaca;border-radius:12px;background:#fef2f2;color:#b91c1c;font-size:13px;font-weight:700}
        .executive-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px;margin-top:20px}.executive-stat{padding:18px;border:1px solid #e2e8f0;border-radius:16px;background:#fff;box-shadow:0 8px 24px rgba(15,23,42,.05)}.executive-stat span{display:block;color:#64748b;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase}.executive-stat strong{display:block;margin-top:8px;font-size:26px;letter-spacing:-.03em}
        .executive-workspace{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(330px,.65fr);gap:20px;margin-top:20px}.executive-panel{padding:22px;border:1px solid #e2e8f0;border-radius:20px;background:#fff;box-shadow:0 12px 35px rgba(15,23,42,.07)}.executive-panel-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:18px}.executive-panel-head h2{margin:0;font-size:19px}.executive-panel-head p{margin:5px 0 0;color:#64748b;font-size:13px}
        .executive-filter-grid{display:grid;grid-template-columns:minmax(220px,1fr) minmax(150px,220px) minmax(150px,220px);gap:12px}.executive-control{width:100%;height:46px;padding:0 13px;border:1px solid #cbd5e1;border-radius:11px;background:#fff;color:#0f172a;font-size:13px;outline:none}.executive-control:focus{border-color:#2563eb;box-shadow:0 0 0 4px rgba(37,99,235,.1)}
        .executive-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-top:18px}.executive-card{width:100%;padding:18px;border:1px solid #e2e8f0;border-radius:16px;background:#fff;box-shadow:0 8px 24px rgba(15,23,42,.05);text-align:left;cursor:pointer;transition:.18s ease}.executive-card:hover,.executive-card.selected{border-color:#93c5fd;box-shadow:0 10px 28px rgba(37,99,235,.12);transform:translateY(-1px)}
        .executive-card-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.executive-profile{display:flex;gap:11px;min-width:0}.executive-avatar{width:44px;height:44px;display:grid;place-items:center;flex:0 0 auto;border-radius:13px;background:#eff6ff;color:#1d4ed8;font-size:13px;font-weight:900}.executive-profile strong{display:block;color:#0f172a;font-size:15px}.executive-profile small{display:block;margin-top:4px;color:#64748b;font-size:11px;overflow-wrap:anywhere}
        .executive-status{padding:6px 9px;border-radius:999px;font-size:10px;font-weight:850;white-space:nowrap}.executive-status.online{color:#047857;background:#ecfdf5}.executive-status.offline{color:#64748b;background:#f1f5f9}.executive-mobile{margin-top:14px;color:#475569;font-size:13px}
        .executive-card-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:16px;padding-top:14px;border-top:1px solid #e2e8f0}.executive-card-metrics span{display:block;color:#64748b;font-size:9px;font-weight:800;text-transform:uppercase}.executive-card-metrics strong{display:block;margin-top:4px;font-size:18px}.executive-progress{height:7px;margin-top:14px;overflow:hidden;border-radius:999px;background:#e2e8f0}.executive-progress>div{height:100%;border-radius:inherit;background:linear-gradient(90deg,#2563eb,#0ea5e9)}.executive-progress-text{display:flex;justify-content:space-between;gap:10px;margin-top:6px;color:#64748b;font-size:10px;font-weight:700}.executive-last-seen{margin-top:12px;color:#64748b;font-size:11px}
        .executive-detail-profile{display:flex;align-items:center;gap:13px;padding-bottom:18px;border-bottom:1px solid #e2e8f0}.executive-detail-avatar{width:58px;height:58px;display:grid;place-items:center;flex:0 0 auto;border-radius:17px;background:#eff6ff;color:#1d4ed8;font-size:17px;font-weight:900}.executive-detail-profile h3{margin:0;font-size:18px}.executive-detail-profile p{margin:6px 0 0;color:#64748b;font-size:12px}.executive-detail-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:16px}.executive-detail-box{padding:13px;border:1px solid #e2e8f0;border-radius:13px;background:#f8fafc}.executive-detail-box span{display:block;color:#94a3b8;font-size:9px;font-weight:900;text-transform:uppercase}.executive-detail-box strong{display:block;margin-top:5px;color:#334155;font-size:13px;overflow-wrap:anywhere}
        .executive-case-list{display:flex;flex-direction:column;gap:9px;max-height:390px;margin-top:16px;overflow-y:auto}.executive-case-row{padding:12px;border:1px solid #e2e8f0;border-radius:12px;background:#fff}.executive-case-row-top{display:flex;justify-content:space-between;gap:10px}.executive-case-row strong{font-size:12px}.executive-case-row span{color:#64748b;font-size:10px}.executive-case-row p{margin:7px 0 0;color:#475569;font-size:11px;line-height:1.5}.executive-empty,.executive-loading{padding:42px 15px;color:#64748b;text-align:center;font-size:13px;font-weight:700}
        @media(max-width:1180px){.executive-stats{grid-template-columns:repeat(3,1fr)}.executive-workspace{grid-template-columns:1fr}}@media(max-width:760px){.executive-app-page{padding:14px}.executive-stats{grid-template-columns:repeat(2,1fr)}.executive-filter-grid{grid-template-columns:1fr}.executive-panel-head{align-items:flex-start;flex-direction:column}}@media(max-width:480px){.executive-stats{grid-template-columns:1fr}.executive-card-metrics,.executive-detail-grid{grid-template-columns:1fr}}
      `}</style>

      <section className="executive-hero">
        <div className="executive-hero-row">
          <div>
            <div className="executive-kicker">Field Executive Command Center</div>
            <h1>Executive Mobile App</h1>
            <p>Executive availability, assigned work aur case completion ko Supabase se live monitor karein.</p>
          </div>

          <button className="executive-refresh" type="button" disabled={refreshing || loading} onClick={() => void loadData(true)}>
            {refreshing || loading ? "Refreshing..." : "Refresh Data"}
          </button>
        </div>
      </section>

      {message ? <div className="executive-message">{message}</div> : null}

      <section className="executive-stats">
        {[
          ["Total Executives", executives.length],
          ["Online", onlineCount],
          ["Assigned Cases", assignedCount],
          ["Pending Cases", pendingCount],
          ["Completed Cases", completedCount],
        ].map(([label, value]) => (
          <article className="executive-stat" key={String(label)}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="executive-workspace">
        <article className="executive-panel">
          <div className="executive-panel-head">
            <div>
              <h2>Executive App Status</h2>
              <p>{lastRefresh ? `Last refresh: ${lastRefresh.toLocaleTimeString("en-IN")}` : "Live data loading..."}</p>
            </div>
            <strong>{filteredExecutives.length} results</strong>
          </div>

          <div className="executive-filter-grid">
            <input className="executive-control" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search executive, code, mobile or area..." />
            <select className="executive-control" value={appStatus} onChange={(event) => setAppStatus(event.target.value as AppFilter)}>
              <option value="All">All App Status</option><option value="Online">Online</option><option value="Offline">Offline</option>
            </select>
            <select className="executive-control" value={workFilter} onChange={(event) => setWorkFilter(event.target.value as WorkFilter)}>
              <option value="All">All Work Status</option><option value="With Cases">With Cases</option><option value="No Cases">No Cases</option>
            </select>
          </div>

          {loading ? <div className="executive-loading">Executives load ho rahe hain...</div> : (
            <div className="executive-grid">
              {filteredExecutives.map((executive) => (
                <button key={executive.id} type="button" className={`executive-card ${selectedExecutiveId === executive.id ? "selected" : ""}`} onClick={() => setSelectedExecutiveId(executive.id)}>
                  <div className="executive-card-top">
                    <div className="executive-profile"><div className="executive-avatar">{initials(executive.name)}</div><div><strong>{executive.name}</strong><small>{executive.code} · {executive.area}</small></div></div>
                    <span className={`executive-status ${executive.appStatus === "Online" ? "online" : "offline"}`}>{executive.appStatus}</span>
                  </div>
                  <div className="executive-mobile">Mobile: <strong>{executive.mobile}</strong></div>
                  <div className="executive-card-metrics"><div><span>Assigned</span><strong>{executive.assignedCases}</strong></div><div><span>Pending</span><strong>{executive.pendingCases}</strong></div><div><span>Completed</span><strong>{executive.completedCases}</strong></div></div>
                  <div className="executive-progress"><div style={{ width: `${executive.completionPercent}%` }} /></div>
                  <div className="executive-progress-text"><span>Completion</span><span>{executive.completionPercent}%</span></div>
                  <div className="executive-last-seen">{executive.lastSeen ? `Last seen: ${formatDateTime(executive.lastSeen)}` : "Last seen data unavailable"}</div>
                </button>
              ))}
              {filteredExecutives.length === 0 ? <div className="executive-empty">No matching executives found.</div> : null}
            </div>
          )}
        </article>

        <aside className="executive-panel">
          <div className="executive-panel-head"><div><h2>Executive Details</h2><p>Selected executive ka current workload.</p></div></div>
          {selectedExecutive ? (
            <>
              <div className="executive-detail-profile"><div className="executive-detail-avatar">{initials(selectedExecutive.name)}</div><div><h3>{selectedExecutive.name}</h3><p>{selectedExecutive.code} · {selectedExecutive.area}</p></div></div>
              <div className="executive-detail-grid">
                <div className="executive-detail-box"><span>Mobile</span><strong>{selectedExecutive.mobile}</strong></div>
                <div className="executive-detail-box"><span>App Status</span><strong>{selectedExecutive.appStatus}</strong></div>
                <div className="executive-detail-box"><span>Executive Status</span><strong>{selectedExecutive.status}</strong></div>
                <div className="executive-detail-box"><span>Completion</span><strong>{selectedExecutive.completionPercent}%</strong></div>
                <div className="executive-detail-box"><span>Visited</span><strong>{selectedExecutive.visitedCases}</strong></div>
                <div className="executive-detail-box"><span>Last Seen</span><strong>{formatDateTime(selectedExecutive.lastSeen)}</strong></div>
              </div>
              <div className="executive-case-list">
                {selectedExecutive.cases.slice(0, 30).map((item) => (
                  <div className="executive-case-row" key={item.id}>
                    <div className="executive-case-row-top"><strong>{item.customer_name?.trim() || `Case #${item.id}`}</strong><span>{item.status || "Pending"}</span></div>
                    <p>{item.mobile || "No mobile"} · {item.area || selectedExecutive.area}<br />Loan: {money(item.loan_amount)}</p>
                  </div>
                ))}
                {selectedExecutive.cases.length === 0 ? <div className="executive-empty">Is executive ko abhi koi case assigned nahi hai.</div> : null}
              </div>
            </>
          ) : <div className="executive-empty">Executive select karne ke baad details yahan dikhengi.</div>}
        </aside>
      </section>
    </div>
  );
}

export default ExecutiveAppPage;