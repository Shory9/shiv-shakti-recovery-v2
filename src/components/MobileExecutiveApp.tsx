import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { supabase } from "../supabaseClient";

type ExecutiveRow = {
  id: number | string;
  executive_code?: string | null;
  agent_code?: string | null;
  full_name?: string | null;
  name?: string | null;
  mobile?: string | null;
  area?: string | null;
  vehicle_type?: string | null;
  status?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  last_location_time?: string | null;
};

type CaseRow = {
  id: string;
  account_number?: string | null;
  account_name?: string | null;
  mobile_number?: string | null;
  address?: string | null;
  branch?: string | null;
  scheme_code?: string | null;
  rev_seg?: string | null;
  asset_class?: string | null;
  sanction_limit?: number | string | null;
  customer_balance?: number | string | null;
  balance_inr?: number | string | null;
  bank_name?: string | null;
  status?: string | null;
  assigned_executive_id?: string | null;
  assigned_executive?: string | null;
  executive_code?: string | null;
  remarks?: string | null;
};

type Screen =
  | "login"
  | "register"
  | "pending"
  | "dashboard"
  | "caseDetails"
  | "gps"
  | "payments"
  | "profile";

const CASE_BATCH_SIZE = 1000;

const cleanText = (value: unknown) => String(value ?? "").trim();
const cleanPhone = (value: unknown) => cleanText(value).replace(/\D/g, "");


function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;

  if (error && typeof error === "object" && "message" in error) {
    const message = cleanText((error as { message?: unknown }).message);
    if (message) return message;
  }

  return fallback;
}

function executiveCode(row: ExecutiveRow) {
  return cleanText(row.executive_code || row.agent_code || `SS${row.id}`);
}

function executiveName(row: ExecutiveRow) {
  return cleanText(row.full_name || row.name || "Executive");
}

function executivePhone(row: ExecutiveRow) {
  return cleanPhone(row.mobile);
}

function isApproved(row: ExecutiveRow) {
  const status = cleanText(row.status).toLowerCase();
  return status === "active" || status === "approved" || status === "online";
}


function caseNumber(row: CaseRow) {
  return cleanText(row.account_number || `ID ${row.id}`);
}

function customerName(row: CaseRow) {
  return cleanText(row.account_name || `Case #${row.id}`);
}

function caseArea(row: CaseRow) {
  const remarksArea = cleanText(row.remarks).match(/Resolved Area:\s*([^|]+)/i);
  return cleanText(remarksArea?.[1] || row.branch || "Not available");
}

function toNumber(value: unknown) {
  const parsed = Number(cleanText(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: unknown) {
  const amount = toNumber(value);
  if (amount <= 0) return "Not available";

  return amount.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}


export default function MobileExecutiveApp() {
  const [screen, setScreen] = useState<Screen>("login");
  const [executive, setExecutive] = useState<ExecutiveRow | null>(null);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [selectedCase, setSelectedCase] = useState<CaseRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [loginCode, setLoginCode] = useState("");
  const [loginPhone, setLoginPhone] = useState("");

  const [fullName, setFullName] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");
  const [area, setArea] = useState("");
  const [vehicleType, setVehicleType] = useState("bike");

  const [currentCoords, setCurrentCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [gpsStatus, setGpsStatus] = useState("Idle");

  useEffect(() => {
    const savedId = cleanText(localStorage.getItem("ssr_mobile_executive_id"));
    if (savedId) void restoreSession(savedId);
  }, []);

  useEffect(() => {
    if (
      !executive ||
      screen === "login" ||
      screen === "register" ||
      screen === "pending"
    ) {
      return;
    }

    if (!navigator.geolocation) {
      setGpsStatus("Geolocation supported nahi hai.");
      return;
    }

    setGpsStatus("Live GPS tracking active...");

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        setCurrentCoords({ lat, lng });

        try {
          const now = new Date().toISOString();

          const { error } = await supabase
            .from("gps_locations")
            .insert({
              executive_id: executive.id,
              latitude: lat,
              longitude: lng,
              accuracy: position.coords.accuracy,
              recorded_at: now,
            });

          if (error) throw error;
          setGpsStatus(`Updated: ${new Date(now).toLocaleTimeString()}`);
        } catch (error) {
          console.error("GPS sync error:", error);
          setGpsStatus(
            error instanceof Error
              ? `GPS Sync Error: ${error.message}`
              : "GPS location save nahi hui."
          );
        }
      },
      (error) => setGpsStatus(`GPS Error: ${error.message}`),
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [executive, screen]);

  async function restoreSession(id: number | string) {
    setLoading(true);
    setMessage("");

    try {
      const { data, error } = await supabase
        .from("executives")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Executive account nahi mila.");

      const row = data as ExecutiveRow;
      setExecutive(row);

      if (isApproved(row)) {
        setScreen("dashboard");
        await loadCases(row);
      } else {
        setScreen("pending");
      }
    } catch (error) {
      localStorage.removeItem("ssr_mobile_executive_id");
      setExecutive(null);
      setScreen("login");
      setMessage(
        error instanceof Error ? error.message : "Session restore nahi hui."
      );
    } finally {
      setLoading(false);
    }
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

      const match = ((data ?? []) as ExecutiveRow[]).find(
        (row) =>
          executiveCode(row).toLowerCase() === code &&
          executivePhone(row) === phone
      );

      if (!match) throw new Error("Executive code ya mobile number galat hai.");

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
    const executiveArea = area.trim();

    if (!name || phone.length < 10 || !executiveArea) {
      setMessage("Name, valid mobile number aur area required hai.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { data: existing, error: existingError } = await supabase
        .from("executives")
        .select("id, executive_code, mobile");

      if (existingError) throw existingError;

      const rows = (existing ?? []) as ExecutiveRow[];
      const duplicate = rows.find((row) => executivePhone(row) === phone);

      if (duplicate) {
        throw new Error("Is mobile number se registration pehle se maujood hai.");
      }

      const maxNumber = rows.reduce((max, row) => {
        const match = executiveCode(row).match(/(\d+)$/);
        return match ? Math.max(max, Number(match[1])) : max;
      }, 0);

      const generatedCode = `SS${String(maxNumber + 1).padStart(3, "0")}`;

      const { data, error } = await supabase
        .from("executives")
        .insert({
          id: crypto.randomUUID(),
          executive_code: generatedCode,
          full_name: name,
          mobile: phone,
          area: executiveArea,
          vehicle_type: vehicleType,
          status: "pending",
        })
        .select("*")
        .single();

      if (error) throw error;

      const pendingExecutive = data as ExecutiveRow;
      setExecutive(pendingExecutive);
      localStorage.setItem(
        "ssr_mobile_executive_id",
        String(pendingExecutive.id)
      );
      setScreen("pending");
      setMessage(`Registration successful. Aapka code ${generatedCode} hai.`);
    } catch (error) {
      console.error("Registration error:", error);
      setMessage(errorMessage(error, "Registration fail ho gaya."));
    } finally {
      setLoading(false);
    }
  }

  async function loadCases(row: ExecutiveRow | null = executive) {
    if (!row) return;

    setLoading(true);
    setMessage("");

    try {
      const assignedCases: CaseRow[] = [];
      let from = 0;

      while (true) {
        const { data, error } = await supabase
          .from("cases")
          .select("*")
          .eq("assigned_executive_id", String(row.id))
          .order("created_at", { ascending: false })
          .range(from, from + CASE_BATCH_SIZE - 1);

        if (error) throw error;

        const batch = (data ?? []) as CaseRow[];
        assignedCases.push(...batch);

        if (batch.length < CASE_BATCH_SIZE) break;
        from += CASE_BATCH_SIZE;
      }

      setCases(assignedCases);
      setSelectedCase((current) =>
        current
          ? assignedCases.find((item) => item.id === current.id) ?? null
          : null
      );
    } catch (error) {
      console.error("Mobile cases load error:", error);
      setCases([]);
      setMessage(`Cases load error: ${errorMessage(error, "Unknown database error")}`);
    } finally {
      setLoading(false);
    }
  }

  async function updateCaseStatus(caseId: string, nextStatus: string) {
    setLoading(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("cases")
        .update({ status: nextStatus })
        .eq("id", caseId);

      if (error) throw error;

      setCases((current) =>
        current.map((item) =>
          item.id === caseId ? { ...item, status: nextStatus } : item
        )
      );

      setSelectedCase((current) =>
        current?.id === caseId
          ? { ...current, status: nextStatus }
          : current
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Status update nahi hua."
      );
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    void supabase.auth.signOut();
    localStorage.removeItem("ssr_mobile_executive_id");
    setExecutive(null);
    setCases([]);
    setSelectedCase(null);
    setScreen("login");
    setMessage("");
    setLoginCode("");
    setLoginPhone("");
  }

  function callCustomer(item: CaseRow) {
    const phone = cleanPhone(item.mobile_number);
    if (!phone) {
      setMessage("Customer mobile number available nahi hai.");
      return;
    }
    window.location.href = `tel:${phone}`;
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
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Executive Mobile App
            </div>
          </div>
        </header>

        {message && <div style={styles.message}>{message}</div>}

        {screen === "login" && (
          <section style={styles.card}>
            <h1 style={styles.title}>Executive Login</h1>
            <p style={styles.subtext}>
              Executive code aur registered mobile number se login karein.
            </p>
            <form onSubmit={handleLogin} style={styles.form}>
              <input
                style={styles.input}
                value={loginCode}
                onChange={(event) => setLoginCode(event.target.value)}
                placeholder="Executive Code (SS001)"
                autoCapitalize="characters"
              />
              <input
                style={styles.input}
                value={loginPhone}
                onChange={(event) => setLoginPhone(event.target.value)}
                placeholder="Mobile Number"
                inputMode="numeric"
              />
              <button style={styles.primaryButton} disabled={loading}>
                {loading ? "Please wait..." : "Login"}
              </button>
            </form>
            <button
              style={styles.linkButton}
              onClick={() => {
                setMessage("");
                setScreen("register");
              }}
            >
              New Executive Registration
            </button>
          </section>
        )}

        {screen === "register" && (
          <section style={styles.card}>
            <h1 style={styles.title}>Executive Registration</h1>
            <form onSubmit={handleRegister} style={styles.form}>
              <input
                style={styles.input}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Full Name"
              />
              <input
                style={styles.input}
                value={registerPhone}
                onChange={(event) => setRegisterPhone(event.target.value)}
                placeholder="Mobile Number"
                inputMode="numeric"
              />
              <input
                style={styles.input}
                value={area}
                onChange={(event) => setArea(event.target.value)}
                placeholder="Area enter karein"
              />
              <select
                style={styles.input}
                value={vehicleType}
                onChange={(event) => setVehicleType(event.target.value)}
              >
                <option value="bike">Bike</option>
                <option value="car">Car</option>
              </select>
              <button style={styles.primaryButton} disabled={loading}>
                {loading ? "Registering..." : "Register"}
              </button>
            </form>
            <button
              style={styles.linkButton}
              onClick={() => {
                setMessage("");
                setScreen("login");
              }}
            >
              Back to Login
            </button>
          </section>
        )}

        {screen === "pending" && executive && (
          <section style={styles.card}>
            <div style={{ fontSize: 54, textAlign: "center" }}>⏳</div>
            <h1 style={{ ...styles.title, textAlign: "center" }}>
              Approval Pending
            </h1>
            <p style={{ ...styles.subtext, textAlign: "center" }}>
              Admin approval ke baad assigned cases dikhai denge.
            </p>
            <div style={styles.infoBox}>
              <b>{executiveName(executive)}</b>
              <span>Code: {executiveCode(executive)}</span>
              <span>Mobile: {executivePhone(executive)}</span>
              <span>Status: {cleanText(executive.status) || "Pending"}</span>
            </div>
            <button
              style={styles.primaryButton}
              onClick={() => void restoreSession(executive.id)}
              disabled={loading}
            >
              {loading ? "Checking..." : "Check Approval"}
            </button>
            <button style={styles.linkButton} onClick={logout}>
              Logout
            </button>
          </section>
        )}

        {screen === "dashboard" && executive && (
          <div style={{ paddingBottom: 80 }}>
            <section style={styles.profileCard}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>Welcome</div>
                <h1 style={{ margin: "4px 0" }}>
                  {executiveName(executive)}
                </h1>
                <div>
                  {executiveCode(executive)} · {cleanText(executive.area)}
                </div>
              </div>
              <button style={styles.logoutButton} onClick={logout}>
                Logout
              </button>
            </section>

            <section style={styles.statsGrid}>
              <article style={styles.statCard}>
                <span>Total Cases</span>
                <strong>{cases.length}</strong>
              </article>
              <article style={styles.statCard}>
                <span>Pending</span>
                <strong>{pendingCount}</strong>
              </article>
              <article style={styles.statCard}>
                <span>Completed</span>
                <strong>{completedCount}</strong>
              </article>
            </section>

            <div style={styles.sectionHead}>
              <h2 style={{ margin: 0 }}>My Assigned Cases</h2>
              <button
                style={styles.smallButton}
                onClick={() => void loadCases()}
                disabled={loading}
              >
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>

            {loading && cases.length === 0 ? (
              <div style={styles.empty}>Cases load ho rahe hain...</div>
            ) : cases.length === 0 ? (
              <div style={styles.empty}>Abhi koi case assigned nahi hai.</div>
            ) : (
              <section style={styles.caseList}>
                {cases.map((item) => (
                  <article style={styles.caseCard} key={item.id}>
                    <button
                      type="button"
                      style={styles.caseOpenButton}
                      onClick={() => {
                        setSelectedCase(item);
                        setMessage("");
                        setScreen("caseDetails");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      <div style={styles.caseTop}>
                        <div>
                          <strong>{customerName(item)}</strong>
                          <div style={styles.caseMeta}>{caseNumber(item)}</div>
                        </div>
                        <span style={styles.statusBadge}>
                          {cleanText(item.status) || "Pending"}
                        </span>
                      </div>
                      <div style={styles.caseDetails}>
                        <div>
                          📞 {cleanText(item.mobile_number) || "No mobile"}
                        </div>
                        <div>
                          📍 {cleanText(item.address) || caseArea(item)}
                        </div>
                      </div>
                      <div style={styles.viewDetailsText}>
                        Case details dekhein →
                      </div>
                    </button>
                  </article>
                ))}
              </section>
            )}
          </div>
        )}

        {screen === "gps" && executive && (
          <div style={{ paddingBottom: 80 }}>
            <section style={styles.card}>
              <h1 style={styles.title}>Live GPS Tracking</h1>
              <p style={styles.subtext}>
                Aapki live location admin dashboard par sync ho rahi hai.
              </p>
              <div style={styles.infoBox}>
                <span>
                  <b>Status:</b> {gpsStatus}
                </span>
                <span>
                  <b>Latitude:</b> {currentCoords?.lat ?? "Fetching..."}
                </span>
                <span>
                  <b>Longitude:</b> {currentCoords?.lng ?? "Fetching..."}
                </span>
              </div>
            </section>
          </div>
        )}

        {screen === "payments" && executive && (
          <div style={{ paddingBottom: 80 }}>
            <section style={styles.card}>
              <h1 style={styles.title}>Payments & Collections</h1>
              <div style={styles.empty}>
                Payment history module jaldi update hoga.
              </div>
            </section>
          </div>
        )}

        {screen === "profile" && executive && (
          <div style={{ paddingBottom: 80 }}>
            <section style={styles.card}>
              <h1 style={styles.title}>Executive Profile</h1>
              <div style={styles.infoBox}>
                <b>{executiveName(executive)}</b>
                <span>Code: {executiveCode(executive)}</span>
                <span>Mobile: {executivePhone(executive)}</span>
                <span>Area: {cleanText(executive.area)}</span>
                <span>Vehicle: {cleanText(executive.vehicle_type)}</span>
              </div>
              <button style={styles.primaryButton} onClick={logout}>
                Logout
              </button>
            </section>
          </div>
        )}

        {screen === "caseDetails" && executive && selectedCase && (
          <div style={{ paddingBottom: 80 }}>
            <button
              type="button"
              style={styles.backButton}
              onClick={() => {
                setSelectedCase(null);
                setMessage("");
                setScreen("dashboard");
              }}
            >
              ← Back to Cases
            </button>

            <section style={styles.detailHero}>
              <div>
                <div style={styles.detailKicker}>Case Details</div>
                <h1 style={styles.detailTitle}>{customerName(selectedCase)}</h1>
                <div style={styles.detailSubtitle}>
                  {caseNumber(selectedCase)}
                </div>
              </div>
              <span style={styles.detailStatus}>
                {cleanText(selectedCase.status) || "Pending"}
              </span>
            </section>

            <section style={styles.detailGrid}>
              <div style={styles.detailBox}>
                <span>Customer Mobile</span>
                <strong>
                  {cleanText(selectedCase.mobile_number) || "Not available"}
                </strong>
              </div>
              <div style={styles.detailBox}>
                <span>Area</span>
                <strong>{caseArea(selectedCase)}</strong>
              </div>
              <div style={styles.detailBox}>
                <span>Address</span>
                <strong>
                  {cleanText(selectedCase.address) || "Not available"}
                </strong>
              </div>
              <div style={styles.detailBox}>
                <span>Bank</span>
                <strong>
                  {cleanText(selectedCase.bank_name) || "Not available"}
                </strong>
              </div>
              <div style={styles.detailBox}>
                <span>Loan Amount</span>
                <strong>{formatMoney(selectedCase.sanction_limit)}</strong>
              </div>
              <div style={styles.detailBox}>
                <span>Outstanding</span>
                <strong>
                  {formatMoney(selectedCase.balance_inr)}
                </strong>
              </div>
              <div style={styles.detailBox}>
                <span>Customer Balance</span>
                <strong>{formatMoney(selectedCase.customer_balance)}</strong>
              </div>
              <div style={styles.detailBox}>
                <span>Scheme</span>
                <strong>{cleanText(selectedCase.scheme_code) || "Not available"}</strong>
              </div>
              <div style={styles.detailBox}>
                <span>Segment</span>
                <strong>
                  {cleanText(selectedCase.rev_seg) || "Not available"}
                </strong>
              </div>
              <div style={styles.detailBox}>
                <span>Category</span>
                <strong>
                  {cleanText(selectedCase.asset_class) || "Not available"}
                </strong>
              </div>
            </section>

            {cleanText(selectedCase.remarks) && (
              <section style={styles.remarksBox}>
                <span>Remarks</span>
                <p>{cleanText(selectedCase.remarks)}</p>
              </section>
            )}

            <section style={styles.detailActions}>
              <button
                type="button"
                style={styles.callButton}
                onClick={() => callCustomer(selectedCase)}
              >
                📞 Call Customer
              </button>
              <button
                type="button"
                style={styles.actionButton}
                disabled={loading}
                onClick={() =>
                  void updateCaseStatus(selectedCase.id, "Visited")
                }
              >
                Mark Visited
              </button>
              <button
                type="button"
                style={styles.doneButton}
                disabled={loading}
                onClick={() =>
                  void updateCaseStatus(selectedCase.id, "Completed")
                }
              >
                Complete Case
              </button>
            </section>
          </div>
        )}

        {executive &&
          screen !== "login" &&
          screen !== "register" &&
          screen !== "pending" && (
            <nav style={styles.bottomNav}>
              <button
                style={{
                  ...styles.navItem,
                  color: screen === "dashboard" ? "#b91c1c" : "#7f1d1d",
                }}
                onClick={() => setScreen("dashboard")}
              >
                📁 <span>Cases</span>
              </button>
              <button
                style={{
                  ...styles.navItem,
                  color: screen === "gps" ? "#b91c1c" : "#7f1d1d",
                }}
                onClick={() => setScreen("gps")}
              >
                📍 <span>GPS Live</span>
              </button>
              <button
                style={{
                  ...styles.navItem,
                  color: screen === "payments" ? "#b91c1c" : "#7f1d1d",
                }}
                onClick={() => setScreen("payments")}
              >
                💳 <span>Payments</span>
              </button>
              <button
                style={{
                  ...styles.navItem,
                  color: screen === "profile" ? "#b91c1c" : "#7f1d1d",
                }}
                onClick={() => setScreen("profile")}
              >
                👤 <span>Profile</span>
              </button>
            </nav>
          )}
      </div>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#fff5f5",
    color: "#1f1111",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  shell: {
    width: "100%",
    maxWidth: 560,
    margin: "0 auto",
    padding: 16,
    position: "relative",
    boxSizing: "border-box",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "16px 4px 20px",
    color: "#7f1d1d",
  },
  logo: { width: 48, height: 48, objectFit: "contain", borderRadius: 12 },
  card: {
    background: "#ffffff",
    borderRadius: 22,
    padding: 24,
    border: "1px solid #fee2e2",
    boxShadow: "0 16px 38px rgba(127,29,29,.12)",
  },
  title: { margin: 0, fontSize: 28 },
  subtext: { color: "#7f1d1d", lineHeight: 1.6 },
  form: { display: "grid", gap: 12, marginTop: 20 },
  input: {
    width: "100%",
    minHeight: 50,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid #fecaca",
    background: "#fff",
    fontSize: 15,
    boxSizing: "border-box",
  },
  primaryButton: {
    width: "100%",
    minHeight: 50,
    border: 0,
    borderRadius: 12,
    background: "linear-gradient(135deg,#dc2626,#7f1d1d)",
    color: "#fff",
    fontSize: 15,
    fontWeight: 800,
    cursor: "pointer",
    marginTop: 6,
  },
  linkButton: {
    width: "100%",
    padding: 14,
    border: 0,
    background: "transparent",
    color: "#dc2626",
    fontWeight: 800,
    cursor: "pointer",
  },
  message: {
    padding: 13,
    marginBottom: 14,
    borderRadius: 12,
    background: "#fff7ed",
    color: "#9a3412",
    fontWeight: 700,
    fontSize: 13,
  },
  infoBox: {
    display: "grid",
    gap: 8,
    padding: 16,
    margin: "18px 0",
    borderRadius: 14,
    background: "#fffafa",
  },
  profileCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: 20,
    borderRadius: 20,
    background: "linear-gradient(135deg,#111111 0%,#7f1d1d 55%,#dc2626 100%)",
    color: "#fff",
    boxShadow: "0 16px 34px rgba(127,29,29,.24)",
  },
  logoutButton: {
    border: "1px solid rgba(255,255,255,.35)",
    borderRadius: 10,
    padding: "10px 13px",
    background: "rgba(255,255,255,.1)",
    color: "#fff",
    fontWeight: 800,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3,1fr)",
    gap: 10,
    marginTop: 14,
  },
  statCard: {
    padding: 15,
    borderRadius: 15,
    background: "#fff",
    boxShadow: "0 8px 24px rgba(15,23,42,.06)",
  },
  sectionHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 22,
    marginBottom: 12,
  },
  smallButton: {
    border: 0,
    borderRadius: 9,
    padding: "9px 12px",
    background: "#fee2e2",
    color: "#b91c1c",
    fontWeight: 800,
  },
  empty: {
    padding: 30,
    borderRadius: 16,
    background: "#fff",
    textAlign: "center",
    color: "#7f1d1d",
  },
  caseList: { display: "grid", gap: 12 },
  caseCard: {
    borderRadius: 16,
    background: "#fff",
    boxShadow: "0 8px 24px rgba(15,23,42,.06)",
    overflow: "hidden",
  },
  caseOpenButton: {
    width: "100%",
    padding: 16,
    border: 0,
    background: "transparent",
    color: "inherit",
    textAlign: "left",
    cursor: "pointer",
  },
  caseTop: { display: "flex", justifyContent: "space-between", gap: 12 },
  caseMeta: { marginTop: 4, color: "#7f1d1d", fontSize: 12 },
  statusBadge: {
    height: "fit-content",
    padding: "6px 9px",
    borderRadius: 999,
    background: "#fef2f2",
    color: "#b91c1c",
    fontSize: 11,
    fontWeight: 800,
  },
  caseDetails: {
    display: "grid",
    gap: 7,
    marginTop: 14,
    color: "#3f1d1d",
    fontSize: 13,
  },
  viewDetailsText: {
    marginTop: 14,
    color: "#dc2626",
    fontSize: 12,
    fontWeight: 800,
  },
  backButton: {
    marginBottom: 12,
    padding: "10px 12px",
    border: 0,
    borderRadius: 10,
    background: "#fee2e2",
    color: "#b91c1c",
    fontWeight: 800,
  },
  detailHero: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
    padding: 20,
    borderRadius: 20,
    background: "linear-gradient(135deg,#111111 0%,#7f1d1d 60%,#dc2626 100%)",
    color: "#fff",
    boxShadow: "0 16px 34px rgba(127,29,29,.22)",
  },
  detailKicker: {
    fontSize: 11,
    fontWeight: 800,
    opacity: 0.75,
    textTransform: "uppercase",
    letterSpacing: ".08em",
  },
  detailTitle: { margin: "7px 0 3px", fontSize: 25 },
  detailSubtitle: { fontSize: 12, opacity: 0.78 },
  detailStatus: {
    padding: "7px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,.14)",
    fontSize: 11,
    fontWeight: 800,
    textTransform: "capitalize",
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginTop: 14,
  },
  detailBox: {
    padding: 14,
    borderRadius: 14,
    background: "#fff",
    boxShadow: "0 8px 24px rgba(15,23,42,.05)",
  },
  remarksBox: {
    marginTop: 14,
    padding: 16,
    borderRadius: 14,
    background: "#fff",
    boxShadow: "0 8px 24px rgba(15,23,42,.05)",
  },
  detailActions: {
    display: "grid",
    gap: 10,
    marginTop: 16,
    paddingBottom: 24,
  },
  callButton: {
    minHeight: 50,
    border: 0,
    borderRadius: 12,
    background: "#dc2626",
    color: "#fff",
    fontWeight: 800,
  },
  actionButton: {
    border: 0,
    borderRadius: 10,
    padding: 11,
    background: "#fef3c7",
    color: "#92400e",
    fontWeight: 800,
  },
  doneButton: {
    border: 0,
    borderRadius: 10,
    padding: 11,
    background: "#dcfce7",
    color: "#166534",
    fontWeight: 800,
  },
  bottomNav: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    background: "#fff",
    display: "flex",
    justifyContent: "space-around",
    alignItems: "center",
    borderTop: "1px solid #fecaca",
    zIndex: 1000,
    boxShadow: "0 -4px 20px rgba(0,0,0,0.05)",
  },
  navItem: {
    background: "transparent",
    border: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 3,
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
  },
};