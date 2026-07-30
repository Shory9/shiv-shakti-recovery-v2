import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

type ExecutiveRankRow = {
  id: number;
  executive_code: string;
  full_name: string;
  area: string;
  totalAssigned: number;
  completedCases: number;
  completionRate: number;
  completionPercent: number; // <-- Yeh property add kar di hai
};

export default function ExecutiveRankingPage() {
  const [rankings, setRankings] = useState<ExecutiveRankRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadRankings();
  }, []);

  async function loadRankings() {
    setLoading(true);
    setError("");

    try {
      const { data: execData, error: execError } = await supabase
        .from("executive")
        .select("*");

      if (execError) throw execError;

      const { data: caseData, error: caseError } = await supabase
        .from("cases")
        .select("id, assigned_executive, assigned_executive_id, status");

      if (caseError) throw caseError;

      const executives = execData ?? [];
      const cases = caseData ?? [];

      const mapped: ExecutiveRankRow[] = executives.map((ex: any) => {
        const exId = Number(ex.id);
        const exCode = String(ex.executive_code || "").trim().toLowerCase();
        const exName = ex.full_name || ex.name || "Unknown Executive";
        const exArea = ex.area || "Unassigned";

        const assigned = cases.filter((c: any) => {
          const matchId = Number(c.assigned_executive_id) === exId;
          const matchCode = String(c.assigned_executive || "").trim().toLowerCase() === exCode;
          return matchId || matchCode;
        });

        const completed = assigned.filter((c: any) => {
          const st = String(c.status || "").trim().toLowerCase();
          return ["completed", "paid", "closed", "settled"].includes(st);
        }).length;

        const totalAssigned = assigned.length;
        const completionRate = totalAssigned > 0 ? Math.round((completed / totalAssigned) * 100) : 0;

        return {
          id: exId,
          executive_code: ex.executive_code || `SS${exId}`,
          full_name: exName,
          area: exArea,
          totalAssigned,
          completedCases: completed,
          completionRate,
          completionPercent: completionRate,
        };
      });

      mapped.sort((a, b) => {
        if (b.completedCases !== a.completedCases) {
          return b.completedCases - a.completedCases;
        }
        return b.completionRate - a.completionRate;
      });

      setRankings(mapped);
    } catch (err: any) {
      setError(err?.message || "Rankings load nahi ho paayi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "24px", backgroundColor: "#f8fafc", minHeight: "100vh", fontFamily: "sans-serif" }}>
      <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a", margin: 0 }}>
            🏆 Executive Performance Ranking
          </h2>
          <p style={{ fontSize: "13px", color: "#64748b", margin: "4px 0 0 0" }}>
            Shiv Shakti Recovery Field Team Leaderboard
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadRankings()}
          disabled={loading}
          style={{
            padding: "8px 16px",
            backgroundColor: "#2563eb",
            color: "#ffffff",
            border: "none",
            borderRadius: "8px",
            fontWeight: "700",
            fontSize: "13px",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Refreshing..." : "Refresh Leaderboard"}
        </button>
      </div>

      {error && (
        <div style={{ padding: "12px", marginBottom: "16px", backgroundColor: "#fef2f2", color: "#b91c1c", borderRadius: "8px", fontWeight: "700", fontSize: "13px" }}>
          {error}
        </div>
      )}

      <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px", boxShadow: "0 2px 4px rgba(0,0,0,0.04)" }}>
        {loading ? (
          <p style={{ padding: "30px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>Calculating rankings...</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8fafc", borderBottom: "2px solid #e2e8f0", color: "#475569" }}>
                  <th style={{ padding: "12px", width: "80px" }}>Rank</th>
                  <th style={{ padding: "12px" }}>Executive Code</th>
                  <th style={{ padding: "12px" }}>Name</th>
                  <th style={{ padding: "12px" }}>Area</th>
                  <th style={{ padding: "12px" }}>Assigned Cases</th>
                  <th style={{ padding: "12px" }}>Completed / Paid</th>
                  <th style={{ padding: "12px" }}>Success Rate</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((ex, index) => {
                  let medal = `#${index + 1}`;
                  if (index === 0) medal = "🥇 1st";
                  else if (index === 1) medal = "🥈 2nd";
                  else if (index === 2) medal = "🥉 3rd";

                  return (
                    <tr key={ex.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "12px", fontWeight: "800", color: index < 3 ? "#2563eb" : "#64748b" }}>
                        {medal}
                      </td>
                      <td style={{ padding: "12px", fontWeight: "700", fontFamily: "monospace" }}>{ex.executive_code}</td>
                      <td style={{ padding: "12px", fontWeight: "700", color: "#0f172a" }}>{ex.full_name}</td>
                      <td style={{ padding: "12px", color: "#475569" }}>{ex.area}</td>
                      <td style={{ padding: "12px", fontWeight: "700" }}>{ex.totalAssigned}</td>
                      <td style={{ padding: "12px", fontWeight: "700", color: "#059669" }}>{ex.completedCases}</td>
                      <td style={{ padding: "12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{ flex: 1, height: "8px", backgroundColor: "#e2e8f0", borderRadius: "999px", overflow: "hidden", maxWidth: "120px" }}>
                            <div style={{ width: `${ex.completionPercent}%`, height: "100%", backgroundColor: "#2563eb", borderRadius: "999px" }} />
                          </div>
                          <strong style={{ fontSize: "12px" }}>{ex.completionPercent}%</strong>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {rankings.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: "30px", textAlign: "center", color: "#64748b" }}>
                      Koi executive records nahi mile.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}