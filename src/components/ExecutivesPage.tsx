import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

type Executive = {
  id: number | string;
  executive_code: string;
  full_name: string;
  phone: string;
  area: string;
  vehicle_type: string;
  status: string;
  role?: string | null;
  user_role?: string | null;
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
  const [workingId, setWorkingId] = useState<number | string | null>(null);

  useEffect(() => {
    void fetchExecutives();
  }, []);

  const fetchExecutives = async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("id", { ascending: false });

      if (error) throw error;

      setExecutives(
        (data ?? [])
          .filter((e: any) => {
            const role = String(e.role ?? e.user_role ?? "").trim().toLowerCase();
            return !role || role === "executive" || role === "field_executive";
          })
          .map((e: any) => ({
            id: e.id,
            executive_code: e.executive_code?.trim() || "",
            full_name: e.full_name || e.name || "",
            phone: e.phone || e.mobile || "",
            area: e.area || "",
            vehicle_type: e.vehicle_type || "bike",
            status: e.status || "active",
            role: e.role ?? null,
            user_role: e.user_role ?? null,
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
      const normalizedPhone = phone.trim();
      const duplicate = executives.some((item) => item.phone.trim() === normalizedPhone);
      if (duplicate) {
        alert("Is phone number se executive pehle se registered hai.");
        return;
      }

      const generatedCode = `SS${Math.floor(100000 + Math.random() * 900000)}`;

      const newExec = {
        id: crypto.randomUUID(), // ✅ YEH LINE ADD KI HAI - UUID generate karega
        executive_code: generatedCode,
        full_name: fullName.trim(),
        phone: phone.trim(),
        area: finalArea,
        vehicle_type: vehicleType,
        status: "active",
        role: "executive",
      };

      const { error } = await supabase.from("profiles").insert([newExec]);

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
        .from("profiles")
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
        .from("profiles")
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
        padding: "4px 8px",
        borderRadius: "999px",
        fontWeight: "700",
        fontSize: "12px",
        display: "inline-block",
        textTransform: "capitalize",
      };
    }

    if (["active", "approved", "online"].includes(normalized)) {
      return {
        color: "#047857",
        backgroundColor: "#d1fae5",
        padding: "4px 8px",
        borderRadius: "999px",
        fontWeight: "700",
        fontSize: "12px",
        display: "inline-block",
        textTransform: "capitalize",
      };
    }

    return {
      color: "#475569",
      backgroundColor: "#e2e8f0",
      padding: "4px 8px",
      borderRadius: "999px",
      fontWeight: "700",
      fontSize: "12px",
      display: "inline-block",
      textTransform: "capitalize",
    };
  };

  return (
    <div
      style={{
        padding: "20px",
        backgroundColor: "#f8fafc",
        minHeight: "100vh",
      }}
    >
      <div style={{ marginBottom: "20px" }}>
        <h2
          style={{
            fontSize: "22px",
            fontWeight: "800",
            color: "#0f172a",
          }}
        >
          👨‍💼 Field Executive Management
        </h2>

        <p style={{ color: "#64748b", fontSize: "13px" }}>
          Powered by Akyos CRM V2 Architecture
        </p>
      </div>

      {/* Add Executive Form */}
      <div
        style={{
          backgroundColor: "#ffffff",
          padding: "16px",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          marginBottom: "20px",
        }}
      >
        <h3
          style={{
            fontSize: "15px",
            fontWeight: "700",
            marginBottom: "12px",
          }}
        >
          + Add New Field Executive
        </h3>

        <form
          onSubmit={handleAddExecutive}
          style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}
        >
          <input
            type="text"
            placeholder="Executive Name (e.g. rajesh)"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              flex: "1 1 180px",
              fontSize: "13px",
            }}
          />

          <input
            type="text"
            placeholder="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              flex: "1 1 140px",
              fontSize: "13px",
            }}
          />

          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              flex: "1 1 160px",
              backgroundColor: "#fff",
              fontSize: "13px",
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
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #2563eb",
                flex: "1 1 160px",
                fontSize: "13px",
              }}
            />
          )}

          <select
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              flex: "1 1 90px",
              fontSize: "13px",
            }}
          >
            <option value="bike">Bike</option>
            <option value="car">Car</option>
          </select>

          <button
            type="submit"
            disabled={isAdding}
            style={{
              padding: "8px 16px",
              backgroundColor: "#2563eb",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              fontWeight: "700",
              fontSize: "13px",
              cursor: isAdding ? "not-allowed" : "pointer",
              opacity: isAdding ? 0.7 : 1,
            }}
          >
            {isAdding ? "Adding..." : "+ Add Executive"}
          </button>
        </form>
      </div>

      {/* List Executives */}
      <div
        style={{
          backgroundColor: "#ffffff",
          padding: "16px",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
        }}
      >
        <h3
          style={{
            fontSize: "15px",
            fontWeight: "700",
            marginBottom: "12px",
          }}
        >
          Executive List ({executives.length})
        </h3>

        {loading ? (
          <p style={{ fontSize: "13px", color: "#64748b" }}>Loading executives...</p>
        ) : (
          <div style={{ overflowX: "auto", width: "100%" }}>
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
                  }}
                >
                  <th style={{ padding: "8px 10px" }}>Code</th>
                  <th style={{ padding: "8px 10px" }}>Name</th>
                  <th style={{ padding: "8px 10px" }}>Phone</th>
                  <th style={{ padding: "8px 10px" }}>Assigned Area</th>
                  <th style={{ padding: "8px 10px" }}>Vehicle</th>
                  <th style={{ padding: "8px 10px" }}>Status</th>
                  <th style={{ padding: "8px 10px", textAlign: "right" }}>Actions</th>
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
                      <td style={{ padding: "8px 10px", fontWeight: "700" }}>
                        {ex.executive_code || "N/A"}
                      </td>

                      <td style={{ padding: "8px 10px" }}>{ex.full_name}</td>

                      <td style={{ padding: "8px 10px" }}>{ex.phone}</td>

                      <td
                        style={{
                          padding: "8px 10px",
                          fontWeight: "600",
                          color: "#2563eb",
                        }}
                      >
                        {ex.area}
                      </td>

                      <td
                        style={{
                          padding: "8px 10px",
                          textTransform: "capitalize",
                        }}
                      >
                        {ex.vehicle_type}
                      </td>

                      <td style={{ padding: "8px 10px" }}>
                        <span style={statusStyle(ex.status)}>{ex.status}</span>
                      </td>

                      <td style={{ padding: "8px 10px", textAlign: "right" }}>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            gap: "6px",
                          }}
                        >
                          {isPending && (
                            <button
                              type="button"
                              disabled={isWorking}
                              onClick={() => void handleApproveExecutive(ex)}
                              style={{
                                padding: "5px 10px",
                                backgroundColor: "#16a34a",
                                color: "#ffffff",
                                border: "none",
                                borderRadius: "5px",
                                fontWeight: "700",
                                fontSize: "12px",
                                cursor: isWorking ? "not-allowed" : "pointer",
                                opacity: isWorking ? 0.65 : 1,
                              }}
                            >
                              {isWorking ? "Wait..." : "Approve"}
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={isWorking}
                            onClick={() => void handleDeleteExecutive(ex)}
                            style={{
                              padding: "5px 10px",
                              backgroundColor: "#dc2626",
                              color: "#ffffff",
                              border: "none",
                              borderRadius: "5px",
                              fontWeight: "700",
                              fontSize: "12px",
                              cursor: isWorking ? "not-allowed" : "pointer",
                              opacity: isWorking ? 0.65 : 1,
                            }}
                          >
                            {isWorking ? "Wait..." : "Delete"}
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
                        padding: "20px",
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