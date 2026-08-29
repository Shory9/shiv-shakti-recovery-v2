import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

type RawRow = Record<string, unknown>;
type PaymentStatus = "All" | "Recorded" | "Pending" | "Verified" | "Rejected";

type PaymentRecord = {
  id: string;
  bank: PaymentBank;
  receiptNumber: string;
  customerName: string;
  mobile: string;
  caseNumber: string;
  branch: string;
  executiveName: string;
  bankName: string;
  amount: number;
  paymentMode: string;
  paymentDate: string;
  status: Exclude<PaymentStatus, "All">;
};

type PaymentBank = "BOB" | "SBI";
type AdminCaseOption = {
  id: string;
  bank: PaymentBank;
  accountNumber: string;
  customerName: string;
  label: string;
  branch: string;
};
type AdminExecutiveOption = { id: string; bank: PaymentBank; label: string };

const PAGE_SIZE = 1000;

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function first(row: RawRow, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = text(row[key]);
    if (value) return value;
  }
  return fallback;
}

function numberValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSearchValue(value: unknown): string {
  return text(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeStatus(value: unknown): Exclude<PaymentStatus, "All"> {
  const status = text(value).toLowerCase();

  if (status === "recorded") return "Recorded";

  if (["verified", "approved", "paid", "completed", "success"].includes(status)) {
    return "Verified";
  }

  if (["rejected", "failed", "cancelled", "canceled"].includes(status)) {
    return "Rejected";
  }

  return "Pending";
}

function formatDate(value: unknown): string {
  const raw = text(value);
  if (!raw) return "-";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleDateString("en-IN");
}

async function fetchAll(table: "payments" | "cases" | "executives" | "sbi_payments" | "sbi_cases" | "sbi_executives") {
  const rows: RawRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    const page = (data ?? []) as RawRow[];
    rows.push(...page);

    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PaymentStatus>("All");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [caseOptions, setCaseOptions] = useState<AdminCaseOption[]>([]);
  const [executiveOptions, setExecutiveOptions] = useState<AdminExecutiveOption[]>([]);
  const [formBank, setFormBank] = useState<PaymentBank>("BOB");
  const [formCaseId, setFormCaseId] = useState("");
  const [formCaseSearch, setFormCaseSearch] = useState("");
  const [formExecutiveId, setFormExecutiveId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formMode, setFormMode] = useState("Settlement");
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formReceipt, setFormReceipt] = useState("");
  const [formRemarks, setFormRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const filteredCaseOptions = useMemo(() => {
    const query = formCaseSearch.trim().toLowerCase();
    return caseOptions.filter(
      (row) =>
        row.bank === formBank &&
        (!query ||
          row.accountNumber.toLowerCase().includes(query) ||
          row.customerName.toLowerCase().includes(query) ||
          row.label.toLowerCase().includes(query))
    );
  }, [caseOptions, formBank, formCaseSearch]);

  const selectedAdminCase = useMemo(
    () => caseOptions.find((row) => row.bank === formBank && row.id === formCaseId),
    [caseOptions, formBank, formCaseId]
  );

  function updateCaseSearch(value: string) {
    setFormCaseSearch(value);
    const normalized = normalizeSearchValue(value);
    const exactMatch = normalized
      ? caseOptions.find(
          (row) =>
            row.bank === formBank &&
            normalizeSearchValue(row.accountNumber) === normalized
        )
      : undefined;
    setFormCaseId(exactMatch?.id ?? "");
  }

  const loadPayments = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setMessage("");

    try {
      const [bobPaymentRows, bobCaseRows, bobProfileRows, sbiPaymentRows, sbiCaseRows, sbiProfileRows] = await Promise.all([
        fetchAll("payments"),
        fetchAll("cases"),
        fetchAll("executives"),
        fetchAll("sbi_payments"),
        fetchAll("sbi_cases"),
        fetchAll("sbi_executives"),
      ]);

      const paymentRows: RawRow[] = [
        ...bobPaymentRows.map((row) => ({ ...row, __bank: "BOB" })),
        ...sbiPaymentRows.map((row) => ({ ...row, __bank: "SBI" })),
      ];
      const caseRows: RawRow[] = [
        ...bobCaseRows.map((row) => ({ ...row, __bank: "BOB" })),
        ...sbiCaseRows.map((row) => ({ ...row, __bank: "SBI" })),
      ];
      const profileRows: RawRow[] = [
        ...bobProfileRows.map((row) => ({ ...row, __bank: "BOB" })),
        ...sbiProfileRows.map((row) => ({ ...row, __bank: "SBI" })),
      ];

      const casesById = new Map<string, RawRow>();
      caseRows.forEach((row) => {
        const id = first(row, ["id", "case_id"]);
        if (id) casesById.set(`${first(row, ["__bank"], "BOB")}:${id}`, row);
      });

      const profilesById = new Map<string, RawRow>();
      profileRows.forEach((row) => {
        const id = first(row, ["id", "profile_id"]);
        if (id) profilesById.set(`${first(row, ["__bank"], "BOB")}:${id}`, row);
      });

      setCaseOptions(caseRows.map((row) => {
        const accountNumber = first(row, ["account_number", "loan_account_number", "account_no", "case_number"], "-");
        const customerName = first(row, ["account_name", "customer_name", "name"], "Unknown");
        return {
          id: first(row, ["id", "case_id"]),
          bank: first(row, ["__bank"], "BOB") as PaymentBank,
          accountNumber,
          customerName,
          branch: first(row, ["branch", "branch_name", "village", "area", "assigned_area"]),
          label: `${accountNumber} - ${customerName}`,
        };
      }).filter((row) => row.id));
      setExecutiveOptions(profileRows.map((row) => ({
        id: first(row, ["id"]),
        bank: first(row, ["__bank"], "BOB") as PaymentBank,
        label: `${first(row, ["executive_code"], "-")} - ${first(row, ["full_name"], "Executive")}`,
      })).filter((row) => row.id));

      const mapped = paymentRows.map((payment, index): PaymentRecord => {
        const caseId = first(payment, ["case_id"]);
        const executiveId = first(payment, [
          "executive_id",
          "collected_by",
          "profile_id",
          "created_by",
        ]);
        const paymentBank = first(payment, ["__bank"], "BOB") as PaymentBank;

        const caseRow = casesById.get(`${paymentBank}:${caseId}`) ?? {};
        const profileRow = profilesById.get(`${paymentBank}:${executiveId}`) ?? {};

        return {
          id: first(payment, ["id"], String(index + 1)),
          bank: paymentBank,
          receiptNumber: first(
            payment,
            ["receipt_number", "receipt_no", "transaction_id", "reference_number"],
            "-"
          ),
          customerName: first(
            payment,
            ["customer_name"],
            first(caseRow, ["customer_name", "account_name", "name"], "Unknown Customer")
          ),
          mobile: first(
            payment,
            ["mobile", "phone"],
            first(caseRow, ["mobile_number", "mobile", "mobile_no", "phone"], "-")
          ),
          caseNumber: first(
            payment,
            ["case_number"],
            first(caseRow, ["account_number", "case_number", "account_no", "id"], "-")
          ),
          branch: first(
            payment,
            ["payment_branch", "branch"],
            first(caseRow, ["branch", "village", "area"], "-")
          ),
          executiveName: first(
            payment,
            ["executive_name"],
            first(profileRow, ["full_name", "name"], "-")
          ),
          bankName: first(
            payment,
            ["bank_name"],
            first(caseRow, ["bank_name"], paymentBank === "SBI" ? "State Bank of India (SBI)" : "Bank of Baroda (BOB)")
          ),
          amount: numberValue(
            payment.amount ??
              payment.payment_amount ??
              payment.collected_amount ??
              payment.recovery_amount
          ),
          paymentMode: first(
            payment,
            ["payment_mode", "mode", "payment_method"],
            "-"
          ),
          paymentDate: formatDate(
            payment.payment_date ??
              payment.collected_at ??
              payment.created_at
          ),
          status: normalizeStatus(
            payment.status ??
              payment.verification_status ??
              payment.payment_status
          ),
        };
      });

      mapped.sort((a, b) => {
        const firstDate = new Date(a.paymentDate).getTime();
        const secondDate = new Date(b.paymentDate).getTime();

        if (Number.isNaN(firstDate) || Number.isNaN(secondDate)) return 0;
        return secondDate - firstDate;
      });

      setPayments(mapped);
    } catch (error) {
      console.error("Payment load error:", error);
      setPayments([]);
      setMessage(
        error instanceof Error
          ? `Payment load error: ${error.message}`
          : "Payment data load nahi hua."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  async function addAdminPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = numberValue(formAmount);
    const selectedCase = selectedAdminCase;
    if (!formCaseId || amount <= 0 || !formDate || !selectedCase?.branch) {
      setMessage("Case, branch, valid amount aur payment date required hai.");
      return;
    }
    setSaving(true);
    setMessage("");
    const table = formBank === "SBI" ? "sbi_payments" : "payments";
    const { error } = await supabase.from(table).insert({
      case_id: formCaseId,
      executive_id: formExecutiveId || null,
      amount,
      payment_mode: formMode,
      payment_date: formDate,
      receipt_number: formReceipt.trim() || null,
      reference_number: null,
      remarks: formRemarks.trim() || "Payment added by admin",
    });
    if (error) {
      setMessage(`Payment save error: ${error.message}`);
    } else {
      setMessage(`${formBank} payment successfully add ho gayi.`);
      setFormAmount(""); setFormReceipt(""); setFormRemarks(""); setFormCaseId(""); setFormCaseSearch(""); setFormExecutiveId("");
      await loadPayments(true);
    }
    setSaving(false);
  }

  async function deletePayment(payment: PaymentRecord) {
    const confirmed = window.confirm(
      `${payment.bank} payment permanently delete karein?\n\n` +
      `Customer: ${payment.customerName}\n` +
      `Amount: ${formatCurrency(payment.amount)}\n` +
      `Date: ${payment.paymentDate}`
    );
    if (!confirmed || deletingId) return;

    setDeletingId(payment.id);
    setMessage("");
    const table = payment.bank === "SBI" ? "sbi_payments" : "payments";
    const { error } = await supabase.from(table).delete().eq("id", payment.id);

    if (error) {
      setMessage(`Payment delete error: ${error.message}`);
    } else {
      setMessage(`${payment.bank} payment successfully delete ho gayi.`);
      await loadPayments(true);
    }
    setDeletingId("");
  }

  useEffect(() => {
    // Initial remote data sync is intentionally started when this page mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPayments();

    const channel = supabase
      .channel("payments-page-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments" },
        () => void loadPayments(true)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cases" },
        () => void loadPayments(true)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "executives" },
        () => void loadPayments(true)
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadPayments]);

  const filteredPayments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return payments.filter((payment) => {
      const matchesSearch =
        !query ||
        payment.customerName.toLowerCase().includes(query) ||
        payment.mobile.toLowerCase().includes(query) ||
        payment.caseNumber.toLowerCase().includes(query) ||
        payment.receiptNumber.toLowerCase().includes(query) ||
        payment.executiveName.toLowerCase().includes(query) ||
        payment.branch.toLowerCase().includes(query) ||
        payment.bankName.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "All" || payment.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [payments, search, statusFilter]);

  const totalAmount = payments.reduce((total, payment) => total + payment.amount, 0);
  const recordedCount = payments.filter(
    (payment) => payment.status === "Recorded"
  ).length;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);

  return (
    <div className="payments-page">
      <style>{`
        .payments-page{min-height:100%;padding:26px;background:#f5f7fb;color:#0f172a;box-sizing:border-box}
        .payments-page *{box-sizing:border-box}
        .payments-hero{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:28px;border-radius:20px;background:linear-gradient(135deg,#07192d,#075985);color:white}
        .payments-hero h1{margin:8px 0 0}.payments-hero p{margin:10px 0 0;color:#e0f2fe}
        .payments-status{padding:14px 17px;border:1px solid rgba(255,255,255,.2);border-radius:14px;background:rgba(255,255,255,.08)}
        .payments-status span{display:block;font-size:10px;color:#bae6fd;font-weight:800}.payments-status strong{display:block;margin-top:6px}
        .payments-refresh{margin-top:10px;height:38px;padding:0 14px;border:1px solid rgba(255,255,255,.25);border-radius:10px;background:rgba(255,255,255,.1);color:white;font-weight:800;cursor:pointer}
        .payments-message{margin-top:15px;padding:13px;border-radius:11px;background:#fef2f2;color:#b91c1c;font-weight:700}
        .payments-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-top:18px}
        .payments-stat,.payments-panel{background:white;border:1px solid #e2e8f0;border-radius:17px}
        .payments-stat{padding:18px}.payments-stat span{display:block;color:#64748b;font-size:10px;font-weight:900}.payments-stat strong{display:block;margin-top:9px;font-size:24px}
        .payments-panel{margin-top:18px;padding:20px}
        .payments-form{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:16px}
        .payments-form label{display:grid;gap:6px;color:#475569;font-size:11px;font-weight:800}.payments-form .wide{grid-column:span 2}
        .payments-save{height:44px;border:0;border-radius:11px;background:#075985;color:white;font-weight:900;cursor:pointer;align-self:end}
        .payments-save:disabled{cursor:not-allowed;opacity:.55}
        .payments-case-found{grid-column:span 4;padding:12px 14px;border:1px solid #bbf7d0;border-radius:11px;background:#f0fdf4;color:#166534;font-size:12px;font-weight:800}
        .payments-heading{display:flex;justify-content:space-between;align-items:center;gap:12px}.payments-heading h2{margin:0}.payments-heading p{margin:5px 0 0;color:#64748b;font-size:12px}
        .payments-connected{padding:7px 11px;border-radius:999px;background:#ecfdf5;color:#047857;font-size:10px;font-weight:900}
        .payments-toolbar{display:grid;grid-template-columns:1fr 180px 140px;gap:10px;margin:16px 0}
        .payments-input,.payments-select,.payments-button{height:43px;padding:0 12px;border:1px solid #cbd5e1;border-radius:10px;background:white}
        .payments-button{font-weight:800;cursor:pointer}
        .payments-table-wrap{overflow:auto;border:1px solid #e2e8f0;border-radius:13px}
        .payments-table{width:100%;min-width:1050px;border-collapse:collapse}
        .payments-table th{padding:12px;background:#f8fafc;color:#64748b;font-size:10px;text-align:left}
        .payments-table td{padding:13px;border-top:1px solid #eef2f7;color:#475569;font-size:12px}
        .payments-customer strong{display:block;color:#0f172a}.payments-customer span{display:block;margin-top:3px;color:#94a3b8}
        .payments-amount{font-weight:900;color:#0f172a}
        .payments-badge{display:inline-flex;padding:5px 9px;border-radius:999px;font-size:10px;font-weight:900}
        .payments-delete{min-height:38px;padding:0 12px;border:1px solid #fecaca;border-radius:9px;background:#fff1f2;color:#b91c1c;font-weight:900;cursor:pointer}.payments-delete:disabled{cursor:not-allowed;opacity:.55}
        .recorded,.verified{background:#ecfdf5;color:#047857}.pending{background:#fffbeb;color:#b45309}.rejected{background:#fef2f2;color:#b91c1c}
        .payments-empty{padding:50px 20px;text-align:center;color:#64748b;font-weight:700}
        @media(max-width:900px){.payments-stats{grid-template-columns:repeat(2,1fr)}.payments-toolbar{grid-template-columns:1fr}.payments-form{grid-template-columns:repeat(2,1fr)}.payments-case-found{grid-column:span 2}}
        @media(max-width:600px){.payments-page{padding:14px}.payments-hero{align-items:flex-start;flex-direction:column}.payments-stats,.payments-form{grid-template-columns:1fr}.payments-form .wide,.payments-case-found{grid-column:span 1}}
      `}</style>

      <section className="payments-hero">
        <div>
          <small>FINANCIAL CONTROL CENTER</small>
          <h1>Payment Management</h1>
          <p>Recovery payments, receipts aur verification status.</p>
        </div>

        <div className="payments-status">
          <span>PAYMENT DATABASE</span>
          <strong>Connected</strong>
          <button
            className="payments-refresh"
            type="button"
            disabled={loading || refreshing}
            onClick={() => void loadPayments(true)}
          >
            {loading || refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </section>

      {message && <div className="payments-message">{message}</div>}

      <section className="payments-stats">
        <article className="payments-stat">
          <span>TOTAL COLLECTION</span>
          <strong>{formatCurrency(totalAmount)}</strong>
        </article>
        <article className="payments-stat">
          <span>RECORDED AMOUNT</span>
          <strong>{formatCurrency(totalAmount)}</strong>
        </article>
        <article className="payments-stat">
          <span>TOTAL PAYMENTS</span>
          <strong>{payments.length}</strong>
        </article>
        <article className="payments-stat">
          <span>RECORDED ENTRIES</span>
          <strong>{recordedCount}</strong>
        </article>
      </section>

      <section className="payments-panel">
        <div className="payments-heading"><div><h2>Add Payment by Admin</h2><p>Bank aur case select karke verified collection entry save karein.</p></div></div>
        <form className="payments-form" onSubmit={addAdminPayment}>
          <label>Bank<select className="payments-select" value={formBank} onChange={(e) => { setFormBank(e.target.value as PaymentBank); setFormCaseId(""); setFormCaseSearch(""); setFormExecutiveId(""); }}><option value="BOB">Bank of Baroda</option><option value="SBI">State Bank of India</option></select></label>
          <label className="wide">Search Customer / Account<input className="payments-input" type="search" value={formCaseSearch} onChange={(e) => updateCaseSearch(e.target.value)} placeholder="Account number ya customer name type karein" /></label>
          <label className="wide">Customer / Case<select className="payments-select" value={formCaseId} onChange={(e) => setFormCaseId(e.target.value)} required><option value="">{formCaseSearch && filteredCaseOptions.length === 0 ? "No matching case" : "Select case"}</option>{filteredCaseOptions.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
          {selectedAdminCase && <div className="payments-case-found">✓ Customer: {selectedAdminCase.customerName} &nbsp;|&nbsp; A/C: {selectedAdminCase.accountNumber} &nbsp;|&nbsp; Branch: {selectedAdminCase.branch || "Branch missing"}</div>}
          <label>Branch<input className="payments-input" value={selectedAdminCase?.branch ?? ""} placeholder="Case select karne par branch aayegi" readOnly required /></label>
          <label>Executive<select className="payments-select" value={formExecutiveId} onChange={(e) => setFormExecutiveId(e.target.value)}><option value="">Admin / No executive</option>{executiveOptions.filter((row) => row.bank === formBank).map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
          <label>Amount<input className="payments-input" type="number" min="1" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} required /></label>
          <label>Payment Mode<select className="payments-select" value={formMode} onChange={(e) => setFormMode(e.target.value)}><option>Settlement</option><option>Palti Ki Gayi</option><option>Upgrade</option></select></label>
          <label>Payment Date<input className="payments-input" type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} required /></label>
          <label>Receipt Number<input className="payments-input" value={formReceipt} onChange={(e) => setFormReceipt(e.target.value)} placeholder="Optional" /></label>
          <label className="wide">Remarks<input className="payments-input" value={formRemarks} onChange={(e) => setFormRemarks(e.target.value)} placeholder="Optional admin note" /></label>
          <button className="payments-save" type="submit" disabled={saving || !selectedAdminCase}>{saving ? "Saving..." : "Add Payment"}</button>
        </form>
      </section>

      <section className="payments-panel">
        <div className="payments-heading">
          <div>
            <h2>Payment Records</h2>
            <p>Real Supabase payment records.</p>
          </div>
          <span className="payments-connected">{payments.length} records</span>
        </div>

        <div className="payments-toolbar">
          <input
            className="payments-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search customer, mobile, case, receipt..."
          />

          <select
            className="payments-select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as PaymentStatus)}
          >
            <option value="All">All Status</option>
            <option value="Recorded">Recorded</option>
            <option value="Pending">Pending</option>
            <option value="Verified">Verified</option>
            <option value="Rejected">Rejected</option>
          </select>

          <button className="payments-button" type="button" onClick={() => void loadPayments(true)}>
            Refresh
          </button>
        </div>

        <div className="payments-table-wrap">
          {loading ? (
            <div className="payments-empty">Payment records load ho rahe hain...</div>
          ) : filteredPayments.length > 0 ? (
            <table className="payments-table">
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Customer</th>
                  <th>Case Number</th>
                  <th>Bank</th>
                  <th>Branch</th>
                  <th>Executive</th>
                  <th>Payment Date</th>
                  <th>Mode</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.receiptNumber}</td>
                    <td>
                      <div className="payments-customer">
                        <strong>{payment.customerName}</strong>
                        <span>{payment.mobile}</span>
                      </div>
                    </td>
                    <td>{payment.caseNumber}</td>
                    <td>{payment.bankName}</td>
                    <td>{payment.branch}</td>
                    <td>{payment.executiveName}</td>
                    <td>{payment.paymentDate}</td>
                    <td>{payment.paymentMode}</td>
                    <td><span className="payments-amount">{formatCurrency(payment.amount)}</span></td>
                    <td>
                      <span className={`payments-badge ${payment.status.toLowerCase()}`}>
                        {payment.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="payments-delete"
                        type="button"
                        disabled={Boolean(deletingId)}
                        onClick={() => void deletePayment(payment)}
                        aria-label={`Delete ${payment.customerName} payment`}
                      >
                        {deletingId === payment.id ? "Deleting..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="payments-empty">Abhi koi payment record nahi hai.</div>
          )}
        </div>
      </section>
    </div>
  );
}

export default PaymentsPage;
