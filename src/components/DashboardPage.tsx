import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

type RecentCase = {
  id: number;
  case_no: string | null;
  customer_name: string | null;
  area: string | null;
  status: string | null;
  assigned_executive: string | null;
  created_at: string | null;
};

type DashboardState = {
  totalExecutives: number;
  activeExecutives: number;
  totalCases: number;
  pendingCases: number;
  completedCases: number;
  assignedCases: number;
  unassignedCases: number;
  recentCases: RecentCase[];
};

const initialState: DashboardState = {
  totalExecutives: 0,
  activeExecutives: 0,
  totalCases: 0,
  pendingCases: 0,
  completedCases: 0,
  assignedCases: 0,
  unassignedCases: 0,
  recentCases: [],
};

function DashboardPage() {
  const [data, setData] = useState<DashboardState>(initialState);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    setMessage("");

    try {
      const [
        totalExecutivesResult,
        activeExecutivesResult,
        totalCasesResult,
        pendingCasesResult,
        completedCasesResult,
        paidCasesResult,
        assignedCasesResult,
        recentResult,
      ] = await Promise.all([
        supabase.from("executives").select("*", { count: "exact", head: true }),
        supabase.from("executives").select("*", { count: "exact", head: true }).or("status.eq.active,status.eq.Active"),
        supabase.from("cases").select("*", { count: "exact", head: true }),
        supabase.from("cases").select("*", { count: "exact", head: true }).or("status.eq.Pending,status.eq.pending"),
        supabase.from("cases").select("*", { count: "exact", head: true }).or("status.eq.Completed,status.eq.completed"),
        supabase.from("cases").select("*", { count: "exact", head: true }).or("status.eq.Paid,status.eq.paid"),
        supabase.from("cases").select("*", { count: "exact", head: true }).not("assigned_executive", "is", null),
        supabase
          .from("cases")
          .select("id,case_no,case_number,customer_name,area,status,assigned_executive,created_at")
          .order("id", { ascending: false })
          .limit(8),
      ]);

      const totalCasesCount = totalCasesResult.count ?? 0;
      const assignedCount = assignedCasesResult.count ?? 0;

      // Safe fallback for unassigned cases
      const unassignedCount = Math.max(0, totalCasesCount - assignedCount);

      // Standardizing recent cases records
      const formattedRecentCases = ((recentResult.data ?? []) as any[]).map((c) => ({
        id: c.id,
        case_no: c.case_no || c.case_number || "-",
        customer_name: c.customer_name || "Unknown",
        area: c.area || "Unassigned",
        status: c.status || "Pending",
        assigned_executive: c.assigned_executive,
        created_at: c.created_at,
      }));

      setData({
        totalExecutives: totalExecutivesResult.count ?? 0,
        activeExecutives: activeExecutivesResult.count ?? 0,
        totalCases: totalCasesCount,
        pendingCases: pendingCasesResult.count ?? 0,
        completedCases: (completedCasesResult.count ?? 0) + (paidCasesResult.count ?? 0),
        assignedCases: assignedCount,
        unassignedCases: unassignedCount,
        recentCases: formattedRecentCases,
      });
    } catch (error) {
      console.error("Dashboard load error:", error);
      setMessage(
        error instanceof Error
          ? `Dashboard load error: ${error.message}`
          : "Dashboard data load nahi hua."
      );
    } finally {
      setLoading(false);
    }
  };

  const completionRate =
    data.totalCases === 0
      ? 0
      : Math.round((data.completedCases / data.totalCases) * 100);

  return (
    <div style={{ minHeight: "100%", padding: 26, background: "#f5f7fb", color: "#0f172a" }}>
      <section style={{ padding: 30, borderRadius: 22, color: "white", background: "linear-gradient(135deg,#07192d,#12497b)", boxShadow: "0 18px 45px rgba(7,25,45,.18)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ color: "#bfdbfe", fontSize: 12, fontWeight: 800, letterSpacing: ".12em" }}>POWERED BY AKYOS</div>
            <h1 style={{ margin: "10px 0 0", fontSize: 36 }}>Akyos CRM Dashboard</h1>
            <p style={{ margin: "12px 0 0", color: "#dbeafe" }}>
              Real-time executive tracking, case allocations, aur recovery analytics overview.
            </p>
          </div>
          <button onClick={() => void loadDashboard()} disabled={loading} style={{ height: 44, padding: "0 18px", border: "1px solid rgba(255,255,255,.25)", borderRadius: 11, background: "rgba(255,255,255,.1)", color: "white", fontWeight: 800, cursor: "pointer" }}>
            {loading ? "Refreshing..." : "Refresh Stats"}
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
          ["Total Executives", data.totalExecutives],
          ["Active Executives", data.activeExecutives],
          ["Total Cases", data.totalCases],
          ["Pending Cases", data.pendingCases],
          ["Completed / Paid", data.completedCases],
          ["Completion Rate", `${completionRate}%`],
          ["Assigned Cases", data.assignedCases],
          ["Unassigned Cases", data.unassignedCases],
        ].map(([label, value]) => (
          <article key={String(label)} style={{ padding: 18, borderRadius: 16, background: "white", border: "1px solid #e2e8f0", boxShadow: "0 8px 24px rgba(15,23,42,.05)" }}>
            <span style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>{label}</span>
            <strong style={{ display: "block", marginTop: 8, fontSize: 26 }}>{value}</strong>
          </article>
        ))}
      </section>

      <section style={{ marginTop: 20, padding: 22, borderRadius: 20, background: "white", border: "1px solid #e2e8f0" }}>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Recent Imported Cases</h2>
          <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>System mein last 8 live cases.</p>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Loading real-time stats...</div>
        ) : (
          <div style={{ overflow: "auto", border: "1px solid #e2e8f0", borderRadius: 14 }}>
            <table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Case / Acc No.", "Customer Name", "Market / Area", "Status", "Allocation"].map((item) => (
                    <th key={item} style={{ padding: 12, textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>{item}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.recentCases.map((item) => (
                  <tr key={item.id}>
                    <td style={{ padding: 12, borderBottom: "1px solid #eef2f7", fontFamily: "monospace", fontWeight: 800 }}>{item.case_no}</td>
                    <td style={{ padding: 12, borderBottom: "1px solid #eef2f7" }}>{item.customer_name}</td>
                    <td style={{ padding: 12, borderBottom: "1px solid #eef2f7" }}>{item.area}</td>
                    <td style={{ padding: 12, borderBottom: "1px solid #eef2f7" }}>{item.status}</td>
                    <td style={{ padding: 12, borderBottom: "1px solid #eef2f7" }}>
                      <span style={{ padding: "5px 9px", borderRadius: 999, fontWeight: 800, background: item.assigned_executive ? "#ecfdf5" : "#fef2f2", color: item.assigned_executive ? "#047857" : "#b91c1c" }}>
                        {item.assigned_executive ? `Assigned (${item.assigned_executive})` : "Unassigned"}
                      </span>
                    </td>
                  </tr>
                ))}
                {data.recentCases.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#64748b" }}>No cases found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default DashboardPage;