import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "../supabaseClient";

type ExecutiveRow = {
  id: number;
  executive_code?: string | null;
  agent_code?: string | null;
  full_name?: string | null;
  name?: string | null;
  phone?: string | null;
  mobile?: string | null;
  area?: string | null;
  vehicle_type?: string | null;
  status?: string | null;
};

type CaseRow = {
  id: number;
  case_number?: string | null;
  customer_name?: string | null;
  mobile?: string | null;
  phone?: string | null;
  address?: string | null;
  area?: string | null;
  status?: string | null;
  assigned_executive_id?: number | null;
  assigned_executive?: string | null;
};

type Screen = "login" | "register" | "pending" | "dashboard";

const cleanPhone = (value: string) => value.replace(/\D/g, "");
const cleanText = (value: unknown) => String(value ?? "").trim();

function executiveCode(row: ExecutiveRow) {
  return cleanText(row.executive_code || row.agent_code || `SS${row.id}`);
}

function executiveName(row: ExecutiveRow) {
  return cleanText(row.full_name || row.name || "Executive");
}

function executivePhone(row: ExecutiveRow) {
  return cleanPhone(cleanText(row.phone || row.mobile));
}

function isApproved(row: ExecutiveRow) {
  const status = cleanText(row.status).toLowerCase();
  return status === "active" || status === "approved" || status === "online";
}

export default function MobileExecutiveApp() {
  const [screen, setScreen] = useState<Screen>("login");
  const [executive, setExecutive] = useState<ExecutiveRow | null>(null);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [loginCode, setLoginCode] = useState("");
  const [loginPhone, setLoginPhone] = useState("");

  const [fullName, setFullName] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");
  const [area, setArea] = useState("");
  const [vehicleType, setVehicleType] = useState("bike");

  useEffect(() => {
    const savedId = Number(localStorage.getItem("ssr_mobile_executive_id"));
    if (Number.isFinite(savedId) && savedId > 0) {
      void restoreSession(savedId);
    }
  }, []);

  async function restoreSession(id: number) {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("executives")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      localStorage.removeItem("ssr_mobile_executive_id");
      setLoading(false);
      return;
    }

    const row = data as ExecutiveRow;
    setExecutive(row);

    if (isApproved(row)) {
      setScreen("dashboard");
      await loadCases(row);
    } else {
      setScreen("pending");
    }

    setLoading(false);
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();

    const code = loginCode.trim().toLowerCase();
    const phone = cleanPhone(loginPhone);

    if (!code || phone.length < 10) {
      setMessage("Executive code aur valid mobile number enter karo.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { data, error } = await supabase.from("executives").select("*");
      if (error) throw error;

      const match = ((data ?? []) as ExecutiveRow[]).find((row) => {
        return executiveCode(row).toLowerCase() === code && executivePhone(row) === phone;
      });

      if (!match) {
        setMessage("Executive code ya mobile number galat hai.");
        return;
      }

      setExecutive(match);
      localStorage.setItem("ssr_mobile_executive_id", String(match.id));

      if (!isApproved(match)) {
        setScreen("pending");
        return;
      }

      setScreen("dashboard");
      await loadCases(match);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login fail ho gaya.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(event: FormEvent) {
    event.preventDefault();

    const name = fullName.trim();
    const phone = cleanPhone(registerPhone);

    if (!name || phone.length < 10 || !area) {
      setMessage("Name, valid mobile number aur area required hai.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { data: existing, error: existingError } = await supabase
        .from("executives")
        .select("*");

      if (existingError) throw existingError;

      const duplicate = ((existing ?? []) as ExecutiveRow[]).find(
        (row) => executivePhone(row) === phone
      );

      if (duplicate) {
        setMessage("Is mobile number se registration pehle se maujood hai.");
        return;
      }

      const generatedCode = `SS${Date.now().toString().slice(-6)}`;

      const { error } = await supabase
        .from("executives")
        .insert({
          executive_code: generatedCode,
          full_name: name,
          phone,
          area,
          vehicle_type: vehicleType,
          status: "pending",
        });

      if (error) throw error;

      const pendingExecutive: ExecutiveRow = {
        id: 0,
        executive_code: generatedCode,
        full_name: name,
        phone,
        area,
        vehicle_type: vehicleType,
        status: "pending",
      };

      setExecutive(pendingExecutive);
      localStorage.setItem("ssr_mobile_executive_code", generatedCode);
      localStorage.setItem("ssr_mobile_executive_phone", phone);
      setScreen("pending");
      setMessage(`Registration successful. Aapka code ${generatedCode} hai.`);
    } catch (error: unknown) {
      console.error("REGISTER ERROR:", error);

      const registerError =
        typeof error === "object" && error !== null
          ? (error as {
              message?: string;
              details?: string;
              hint?: string;
              code?: string;
            })
          : null;

      const errorMessage =
        registerError?.message ||
        registerError?.details ||
        registerError?.hint ||
        (registerError?.code ? `Error code: ${registerError.code}` : "") ||
        String(error || "Registration fail ho gaya.");

      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  async function loadCases(row = executive) {
    if (!row) return;

    setLoading(true);
    setMessage("");

    try {
      const { data, error } = await supabase
        .from("cases")
        .select("*")
        .order("id", { ascending: false });

      if (error) throw error;

      const code = executiveCode(row).toLowerCase();
      const assigned = ((data ?? []) as CaseRow[]).filter((item) => {
        const idMatch = Number(item.assigned_executive_id) === Number(row.id);
        const codeMatch = cleanText(item.assigned_executive).toLowerCase() === code;
        return idMatch || codeMatch;
      });

      setCases(assigned);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cases load nahi hue.");
    } finally {
      setLoading(false);
    }
  }

  async function updateCaseStatus(caseId: number, nextStatus: string) {
    setLoading(true);
    setMessage("");

    const { error } = await supabase
      .from("cases")
      .update({ status: nextStatus })
      .eq("id", caseId);

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setCases((current) =>
      current.map((item) =>
        item.id === caseId ? { ...item, status: nextStatus } : item
      )
    );
    setLoading(false);
  }

  function logout() {
    localStorage.removeItem("ssr_mobile_executive_id");
    setExecutive(null);
    setCases([]);
    setScreen("login");
    setMessage("");
    setLoginCode("");
    setLoginPhone("");
  }

  const pendingCount = useMemo(
    () =>
      cases.filter(
        (item) =>
          !["completed", "paid", "closed"].includes(
            cleanText(item.status).toLowerCase()
          )
      ).length,
    [cases]
  );

  const completedCount = cases.length - pendingCount;

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.header}>
          <img src="/logo.png" alt="Shiv Shakti" style={styles.logo} />
          <div>
            <strong style={{ fontSize: 18 }}>Shiv Shakti Recovery</strong>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Executive Mobile App</div>
          </div>
        </header>

        {message ? <div style={styles.message}>{message}</div> : null}

        {screen === "login" && (
          <section style={styles.card}>
            <h1 style={styles.title}>Executive Login</h1>
            <p style={styles.subtext}>Executive code aur registered mobile number se login karein.</p>
            <form onSubmit={handleLogin} style={styles.form}>
              <input style={styles.input} value={loginCode} onChange={(event) => setLoginCode(event.target.value)} placeholder="Executive Code (SS001)" autoCapitalize="characters" />
              <input style={styles.input} value={loginPhone} onChange={(event) => setLoginPhone(event.target.value)} placeholder="Mobile Number" inputMode="numeric" />
              <button style={styles.primaryButton} disabled={loading}>{loading ? "Please wait..." : "Login"}</button>
            </form>
            <button style={styles.linkButton} onClick={() => { setMessage(""); setScreen("register"); }}>New Executive Registration</button>
          </section>
        )}

        {screen === "register" && (
          <section style={styles.card}>
            <h1 style={styles.title}>Executive Registration</h1>
            <form onSubmit={handleRegister} style={styles.form}>
              <input style={styles.input} value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Full Name" />
              <input style={styles.input} value={registerPhone} onChange={(event) => setRegisterPhone(event.target.value)} placeholder="Mobile Number" inputMode="numeric" />
              <input
                style={styles.input}
                value={area}
                onChange={(event) => setArea(event.target.value)}
                placeholder="Area enter karein"
              />
              <select style={styles.input} value={vehicleType} onChange={(event) => setVehicleType(event.target.value)}>
                <option value="bike">Bike</option>
                <option value="car">Car</option>
              </select>
              <button style={styles.primaryButton} disabled={loading}>{loading ? "Registering..." : "Register"}</button>
            </form>
            <button style={styles.linkButton} onClick={() => { setMessage(""); setScreen("login"); }}>Back to Login</button>
          </section>
        )}

        {screen === "pending" && executive && (
          <section style={styles.card}>
            <div style={{ fontSize: 54, textAlign: "center" }}>⏳</div>
            <h1 style={{ ...styles.title, textAlign: "center" }}>Approval Pending</h1>
            <p style={{ ...styles.subtext, textAlign: "center" }}>Admin approval ke baad aap login karke assigned cases dekh sakenge.</p>
            <div style={styles.infoBox}>
              <b>{executiveName(executive)}</b>
              <span>Code: {executiveCode(executive)}</span>
              <span>Mobile: {executivePhone(executive)}</span>
              <span>Status: {cleanText(executive.status) || "Pending"}</span>
            </div>
            <button style={styles.primaryButton} onClick={() => void restoreSession(executive.id)} disabled={loading}>{loading ? "Checking..." : "Check Approval"}</button>
            <button style={styles.linkButton} onClick={logout}>Logout</button>
          </section>
        )}

        {screen === "dashboard" && executive && (
          <>
            <section style={styles.profileCard}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>Welcome</div>
                <h1 style={{ margin: "4px 0" }}>{executiveName(executive)}</h1>
                <div>{executiveCode(executive)} · {cleanText(executive.area)}</div>
              </div>
              <button style={styles.logoutButton} onClick={logout}>Logout</button>
            </section>

            <section style={styles.statsGrid}>
              <article style={styles.statCard}><span>Total Cases</span><strong>{cases.length}</strong></article>
              <article style={styles.statCard}><span>Pending</span><strong>{pendingCount}</strong></article>
              <article style={styles.statCard}><span>Completed</span><strong>{completedCount}</strong></article>
            </section>

            <div style={styles.sectionHead}>
              <h2 style={{ margin: 0 }}>My Assigned Cases</h2>
              <button style={styles.smallButton} onClick={() => void loadCases()} disabled={loading}>Refresh</button>
            </div>

            {loading && cases.length === 0 ? (
              <div style={styles.empty}>Cases load ho rahe hain...</div>
            ) : cases.length === 0 ? (
              <div style={styles.empty}>Abhi koi case assigned nahi hai.</div>
            ) : (
              <section style={styles.caseList}>
                {cases.map((item) => (
                  <article style={styles.caseCard} key={item.id}>
                    <div style={styles.caseTop}>
                      <div>
                        <strong>{cleanText(item.customer_name) || `Case #${item.id}`}</strong>
                        <div style={styles.caseMeta}>{cleanText(item.case_number) || `ID ${item.id}`}</div>
                      </div>
                      <span style={styles.statusBadge}>{cleanText(item.status) || "Pending"}</span>
                    </div>
                    <div style={styles.caseDetails}>
                      <div>📞 {cleanText(item.mobile || item.phone) || "No mobile"}</div>
                      <div>📍 {cleanText(item.address || item.area) || "No address"}</div>
                    </div>
                    <div style={styles.actionRow}>
                      <button style={styles.actionButton} onClick={() => void updateCaseStatus(item.id, "Visited")}>Mark Visited</button>
                      <button style={styles.doneButton} onClick={() => void updateCaseStatus(item.id, "Completed")}>Complete</button>
                    </div>
                  </article>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#eef3f8", color: "#0f172a", fontFamily: "Inter, system-ui, sans-serif" },
  shell: { width: "100%", maxWidth: 560, margin: "0 auto", padding: 16 },
  header: { display: "flex", alignItems: "center", gap: 12, padding: "16px 4px 20px" },
  logo: { width: 48, height: 48, objectFit: "contain", borderRadius: 12 },
  card: { background: "#fff", borderRadius: 22, padding: 24, boxShadow: "0 14px 40px rgba(15,23,42,.1)" },
  title: { margin: 0, fontSize: 28 },
  subtext: { color: "#64748b", lineHeight: 1.6 },
  form: { display: "grid", gap: 12, marginTop: 20 },
  input: { width: "100%", minHeight: 50, padding: "0 14px", borderRadius: 12, border: "1px solid #cbd5e1", background: "#fff", fontSize: 15, boxSizing: "border-box" },
  primaryButton: { width: "100%", minHeight: 50, border: 0, borderRadius: 12, background: "#0d3b66", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", marginTop: 6 },
  linkButton: { width: "100%", padding: 14, border: 0, background: "transparent", color: "#2563eb", fontWeight: 800, cursor: "pointer" },
  message: { padding: 13, marginBottom: 14, borderRadius: 12, background: "#fff7ed", color: "#9a3412", fontWeight: 700, fontSize: 13 },
  infoBox: { display: "grid", gap: 8, padding: 16, margin: "18px 0", borderRadius: 14, background: "#f8fafc" },
  profileCard: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: 20, borderRadius: 20, background: "linear-gradient(135deg,#07192d,#12497b)", color: "#fff" },
  logoutButton: { border: "1px solid rgba(255,255,255,.35)", borderRadius: 10, padding: "10px 13px", background: "rgba(255,255,255,.1)", color: "#fff", fontWeight: 800 },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 14 },
  statCard: { padding: 15, borderRadius: 15, background: "#fff", boxShadow: "0 8px 24px rgba(15,23,42,.06)" },
  sectionHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 22, marginBottom: 12 },
  smallButton: { border: 0, borderRadius: 9, padding: "9px 12px", background: "#dbeafe", color: "#1d4ed8", fontWeight: 800 },
  empty: { padding: 30, borderRadius: 16, background: "#fff", textAlign: "center", color: "#64748b" },
  caseList: { display: "grid", gap: 12 },
  caseCard: { padding: 16, borderRadius: 16, background: "#fff", boxShadow: "0 8px 24px rgba(15,23,42,.06)" },
  caseTop: { display: "flex", justifyContent: "space-between", gap: 12 },
  caseMeta: { marginTop: 4, color: "#64748b", fontSize: 12 },
  statusBadge: { height: "fit-content", padding: "6px 9px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", fontSize: 11, fontWeight: 800 },
  caseDetails: { display: "grid", gap: 7, marginTop: 14, color: "#475569", fontSize: 13 },
  actionRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 14 },
  actionButton: { border: 0, borderRadius: 10, padding: 11, background: "#fef3c7", color: "#92400e", fontWeight: 800 },
  doneButton: { border: 0, borderRadius: 10, padding: 11, background: "#dcfce7", color: "#166534", fontWeight: 800 },
};