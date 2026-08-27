import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

export type SbiExecutive = {
  id: string;
  executive_code: string;
  full_name: string;
  mobile: string | null;
  area: string | null;
  vehicle_type: string | null;
  status: string;
};

type SbiCase = {
  id: string;
  account_number: string;
  account_name: string;
  village: string | null;
  status: string;
  assigned_executive_id: string | null;
};

type SBIManagementPageProps = {
  onDirectImport?: (executive: SbiExecutive) => void;
};

export default function SBIManagementPage({ onDirectImport }: SBIManagementPageProps) {
  const [executives, setExecutives] = useState<SbiExecutive[]>([]);
  const [cases, setCases] = useState<SbiCase[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    const [executiveResult, caseResult] = await Promise.all([
      supabase.from("sbi_executives").select("id,executive_code,full_name,mobile,area,vehicle_type,status").order("created_at"),
      supabase.from("sbi_cases").select("id,account_number,account_name,village,status,assigned_executive_id").order("created_at", { ascending: false }),
    ]);
    if (executiveResult.error || caseResult.error) {
      setMessage(executiveResult.error?.message || caseResult.error?.message || "SBI data load nahi hua.");
    } else {
      setExecutives((executiveResult.data ?? []) as SbiExecutive[]);
      setCases((caseResult.data ?? []) as SbiCase[]);
      setMessage("");
    }
    setLoading(false);
  }

  useEffect(() => {
    // Initial remote data sync is intentionally started when this page mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, []);

  async function approveExecutive(executive: SbiExecutive) {
    const { error } = await supabase.from("sbi_executives").update({ status: "approved" }).eq("id", executive.id);
    if (error) return setMessage(error.message);
    setExecutives((rows) => rows.map((row) => row.id === executive.id ? { ...row, status: "approved" } : row));
    setMessage(`${executive.executive_code} approve ho gaya.`);
  }

  async function assignCase(caseId: string, executiveId: string) {
    const executive = executives.find((row) => row.id === executiveId);
    const payload = executive ? {
      assigned_executive_id: executive.id,
      assigned_executive: `${executive.executive_code} - ${executive.full_name}`,
      executive_code: executive.executive_code,
    } : { assigned_executive_id: null, assigned_executive: null, executive_code: null };
    const { error } = await supabase.from("sbi_cases").update(payload).eq("id", caseId);
    if (error) return setMessage(error.message);
    setCases((rows) => rows.map((row) => row.id === caseId ? { ...row, assigned_executive_id: executiveId || null } : row));
    setMessage(executive ? `Case ${executive.executive_code} ko assign ho gaya.` : "Case unassigned ho gaya.");
  }

  const approvedExecutives = useMemo(
    () => executives.filter((row) => ["approved", "active", "online"].includes(row.status.toLowerCase())),
    [executives]
  );

  const assignedCountByExecutive = useMemo(() => {
    const counts = new Map<string, number>();
    cases.forEach((row) => {
      if (row.assigned_executive_id) {
        counts.set(row.assigned_executive_id, (counts.get(row.assigned_executive_id) || 0) + 1);
      }
    });
    return counts;
  }, [cases]);

  const statusStyle = (status: string): React.CSSProperties => {
    const active = ["approved", "active", "online"].includes(status.toLowerCase());
    return {
      display: "inline-block", padding: "4px 9px", borderRadius: 999,
      background: active ? "#d1fae5" : "#fef3c7",
      color: active ? "#047857" : "#b45309", fontSize: 12, fontWeight: 800,
    };
  };

  return (
    <div style={{ padding: 20, display: "grid", gap: 20, background: "#f8fafc", minHeight: "100vh" }}>
      <section style={{ background: "linear-gradient(135deg,#082f49,#0369a1)", color: "white", borderRadius: 18, padding: 24, boxShadow: "0 12px 30px rgba(3,105,161,.18)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.2, color: "#bae6fd" }}>STATE BANK OF INDIA</div>
            <h2 style={{ margin: "7px 0 5px", fontSize: 24 }}>SBI Field Executive Management</h2>
            <p style={{ margin: 0, color: "#e0f2fe" }}>Executive ke saamne file upload karke cases direct assign karein.</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ padding: "11px 15px", borderRadius: 12, background: "rgba(255,255,255,.12)" }}><small>Executives</small><strong style={{ display: "block", fontSize: 21 }}>{executives.length}</strong></div>
            <div style={{ padding: "11px 15px", borderRadius: 12, background: "rgba(255,255,255,.12)" }}><small>SBI Cases</small><strong style={{ display: "block", fontSize: 21 }}>{cases.length}</strong></div>
          </div>
        </div>
      </section>
      {message && <div style={{ padding: 12, background: "#fff7ed", borderRadius: 10 }}>{message}</div>}
      {loading ? <p>Loading SBI data...</p> : (
        <>
          <section style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: 18 }}>
            <h3 style={{ marginTop: 0 }}>SBI Executive List ({executives.length})</h3>
            <div style={{ overflowX: "auto" }}><table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
              <thead><tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}><th style={{ padding: 10 }}>Code</th><th>Name</th><th>Mobile</th><th>Assigned Area</th><th>Vehicle</th><th>Status</th><th>Cases</th><th style={{ textAlign: "right", padding: 10 }}>Actions</th></tr></thead>
              <tbody>{executives.map((row) => {
                const approved = ["approved", "active", "online"].includes(row.status.toLowerCase());
                return <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: 10, fontWeight: 800 }}>{row.executive_code}</td><td>{row.full_name}</td><td>{row.mobile || "-"}</td><td style={{ color: "#0369a1", fontWeight: 700 }}>{row.area || "-"}</td><td style={{ textTransform: "capitalize" }}>{row.vehicle_type || "-"}</td><td><span style={statusStyle(row.status)}>{row.status}</span></td><td style={{ fontWeight: 800 }}>{assignedCountByExecutive.get(row.id) || 0}</td>
                <td style={{ textAlign: "right", padding: 10 }}><div style={{ display: "inline-flex", gap: 7 }}>
                  <button type="button" disabled={!approved} onClick={() => onDirectImport?.(row)} style={{ padding: "7px 11px", border: 0, borderRadius: 6, background: "#2563eb", color: "white", fontWeight: 800, cursor: approved ? "pointer" : "not-allowed", opacity: approved ? 1 : .5 }}>Upload Bank File</button>
                  {!approved && <button type="button" onClick={() => void approveExecutive(row)} style={{ padding: "7px 11px", border: 0, borderRadius: 6, background: "#16a34a", color: "white", fontWeight: 800, cursor: "pointer" }}>Approve</button>}
                </div></td>
              </tr>})}</tbody>
            </table></div>
          </section>
          <section style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: 18 }}>
            <h3 style={{ marginTop: 0 }}>SBI Case Assignment</h3>
            <div style={{ overflowX: "auto" }}><table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
              <thead><tr style={{ background: "#f8fafc" }}><th style={{ padding: 9 }}>Account</th><th>Customer</th><th>Village</th><th>Status</th><th>SBI Executive</th></tr></thead>
              <tbody>{cases.map((row) => <tr key={row.id}>
                <td style={{ padding: 9 }}>{row.account_number}</td><td>{row.account_name}</td><td>{row.village || "-"}</td><td>{row.status}</td>
                <td><select value={row.assigned_executive_id || ""} onChange={(event) => void assignCase(row.id, event.target.value)}>
                  <option value="">Unassigned</option>
                  {approvedExecutives.map((executive) => <option key={executive.id} value={executive.id}>{executive.executive_code} - {executive.full_name}</option>)}
                </select></td>
              </tr>)}</tbody>
            </table></div>
          </section>
        </>
      )}
    </div>
  );
}
