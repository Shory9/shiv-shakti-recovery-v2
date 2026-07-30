import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

type RawRow = Record<string, unknown>;

type ExecutiveCard = {
  id: string;
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
  cases: RawRow[];
};

type AppFilter = "All" | "Online" | "Offline";
type WorkFilter = "All" | "With Cases" | "No Cases";

const PAGE_SIZE = 1000;
const AUTO_REFRESH_MS = 30_000;

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function first(row: RawRow, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = text(row[key]);
    if (value) return value;
  }
  return fallback;
}

function normalizeStatus(value: unknown): string {
  return text(value).toLowerCase();
}

function isCompleted(value: unknown): boolean {
  return ["completed", "paid", "closed", "settled", "recovered"].includes(
    normalizeStatus(value)
  );
}

function isVisited(value: unknown): boolean {
  return ["visited", "visit completed", "customer visited"].includes(
    normalizeStatus(value)
  );
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "EX"
  );
}

function formatDateTime(value: string): string {
  if (!value) return "Unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return date.toLocaleString("en-IN");
}

async function fetchAll(table: "profiles" | "cases" | "case_operations") {
  const rows: RawRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    const page = (data ?? []) as RawRow[];
    rows.push(...page);

    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

function ExecutiveAppPage() {
  const [executives, setExecutives] = useState<ExecutiveCard[]>([]);
  const [search, setSearch] = useState("");
  const [appFilter, setAppFilter] = useState<AppFilter>("All");
  const [workFilter, setWorkFilter] = useState<WorkFilter>("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadData = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    setMessage("");

    try {
      const [profileRows, caseRows, operationRows] = await Promise.all([
        fetchAll("profiles"),
        fetchAll("cases"),
        fetchAll("case_operations"),
      ]);

      const executiveProfiles = profileRows.filter((row) => {
        const role = first(row, ["role", "user_role"]).toLowerCase();
        return role === "executive" || role === "field_executive";
      });

      const caseById = new Map<string, RawRow>();
      caseRows.forEach((row) => {
        const id = first(row, ["id", "case_id"]);
        if (id) caseById.set(id, row);
      });

      const operationsByExecutive = new Map<string, RawRow[]>();

      operationRows.forEach((operation) => {
        const executiveId = first(operation, [
          "assigned_executive_id",
          "executive_id",
          "assigned_to",
          "profile_id",
        ]);

        if (!executiveId) return;

        const current = operationsByExecutive.get(executiveId) ?? [];
        current.push(operation);
        operationsByExecutive.set(executiveId, current);
      });

      const mapped: ExecutiveCard[] = executiveProfiles.map((profile) => {
        const id = first(profile, ["id"]);
        const operations = operationsByExecutive.get(id) ?? [];

        const cases = operations
          .map((operation) => {
            const caseId = first(operation, ["case_id"]);
            const caseRow = caseById.get(caseId) ?? {};
            return { ...caseRow, __operation: operation };
          })
          .filter((row) => Object.keys(row).length > 1);

        let completedCases = 0;
        let visitedCases = 0;

        operations.forEach((operation) => {
          const status = first(operation, ["status", "case_status", "work_status"]);
          if (isCompleted(status)) completedCases += 1;
          if (isVisited(status)) visitedCases += 1;
        });

        const assignedCases = operations.length;
        const pendingCases = Math.max(0, assignedCases - completedCases);

        const isOnline =
          profile.is_online === true ||
          first(profile, ["app_status", "online_status"]).toLowerCase() === "online";

        return {
          id,
          code: first(profile, ["executive_code", "employee_code", "code"], "-"),
          name: first(profile, ["full_name", "name"], "Unnamed Executive"),
          mobile: first(profile, ["phone", "mobile", "mobile_no"], "Not available"),
          area: first(profile, ["area", "city", "branch"], "Not assigned"),
          status: first(profile, ["status"], profile.is_active === false ? "Inactive" : "Active"),
          appStatus: isOnline ? "Online" : "Offline",
          lastSeen: first(profile, ["last_seen", "updated_at"]),
          assignedCases,
          pendingCases,
          visitedCases,
          completedCases,
          completionPercent:
            assignedCases > 0 ? Math.round((completedCases / assignedCases) * 100) : 0,
          cases,
        };
      });

      mapped.sort((a, b) => a.name.localeCompare(b.name));

      setExecutives(mapped);
      setSelectedId((current) =>
        current && mapped.some((item) => item.id === current)
          ? current
          : mapped[0]?.id ?? null
      );
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Executive App load error:", error);
      setExecutives([]);
      setMessage(
        error instanceof Error
          ? `Executive App load error: ${error.message}`
          : "Executive App data load nahi hua."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();

    const timer = window.setInterval(() => void loadData(true), AUTO_REFRESH_MS);

    const channel = supabase
      .channel("executive-app-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () =>
        void loadData(true)
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "cases" }, () =>
        void loadData(true)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "case_operations" },
        () => void loadData(true)
      )
      .subscribe();

    return () => {
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [loadData]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return executives.filter((executive) => {
      const searchMatch =
        !query ||
        executive.name.toLowerCase().includes(query) ||
        executive.code.toLowerCase().includes(query) ||
        executive.mobile.toLowerCase().includes(query) ||
        executive.area.toLowerCase().includes(query);

      const appMatch =
        appFilter === "All" || executive.appStatus === appFilter;

      const workMatch =
        workFilter === "All" ||
        (workFilter === "With Cases" && executive.assignedCases > 0) ||
        (workFilter === "No Cases" && executive.assignedCases === 0);

      return searchMatch && appMatch && workMatch;
    });
  }, [executives, search, appFilter, workFilter]);

  const selected = useMemo(
    () => executives.find((item) => item.id === selectedId) ?? null,
    [executives, selectedId]
  );

  const onlineCount = executives.filter((item) => item.appStatus === "Online").length;
  const assignedCount = executives.reduce((sum, item) => sum + item.assignedCases, 0);
  const pendingCount = executives.reduce((sum, item) => sum + item.pendingCases, 0);
  const completedCount = executives.reduce((sum, item) => sum + item.completedCases, 0);

  return (
    <div className="executive-app-page">
      <style>{`
        .executive-app-page{min-height:100%;padding:26px;background:#f5f7fb;color:#0f172a;box-sizing:border-box}
        .executive-app-page *{box-sizing:border-box}
        .hero{padding:28px;border-radius:20px;background:linear-gradient(135deg,#07192d,#12497b);color:white}
        .hero-row{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
        .hero h1{margin:8px 0 0}.hero p{margin:10px 0 0;color:#dbeafe}
        .refresh{height:42px;padding:0 16px;border:1px solid rgba(255,255,255,.25);border-radius:10px;background:rgba(255,255,255,.1);color:white;font-weight:800;cursor:pointer}
        .message{margin-top:15px;padding:13px;border-radius:10px;background:#fef2f2;color:#b91c1c;font-weight:700}
        .stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-top:18px}
        .stat,.panel,.card{background:white;border:1px solid #e2e8f0;border-radius:16px}
        .stat{padding:17px}.stat span{display:block;color:#64748b;font-size:11px;font-weight:800}.stat strong{display:block;margin-top:8px;font-size:25px}
        .workspace{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(320px,.65fr);gap:18px;margin-top:18px}
        .panel{padding:20px}.panel-head{display:flex;justify-content:space-between;gap:12px;align-items:center}.panel-head h2{margin:0}.panel-head p{margin:5px 0 0;color:#64748b;font-size:12px}
        .filters{display:grid;grid-template-columns:1fr 180px 180px;gap:10px;margin-top:16px}
        .control{height:43px;padding:0 12px;border:1px solid #cbd5e1;border-radius:10px;background:white}
        .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-top:16px}
        .card{padding:16px;text-align:left;cursor:pointer}.card.selected{border-color:#60a5fa;box-shadow:0 8px 24px rgba(37,99,235,.12)}
        .card-top,.case-top{display:flex;justify-content:space-between;gap:10px}.profile{display:flex;gap:10px;align-items:center}
        .avatar{width:42px;height:42px;display:grid;place-items:center;border-radius:12px;background:#eff6ff;color:#1d4ed8;font-weight:900}
        .badge{padding:5px 8px;border-radius:999px;font-size:10px;font-weight:800}.online{background:#ecfdf5;color:#047857}.offline{background:#f1f5f9;color:#64748b}
        .meta{margin-top:12px;color:#475569;font-size:12px}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid #e2e8f0}.metrics span{font-size:9px;color:#64748b}.metrics strong{display:block;margin-top:3px;font-size:18px}
        .detail-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin-top:15px}.detail{padding:12px;border:1px solid #e2e8f0;border-radius:11px;background:#f8fafc}.detail span{font-size:9px;color:#94a3b8;font-weight:900}.detail strong{display:block;margin-top:4px;font-size:12px}
        .case-list{display:flex;flex-direction:column;gap:8px;max-height:390px;overflow:auto;margin-top:15px}.case-row{padding:11px;border:1px solid #e2e8f0;border-radius:11px}.case-row p{margin:6px 0 0;color:#64748b;font-size:11px}
        .empty{padding:35px;text-align:center;color:#64748b;font-weight:700}
        @media(max-width:1100px){.workspace{grid-template-columns:1fr}.stats{grid-template-columns:repeat(3,1fr)}}
        @media(max-width:700px){.executive-app-page{padding:14px}.stats{grid-template-columns:repeat(2,1fr)}.filters{grid-template-columns:1fr}.detail-grid{grid-template-columns:1fr}}
      `}</style>

      <section className="hero">
        <div className="hero-row">
          <div>
            <small>FIELD EXECUTIVE COMMAND CENTER</small>
            <h1>Executive Mobile App</h1>
            <p>Live executive availability aur case allocation.</p>
          </div>
          <button className="refresh" disabled={loading || refreshing} onClick={() => void loadData(true)}>
            {loading || refreshing ? "Refreshing..." : "Refresh Data"}
          </button>
        </div>
      </section>

      {message && <div className="message">{message}</div>}

      <section className="stats">
        {[
          ["Total Executives", executives.length],
          ["Online", onlineCount],
          ["Assigned Cases", assignedCount],
          ["Pending Cases", pendingCount],
          ["Completed Cases", completedCount],
        ].map(([label, value]) => (
          <article className="stat" key={String(label)}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="workspace">
        <article className="panel">
          <div className="panel-head">
            <div>
              <h2>Executive App Status</h2>
              <p>{lastRefresh ? `Last refresh: ${lastRefresh.toLocaleTimeString("en-IN")}` : "Loading..."}</p>
            </div>
            <strong>{filtered.length} results</strong>
          </div>

          <div className="filters">
            <input className="control" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search executive..." />
            <select className="control" value={appFilter} onChange={(e) => setAppFilter(e.target.value as AppFilter)}>
              <option value="All">All App Status</option>
              <option value="Online">Online</option>
              <option value="Offline">Offline</option>
            </select>
            <select className="control" value={workFilter} onChange={(e) => setWorkFilter(e.target.value as WorkFilter)}>
              <option value="All">All Work Status</option>
              <option value="With Cases">With Cases</option>
              <option value="No Cases">No Cases</option>
            </select>
          </div>

          {loading ? (
            <div className="empty">Executives load ho rahe hain...</div>
          ) : (
            <div className="grid">
              {filtered.map((executive) => (
                <button
                  className={`card ${selectedId === executive.id ? "selected" : ""}`}
                  key={executive.id}
                  onClick={() => setSelectedId(executive.id)}
                >
                  <div className="card-top">
                    <div className="profile">
                      <div className="avatar">{initials(executive.name)}</div>
                      <div>
                        <strong>{executive.name}</strong>
                        <div className="meta">{executive.code} · {executive.area}</div>
                      </div>
                    </div>
                    <span className={`badge ${executive.appStatus === "Online" ? "online" : "offline"}`}>
                      {executive.appStatus}
                    </span>
                  </div>

                  <div className="meta">Mobile: <strong>{executive.mobile}</strong></div>

                  <div className="metrics">
                    <div><span>Assigned</span><strong>{executive.assignedCases}</strong></div>
                    <div><span>Pending</span><strong>{executive.pendingCases}</strong></div>
                    <div><span>Completed</span><strong>{executive.completedCases}</strong></div>
                  </div>
                </button>
              ))}

              {filtered.length === 0 && <div className="empty">No executives found.</div>}
            </div>
          )}
        </article>

        <aside className="panel">
          <div className="panel-head">
            <div>
              <h2>Executive Details</h2>
              <p>Selected executive ka live data.</p>
            </div>
          </div>

          {selected ? (
            <>
              <div className="detail-grid">
                <div className="detail"><span>NAME</span><strong>{selected.name}</strong></div>
                <div className="detail"><span>CODE</span><strong>{selected.code}</strong></div>
                <div className="detail"><span>MOBILE</span><strong>{selected.mobile}</strong></div>
                <div className="detail"><span>AREA</span><strong>{selected.area}</strong></div>
                <div className="detail"><span>STATUS</span><strong>{selected.status}</strong></div>
                <div className="detail"><span>APP STATUS</span><strong>{selected.appStatus}</strong></div>
                <div className="detail"><span>LAST SEEN</span><strong>{formatDateTime(selected.lastSeen)}</strong></div>
                <div className="detail"><span>COMPLETION</span><strong>{selected.completionPercent}%</strong></div>
              </div>

              <div className="case-list">
                {selected.cases.slice(0, 30).map((item, index) => {
                  const operation = (item.__operation ?? {}) as RawRow;
                  const caseNo = first(item, ["case_number", "account_no", "id"], `Case ${index + 1}`);
                  const customer = first(item, ["customer_name", "account_name", "name"], "Unknown Customer");
                  const status = first(operation, ["status", "case_status"], "Pending");

                  return (
                    <div className="case-row" key={`${caseNo}-${index}`}>
                      <div className="case-top">
                        <strong>{customer}</strong>
                        <span>{status}</span>
                      </div>
                      <p>{caseNo} · {first(item, ["mobile", "mobile_no", "phone"], "No mobile")}</p>
                    </div>
                  );
                })}

                {selected.cases.length === 0 && (
                  <div className="empty">Is executive ko abhi koi case assigned nahi hai.</div>
                )}
              </div>
            </>
          ) : (
            <div className="empty">Executive select karo.</div>
          )}
        </aside>
      </section>
    </div>
  );
}

export default ExecutiveAppPage;