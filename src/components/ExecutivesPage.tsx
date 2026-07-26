import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

type Executive = {
  id: number;
  executive_code: string;
  full_name: string;
  phone: string;
  area: string;
  vehicle_type: string;
  status: string;
};

export default function ExecutivesPage(): React.ReactElement {
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("CRPF Neemuch");
  const [vehicleType, setVehicleType] = useState("car");
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    void fetchExecutives();
  }, []);

  const fetchExecutives = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("executives")
        .select("*")
        .order("id", { ascending: false });

      if (error) throw error;

      if (data) {
        setExecutives(
          data.map((e: any) => ({
            id: e.id,
            executive_code: e.executive_code || e.agent_code || `SS${e.id}`,
            full_name: e.full_name || e.name || "",
            phone: e.phone || e.mobile || "",
            area: e.area || "",
            vehicle_type: e.vehicle_type || "bike",
            status: e.status || "active",
          }))
        );
      }
    } catch (err: any) {
      alert("Error fetching executives: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddExecutive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim()) {
      alert("Please enter full name and phone number.");
      return;
    }

    setIsAdding(true);

    try {
      const generatedCode = `SS${Math.floor(100 + Math.random() * 900)}`;

      // Strict fix: Using executive_code instead of agent_code
      const newExec = {
        executive_code: generatedCode,
        full_name: fullName.trim(),
        phone: phone.trim(),
        area: area.trim(),
        vehicle_type: vehicleType,
        status: "active",
      };

      const { error } = await supabase.from("executives").insert([newExec]);

      if (error) throw error;

      alert(`Executive ${fullName} added successfully! Code: ${generatedCode}`);
      setFullName("");
      setPhone("");
      void fetchExecutives();
    } catch (err: any) {
      alert("Executive Add Error: " + err.message);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div style={{ padding: "24px", backgroundColor: "#f8fafc", minHeight: "100vh" }}>
      <div style={{ marginBottom: "20px" }}>
        <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#0f172a" }}>
          👨‍💼 Field Executive Management
        </h2>
        <p style={{ color: "#64748b", fontSize: "14px" }}>
          Powered by Akyos CRM V2 Architecture
        </p>
      </div>

      {/* Add Executive Form */}
      <div
        style={{
          backgroundColor: "#ffffff",
          padding: "20px",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          marginBottom: "24px",
        }}
      >
        <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "16px" }}>
          + Add New Field Executive
        </h3>

        <form onSubmit={handleAddExecutive} style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
          <input
            type="text"
            placeholder="Executive Name (e.g. rajesh)"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", flex: "1 1 200px" }}
          />

          <input
            type="text"
            placeholder="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", flex: "1 1 180px" }}
          />

          <input
            type="text"
            placeholder="Area (e.g. CRPF Neemuch)"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", flex: "1 1 200px" }}
          />

          <select
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
            style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", flex: "1 1 120px" }}
          >
            <option value="bike">Bike</option>
            <option value="car">Car</option>
          </select>

          <button
            type="submit"
            disabled={isAdding}
            style={{
              padding: "10px 20px",
              backgroundColor: "#2563eb",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              fontWeight: "700",
              cursor: isAdding ? "not-allowed" : "pointer",
            }}
          >
            {isAdding ? "Adding Executive..." : "+ Add Executive"}
          </button>
        </form>
      </div>

      {/* List Executives */}
      <div
        style={{
          backgroundColor: "#ffffff",
          padding: "20px",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
        }}
      >
        <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "16px" }}>
          Executive List ({executives.length})
        </h3>

        {loading ? (
          <p>Loading executives...</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8fafc", textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>
                  <th style={{ padding: "10px" }}>Executive Code</th>
                  <th style={{ padding: "10px" }}>Name</th>
                  <th style={{ padding: "10px" }}>Phone</th>
                  <th style={{ padding: "10px" }}>Assigned Area</th>
                  <th style={{ padding: "10px" }}>Vehicle</th>
                  <th style={{ padding: "10px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {executives.map((ex) => (
                  <tr key={ex.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px", fontWeight: "700" }}>{ex.executive_code}</td>
                    <td style={{ padding: "10px" }}>{ex.full_name}</td>
                    <td style={{ padding: "10px" }}>{ex.phone}</td>
                    <td style={{ padding: "10px", fontWeight: "600", color: "#2563eb" }}>{ex.area}</td>
                    <td style={{ padding: "10px" }}>{ex.vehicle_type}</td>
                    <td style={{ padding: "10px", color: "#059669", fontWeight: "700" }}>{ex.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}