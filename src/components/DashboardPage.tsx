import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "../supabaseClient";

type RawRow = Record<string, unknown>;

type RecentCase = {
  id: string;
  caseNo: string;
  customerName: string;
  area: string;
  status: string;
  assignedExecutive: string;
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

const FETCH_BATCH_SIZE = 1000;

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function firstText(row: RawRow | undefined, keys: string[], fallback = ""): string {
  if (!row) return fallback;

  for (const key of keys) {
    const value = text(row[key]);
    if (value) return value;
  }

  return fallback;
}

function truthy(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const normalized = text(value).toLowerCase();
  return ["true", "1", "yes", "active", "approved", "online"].includes(normalized);
}

function isExecutive(profile: RawRow): boolean {
  return firstText(profile, ["role", "user_role"]).toLowerCase() === "executive";
}

function isActiveExecutive(profile: RawRow): boolean {
  if (Object.prototype.hasOwnProperty.call(profile, "is_active")) {
    return truthy(profile.is_active);
  }

  return ["active", "approved", "online"].includes(
    firstText(profile, ["status"], "active").toLowerCase()
  );
}

function isCompletedStatus(status: string): boolean {
  return ["completed", "paid", "closed", "settled", "recovered"].includes(
    status.toLowerCase()
  );
}

async function fetchAllRows(table: "cases" | "profiles" | "case_operations") {
  const rows: RawRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + FETCH_BATCH_SIZE - 1);

    if (error) throw new Error(`${table}: ${error.message}`);

    const batch = (data ?? []) as RawRow[];
    rows.push(...batch);

    if (batch.length < FETCH_BATCH_SIZE) break;
    from += FETCH_BATCH_SIZE;
  }

  return rows;
}

function DashboardPage() {
  const [data, setData] = useState<DashboardState>(initialState);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    setMessage("");

    try {
      const [profiles, cases, operations] = await Promise.all([
        fetchAllRows("profiles"),
        fetchAllRows("cases"),
        fetchAllRows("case_operations"),
      ]);

      const executives = profiles.filter(isExecutive);

      const profileById = new Map<string, RawRow>();
      profiles.forEach((profile) => {
        const id = firstText(profile, ["id"]);
        if (id) profileById.set(id, profile);
      });

      const operationByCaseId = new Map<string, RawRow>();
      operations.forEach((operation) => {
        const caseId = firstText(operation, ["case_id", "caseid"]);
        if (caseId) operationByCaseId.set(caseId, operation);
      });

      let completedCases = 0;
      let pendingCases = 0;
      let assignedCases = 0;

      const recentCases: RecentCase[] = [...cases]
        .sort((a, b) => {
          const aDate = Date.parse(firstText(a, ["created_at", "updated_at"], ""));
          const bDate = Date.parse(firstText(b, ["created_at", "updated_at"], ""));
          return (Number.isFinite(bDate) ? bDate : 0) - (Number.isFinite(aDate) ? aDate : 0);
        })
        .map((caseRow, index) => {
          const caseId = firstText(caseRow, ["id"]);
          const operation = operationByCaseId.get(caseId);

          const status = firstText(operation, ["status", "case_status"], "Pending");
          if (isCompletedStatus(status)) completedCases += 1;
          else pendingCases += 1;

          const executiveId = firstText(operation, [
            "assigned_executive_id",
            "executive_id",
            "assigned_to",
          ]);

          if (executiveId) assignedCases += 1;

          const executive = profileById.get(executiveId);
          const executiveName = firstText(executive, ["full_name", "name", "email"]);

          return {
            id: caseId || String(index + 1),
            caseNo: firstText(
              caseRow,
              ["account_no", "case_number", "case_no", "ac_no"],
              `Case ${index + 1}`
            ),
            customerName: firstText(
              caseRow,
              ["account_name", "customer_name", "customer", "ac_name"],
              "Unknown Customer"
            ),
            area: firstText(
              caseRow,
              ["branch", "area", "market", "address"],
              "Unassigned"
            ),
            status,
            assignedExecutive: executiveName || executiveId,
          };
        })
        .slice(0, 8);

      setData({
        totalExecutives: executives.length,
        activeExecutives: executives.filter(isActiveExecutive).length,
        totalCases: cases.length,
        pendingCases,
        completedCases,
        assignedCases,
        unassignedCases: Math.max(0, cases.length - assignedCases),
        recentCases,
      });
    } catch (error) {
      console.error("Dashboard load error:", error);
      setData(initialState);
      setMessage(
        error instanceof Error
          ? `Dashboard load error: ${error.message}`
          : "Dashboard data load nahi hua."
      );
    } finally {
      setLoading(false);
    }
  }

  const completionRate = useMemo(() => {
    if (data.totalCases === 0) return 0;
    return Math.round((data.completedCases / data.totalCases) * 100);
  }, [data.completedCases, data.totalCases]);

  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div>
            <div style={styles.kicker}>POWERED BY AKYOS DEVELOPMENT</div>
            <h1 style={styles.title}>Shiv Shakti Recovery Dashboard</h1>
            <p style={styles.subtitle}>
              Real-time executive tracking, case allocations, aur recovery analytics overview.
            </p>
          </div>

          <button
            onClick={() => void loadDashboard()}
            disabled={loading}
            style={styles.refreshButton}
          >
            {loading ? "Refreshing..." : "Refresh Stats"}
          </button>
        </div>
      </section>

      {message && <div style={styles.errorBox}>{message}</div>}

      <section style={styles.statsGrid}>
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
          <article key={String(label)} style={styles.statCard}>
            <span style={styles.statLabel}>{label}</span>
            <strong style={styles.statValue}>
              {typeof value === "number" ? value.toLocaleString("en-IN") : value}
            </strong>
          </article>
        ))}
      </section>

      <section style={styles.tablePanel}>
        <div style={styles.tableHeading}>
          <h2 style={styles.tableTitle}>Recent Imported Cases</h2>
          <p style={styles.tableSubtitle}>System mein last 8 live cases.</p>
        </div>

        {loading ? (
          <div style={styles.loadingBox}>Loading real-time stats...</div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeaderRow}>
                  {["Case / Acc No.", "Customer Name", "Market / Area", "Status", "Allocation"].map(
                    (item) => (
                      <th key={item} style={styles.tableHeader}>
                        {item}
                      </th>
                    )
                  )}
                </tr>
              </thead>

              <tbody>
                {data.recentCases.map((item) => (
                  <tr key={item.id}>
                    <td style={{ ...styles.tableCell, ...styles.caseNumber }}>{item.caseNo}</td>
                    <td style={styles.tableCell}>{item.customerName}</td>
                    <td style={styles.tableCell}>{item.area}</td>
                    <td style={styles.tableCell}>{item.status}</td>
                    <td style={styles.tableCell}>
                      <span
                        style={{
                          ...styles.assignmentBadge,
                          ...(item.assignedExecutive ? styles.assignedBadge : styles.unassignedBadge),
                        }}
                      >
                        {item.assignedExecutive
                          ? `Assigned (${item.assignedExecutive})`
                          : "Unassigned"}
                      </span>
                    </td>
                  </tr>
                ))}

                {data.recentCases.length === 0 && (
                  <tr>
                    <td colSpan={5} style={styles.emptyTableCell}>
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

const styles: Record<string, CSSProperties> = {
  page: { minHeight: "100%", padding: 26, backgroundColor: "#f5f7fb", color: "#0f172a", boxSizing: "border-box" },
  hero: { padding: 30, borderRadius: 22, color: "#ffffff", background: "linear-gradient(135deg,#07192d,#12497b)", boxShadow: "0 18px 45px rgba(7,25,45,.18)" },
  heroContent: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap" },
  kicker: { color: "#bfdbfe", fontSize: 12, fontWeight: 800, letterSpacing: ".12em" },
  title: { margin: "10px 0 0", fontSize: 36, fontWeight: 800 },
  subtitle: { margin: "12px 0 0", color: "#dbeafe" },
  refreshButton: { height: 44, padding: "0 18px", border: "1px solid rgba(255,255,255,.25)", borderRadius: 11, background: "rgba(255,255,255,.1)", color: "#ffffff", fontWeight: 800, cursor: "pointer" },
  errorBox: { marginTop: 16, padding: 13, borderRadius: 10, backgroundColor: "#fef2f2", color: "#b91c1c", fontWeight: 700 },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginTop: 20 },
  statCard: { padding: 18, borderRadius: 16, backgroundColor: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 8px 24px rgba(15,23,42,.05)" },
  statLabel: { color: "#64748b", fontSize: 12, fontWeight: 800 },
  statValue: { display: "block", marginTop: 8, fontSize: 26 },
  tablePanel: { marginTop: 20, padding: 22, borderRadius: 20, backgroundColor: "#ffffff", border: "1px solid #e2e8f0" },
  tableHeading: { marginBottom: 16 },
  tableTitle: { margin: 0, fontSize: 20, fontWeight: 800 },
  tableSubtitle: { margin: "6px 0 0", color: "#64748b", fontSize: 13 },
  loadingBox: { padding: 40, textAlign: "center", color: "#64748b" },
  tableWrap: { overflow: "auto", border: "1px solid #e2e8f0", borderRadius: 14 },
  table: { width: "100%", minWidth: 760, borderCollapse: "collapse", fontSize: 13 },
  tableHeaderRow: { backgroundColor: "#f8fafc" },
  tableHeader: { padding: 12, textAlign: "left", borderBottom: "1px solid #e2e8f0" },
  tableCell: { padding: 12, borderBottom: "1px solid #eef2f7" },
  caseNumber: { fontFamily: "monospace", fontWeight: 800 },
  assignmentBadge: { display: "inline-block", padding: "5px 9px", borderRadius: 999, fontWeight: 800 },
  assignedBadge: { backgroundColor: "#ecfdf5", color: "#047857" },
  unassignedBadge: { backgroundColor: "#fef2f2", color: "#b91c1c" },
  emptyTableCell: { padding: 40, textAlign: "center", color: "#64748b" },
};

export default DashboardPage;