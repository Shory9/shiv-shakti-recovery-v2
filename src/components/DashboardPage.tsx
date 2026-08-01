import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

type RecentCase = {
  id: string;
  account_number: string | null;
  account_name: string | null;
  branch: string | null;
  remarks: string | null;
  status: string | null;
  assigned_executive_id: string | null;
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
        supabase
          .from("executives")
          .select("*", { count: "exact", head: true })
          .or("status.eq.active,status.eq.Active"),
        supabase.from("cases").select("*", { count: "exact", head: true }),
        supabase
          .from("cases")
          .select("*", { count: "exact", head: true })
          .or("status.eq.Pending,status.eq.pending"),
        supabase
          .from("cases")
          .select("*", { count: "exact", head: true })
          .or("status.eq.Completed,status.eq.completed"),
        supabase
          .from("cases")
          .select("*", { count: "exact", head: true })
          .or("status.eq.Paid,status.eq.paid"),
        supabase
          .from("cases")
          .select("*", { count: "exact", head: true })
          .not("assigned_executive_id", "is", null),
        supabase
          .from("cases")
          .select(
            "id,account_number,account_name,branch,remarks,status,assigned_executive_id,assigned_executive,created_at"
          )
          .order("id", { ascending: false })
          .limit(8),
      ]);

      const totalCasesCount = totalCasesResult.count ?? 0;
      const assignedCount = assignedCasesResult.count ?? 0;

      const unassignedCount = Math.max(0, totalCasesCount - assignedCount);

      const formattedRecentCases = ((recentResult.data ?? []) as RecentCase[]).map(
        (c) => {
          const resolvedAreaMatch = String(c.remarks ?? "").match(
            /Resolved Area:\s*([^|]+)/i
          );

          return {
            ...c,
            account_number: c.account_number || "-",
            account_name: c.account_name || "Unknown",
            branch:
              resolvedAreaMatch?.[1]?.trim() ||
              c.branch ||
              "Unassigned",
            status: c.status || "pending",
            assigned_executive:
              c.assigned_executive_id
                ? c.assigned_executive || "Assigned"
                : null,
          };
        }
      );

      setData({
        totalExecutives: totalExecutivesResult.count ?? 0,
        activeExecutives: activeExecutivesResult.count ?? 0,
        totalCases: totalCasesCount,
        pendingCases: pendingCasesResult.count ?? 0,
        completedCases:
          (completedCasesResult.count ?? 0) + (paidCasesResult.count ?? 0),
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
    <div
      style={{
        minHeight: "100%",
        padding: "26px",
        backgroundColor: "#f5f7fb",
        color: "#0f172a",
      }}
    >
      <section
        style={{
          padding: "30px",
          borderRadius: "22px",
          color: "#ffffff",
          background: "linear-gradient(135deg,#07192d,#12497b)",
          boxShadow: "0 18px 45px rgba(7,25,45,.18)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "20px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                color: "#bfdbfe",
                fontSize: "12px",
                fontWeight: 800,
                letterSpacing: ".12em",
              }}
            >
              POWERED BY AKYOS DEVELOPMENT
            </div>
            <h1 style={{ margin: "10px 0 0", fontSize: "36px", fontWeight: 800 }}>
              Shiv Shakti Recovery Dashboard
            </h1>
            <p style={{ margin: "12px 0 0", color: "#dbeafe" }}>
              Real-time executive tracking, case allocations, aur recovery analytics overview.
            </p>
          </div>
          <button
            onClick={() => void loadDashboard()}
            disabled={loading}
            style={{
              height: "44px",
              padding: "0 18px",
              border: "1px solid rgba(255,255,255,.25)",
              borderRadius: "11px",
              background: "rgba(255,255,255,.1)",
              color: "#ffffff",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {loading ? "Refreshing..." : "Refresh Stats"}
          </button>
        </div>
      </section>

      {message && (
        <div
          style={{
            marginTop: "16px",
            padding: "13px",
            borderRadius: "10px",
            backgroundColor: "#fef2f2",
            color: "#b91c1c",
            fontWeight: 700,
          }}
        >
          {message}
        </div>
      )}

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
          gap: "14px",
          marginTop: "20px",
        }}
      >
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
          <article
            key={String(label)}
            style={{
              padding: "18px",
              borderRadius: "16px",
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              boxShadow: "0 8px 24px rgba(15,23,42,.05)",
            }}
          >
            <span style={{ color: "#64748b", fontSize: "12px", fontWeight: 800 }}>
              {label}
            </span>
            <strong
              style={{ display: "block", marginTop: "8px", fontSize: "26px" }}
            >
              {value}
            </strong>
          </article>
        ))}
      </section>

      <section
        style={{
          marginTop: "20px",
          padding: "22px",
          borderRadius: "20px",
          backgroundColor: "#ffffff",
          border: "1px solid #e2e8f0",
        }}
      >
        <div style={{ marginBottom: "16px" }}>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800 }}>
            Recent Imported Cases
          </h2>
          <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: "13px" }}>
            System mein last 8 live cases.
          </p>
        </div>

        {loading ? (
          <div
            style={{ padding: "40px", textAlign: "center", color: "#64748b" }}
          >
            Loading real-time stats...
          </div>
        ) : (
          <div
            style={{
              overflow: "auto",
              border: "1px solid #e2e8f0",
              borderRadius: "14px",
            }}
          >
            <table
              style={{
                width: "100%",
                minWidth: "760px",
                borderCollapse: "collapse",
                fontSize: "13px",
              }}
            >
              <thead>
                <tr style={{ backgroundColor: "#f8fafc" }}>
                  {[
                    "Case / Acc No.",
                    "Customer Name",
                    "Market / Area",
                    "Status",
                    "Allocation",
                  ].map((item) => (
                    <th
                      key={item}
                      style={{
                        padding: "12px",
                        textAlign: "left",
                        borderBottom: "1px solid #e2e8f0",
                      }}
                    >
                      {item}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.recentCases.map((item) => (
                  <tr key={item.id}>
                    <td
                      style={{
                        padding: "12px",
                        borderBottom: "1px solid #eef2f7",
                        fontFamily: "monospace",
                        fontWeight: 800,
                      }}
                    >
                      {item.account_number}
                    </td>
                    <td style={{ padding: "12px", borderBottom: "1px solid #eef2f7" }}>
                      {item.account_name}
                    </td>
                    <td style={{ padding: "12px", borderBottom: "1px solid #eef2f7" }}>
                      {item.branch}
                    </td>
                    <td style={{ padding: "12px", borderBottom: "1px solid #eef2f7" }}>
                      {item.status}
                    </td>
                    <td style={{ padding: "12px", borderBottom: "1px solid #eef2f7" }}>
                      <span
                        style={{
                          padding: "5px 9px",
                          borderRadius: "999px",
                          fontWeight: 800,
                          backgroundColor: item.assigned_executive_id
                            ? "#ecfdf5"
                            : "#fef2f2",
                          color: item.assigned_executive_id
                            ? "#047857"
                            : "#b91c1c",
                        }}
                      >
                        {item.assigned_executive_id
                          ? item.assigned_executive &&
                            item.assigned_executive !== "Assigned"
                            ? `Assigned (${item.assigned_executive})`
                            : "Assigned"
                          : "Unassigned"}
                      </span>
                    </td>
                  </tr>
                ))}
                {data.recentCases.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        padding: "40px",
                        textAlign: "center",
                        color: "#64748b",
                      }}
                    >
                      No cases found.
                    </td>
                  </tr>
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