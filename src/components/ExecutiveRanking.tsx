import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

type ExecutiveProfile = {
  id: string | number;
  executive_code?: string | null;
  agent_code?: string | null;
  employee_code?: string | null;
  full_name?: string | null;
  name?: string | null;
  area?: string | null;
  assigned_area?: string | null;
  city?: string | null;
  role?: string | null;
  user_role?: string | null;
};

type CaseRow = {
  id: string | number;
  assigned_executive?: string | null;
  assigned_executive_id?: string | number | null;
  status?: string | null;
};

type ExecutiveRankRow = {
  id: string;
  executive_code: string;
  full_name: string;
  area: string;
  totalAssigned: number;
  completedCases: number;
  completionRate: number;
  completionPercent: number;
};

function normalized(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function isCompletedStatus(status?: string | null): boolean {
  return ["completed", "paid", "closed", "settled", "recovered"].includes(
    normalized(status)
  );
}

export default function ExecutiveRankingPage() {
  const [rankings, setRankings] = useState<ExecutiveRankRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchAllRows = useCallback(async <T,>(table: string): Promise<T[]> => {
    const rows: T[] = [];
    const pageSize = 1000;
    let from = 0;

    while (true) {
      const { data, error: queryError } = await supabase
        .from(table)
        .select("*")
        .range(from, from + pageSize - 1);

      if (queryError) throw queryError;

      const page = (data ?? []) as T[];
      rows.push(...page);

      if (page.length < pageSize) break;
      from += pageSize;
    }

    return rows;
  }, []);

  const loadRankings = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [profileRows, caseRows] = await Promise.all([
        fetchAllRows<ExecutiveProfile>("profiles"),
        fetchAllRows<CaseRow>("cases"),
      ]);

      const executives = profileRows.filter((profile) => {
        const role = normalized(profile.role || profile.user_role);

        return (
          !role ||
          role === "executive" ||
          role === "agent" ||
          role === "field_executive"
        );
      });

      const mapped: ExecutiveRankRow[] = executives.map((executive, index) => {
        const executiveId = String(executive.id);
        const executiveCode =
          executive.executive_code ||
          executive.agent_code ||
          executive.employee_code ||
          `SS${String(index + 1).padStart(3, "0")}`;

        const normalizedCode = normalized(executiveCode);

        const assigned = caseRows.filter((item) => {
          const assignedId = String(item.assigned_executive_id ?? "");
          const assignedCode = normalized(item.assigned_executive);

          return (
            (assignedId && assignedId === executiveId) ||
            (assignedCode && assignedCode === normalizedCode)
          );
        });

        const completedCases = assigned.filter((item) =>
          isCompletedStatus(item.status)
        ).length;

        const totalAssigned = assigned.length;
        const completionRate =
          totalAssigned > 0
            ? Math.round((completedCases / totalAssigned) * 100)
            : 0;

        return {
          id: executiveId,
          executive_code: executiveCode,
          full_name:
            executive.full_name || executive.name || "Unknown Executive",
          area:
            executive.area ||
            executive.assigned_area ||
            executive.city ||
            "Unassigned",
          totalAssigned,
          completedCases,
          completionRate,
          completionPercent: completionRate,
        };
      });

      mapped.sort((a, b) => {
        if (b.completedCases !== a.completedCases) {
          return b.completedCases - a.completedCases;
        }

        if (b.completionRate !== a.completionRate) {
          return b.completionRate - a.completionRate;
        }

        return b.totalAssigned - a.totalAssigned;
      });

      setRankings(mapped);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Rankings load nahi ho paayi.";

      setError(message);
      console.error("Executive ranking error:", caughtError);
    } finally {
      setLoading(false);
    }
  }, [fetchAllRows]);

  useEffect(() => {
    void loadRankings();

    const channel = supabase
      .channel("executive-ranking-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => void loadRankings()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cases" },
        () => void loadRankings()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadRankings]);

  return (
    <div
      style={{
        padding: "24px",
        backgroundColor: "#f8fafc",
        minHeight: "100vh",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          marginBottom: "20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2
            style={{
              fontSize: "22px",
              fontWeight: "800",
              color: "#0f172a",
              margin: 0,
            }}
          >
            🏆 Executive Performance Ranking
          </h2>

          <p
            style={{
              fontSize: "13px",
              color: "#64748b",
              margin: "4px 0 0 0",
            }}
          >
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
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Refreshing..." : "Refresh Leaderboard"}
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: "12px",
            marginBottom: "16px",
            backgroundColor: "#fef2f2",
            color: "#b91c1c",
            borderRadius: "8px",
            border: "1px solid #fecaca",
            fontWeight: "700",
            fontSize: "13px",
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          backgroundColor: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "16px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
        }}
      >
        {loading ? (
          <p
            style={{
              padding: "30px",
              textAlign: "center",
              color: "#64748b",
              fontSize: "13px",
            }}
          >
            Calculating rankings...
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "13px",
                textAlign: "left",
              }}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: "#f8fafc",
                    borderBottom: "2px solid #e2e8f0",
                    color: "#475569",
                  }}
                >
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
                {rankings.map((executive, index) => {
                  let medal = `#${index + 1}`;

                  if (index === 0) medal = "🥇 1st";
                  else if (index === 1) medal = "🥈 2nd";
                  else if (index === 2) medal = "🥉 3rd";

                  return (
                    <tr
                      key={executive.id}
                      style={{ borderBottom: "1px solid #f1f5f9" }}
                    >
                      <td
                        style={{
                          padding: "12px",
                          fontWeight: "800",
                          color: index < 3 ? "#2563eb" : "#64748b",
                        }}
                      >
                        {medal}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          fontWeight: "700",
                          fontFamily: "monospace",
                        }}
                      >
                        {executive.executive_code}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          fontWeight: "700",
                          color: "#0f172a",
                        }}
                      >
                        {executive.full_name}
                      </td>

                      <td style={{ padding: "12px", color: "#475569" }}>
                        {executive.area}
                      </td>

                      <td style={{ padding: "12px", fontWeight: "700" }}>
                        {executive.totalAssigned}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          fontWeight: "700",
                          color: "#059669",
                        }}
                      >
                        {executive.completedCases}
                      </td>

                      <td style={{ padding: "12px" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                          }}
                        >
                          <div
                            style={{
                              flex: 1,
                              height: "8px",
                              backgroundColor: "#e2e8f0",
                              borderRadius: "999px",
                              overflow: "hidden",
                              maxWidth: "120px",
                            }}
                          >
                            <div
                              style={{
                                width: `${executive.completionPercent}%`,
                                height: "100%",
                                backgroundColor: "#2563eb",
                                borderRadius: "999px",
                              }}
                            />
                          </div>

                          <strong style={{ fontSize: "12px" }}>
                            {executive.completionPercent}%
                          </strong>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {rankings.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        padding: "30px",
                        textAlign: "center",
                        color: "#64748b",
                      }}
                    >
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