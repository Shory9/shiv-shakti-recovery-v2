import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

type SbiExecutive = {
  id: string;
  executive_code: string;
  full_name: string;
  mobile: string | null;
  area: string | null;
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

export default function SBIManagementPage() {
  const [executives, setExecutives] = useState<SbiExecutive[]>([]);
  const [cases, setCases] = useState<SbiCase[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    const [executiveResult, caseResult] = await Promise.all([
      supabase.from("sbi_executives").select("id,executive_code,full_name,mobile,area,status").order("created_at"),
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

  useEffect(() => { void loadData(); }, []);

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

  return (
    <div style={{ padding: 24, display: "grid", gap: 22 }}>
      <section style={{ background: "#eef6ff", border: "1px solid #93c5fd", borderRadius: 14, padding: 20 }}>
        <h2 style={{ margin: 0 }}>SBI Operations — Isolated</h2>
        <p style={{ marginBottom: 0 }}>Yahan sirf SBI executives aur SBI cases dikhte hain. BOB data is screen me use nahi hota.</p>
      </section>
      {message && <div style={{ padding: 12, background: "#fff7ed", borderRadius: 10 }}>{message}</div>}
      {loading ? <p>Loading SBI data...</p> : (
        <>
          <section style={{ background: "white", borderRadius: 14, padding: 20 }}>
            <h3>SBI Executive Registrations</h3>
            <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th>Code</th><th>Name</th><th>Area</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>{executives.map((row) => <tr key={row.id}>
                <td>{row.executive_code}</td><td>{row.full_name}</td><td>{row.area || "-"}</td><td>{row.status}</td>
                <td>{row.status === "pending" && <button type="button" onClick={() => void approveExecutive(row)}>Approve</button>}</td>
              </tr>)}</tbody>
            </table></div>
          </section>
          <section style={{ background: "white", borderRadius: 14, padding: 20 }}>
            <h3>SBI Case Assignment</h3>
            <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th>Account</th><th>Customer</th><th>Village</th><th>Status</th><th>SBI Executive</th></tr></thead>
              <tbody>{cases.map((row) => <tr key={row.id}>
                <td>{row.account_number}</td><td>{row.account_name}</td><td>{row.village || "-"}</td><td>{row.status}</td>
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
