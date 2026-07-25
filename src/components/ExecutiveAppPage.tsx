import { useEffect, useMemo, useState } from "react";
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
  completedCases: number;
};

function ExecutiveAppPage() {
  const [executives, setExecutives] = useState<ExecutiveCard[]>([]);
  const [search, setSearch] = useState("");
  const [appStatus, setAppStatus] = useState<"All" | "Online" | "Offline">("All");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void loadData();
  }, []);

  const fetchAllCases = async () => {
    const rows: Array<{ assigned_executive_id: number | null; status: string | null }> = [];
    let from = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error } = await supabase
        .from("cases")
        .select("assigned_executive_id,status")
        .range(from, from + pageSize - 1);

      if (error) throw error;

      const page = (data ?? []) as Array<{
        assigned_executive_id: number | null;
        status: string | null;
      }>;

      rows.push(...page);
      if (page.length < pageSize) break;
      from += pageSize;
    }

    return rows;
  };

  const loadData = async () => {
    setLoading(true);
    setMessage("");

    try {
      const [executiveResult, cases] = await Promise.all([
        supabase.from("executives").select("*").order("created_at", { ascending: false }),
        fetchAllCases(),
      ]);

      if (executiveResult.error) throw executiveResult.error;

      const rows = (executiveResult.data ?? []) as ExecutiveRow[];

      setExecutives(
        rows.map((row) => {
          const assigned = cases.filter(
            (item) => Number(item.assigned_executive_id) === Number(row.id)
          );

          const completed = assigned.filter((item) => {
            const status = String(item.status ?? "").toLowerCase();
            return status === "completed" || status === "paid";
          }).length;

          return {
            id: row.id,
            code: row.code ?? "",
            name: row.name ?? "",
            mobile: row.mobile ?? "",
            area: row.area ?? "",
            status: row.status ?? "Active",
            appStatus: row.is_online ? "Online" : "Offline",
            lastSeen: row.last_seen ?? "",
            assignedCases: assigned.length,
            completedCases: completed,
          };
        })
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
    }
  };

  const filteredExecutives = useMemo(() => {
    const query = search.trim().toLowerCase();

    return executives.filter((executive) => {
      const matchesSearch =
        !query ||
        executive.name.toLowerCase().includes(query) ||
        executive.code.toLowerCase().includes(query) ||
        executive.mobile.toLowerCase().includes(query) ||
        executive.area.toLowerCase().includes(query);

      const matchesStatus =
        appStatus === "All" || executive.appStatus === appStatus;

      return matchesSearch && matchesStatus;
    });
  }, [executives, search, appStatus]);

  const onlineCount = executives.filter((item) => item.appStatus === "Online").length;
  const assignedCount = executives.reduce((sum, item) => sum + item.assignedCases, 0);
  const completedCount = executives.reduce((sum, item) => sum + item.completedCases, 0);

  return (
    <div style={{ minHeight: "100%", padding: 26, background: "#f5f7fb", color: "#0f172a" }}>
      <section style={{ padding: 30, borderRadius: 22, color: "white", background: "linear-gradient(135deg,#07192d,#12497b)", boxShadow: "0 18px 45px rgba(7,25,45,.18)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ color: "#bfdbfe", fontSize: 12, fontWeight: 800, letterSpacing: ".12em" }}>FIELD EXECUTIVE COMMAND CENTER</div>
            <h1 style={{ margin: "10px 0 0", fontSize: 36 }}>Executive Mobile App</h1>
            <p style={{ margin: "12px 0 0", color: "#dbeafe" }}>
              Executive allocation aur app availability ka live overview.
            </p>
          </div>
          <button onClick={() => void loadData()} disabled={loading} style={{ height: 44, padding: "0 18px", border: "1px solid rgba(255,255,255,.25)", borderRadius: 11, background: "rgba(255,255,255,.1)", color: "white", fontWeight: 800, cursor: "pointer" }}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </section>

      {message && (
        <div style={{ marginTop: 16, padding: 13, borderRadius: 10, background: "#fef2f2", color: "#b91c1c", fontWeight: 700 }}>
          {message}
        </div>
      )}

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginTop: 20 }}>
        {[
          ["Total Executives", executives.length],
          ["Online", onlineCount],
          ["Assigned Cases", assignedCount],
          ["Completed Cases", completedCount],
        ].map(([label, value]) => (
          <article key={String(label)} style={{ padding: 18, borderRadius: 16, background: "white", border: "1px solid #e2e8f0" }}>
            <span style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>{label}</span>
            <strong style={{ display: "block", marginTop: 8, fontSize: 26 }}>{value}</strong>
          </article>
        ))}
      </section>

      <section style={{ marginTop: 20, padding: 22, borderRadius: 20, background: "white", border: "1px solid #e2e8f0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(240px,1fr) minmax(180px,260px)", gap: 12 }}>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search executive" style={{ height: 46, padding: "0 13px", border: "1px solid #cbd5e1", borderRadius: 11 }} />
          <select value={appStatus} onChange={(event) => setAppStatus(event.target.value as "All" | "Online" | "Offline")} style={{ height: 46, padding: "0 13px", border: "1px solid #cbd5e1", borderRadius: 11, background: "white" }}>
            <option value="All">All App Status</option>
            <option value="Online">Online</option>
            <option value="Offline">Offline</option>
          </select>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Loading executives...</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14, marginTop: 18 }}>
            {filteredExecutives.map((executive) => (
              <article key={executive.id} style={{ padding: 18, border: "1px solid #e2e8f0", borderRadius: 16, background: "white", boxShadow: "0 8px 24px rgba(15,23,42,.05)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <strong style={{ fontSize: 16 }}>{executive.name}</strong>
                    <div style={{ marginTop: 4, color: "#64748b", fontSize: 12 }}>{executive.code || "No code"} · {executive.area || "No area"}</div>
                  </div>
                  <span style={{ height: "fit-content", padding: "5px 9px", borderRadius: 999, fontSize: 11, fontWeight: 800, background: executive.appStatus === "Online" ? "#ecfdf5" : "#f1f5f9", color: executive.appStatus === "Online" ? "#047857" : "#64748b" }}>
                    {executive.appStatus}
                  </span>
                </div>

                <div style={{ marginTop: 14, color: "#475569", fontSize: 13 }}>
                  Mobile: <strong>{executive.mobile || "-"}</strong>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginTop: 16, paddingTop: 14, borderTop: "1px solid #e2e8f0" }}>
                  <div>
                    <span style={{ color: "#64748b", fontSize: 11, fontWeight: 800 }}>ASSIGNED</span>
                    <strong style={{ display: "block", marginTop: 4, fontSize: 20 }}>{executive.assignedCases}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", fontSize: 11, fontWeight: 800 }}>COMPLETED</span>
                    <strong style={{ display: "block", marginTop: 4, fontSize: 20 }}>{executive.completedCases}</strong>
                  </div>
                </div>

                <div style={{ marginTop: 12, color: "#64748b", fontSize: 12 }}>
                  {executive.lastSeen ? `Last seen: ${new Date(executive.lastSeen).toLocaleString("en-IN")}` : "Last seen data unavailable"}
                </div>
              </article>
            ))}

            {filteredExecutives.length === 0 && (
              <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>No executives found.</div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export default ExecutiveAppPage;