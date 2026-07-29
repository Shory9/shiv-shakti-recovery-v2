import React, { useEffect, useState } from "react";
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

// Available pre-defined areas for Neemuch region
const PREDEFINED_AREAS = [
  "CRPF Neemuch",
  "Neemuch City",
  "Neemuch Cantt",
  "CRPF Road Neemuch",
  "Mandsaur",
  "Manasa",
  "Jawad",
  "Singoli",
  "Rampura",
  "Custom Area (Type manually)",
];

export default function ExecutivesPage(): React.ReactElement {
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedArea, setSelectedArea] = useState("CRPF Neemuch");
  const [customArea, setCustomArea] = useState("");
  const [vehicleType, setVehicleType] = useState("car");
  const [isAdding, setIsAdding] = useState(false);
  const [workingId, setWorkingId] = useState<number | null>(null);

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

      setExecutives(
        (data ?? []).map((e: any) => ({
          id: Number(e.id),
          executive_code: e.executive_code || e.agent_code || `SS${e.id}`,
          full_name: e.full_name || e.name || "",
          phone: e.phone || e.mobile || "",
          area: e.area || "",
          vehicle_type: e.vehicle_type || "bike",
          status: e.status || "active",
        }))
      );
    } catch (err: any) {
      alert("Error fetching executives: " + (err?.message || "Unknown error"));
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

    const finalArea =
      selectedArea === "Custom Area (Type manually)"
        ? customArea.trim()
        : selectedArea;

    if (!finalArea) {
      alert("Please specify an area.");
      return;
    }

    setIsAdding(true);

    try {
      const generatedCode = `SS${Math.floor(100000 + Math.random() * 900000)}`;

      const newExec = {
        executive_code: generatedCode,
        full_name: fullName.trim(),
        phone: phone.trim(),
        area: finalArea,
        vehicle_type: vehicleType,
        status: "active",
      };

      const { error } = await supabase.from("executives").insert([newExec]);

      if (error) throw error;

      alert(
        `Executive ${fullName.trim()} added successfully for ${finalArea}! Code: ${generatedCode}`
      );

      setFullName("");
      setPhone("");
      setCustomArea("");
      setSelectedArea("CRPF Neemuch");
      setVehicleType("car");

      await fetchExecutives();
    } catch (err: any) {
      alert("Executive Add Error: " + (err?.message || "Unknown error"));
    } finally {
      setIsAdding(false);
    }
  };

  const handleApproveExecutive = async (executive: Executive) => {
    const confirmed = window.confirm(
      `${executive.full_name} ko approve karna hai?`
    );

    if (!confirmed) return;

    setWorkingId(executive.id);

    try {
      const { error } = await supabase
        .from("executives")
        .update({ status: "active" })
        .eq("id", executive.id);

      if (error) throw error;

      setExecutives((current) =>
        current.map((item) =>
          item.id === executive.id ? { ...item, status: "active" } : item
        )
      );

      alert(`${executive.full_name} approved successfully.`);
    } catch (err: any) {
      alert("Approval Error: " + (err?.message || "Unknown error"));
    } finally {
      setWorkingId(null);
    }
  };

  const handleDeleteExecutive = async (executive: Executive) => {
    const confirmed = window.confirm(
      `${executive.full_name} ko permanently delete karna hai?`
    );

    if (!confirmed) return;

    setWorkingId(executive.id);

    try {
      const { error } = await supabase
        .from("executives")
        .delete()
        .eq("id", executive.id);

      if (error) throw error;

      setExecutives((current) =>
        current.filter((item) => item.id !== executive.id)
      );

      alert(`${executive.full_name} deleted successfully.`);
    } catch (err: any) {
      alert("Delete Error: " + (err?.message || "Unknown error"));
    } finally {
      setWorkingId(null);
    }
  };

  const statusStyle = (status: string): React.CSSProperties => {
    const normalized = status.trim().toLowerCase();

    if (normalized === "pending") {
      return {
        color: "#b45309",
        backgroundColor: "#fef3c7",
        padding: "5px 10px",
        borderRadius: "999px",
        fontWeight: "800",
        display: "inline-block",
        textTransform: "capitalize",
      };
    }

    if (["active", "approved", "online"].includes(normalized)) {
      return {
        color: "#047857",
        backgroundColor: "#d1fae5",
        padding: "5px 10px",
        borderRadius: "999px",
        fontWeight: "800",
        display: "inline-block",
        textTransform: "capitalize",
      };
    }

    return {
      color: "#475569",
      backgroundColor: "#e2e8f0",
      padding: "5px 10px",
      borderRadius: "999px",
      fontWeight: "800",
      display: "inline-block",
      textTransform: "capitalize",
    };
  };

  return (
    <div
      style={{
        padding: "24px",
        backgroundColor: "#f8fafc",
        minHeight: "100vh",
      }}
    >
      <div style={{ marginBottom: "20px" }}>
        <h2
          style={{
            fontSize: "24px",
            fontWeight: "800",
            color: "#0f172a",
          }}
        >
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
        <h3
          style={{
            fontSize: "16px",
            fontWeight: "700",
            marginBottom: "16px",
          }}
        >
          + Add New Field Executive
        </h3>

        <form
          onSubmit={handleAddExecutive}
          style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}
        >
          <input
            type="text"
            placeholder="Executive Name (e.g. rajesh)"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              flex: "1 1 200px",
            }}
          />

          <input
            type="text"
            placeholder="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              flex: "1 1 180px",
            }}
          />

          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              flex: "1 1 200px",
              backgroundColor: "#fff",
            }}
          >
            {PREDEFINED_AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          {selectedArea === "Custom Area (Type manually)" && (
            <input
              type="text"
              placeholder="Enter Custom Area Name"
              value={customArea}
              onChange={(e) => setCustomArea(e.target.value)}
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid #2563eb",
                flex: "1 1 200px",
              }}
            />
          )}

          <select
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              flex: "1 1 100px",
            }}
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
              opacity: isAdding ? 0.7 : 1,
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
        <h3
          style={{
            fontSize: "16px",
            fontWeight: "700",
            marginBottom: "16px",
          }}
        >
          Executive List ({executives.length})
        </h3>

        {loading ? (
          <p>Loading executives...</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "14px",
                minWidth: "900px",
              }}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: "#f8fafc",
                    textAlign: "left",
                    borderBottom: "2px solid #e2e8f0",
                  }}
                >
                  <th style={{ padding: "10px" }}>Executive Code</th>
                  <th style={{ padding: "10px" }}>Name</th>
                  <th style={{ padding: "10px" }}>Phone</th>
                  <th style={{ padding: "10px" }}>Assigned Area</th>
                  <th style={{ padding: "10px" }}>Vehicle</th>
                  <th style={{ padding: "10px" }}>Status</th>
                  <th style={{ padding: "10px" }}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {executives.map((ex) => {
                  const isPending =
                    ex.status.trim().toLowerCase() === "pending";
                  const isWorking = workingId === ex.id;

                  return (
                    <tr
                      key={ex.id}
                      style={{ borderBottom: "1px solid #f1f5f9" }}
                    >
                      <td style={{ padding: "10px", fontWeight: "700" }}>
                        {ex.executive_code}
                      </td>

                      <td style={{ padding: "10px" }}>{ex.full_name}</td>

                      <td style={{ padding: "10px" }}>{ex.phone}</td>

                      <td
                        style={{
                          padding: "10px",
                          fontWeight: "600",
                          color: "#2563eb",
                        }}
                      >
                        {ex.area}
                      </td>

                      <td
                        style={{
                          padding: "10px",
                          textTransform: "capitalize",
                        }}
                      >
                        {ex.vehicle_type}
                      </td>

                      <td style={{ padding: "10px" }}>
                        <span style={statusStyle(ex.status)}>{ex.status}</span>
                      </td>

                      <td style={{ padding: "10px" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            flexWrap: "wrap",
                          }}
                        >
                          {isPending && (
                            <button
                              type="button"
                              disabled={isWorking}
                              onClick={() => void handleApproveExecutive(ex)}
                              style={{
                                padding: "8px 12px",
                                backgroundColor: "#16a34a",
                                color: "#ffffff",
                                border: "none",
                                borderRadius: "7px",
                                fontWeight: "700",
                                cursor: isWorking ? "not-allowed" : "pointer",
                                opacity: isWorking ? 0.65 : 1,
                              }}
                            >
                              {isWorking ? "Please wait..." : "Approve"}
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={isWorking}
                            onClick={() => void handleDeleteExecutive(ex)}
                            style={{
                              padding: "8px 12px",
                              backgroundColor: "#dc2626",
                              color: "#ffffff",
                              border: "none",
                              borderRadius: "7px",
                              fontWeight: "700",
                              cursor: isWorking ? "not-allowed" : "pointer",
                              opacity: isWorking ? 0.65 : 1,
                            }}
                          >
                            {isWorking ? "Please wait..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {executives.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        padding: "24px",
                        textAlign: "center",
                        color: "#64748b",
                      }}
                    >
                      No executives found.
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