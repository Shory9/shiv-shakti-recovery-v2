import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

type ExecutiveStatus = "Active" | "Inactive";

type ExecutiveRow = {
  id: number;
  code: string | null;
  name: string | null;
  mobile: string | null;
  area: string | null;
  status: string | null;
  created_at?: string | null;
};

type ExecutiveView = {
  id: number;
  code: string;
  name: string;
  mobile: string;
  area: string;
  status: ExecutiveStatus;
  assignedCases: number;
  completedCases: number;
};

type FormData = {
  code: string;
  name: string;
  mobile: string;
  area: string;
  status: ExecutiveStatus;
};

const emptyForm: FormData = {
  code: "",
  name: "",
  mobile: "",
  area: "",
  status: "Active",
};

function ExecutivesPage() {
  const [executives, setExecutives] = useState<ExecutiveView[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ExecutiveStatus | "All">("All");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void loadExecutives();
  }, []);

  const fetchAllCases = async () => {
    const allRows: Array<{ assigned_executive_id: number | null; status: string | null }> = [];
    const pageSize = 1000;
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from("cases")
        .select("assigned_executive_id,status")
        .range(from, from + pageSize - 1);

      if (error) throw error;

      const rows = (data ?? []) as Array<{
        assigned_executive_id: number | null;
        status: string | null;
      }>;

      allRows.push(...rows);
      if (rows.length < pageSize) break;
      from += pageSize;
    }

    return allRows;
  };

  const loadExecutives = async () => {
    setLoading(true);
    setMessage("");

    try {
      const [executiveResult, cases] = await Promise.all([
        supabase
          .from("executives")
          .select("id,code,name,mobile,area,status,created_at")
          .order("created_at", { ascending: false }),
        fetchAllCases(),
      ]);

      if (executiveResult.error) throw executiveResult.error;

      const rows = (executiveResult.data ?? []) as ExecutiveRow[];

      const mapped = rows.map<ExecutiveView>((row) => {
        const assigned = cases.filter(
          (item) => Number(item.assigned_executive_id) === Number(row.id)
        );

        const completed = assigned.filter((item) => {
          const value = String(item.status ?? "").toLowerCase();
          return value === "completed" || value === "paid";
        }).length;

        return {
          id: row.id,
          code: row.code ?? "",
          name: row.name ?? "",
          mobile: row.mobile ?? "",
          area: row.area ?? "",
          status: row.status === "Inactive" ? "Inactive" : "Active",
          assignedCases: assigned.length,
          completedCases: completed,
        };
      });

      setExecutives(mapped);
    } catch (error) {
      console.error("Executives load error:", error);
      setMessage(
        error instanceof Error
          ? `Executives load error: ${error.message}`
          : "Executives load nahi hue."
      );
    } finally {
      setLoading(false);
    }
  };

  const filteredExecutives = useMemo(() => {
    const query = search.trim().toLowerCase();

    return executives.filter((executive) => {
      const matchesSearch =
        !query ||
        executive.name.toLowerCase().includes(query) ||
        executive.code.toLowerCase().includes(query) ||
        executive.mobile.toLowerCase().includes(query) ||
        executive.area.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "All" || executive.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [executives, search, statusFilter]);

  const activeCount = executives.filter((item) => item.status === "Active").length;
  const assignedCount = executives.reduce((sum, item) => sum + item.assignedCases, 0);
  const completedCount = executives.reduce((sum, item) => sum + item.completedCases, 0);

  const openAdd = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setShowModal(true);
    setMessage("");
  };

  const openEdit = (executive: ExecutiveView) => {
    setEditingId(executive.id);
    setFormData({
      code: executive.code,
      name: executive.name,
      mobile: executive.mobile,
      area: executive.area,
      status: executive.status,
    });
    setShowModal(true);
    setMessage("");
  };

  const saveExecutive = async () => {
    if (!formData.name.trim() || !formData.area.trim()) {
      setMessage("Executive Name aur Area required hai.");
      return;
    }

    setSaving(true);
    setMessage("");

    const payload = {
      code: formData.code.trim(),
      name: formData.name.trim(),
      mobile: formData.mobile.trim(),
      area: formData.area.trim(),
      status: formData.status,
    };

    try {
      if (editingId === null) {
        const { error } = await supabase.from("executives").insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("executives")
          .update(payload)
          .eq("id", editingId);

        if (error) throw error;
      }

      setShowModal(false);
      setFormData(emptyForm);
      setEditingId(null);
      await loadExecutives();
    } catch (error) {
      console.error("Executive save error:", error);
      setMessage(
        error instanceof Error
          ? `Save error: ${error.message}`
          : "Executive save nahi hua."
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteExecutive = async (id: number) => {
    const assignedCases = executives.find((item) => item.id === id)?.assignedCases ?? 0;

    if (assignedCases > 0) {
      setMessage(
        "Is executive ke historical cases assigned hain. Delete ke badle status Inactive karein."
      );
      return;
    }

    if (!window.confirm("Kya aap is executive ko delete karna chahte hain?")) return;

    const { error } = await supabase.from("executives").delete().eq("id", id);

    if (error) {
      setMessage(`Delete error: ${error.message}`);
      return;
    }

    await loadExecutives();
  };

  return (
    <div style={{ minHeight: "100%", padding: 26, background: "#f5f7fb", color: "#0f172a" }}>
      <section style={{ padding: 30, borderRadius: 22, color: "white", background: "linear-gradient(135deg,#07192d,#12497b)", boxShadow: "0 18px 45px rgba(7,25,45,.18)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ color: "#bfdbfe", fontSize: 12, fontWeight: 800, letterSpacing: ".12em" }}>WORKFORCE MANAGEMENT</div>
            <h1 style={{ margin: "10px 0 0", fontSize: 36 }}>Executive Management</h1>
            <p style={{ margin: "12px 0 0", color: "#dbeafe" }}>
              Har executive ko ek fixed area dein. Bank Import exact area match se case assign karega.
            </p>
          </div>
          <button onClick={openAdd} style={{ height: 46, padding: "0 22px", border: 0, borderRadius: 12, background: "#2563eb", color: "white", fontWeight: 800, cursor: "pointer" }}>
            + Add Executive
          </button>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginTop: 20 }}>
        {[
          ["Total Executives", executives.length],
          ["Active Executives", activeCount],
          ["Assigned Cases", assignedCount],
          ["Completed Cases", completedCount],
        ].map(([label, value]) => (
          <article key={String(label)} style={{ padding: 18, borderRadius: 16, background: "white", border: "1px solid #e2e8f0" }}>
            <span style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>{label}</span>
            <strong style={{ display: "block", marginTop: 8, fontSize: 26 }}>{value}</strong>
          </article>
        ))}
      </section>

      <section style={{ marginTop: 20, padding: 22, borderRadius: 20, background: "white", border: "1px solid #e2e8f0" }}>
        {message && (
          <div style={{ marginBottom: 16, padding: 12, borderRadius: 10, background: "#fef2f2", color: "#b91c1c", fontWeight: 700 }}>
            {message}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "minmax(240px,1fr) minmax(180px,260px)", gap: 12, marginBottom: 18 }}>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, code, mobile or area" style={{ height: 46, padding: "0 13px", border: "1px solid #cbd5e1", borderRadius: 11 }} />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ExecutiveStatus | "All")} style={{ height: 46, padding: "0 13px", border: "1px solid #cbd5e1", borderRadius: 11, background: "white" }}>
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Loading executives...</div>
        ) : (
          <div style={{ overflow: "auto", border: "1px solid #e2e8f0", borderRadius: 14 }}>
            <table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Executive", "Code", "Mobile", "Area", "Assigned", "Completed", "Status", "Actions"].map((item) => (
                    <th key={item} style={{ padding: 12, textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>{item}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredExecutives.map((executive) => (
                  <tr key={executive.id}>
                    <td style={{ padding: 12, borderBottom: "1px solid #eef2f7", fontWeight: 800 }}>{executive.name}</td>
                    <td style={{ padding: 12, borderBottom: "1px solid #eef2f7" }}>{executive.code || "-"}</td>
                    <td style={{ padding: 12, borderBottom: "1px solid #eef2f7" }}>{executive.mobile || "-"}</td>
                    <td style={{ padding: 12, borderBottom: "1px solid #eef2f7" }}>{executive.area || "-"}</td>
                    <td style={{ padding: 12, borderBottom: "1px solid #eef2f7" }}>{executive.assignedCases}</td>
                    <td style={{ padding: 12, borderBottom: "1px solid #eef2f7" }}>{executive.completedCases}</td>
                    <td style={{ padding: 12, borderBottom: "1px solid #eef2f7" }}>
                      <span style={{ padding: "5px 9px", borderRadius: 999, fontWeight: 800, background: executive.status === "Active" ? "#ecfdf5" : "#fef2f2", color: executive.status === "Active" ? "#047857" : "#b91c1c" }}>
                        {executive.status}
                      </span>
                    </td>
                    <td style={{ padding: 12, borderBottom: "1px solid #eef2f7" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => openEdit(executive)} style={{ padding: "7px 10px", border: "1px solid #bfdbfe", borderRadius: 8, background: "#eff6ff", color: "#1d4ed8", fontWeight: 800, cursor: "pointer" }}>Edit</button>
                        <button onClick={() => void deleteExecutive(executive.id)} style={{ padding: "7px 10px", border: "1px solid #fecaca", borderRadius: 8, background: "#fef2f2", color: "#dc2626", fontWeight: 800, cursor: "pointer" }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredExecutives.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#64748b" }}>No executives found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "grid", placeItems: "center", padding: 20, background: "rgba(15,23,42,.55)" }}>
          <div style={{ width: "100%", maxWidth: 560, padding: 24, borderRadius: 18, background: "white" }}>
            <h2 style={{ marginTop: 0 }}>{editingId === null ? "Add Executive" : "Edit Executive"}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 14 }}>
              <input value={formData.code} onChange={(event) => setFormData({ ...formData, code: event.target.value })} placeholder="Executive Code" style={{ height: 44, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 10 }} />
              <input value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} placeholder="Executive Name" style={{ height: 44, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 10 }} />
              <input value={formData.mobile} onChange={(event) => setFormData({ ...formData, mobile: event.target.value })} placeholder="Mobile" style={{ height: 44, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 10 }} />
              <input value={formData.area} onChange={(event) => setFormData({ ...formData, area: event.target.value })} placeholder="Fixed Area" style={{ height: 44, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 10 }} />
              <select value={formData.status} onChange={(event) => setFormData({ ...formData, status: event.target.value as ExecutiveStatus })} style={{ height: 44, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 10, background: "white" }}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} disabled={saving} style={{ height: 42, padding: "0 18px", border: 0, borderRadius: 10, background: "#e2e8f0", fontWeight: 800, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => void saveExecutive()} disabled={saving} style={{ height: 42, padding: "0 18px", border: 0, borderRadius: 10, background: "#2563eb", color: "white", fontWeight: 800, cursor: "pointer" }}>{saving ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExecutivesPage;