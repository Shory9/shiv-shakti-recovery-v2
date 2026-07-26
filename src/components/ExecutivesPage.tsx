import React, {
  type ChangeEvent,
  useEffect,
  useState,
} from "react";

import { supabase } from "../supabaseClient";

type Executive = {
  id: number;
  agent_code?: string | null;
  name: string;
  phone: string;
  area: string;
  cases: number;
  status: string;
};

const WORKING_AREAS = [
  "CRPF Neemuch",
  "Pustak Bajar Neemuch",
  "Neemuch",
  "Manasa",
  "Mandsaur",
  "MEN DB Mandsaur",
  "Jaora",
  "Bilpank",
  "Khachrod",
  "Sailana",
  "Station Road Ratlam",
  "Alkapuri Ratlam",
  "College Road Ratlam",
  "Chandni Chowk Ratlam",
  "Bamaniya",
  "Petlawad",
  "Dhar",
  "Manavar",
  "Tonki",
];

function ExecutiveManagement(): React.ReactElement {
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const [name, setName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [area, setArea] = useState<string>("");
  const [vehicle, setVehicle] = useState<string>("");
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");

  function formatAgentCode(id: number, code?: string | null): string {
    if (code && code.trim().length > 0) return code;
    return "SS" + String(id).padStart(3, "0");
  }

  function cleanPhone(value: string): string {
    return value.replace(/\D/g, "");
  }

  async function loadExecutives(): Promise<void> {
    setLoading(true);
    setErrorMsg("");

    try {
      const { data, error } = await supabase
        .from("executives")
        .select("*")
        .order("id", { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map((row: any) => {
        const execName =
          row.full_name || row.name || row.executive_name || "Field Executive";
        const execCode =
          row.executive_code || row.agent_code || `SS00${row.id}`;
        const execPhone = row.phone || row.mobile || "-";

        return {
          id: Number(row.id),
          agent_code: execCode,
          name: String(execName),
          phone: String(execPhone),
          area: String(row.area || "Unassigned"),
          cases: Number(row.cases || 0),
          status: String(row.status || "active").toLowerCase(),
        };
      });

      setExecutives(formatted);
    } catch (err: any) {
      console.error("Load Executives Error:", err);
      setErrorMsg(err.message || "Executives load nahi ho paaye.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadExecutives();
  }, []);

  async function addExecutive(): Promise<void> {
    if (isAdding) return;

    const cleanName = name.trim();
    const normalizedPhone = cleanPhone(phone);
    const cleanArea = area.trim();

    if (!cleanName || !normalizedPhone || !cleanArea) {
      alert("Name, phone aur working area required hai.");
      return;
    }

    if (normalizedPhone.length < 10) {
      alert("Valid 10-digit mobile number enter karo.");
      return;
    }

    setIsAdding(true);

    try {
      // 1. Unique code generate karo
      const generatedCode = "SS" + Math.floor(100 + Math.random() * 900);

      // 2. Both columns sync insert
      const { data, error } = await supabase
        .from("executives")
        .insert({
          full_name: cleanName,
          name: cleanName,
          phone: normalizedPhone,
          mobile: normalizedPhone,
          area: cleanArea,
          executive_code: generatedCode,
          agent_code: generatedCode,
          cases: 0,
          status: "active",
        })
        .select()
        .single();

      if (error) throw error;

      setName("");
      setPhone("");
      setArea("");
      setVehicle("");

      await loadExecutives();

      alert(
        `Executive added successfully!\nAgent Code: ${
          data?.executive_code || generatedCode
        }\nName: ${cleanName}`
      );
    } catch (error: any) {
      alert("Executive Add Error: " + (error.message || "Unknown error"));
    } finally {
      setIsAdding(false);
    }
  }

  async function toggleStatus(item: Executive): Promise<void> {
    const isCurrentlyActive = item.status === "active";
    const nextStatus = isCurrentlyActive ? "inactive" : "active";

    try {
      const { error } = await supabase
        .from("executives")
        .update({ status: nextStatus })
        .eq("id", item.id);

      if (error) throw error;

      setExecutives((old) =>
        old.map((exec) =>
          exec.id === item.id ? { ...exec, status: nextStatus } : exec
        )
      );
    } catch (err: any) {
      alert("Status update error: " + err.message);
    }
  }

  async function deleteExecutive(item: Executive): Promise<void> {
    const confirmed = window.confirm(
      `Warning: ${formatAgentCode(item.id, item.agent_code)} - ${item.name} ko permanently delete karna hai?`
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("executives")
        .delete()
        .eq("id", item.id);

      if (error) throw error;

      await loadExecutives();
      alert("Executive deleted successfully.");
    } catch (err: any) {
      alert("Delete error: " + err.message);
    }
  }

  const filteredExecutives = executives.filter((item: Executive) => {
    const q = searchTerm.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.phone.includes(q) ||
      item.area.toLowerCase().includes(q) ||
      formatAgentCode(item.id, item.agent_code).toLowerCase().includes(q)
    );
  });

  return (
    <div className="module-card" style={{ padding: "24px", backgroundColor: "#f8fafc", minHeight: "100vh" }}>
      <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#0f172a", marginBottom: "4px" }}>
        👨‍💼 Field Executive Management
      </h2>
      <p style={{ color: "#64748b", fontSize: "13px", margin: 0 }}>
        Powered by Akyos CRM V2 Architecture
      </p>

      {errorMsg && (
        <div style={{ marginTop: "16px", padding: "12px", backgroundColor: "#fef2f2", color: "#b91c1c", borderRadius: "6px", fontSize: "13px", fontWeight: "600" }}>
          🚨 {errorMsg}
        </div>
      )}

      <hr style={{ margin: "16px 0", borderColor: "#e2e8f0" }} />

      <h3 style={{ fontSize: "15px", fontWeight: "700", marginBottom: "12px" }}>+ Add New Field Executive</h3>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", maxWidth: "850px" }}>
        <input
          placeholder="Executive Full Name"
          value={name}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
          style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "13px" }}
        />

        <input
          placeholder="Mobile Number"
          value={phone}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setPhone(event.target.value)}
          style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "13px" }}
        />

        <select
          value={area}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => setArea(event.target.value)}
          style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", backgroundColor: "#fff", fontSize: "13px" }}
        >
          <option value="">Select Working Area</option>
          {WORKING_AREAS.map((workingArea) => (
            <option key={workingArea} value={workingArea}>
              {workingArea}
            </option>
          ))}
        </select>

        <input
          placeholder="Vehicle Number / Info"
          value={vehicle}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setVehicle(event.target.value)}
          style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "13px" }}
        />
      </div>

      <button
        onClick={addExecutive}
        disabled={isAdding}
        style={{
          marginTop: "16px",
          padding: "9px 20px",
          backgroundColor: "#2563eb",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontWeight: "700",
          fontSize: "13px",
          opacity: isAdding ? 0.7 : 1
        }}
      >
        {isAdding ? "Adding Executive..." : "+ Save Executive"}
      </button>

      <hr style={{ margin: "24px 0", borderColor: "#e2e8f0" }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h3 style={{ fontSize: "15px", fontWeight: "700", margin: 0 }}>
          Executive List ({filteredExecutives.length})
        </h3>
        <input
          placeholder="Search by Code, Name, Area..."
          value={searchTerm}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
          style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", width: "260px", fontSize: "13px" }}
        />
      </div>

      <div style={{ overflowX: "auto", backgroundColor: "#ffffff", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ backgroundColor: "#f8fafc", textAlign: "left", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
              <th style={{ padding: "10px" }}>Agent Code</th>
              <th style={{ padding: "10px" }}>Name</th>
              <th style={{ padding: "10px" }}>Phone</th>
              <th style={{ padding: "10px" }}>Working Area</th>
              <th style={{ padding: "10px" }}>Assigned Cases</th>
              <th style={{ padding: "10px" }}>Status</th>
              <th style={{ padding: "10px", textAlign: "right" }}>Action</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: "24px", textAlign: "center", color: "#64748b" }}>
                  Executives load ho rahe hain...
                </td>
              </tr>
            ) : filteredExecutives.length > 0 ? (
              filteredExecutives.map((item: Executive) => {
                const isActive = item.status === "active";
                return (
                  <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px" }}>
                      <strong style={{ color: "#2563eb" }}>{formatAgentCode(item.id, item.agent_code)}</strong>
                    </td>
                    <td style={{ padding: "10px", fontWeight: "600", color: "#0f172a" }}>{item.name}</td>
                    <td style={{ padding: "10px", color: "#475569" }}>{item.phone}</td>
                    <td style={{ padding: "10px", color: "#475569" }}>{item.area}</td>
                    <td style={{ padding: "10px", fontWeight: "700" }}>{item.cases}</td>
                    <td style={{ padding: "10px" }}>
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: "12px",
                          fontSize: "11px",
                          fontWeight: "700",
                          backgroundColor: isActive ? "#ecfdf5" : "#fef2f2",
                          color: isActive ? "#059669" : "#dc2626",
                          textTransform: "capitalize"
                        }}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td style={{ padding: "10px", textAlign: "right" }}>
                      <button
                        onClick={() => toggleStatus(item)}
                        style={{ padding: "4px 10px", backgroundColor: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "4px", cursor: "pointer", marginRight: "6px", fontSize: "11px", fontWeight: "600" }}
                      >
                        {isActive ? "Deactivate" : "Activate"}
                      </button>

                      <button
                        onClick={() => deleteExecutive(item)}
                        style={{ padding: "4px 10px", backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: "4px", cursor: "pointer", fontSize: "11px", fontWeight: "600" }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} style={{ padding: "24px", textAlign: "center", color: "#94a3b8" }}>
                  No executives found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ExecutiveManagement;