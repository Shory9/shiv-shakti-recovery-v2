import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import {
  Camera,
  CameraDirection,
  CameraResultType,
  CameraSource,
} from "@capacitor/camera";
import { App as CapacitorApp } from "@capacitor/app";
import { Geolocation } from "@capacitor/geolocation";
import { supabase } from "../supabaseClient";
import { initializeWorkReminders } from "../utils/workReminderNotifications";
import { bankContext, type BankCode } from "../types/bank";

type ExecutiveRow = {
  id: number | string;
  executive_code?: string | null;
  full_name?: string | null;
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

type PaymentRow = {
  id: string;
  case_id?: string | null;
  amount?: number | string | null;
  payment_date?: string | null;
  payment_mode?: string | null;
  reference_number?: string | null;
  receipt_number?: string | null;
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

const MOBILE_EXECUTIVE_ID_KEY = "ssr_mobile_executive_id";
const MOBILE_SCREEN_KEY = "ssr_mobile_screen";
const PENDING_VISIT_KEY = "ssr_pending_visit";
const RESTORED_VISIT_PHOTO_KEY = "ssr_restored_visit_photo";

type PendingVisit = {
  caseId: string;
  outcome: string;
  remarks: string;
  followUp: string;
};



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

function executiveName(row: ExecutiveRow) {
  return cleanText(row.full_name || "Executive");
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
  const amountInRupees = toNumber(value);
  if (amountInRupees <= 0) return "";

  return amountInRupees.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

function cleanCaseRemarks(value: unknown) {
  return cleanText(value)
    .replace(/Resolved Area:\s*[^|]+(?:\||$)/i, "")
    .replace(/Source File:\s*[^|]+(?:\||$)/i, "")
    .replace(/\|\s*\|/g, "|")
    .replace(/^\s*\|\s*|\s*\|\s*$/g, "")
    .trim();
}

function stampVisitPhoto(
  photo: Blob,
  coords: { lat: number; lng: number },
  visitCase: CaseRow,
  visitExecutive: ExecutiveRow
) {
  return new Promise<Blob>((resolve, reject) => {
    const imageUrl = URL.createObjectURL(photo);
    const image = new Image();

    image.onload = () => {
      const maxSide = 1280;
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));

      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(imageUrl);
        reject(new Error("Photo process nahi ho payi."));
        return;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const overlayHeight = Math.max(250, Math.round(canvas.height * 0.28));
      const overlayTop = canvas.height - overlayHeight;
      const padding = Math.max(22, Math.round(canvas.width * 0.025));
      const titleSize = Math.max(28, Math.round(canvas.width * 0.035));
      const textSize = Math.max(22, Math.round(canvas.width * 0.026));

      context.fillStyle = "rgba(8, 15, 25, 0.82)";
      context.fillRect(0, overlayTop, canvas.width, overlayHeight);
      context.fillStyle = "#16a34a";
      context.fillRect(padding, overlayTop + padding, Math.round(canvas.width * 0.28), titleSize + 20);
      context.fillStyle = "#ffffff";
      context.font = `700 ${titleSize}px sans-serif`;
      context.fillText("VISIT CHECK-IN", padding + 14, overlayTop + padding + titleSize + 2);

      const markerX = padding + 20;
      const markerY = overlayTop + padding + titleSize + 72;
      context.fillStyle = "#ef4444";
      context.beginPath();
      context.arc(markerX, markerY, 13, 0, Math.PI * 2);
      context.fill();

      const address = cleanText(visitCase.address) || caseArea(visitCase);
      const capturedAt = new Date().toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "medium",
      });
      const lines = [
        `${customerName(visitCase)} | ${caseNumber(visitCase)}`,
        address,
        `Lat ${coords.lat.toFixed(6)}  Long ${coords.lng.toFixed(6)}`,
        `${capturedAt} | ${executiveName(visitExecutive)}`,
      ];

      context.fillStyle = "#ffffff";
      context.font = `600 ${textSize}px sans-serif`;
      const lineHeight = Math.round(textSize * 1.35);
      lines.forEach((line, index) => {
        const safeLine = line.length > 72 ? `${line.slice(0, 69)}...` : line;
        context.fillText(
          safeLine,
          padding + 48,
          markerY + index * lineHeight + Math.round(textSize * 0.35),
          canvas.width - padding * 2 - 48
        );
      });

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(imageUrl);
          if (blob) resolve(blob);
          else reject(new Error("GPS stamp photo nahi bani."));
        },
        "image/jpeg",
        0.82
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error("Selected photo read nahi hui."));
    };

    image.src = imageUrl;
  });
}


type MobileExecutiveAppProps = {
  bankCode?: BankCode;
};

export default function MobileExecutiveApp({ bankCode = "BOB" }: MobileExecutiveAppProps) {
  const isSbi = bankCode === "SBI";
  const context = bankContext(bankCode);
  const codePrefix = isSbi ? "SBI" : "SS";
  const rpcName = (name: string) => isSbi ? `sbi_${name}` : name;
  const getExecutiveCode = (row: ExecutiveRow) =>
    cleanText(row.executive_code || `${codePrefix}${row.id}`);
  const executiveStorageKey = `${MOBILE_EXECUTIVE_ID_KEY}_${bankCode.toLowerCase()}`;
  const screenStorageKey = `${MOBILE_SCREEN_KEY}_${bankCode.toLowerCase()}`;
  const [screen, setScreen] = useState<Screen>("login");
  const [executive, setExecutive] = useState<ExecutiveRow | null>(null);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [selectedCase, setSelectedCase] = useState<CaseRow | null>(null);
  const [caseSearch, setCaseSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

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
  const [visitOutcome, setVisitOutcome] = useState("Customer Met");
  const [visitRemarks, setVisitRemarks] = useState("");
  const [visitFollowUp, setVisitFollowUp] = useState("");
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentCaseId, setPaymentCaseId] = useState("");
  const [paymentCaseSearch, setPaymentCaseSearch] = useState("");
  const [paymentType, setPaymentType] = useState("Settlement");
  const [paymentRemarks, setPaymentRemarks] = useState("");
  const restoringVisitRef = useRef(false);

  const paymentCases = useMemo(() => {
    const query = cleanText(paymentCaseSearch).toLowerCase();
    if (!query) return cases;

    return cases.filter((item) =>
      `${customerName(item)} ${caseNumber(item)}`.toLowerCase().includes(query)
    );
  }, [cases, paymentCaseSearch]);

  useEffect(() => {
    let disposed = false;
    let removeReminderListener: (() => Promise<void>) | undefined;

    void initializeWorkReminders(() => {
      if (!disposed) setScreen("dashboard");
    }).then((remove) => {
      removeReminderListener = remove;
    });

    return () => {
      disposed = true;
      void removeReminderListener?.();
    };
  }, []);


  useEffect(() => {
    const savedId = cleanText(localStorage.getItem(executiveStorageKey));
    if (savedId) void restoreSession(savedId);
  }, []);

  useEffect(() => {
    let removeListener: (() => Promise<void>) | undefined;

    void CapacitorApp.addListener("appRestoredResult", (result) => {
      if (
        result.pluginId !== "Camera" ||
        result.methodName !== "getPhoto" ||
        !result.success
      ) {
        return;
      }

      const webPath = cleanText(result.data?.webPath);
      if (webPath) {
        localStorage.setItem(RESTORED_VISIT_PHOTO_KEY, webPath);
      }
    }).then((handle) => {
      removeListener = () => handle.remove();
    });

    return () => {
      void removeListener?.();
    };
  }, []);

  useEffect(() => {
    if (!executive || cases.length === 0 || restoringVisitRef.current) return;

    const photoPath = cleanText(localStorage.getItem(RESTORED_VISIT_PHOTO_KEY));
    const pendingRaw = localStorage.getItem(PENDING_VISIT_KEY);
    if (!photoPath || !pendingRaw) return;

    try {
      const pending = JSON.parse(pendingRaw) as PendingVisit;
      const visitCase = cases.find((item) => item.id === pending.caseId);
      if (!visitCase) return;

      restoringVisitRef.current = true;
      queueMicrotask(() => {
        setSelectedCase(visitCase);
        setScreen("caseDetails");
        void completeVisitPhoto(photoPath, visitCase, executive, pending).finally(() => {
          restoringVisitRef.current = false;
        });
      });
    } catch {
      localStorage.removeItem(PENDING_VISIT_KEY);
      localStorage.removeItem(RESTORED_VISIT_PHOTO_KEY);
    }
  }, [cases, executive]);

  useEffect(() => {
    if (
      executive &&
      !["login", "register", "pending"].includes(screen)
    ) {
      localStorage.setItem(screenStorageKey, screen);
    }
  }, [executive, screen, screenStorageKey]);

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

          const { error } = await supabase.rpc(rpcName("mobile_save_gps_location"), {
            p_executive_id: String(executive.id),
            p_executive_code: getExecutiveCode(executive),
            p_mobile: executivePhone(executive),
            p_latitude: lat,
            p_longitude: lng,
            p_accuracy: position.coords.accuracy,
            p_recorded_at: now,
          });

          if (error) throw error;
          setGpsStatus(`Updated: ${new Date(now).toLocaleTimeString()}`);
        } catch (error) {
          console.error("GPS sync error:", error);
          setGpsStatus(
            `GPS Sync Error: ${errorMessage(error, "Unknown GPS database error")}`
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
    const savedScreen = cleanText(localStorage.getItem(screenStorageKey));

    try {
      const { data, error } = isSbi
        ? await supabase
            .rpc("sbi_mobile_find_executive", { p_id: String(id), p_code: null, p_mobile: null })
            .maybeSingle()
        : await supabase
            .from(context.tables.executives)
            .select("*")
            .eq("id", id)
            .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Executive account nahi mila.");

      const row = data as ExecutiveRow;
      setExecutive(row);

      if (isApproved(row)) {
        const restoredScreen: Screen =
          savedScreen === "payments" ? "payments" : "dashboard";
        setScreen(restoredScreen);
        await loadCases(row);
        if (restoredScreen === "payments") await loadPayments(row);
      } else {
        setScreen("pending");
      }
    } catch (error) {
      localStorage.removeItem(executiveStorageKey);
      localStorage.removeItem(screenStorageKey);
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
      const { data, error } = isSbi
        ? await supabase.rpc("sbi_mobile_find_executive", {
            p_id: null,
            p_code: code,
            p_mobile: phone,
          })
        : await supabase.from(context.tables.executives).select("*");
      if (error) throw error;

      const match = ((data ?? []) as ExecutiveRow[]).find((row) =>
        isSbi ||
        (getExecutiveCode(row).toLowerCase() === code && executivePhone(row) === phone)
      );

      if (!match) throw new Error("Executive code ya mobile number galat hai.");

      setExecutive(match);
      localStorage.setItem(executiveStorageKey, String(match.id));

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
      if (isSbi) {
        const { data, error } = await supabase.rpc("sbi_register_executive", {
          p_full_name: name,
          p_mobile: phone,
          p_area: executiveArea,
          p_vehicle_type: vehicleType,
        });
        if (error) throw error;
        const pendingExecutive = ((data ?? []) as ExecutiveRow[])[0];
        if (!pendingExecutive) throw new Error("SBI registration save nahi hua.");
        setExecutive(pendingExecutive);
        localStorage.setItem(executiveStorageKey, String(pendingExecutive.id));
        setScreen("pending");
        setMessage(`Registration successful. Aapka code ${getExecutiveCode(pendingExecutive)} hai.`);
        return;
      }

      const { data: existing, error: existingError } = await supabase
        .from(context.tables.executives)
        .select("id, executive_code, mobile");

      if (existingError) throw existingError;

      const rows = (existing ?? []) as ExecutiveRow[];
      const duplicate = rows.find((row) => executivePhone(row) === phone);

      if (duplicate) {
        throw new Error("Is mobile number se registration pehle se maujood hai.");
      }

      const maxNumber = rows.reduce((max, row) => {
        const match = getExecutiveCode(row).match(/(\d+)$/);
        return match ? Math.max(max, Number(match[1])) : max;
      }, 0);

      const generatedCode = `${codePrefix}${String(maxNumber + 1).padStart(3, "0")}`;

      const { data, error } = await supabase
        .from(context.tables.executives)
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
        executiveStorageKey,
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
      const { data, error } = await supabase.rpc(rpcName("mobile_executive_cases"), {
        p_executive_id: String(row.id),
        p_executive_code: getExecutiveCode(row),
        p_mobile: executivePhone(row),
      });

      if (error) throw error;

      const assignedCases = (data ?? []) as CaseRow[];
      setCases(assignedCases);
      setSelectedCase((current) =>
        current
          ? assignedCases.find((item) => item.id === current.id) ?? null
          : null
      );
    } catch (error) {
      console.error("Mobile cases load error:", error);
      setCases([]);
      setMessage(
        `Cases load error: ${errorMessage(error, "Unknown database error")}`
      );
    } finally {
      setLoading(false);
    }
  }

  async function updateCaseStatus(caseId: string, nextStatus: string) {
    setLoading(true);
    setMessage("");

    try {
      if (!executive) throw new Error("Executive session nahi mili.");

      const { data, error } = await supabase.rpc(rpcName("mobile_update_case_status"), {
        p_case_id: caseId,
        p_executive_id: String(executive.id),
        p_executive_code: getExecutiveCode(executive),
        p_mobile: executivePhone(executive),
        p_status: nextStatus,
      });

      if (error) throw error;
      if (data !== true) {
        throw new Error("Case assigned executive se match nahi hua.");
      }

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
      console.error("Case status update error:", error);
      setMessage(
        `Status update error: ${errorMessage(error, "Unknown database error")}`
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadPayments(row: ExecutiveRow | null = executive) {
    if (!row) return;

    try {
      const { data, error } = await supabase.rpc(rpcName("mobile_executive_payments"), {
        p_executive_id: String(row.id),
        p_executive_code: getExecutiveCode(row),
        p_mobile: executivePhone(row),
      });
      if (error) throw error;
      setPayments((data ?? []) as PaymentRow[]);
    } catch (error) {
      console.error("Payment history load error:", error);
      setPayments([]);
      setMessage(`Payment history error: ${errorMessage(error, "Unknown database error")}`);
    }
  }

  async function completeVisitPhoto(
    photoWebPath: string,
    visitCase: CaseRow,
    visitExecutive: ExecutiveRow,
    pending: PendingVisit
  ) {
    setLoading(true);

    try {
      setMessage("Live GPS lock ho raha hai...");
      await Geolocation.requestPermissions({ permissions: ["location"] });
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      });
      const coords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      const rawPhoto = await fetch(photoWebPath).then((response) => {
        if (!response.ok) throw new Error("Camera photo read nahi hui.");
        return response.blob();
      });
      const photo = await stampVisitPhoto(rawPhoto, coords, visitCase, visitExecutive);
      const photoPath = `${visitExecutive.id}/${visitCase.id}/${Date.now()}.jpg`;

      setMessage("GPS-stamped visit photo upload ho rahi hai...");
      const { error: uploadError } = await supabase.storage
        .from(isSbi ? "sbi-visit-photos" : "visit-photos")
        .upload(photoPath, photo, {
          cacheControl: "3600",
          contentType: "image/jpeg",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data, error } = await supabase.rpc(rpcName("mobile_record_detailed_visit"), {
        p_case_id: visitCase.id,
        p_executive_id: String(visitExecutive.id),
        p_executive_code: getExecutiveCode(visitExecutive),
        p_mobile: executivePhone(visitExecutive),
        p_photo_path: photoPath,
        p_latitude: coords.lat,
        p_longitude: coords.lng,
        p_outcome: pending.outcome,
        p_remarks: pending.remarks,
        p_next_follow_up: pending.followUp || null,
      });

      if (error) throw error;
      if (!data) throw new Error("Visit record database mein save nahi hua.");

      setCurrentCoords(coords);
      setCases((current) =>
        current.map((item) =>
          item.id === visitCase.id ? { ...item, status: "Visited" } : item
        )
      );
      setSelectedCase((current) =>
        current?.id === visitCase.id ? { ...current, status: "Visited" } : current
      );
      setMessage("Visit saved: camera photo par GPS stamp lagkar upload ho gayi.");
      setVisitRemarks("");
      setVisitFollowUp("");
      localStorage.removeItem(PENDING_VISIT_KEY);
      localStorage.removeItem(RESTORED_VISIT_PHOTO_KEY);
    } catch (error) {
      console.error("Visit capture error:", error);
      setMessage(`Visit save error: ${errorMessage(error, "Unknown visit error")}`);
    } finally {
      setLoading(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function recordCaseVisit(visitCase: CaseRow) {
    if (!executive) {
      setMessage("Executive session nahi mili.");
      return;
    }
    if (!visitOutcome.trim() || !visitRemarks.trim()) {
      setMessage("Visit outcome aur remark required hai.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setLoading(true);
    setMessage("Camera open ho raha hai...");

    const pending: PendingVisit = {
      caseId: visitCase.id,
      outcome: visitOutcome,
      remarks: visitRemarks.trim(),
      followUp: visitFollowUp,
    };
    localStorage.setItem(PENDING_VISIT_KEY, JSON.stringify(pending));

    try {
      await Camera.requestPermissions({ permissions: ["camera"] });
      const capturedPhoto = await Camera.getPhoto({
        quality: 82,
        width: 1280,
        correctOrientation: true,
        saveToGallery: false,
        source: CameraSource.Camera,
        resultType: CameraResultType.Uri,
        direction: CameraDirection.Rear,
      });

      if (!capturedPhoto.webPath) {
        throw new Error("Camera photo nahi mili.");
      }
      await completeVisitPhoto(capturedPhoto.webPath, visitCase, executive, pending);
    } catch (error) {
      console.error("Visit capture error:", error);
      setMessage(
        `Visit save error: ${errorMessage(error, "Unknown visit error")}`
      );
      localStorage.removeItem(PENDING_VISIT_KEY);
      localStorage.removeItem(RESTORED_VISIT_PHOTO_KEY);
    } finally {
      setLoading(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function recordPayment() {
    if (!executive) {
      setMessage("Executive session nahi mili.");
      return;
    }

    const linkedCase = cases.find((item) => item.id === paymentCaseId);
    const amount = toNumber(paymentAmount);
    if (!linkedCase) {
      setMessage("Payment ke liye customer/case select karo.");
      return;
    }
    if (amount <= 0) {
      setMessage("Valid payment amount enter karo.");
      return;
    }

    setLoading(true);
    setMessage("Payment database mein save ho rahi hai...");
    try {
      const { data: paymentId, error } = await supabase.rpc(
        rpcName("mobile_record_payment"),
        {
          p_case_id: linkedCase.id,
          p_executive_id: String(executive.id),
          p_executive_code: getExecutiveCode(executive),
          p_mobile: executivePhone(executive),
          p_amount: amount,
          p_payment_mode: paymentType,
          p_reference_number: null,
          p_receipt_number: null,
          p_remarks: paymentRemarks.trim() || `${paymentType} payment submitted`,
          p_payment_date: new Date().toISOString().slice(0, 10),
        }
      );
      if (error) throw error;
      if (!paymentId) throw new Error("Payment database mein save nahi hui.");

      setPaymentAmount("");
      setPaymentRemarks("");
      setPaymentCaseId("");
      await loadPayments(executive);
      setScreen("payments");
      setMessage(`${customerName(linkedCase)} ki ${paymentType} payment save ho gayi.`);
    } catch (error) {
      console.error("Payment save error:", error);
      setMessage(`Payment save error: ${errorMessage(error, "Unknown database error")}`);
    } finally {
      setLoading(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function logout() {
    void supabase.auth.signOut();
    localStorage.removeItem(executiveStorageKey);
    localStorage.removeItem(screenStorageKey);
    setExecutive(null);
    setCases([]);
    setSelectedCase(null);
    setCaseSearch("");
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

  const filteredCases = useMemo(() => {
    const query = cleanText(caseSearch).toLowerCase();
    if (!query) return cases;

    return cases.filter((item) =>
      [
        customerName(item),
        caseNumber(item),
        cleanText(item.mobile_number),
        cleanText(item.address),
        caseArea(item),
        cleanText(item.bank_name),
      ].some((value) => value.toLowerCase().includes(query))
    );
  }, [cases, caseSearch]);

  return (
    <main style={{ ...styles.page, ...(isSbi ? styles.sbiPage : styles.bobPage) }}>
      <div style={styles.shell}>
        <header style={{ ...styles.header, ...(isSbi ? styles.sbiHeader : styles.bobHeader) }}>
          {executive && !["login", "register", "pending"].includes(screen) && (
            <button
              type="button"
              style={{ ...styles.menuButton, ...(!isSbi ? styles.bobMenuButton : {}) }}
              aria-label={`${isSbi ? "SBI" : "BOB"} navigation menu kholen`}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <span aria-hidden="true">☰</span>
            </button>
          )}
          <div style={styles.brandWrap}>
            <img src="/logo.png" alt="Shiv Shakti Recovery" style={styles.logo} />
            <div>
              <strong style={styles.brandTitle}>Shiv Shakti Recovery</strong>
              <div style={styles.brandSubtitle}>Secure Field Executive App</div>
            </div>
          </div>
          <span style={{ ...styles.bankBadge, ...(isSbi ? styles.sbiBadge : styles.bobBadge) }}>
            {isSbi ? "SBI" : "BOB"}
          </span>
        </header>

        {menuOpen && executive && (
          <div style={styles.drawerLayer} role="presentation" onClick={() => setMenuOpen(false)}>
            <aside
              style={styles.drawer}
              role="dialog"
              aria-modal="true"
              aria-label={`${isSbi ? "SBI" : "BOB"} Executive navigation`}
              onClick={(event) => event.stopPropagation()}
            >
              <div style={{ ...styles.drawerHero, ...(!isSbi ? styles.bobDrawerHero : {}) }}>
                <div style={styles.drawerTopLine}>
                  <span style={styles.drawerBankMark}>{isSbi ? "SBI" : "BOB"}</span>
                  <button type="button" style={styles.drawerClose} aria-label="Menu band karein" onClick={() => setMenuOpen(false)}>×</button>
                </div>
                <strong style={styles.drawerName}>{executiveName(executive)}</strong>
                <span style={styles.drawerMeta}>{getExecutiveCode(executive)} · {cleanText(executive.area) || "Assigned Area"}</span>
              </div>

              <nav style={styles.drawerNav} aria-label={`${isSbi ? "SBI" : "BOB"} app sections`}>
                {([[
                  "dashboard", "▤", "Assigned Cases", "Customer recovery cases"
                ], [
                  "gps", "⌖", "Live GPS", "Location sync status"
                ], [
                  "payments", "₹", "Payments", "Collections and history"
                ], [
                  "profile", "●", "My Profile", "Executive details"
                ]] as const).map(([target, icon, label, hint]) => (
                  <button
                    key={target}
                    type="button"
                    style={{
                      ...styles.drawerItem,
                      ...(screen === target ? (isSbi ? styles.drawerItemActive : styles.bobDrawerItemActive) : {}),
                    }}
                    aria-current={screen === target ? "page" : undefined}
                    onClick={() => {
                      setMenuOpen(false);
                      setScreen(target);
                      if (target === "payments") void loadPayments();
                    }}
                  >
                    <span style={{ ...styles.drawerItemIcon, ...(!isSbi ? styles.bobDrawerItemIcon : {}) }} aria-hidden="true">{icon}</span>
                    <span style={styles.drawerItemText}><strong>{label}</strong><small>{hint}</small></span>
                    <span aria-hidden="true">›</span>
                  </button>
                ))}
              </nav>

              <button type="button" style={styles.drawerLogout} onClick={logout}>Sign out</button>
            </aside>
          </div>
        )}

        <style>{`
          @keyframes executiveNoticeScroll {
            from { transform: translateX(100%); }
            to { transform: translateX(-100%); }
          }
        `}</style>
        <div
          style={styles.attendanceNotice}
          role="status"
          aria-label="Daily check-in notice"
        >
          <div style={styles.attendanceNoticeText}>
            IMPORTANT: Sabhi executives roz subah 10:00 baje tak Check-in karein. Check-in na hone par us din absent maana jayega.
          </div>
        </div>

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
                placeholder={`Executive Code (${codePrefix}001)`}
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
            <div style={{ textAlign: "center", padding: 40, fontSize: 20 }}>Loading...</div>
            <h1 style={{ ...styles.title, textAlign: "center" }}>
              Approval Pending
            </h1>
            <p style={{ ...styles.subtext, textAlign: "center" }}>
              Admin approval ke baad assigned cases dikhai denge.
            </p>
            <div style={styles.infoBox}>
              <b>{executiveName(executive)}</b>
              <span>Code: {getExecutiveCode(executive)}</span>
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
            <section style={{ ...styles.profileCard, ...(isSbi ? styles.sbiProfileCard : styles.bobProfileCard) }}>
              <div>
                <div style={styles.profileEyebrow}>{isSbi ? "SBI" : "BOB"} FIELD DESK</div>
                <h1 style={{ margin: "4px 0" }}>
                  {executiveName(executive)}
                </h1>
                <div>
                  {getExecutiveCode(executive)} {" | "} {cleanText(executive.area)}
                </div>
              </div>
              <button style={styles.logoutButton} onClick={logout}>
                Logout
              </button>
            </section>

            <section style={styles.statsGrid}>
              <article style={styles.statCard}>
                <span style={styles.statLabel}>Total Cases</span>
                <strong>{cases.length}</strong>
              </article>
              <article style={styles.statCard}>
                <span style={styles.statLabel}>Pending</span>
                <strong>{pendingCount}</strong>
              </article>
              <article style={styles.statCard}>
                <span style={styles.statLabel}>Completed</span>
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

            <div style={styles.caseSearchWrap}>
              <span style={styles.caseSearchIcon} aria-hidden="true">
                Search
              </span>
              <input
                type="search"
                value={caseSearch}
                onChange={(event) => setCaseSearch(event.target.value)}
                placeholder="Customer, account no. ya mobile search karein"
                aria-label="Assigned cases search"
                style={styles.caseSearchInput}
              />
              {caseSearch && (
                <button
                  type="button"
                  onClick={() => setCaseSearch("")}
                  aria-label="Search clear karein"
                  style={styles.caseSearchClear}
                >X

                </button>
              )}
            </div>

            {caseSearch && cases.length > 0 && (
              <div style={styles.caseSearchResult}>
                {filteredCases.length} case mile
              </div>
            )}

            {loading && cases.length === 0 ? (
              <div style={styles.empty}>Cases load ho rahe hain...</div>
            ) : cases.length === 0 ? (
              <div style={styles.empty}>Abhi koi case assigned nahi hai.</div>
            ) : filteredCases.length === 0 ? (
              <div style={styles.empty}>
                Is search se koi assigned case nahi mila.
              </div>
            ) : (
              <section style={styles.caseList}>
                {filteredCases.map((item) => (
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
                          Call: {cleanText(item.mobile_number)}
                        </div>
                        <div>
                          Address: {cleanText(item.address)}
                        </div>
                      </div>
                      <div style={styles.viewDetailsText}>
                        Case details dekhein &gt;
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
              <p style={styles.subtext}>
                Visit se alag customer payment save karein. Isme GPS/photo nahi lagega.
              </p>
              <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                <input
                  value={paymentCaseSearch}
                  onChange={(event) => setPaymentCaseSearch(event.target.value)}
                  placeholder="Customer name ya account number search karein"
                  style={styles.input}
                />
                <select
                  value={paymentCaseId}
                  onChange={(event) => setPaymentCaseId(event.target.value)}
                  style={styles.input}
                >
                  <option value="">Customer / case select karein</option>
                  {paymentCases.map((item) => (
                    <option key={item.id} value={item.id}>
                      {customerName(item)} - {caseNumber(item)}
                    </option>
                  ))}
                </select>
                <select
                  value={paymentType}
                  onChange={(event) => setPaymentType(event.target.value)}
                  style={styles.input}
                >
                  <option>Settlement</option>
                  <option>Palti Ki Gayi</option>
                </select>
                <input
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={paymentAmount}
                  onChange={(event) => setPaymentAmount(event.target.value)}
                  placeholder="Payment amount INR"
                  style={styles.input}
                />
                <textarea
                  value={paymentRemarks}
                  onChange={(event) => setPaymentRemarks(event.target.value)}
                  placeholder="Payment remark (optional)"
                  rows={2}
                  style={{ ...styles.input, height: "auto", paddingTop: 12 }}
                />
                <button
                  type="button"
                  style={styles.doneButton}
                  disabled={loading}
                  onClick={() => void recordPayment()}
                >
                  {loading ? "Saving Payment..." : "Save Payment"}
                </button>
              </div>
            </section>

            <section style={styles.card}>
              <h2 style={{ marginTop: 0 }}>Payment History</h2>
              {payments.length === 0 ? (
                <div style={styles.empty}>Abhi koi payment record nahi hai.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {payments.map((payment) => {
                    const linkedCase = cases.find(
                      (item) => item.id === payment.case_id
                    );
                    return (
                      <article key={payment.id} style={styles.infoBox}>
                        <b>
                          {linkedCase
                            ? customerName(linkedCase)
                            : "Recovery Payment"}
                        </b>
                        <span>
                          Case: {linkedCase ? caseNumber(linkedCase) : payment.case_id}
                        </span>
                        <span>
                          Amount: INR {toNumber(payment.amount).toLocaleString("en-IN")}
                        </span>
                        <span>Mode: {cleanText(payment.payment_mode) || "-"}</span>
                        <span>
                          Receipt/Ref: {cleanText(
                            payment.receipt_number || payment.reference_number
                          ) || "-"}
                        </span>
                        <span>
                          Date: {payment.payment_date
                            ? new Date(payment.payment_date).toLocaleDateString("en-IN")
                            : "-"}
                        </span>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {screen === "profile" && executive && (
          <div style={{ paddingBottom: 80 }}>
            <section style={styles.card}>
              <h1 style={styles.title}>Executive Profile</h1>
              <div style={styles.infoBox}>
                <b>{executiveName(executive)}</b>
                <span>Code: {getExecutiveCode(executive)}</span>
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
              Back to Cases
            </button>

            <section style={{ ...styles.detailHero, ...(isSbi ? styles.sbiDetailHero : styles.bobDetailHero) }}>
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
              {cleanText(selectedCase.mobile_number) && (
                <div style={styles.detailBox}>
                  <span>Customer Mobile</span>
                  <strong>{cleanText(selectedCase.mobile_number)}</strong>
                </div>
              )}

              <div style={styles.detailBox}>
                <span>Area</span>
                <strong>{caseArea(selectedCase)}</strong>
              </div>

              {cleanText(selectedCase.address) && (
                <div style={styles.detailBox}>
                  <span>Address</span>
                  <strong>{cleanText(selectedCase.address)}</strong>
                </div>
              )}

              {cleanText(selectedCase.bank_name) && (
                <div style={styles.detailBox}>
                  <span>Bank</span>
                  <strong>{cleanText(selectedCase.bank_name)}</strong>
                </div>
              )}

              {formatMoney(selectedCase.sanction_limit) && (
                <div style={styles.detailBox}>
                  <span>Loan Amount</span>
                  <strong>{formatMoney(selectedCase.sanction_limit)}</strong>
                </div>
              )}

              {formatMoney(selectedCase.balance_inr) && (
                <div style={styles.detailBox}>
                  <span>Outstanding</span>
                  <strong>{formatMoney(selectedCase.balance_inr)}</strong>
                </div>
              )}

              {formatMoney(selectedCase.customer_balance) && (
                <div style={styles.detailBox}>
                  <span>Customer Balance</span>
                  <strong>{formatMoney(selectedCase.customer_balance)}</strong>
                </div>
              )}

              {cleanText(selectedCase.scheme_code) && (
                <div style={styles.detailBox}>
                  <span>Scheme</span>
                  <strong>{cleanText(selectedCase.scheme_code)}</strong>
                </div>
              )}

              {cleanText(selectedCase.rev_seg) && (
                <div style={styles.detailBox}>
                  <span>Segment</span>
                  <strong>{cleanText(selectedCase.rev_seg)}</strong>
                </div>
              )}

              {cleanText(selectedCase.asset_class) && (
                <div style={styles.detailBox}>
                  <span>Category</span>
                  <strong>{cleanText(selectedCase.asset_class)}</strong>
                </div>
              )}
            </section>

            {cleanCaseRemarks(selectedCase.remarks) && (
              <section style={styles.remarksBox}>
                <span>Remarks</span>
                <p>{cleanCaseRemarks(selectedCase.remarks)}</p>
              </section>
            )}

            <section style={{ ...styles.remarksBox, display: "grid", gap: 10 }}>
              <span>Visit Report (GPS photo ke saath)</span>
              <select value={visitOutcome} onChange={(event) => setVisitOutcome(event.target.value)} style={{ padding: 12, borderRadius: 10, border: "1px solid #fecaca", background: "white" }}>
                <option>Customer Met</option><option>Customer Not Available</option><option>House Locked</option><option>Payment Promise</option><option>Refused Payment</option><option>Wrong Address</option><option>Other</option>
              </select>
              <textarea value={visitRemarks} onChange={(event) => setVisitRemarks(event.target.value)} placeholder="Visit remark (required)" rows={3} style={{ padding: 12, borderRadius: 10, border: "1px solid #fecaca", resize: "vertical" }} />
              <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 800 }}>Next Follow-up (optional)<input type="date" value={visitFollowUp} onChange={(event) => setVisitFollowUp(event.target.value)} style={{ padding: 12, borderRadius: 10, border: "1px solid #fecaca" }} /></label>
            </section>

            <section style={styles.detailActions}>
              <button
                type="button"
                style={styles.callButton}
                onClick={() => callCustomer(selectedCase)}
              >
                Call Customer
              </button>
              <button
                type="button"
                style={styles.actionButton}
                disabled={loading}
                onClick={() => void recordCaseVisit(selectedCase)}
              >
                {loading ? "Saving Visit..." : "Mark Visited + Photo"}
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

      </div>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg,#f8fafc 0%,#fff7f7 46%,#f8fafc 100%)",
    color: "#172033",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  sbiPage: {
    background: "linear-gradient(180deg,#eef5ff 0%,#f8fbff 42%,#eef4fb 100%)",
    color: "#102445",
  },
  bobPage: {
    background: "linear-gradient(180deg,#fff6ed 0%,#fffaf5 42%,#fff3e7 100%)",
    color: "#3d2316",
  },
  shell: {
    width: "100%",
    maxWidth: 560,
    margin: "0 auto",
    padding: "12px 14px 92px",
    position: "relative",
    boxSizing: "border-box",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "10px 2px 14px",
    color: "#172033",
  },
  sbiHeader: {
    position: "sticky",
    top: 0,
    zIndex: 900,
    margin: "-12px -14px 14px",
    padding: "14px",
    background: "rgba(248,251,255,.96)",
    borderBottom: "1px solid #dbe8fb",
    boxShadow: "0 8px 24px rgba(15,63,140,.08)",
    backdropFilter: "blur(14px)",
  },
  bobHeader: {
    position: "sticky",
    top: 0,
    zIndex: 900,
    margin: "-12px -14px 14px",
    padding: "14px",
    background: "rgba(255,250,245,.96)",
    borderBottom: "1px solid #fed7aa",
    boxShadow: "0 8px 24px rgba(194,65,12,.09)",
    backdropFilter: "blur(14px)",
  },
  menuButton: {
    width: 42,
    height: 42,
    flexShrink: 0,
    border: "1px solid #c9dcf8",
    borderRadius: 13,
    background: "#fff",
    color: "#0f3f8c",
    fontSize: 22,
    fontWeight: 900,
    boxShadow: "0 6px 16px rgba(15,63,140,.1)",
  },
  bobMenuButton: {
    borderColor: "#fed7aa",
    color: "#c2410c",
    boxShadow: "0 6px 16px rgba(194,65,12,.11)",
  },
  brandWrap: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 },
  logo: {
    width: 44,
    height: 44,
    objectFit: "contain",
    borderRadius: 13,
    background: "#fff",
    boxShadow: "0 6px 18px rgba(15,23,42,.1)",
  },
  brandTitle: { display: "block", fontSize: 16, lineHeight: 1.2 },
  brandSubtitle: { marginTop: 3, fontSize: 10, color: "#64748b", fontWeight: 700 },
  bankBadge: {
    flexShrink: 0,
    padding: "7px 10px",
    borderRadius: 999,
    color: "#fff",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: ".08em",
    boxShadow: "0 6px 16px rgba(15,23,42,.12)",
  },
  bobBadge: { background: "linear-gradient(135deg,#f97316,#b91c1c)" },
  sbiBadge: { background: "linear-gradient(135deg,#2563eb,#0f3f8c)" },
  drawerLayer: {
    position: "fixed",
    inset: 0,
    zIndex: 2000,
    background: "rgba(4,15,35,.5)",
    backdropFilter: "blur(3px)",
  },
  drawer: {
    width: "min(84vw,340px)",
    height: "100%",
    padding: 14,
    boxSizing: "border-box",
    background: "#f8fbff",
    boxShadow: "22px 0 52px rgba(4,25,62,.28)",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  drawerHero: {
    padding: 20,
    borderRadius: 22,
    background: "linear-gradient(145deg,#071d3f,#0f4ba3 64%,#2583e8)",
    color: "#fff",
    boxShadow: "0 18px 38px rgba(15,63,140,.28)",
  },
  bobDrawerHero: {
    background: "linear-gradient(145deg,#431407,#c2410c 62%,#fb923c)",
    boxShadow: "0 18px 38px rgba(194,65,12,.28)",
  },
  drawerTopLine: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 },
  drawerBankMark: { fontSize: 14, fontWeight: 950, letterSpacing: ".18em" },
  drawerClose: {
    width: 34,
    height: 34,
    border: "1px solid rgba(255,255,255,.3)",
    borderRadius: 10,
    background: "rgba(255,255,255,.12)",
    color: "#fff",
    fontSize: 24,
  },
  drawerName: { display: "block", fontSize: 21, letterSpacing: "-.02em" },
  drawerMeta: { display: "block", marginTop: 7, fontSize: 12, opacity: .78 },
  drawerNav: { display: "grid", gap: 8 },
  drawerItem: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 13px",
    border: "1px solid transparent",
    borderRadius: 15,
    background: "transparent",
    color: "#344767",
    textAlign: "left",
  },
  drawerItemActive: {
    background: "#e8f1ff",
    borderColor: "#c9dcf8",
    color: "#0f3f8c",
    boxShadow: "0 8px 18px rgba(15,63,140,.08)",
  },
  bobDrawerItemActive: {
    background: "#fff0df",
    borderColor: "#fed7aa",
    color: "#c2410c",
    boxShadow: "0 8px 18px rgba(194,65,12,.09)",
  },
  drawerItemIcon: {
    width: 38,
    height: 38,
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
    borderRadius: 12,
    background: "#fff",
    color: "#1261bd",
    fontSize: 19,
    boxShadow: "0 5px 14px rgba(15,63,140,.1)",
  },
  bobDrawerItemIcon: {
    color: "#d35400",
    boxShadow: "0 5px 14px rgba(194,65,12,.11)",
  },
  drawerItemText: { display: "grid", gap: 3, flex: 1 },
  drawerLogout: {
    marginTop: "auto",
    minHeight: 48,
    border: "1px solid #fecaca",
    borderRadius: 14,
    background: "#fff",
    color: "#b91c1c",
    fontWeight: 850,
  },
  card: {
    background: "#ffffff",
    borderRadius: 20,
    padding: 20,
    border: "1px solid #e8edf4",
    boxShadow: "0 14px 36px rgba(15,23,42,.08)",
  },
  title: { margin: 0, fontSize: 25, letterSpacing: "-.03em" },
  subtext: { color: "#64748b", lineHeight: 1.55, fontSize: 14 },
  form: { display: "grid", gap: 12, marginTop: 20 },
  input: {
    width: "100%",
    minHeight: 50,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid #dbe3ee",
    background: "#fff",
    fontSize: 15,
    boxSizing: "border-box",
  },
  primaryButton: {
    width: "100%",
    minHeight: 50,
    border: 0,
    borderRadius: 12,
    background: "linear-gradient(135deg,#dc2626,#8f1111)",
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
    boxShadow: "0 18px 38px rgba(15,23,42,.22)",
  },
  sbiProfileCard: {
    background: "linear-gradient(145deg,#071d3f 0%,#0f4ba3 62%,#2583e8 100%)",
    boxShadow: "0 18px 42px rgba(15,63,140,.28)",
  },
  bobProfileCard: {
    background: "linear-gradient(145deg,#431407 0%,#c2410c 62%,#fb923c 100%)",
    boxShadow: "0 18px 42px rgba(194,65,12,.28)",
  },
  profileEyebrow: {
    fontSize: 10,
    opacity: 0.74,
    fontWeight: 900,
    letterSpacing: ".12em",
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
    display: "grid",
    gap: 7,
    padding: "14px 12px",
    borderRadius: 15,
    background: "#fff",
    border: "1px solid #edf1f6",
    boxShadow: "0 8px 24px rgba(15,23,42,.05)",
  },
  statLabel: { color: "#64748b", fontSize: 11, fontWeight: 700 },
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
  caseSearchWrap: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "4px 10px",
    marginBottom: 8,
    border: "1px solid #fecaca",
    borderRadius: 14,
    background: "#fff",
    boxShadow: "0 8px 24px rgba(127,29,29,.06)",
  },
  caseSearchIcon: { fontSize: 17, flexShrink: 0 },
  caseSearchInput: {
    width: "100%",
    minWidth: 0,
    padding: "11px 2px",
    border: 0,
    outline: "none",
    background: "transparent",
    color: "#291414",
    fontSize: 14,
  },
  caseSearchClear: {
    width: 32,
    height: 32,
    flexShrink: 0,
    border: 0,
    borderRadius: 999,
    background: "#fee2e2",
    color: "#991b1b",
    fontSize: 21,
    lineHeight: 1,
    cursor: "pointer",
  },
  caseSearchResult: {
    margin: "0 2px 10px",
    color: "#7f1d1d",
    fontSize: 12,
    fontWeight: 700,
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
    border: "1px solid #e8edf4",
    boxShadow: "0 8px 22px rgba(15,23,42,.05)",
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
  attendanceNotice: {
    width: "100%",
    overflow: "hidden",
    whiteSpace: "nowrap",
    padding: "10px 0",
    marginBottom: 14,
    border: "1px solid #fde68a",
    borderRadius: 12,
    background: "linear-gradient(90deg, #fff7ed, #fef3c7, #fff7ed)",
    color: "#9a3412",
    boxShadow: "0 5px 16px rgba(146,64,14,.12)",
  },
  attendanceNoticeText: {
    display: "inline-block",
    minWidth: "100%",
    paddingLeft: "100%",
    fontSize: 13,
    fontWeight: 800,
    animation: "executiveNoticeScroll 36s linear infinite",
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
    bottom: 10,
    left: "50%",
    transform: "translateX(-50%)",
    width: "calc(100% - 20px)",
    maxWidth: 540,
    minHeight: 68,
    padding: 6,
    boxSizing: "border-box",
    borderRadius: 20,
    background: "rgba(255,255,255,.96)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    border: "1px solid #e5eaf1",
    zIndex: 1000,
    boxShadow: "0 14px 38px rgba(15,23,42,.18)",
  },
  sbiDetailHero: {
    background: "linear-gradient(145deg,#071d3f 0%,#0f4ba3 62%,#2583e8 100%)",
    boxShadow: "0 18px 42px rgba(15,63,140,.25)",
  },
  bobDetailHero: {
    background: "linear-gradient(145deg,#431407 0%,#c2410c 62%,#fb923c 100%)",
    boxShadow: "0 18px 42px rgba(194,65,12,.25)",
  },
  navItem: {
    background: "transparent",
    border: 0,
    minWidth: 0,
    flex: 1,
    minHeight: 54,
    padding: "6px 3px",
    borderRadius: 14,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 3,
    color: "#64748b",
    fontSize: 10,
    fontWeight: 800,
    cursor: "pointer",
  },
  navItemActive: {
    background: "#fff1f2",
    color: "#b91c1c",
    boxShadow: "inset 0 0 0 1px #fecdd3",
  },
  navIcon: { fontSize: 18, lineHeight: 1 },
};
