import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

type RawRow = Record<string, unknown>;
type PaymentStatus = "All" | "Pending" | "Verified" | "Rejected";

type PaymentRecord = {
  id: string;
  receiptNumber: string;
  customerName: string;
  mobile: string;
  caseNumber: string;
  executiveName: string;
  bankName: string;
  amount: number;
  paymentMode: string;
  paymentDate: string;
  status: Exclude<PaymentStatus, "All">;
};

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

function normalizeStatus(value: unknown): Exclude<PaymentStatus, "All"> {
  const status = text(value).toLowerCase();

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

async function fetchAll(table: "payments" | "cases" | "profiles") {
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

  const loadPayments = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    setMessage("");

    try {
      const [paymentRows, caseRows, profileRows] = await Promise.all([
        fetchAll("payments"),
        fetchAll("cases"),
        fetchAll("profiles"),
      ]);

      const casesById = new Map<string, RawRow>();
      caseRows.forEach((row) => {
        const id = first(row, ["id", "case_id"]);
        if (id) casesById.set(id, row);
      });

      const profilesById = new Map<string, RawRow>();
      profileRows.forEach((row) => {
        const id = first(row, ["id", "profile_id"]);
        if (id) profilesById.set(id, row);
      });

      const mapped = paymentRows.map((payment, index): PaymentRecord => {
        const caseId = first(payment, ["case_id"]);
        const executiveId = first(payment, [
          "executive_id",
          "collected_by",
          "profile_id",
          "created_by",
        ]);

        const caseRow = casesById.get(caseId) ?? {};
        const profileRow = profilesById.get(executiveId) ?? {};

        return {
          id: first(payment, ["id"], String(index + 1)),
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
            first(caseRow, ["mobile", "mobile_no", "phone"], "-")
          ),
          caseNumber: first(
            payment,
            ["case_number"],
            first(caseRow, ["case_number", "account_no", "id"], "-")
          ),
          executiveName: first(
            payment,
            ["executive_name"],
            first(profileRow, ["full_name", "name"], "-")
          ),
          bankName: first(
            payment,
            ["bank_name"],
            first(caseRow, ["bank_name", "branch", "branch_name"], "-")
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

  useEffect(() => {
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
        { event: "*", schema: "public", table: "profiles" },
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
        payment.bankName.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "All" || payment.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [payments, search, statusFilter]);

  const totalAmount = payments.reduce((total, payment) => total + payment.amount, 0);
  const verifiedAmount = payments
    .filter((payment) => payment.status === "Verified")
    .reduce((total, payment) => total + payment.amount, 0);
  const pendingCount = payments.filter((payment) => payment.status === "Pending").length;
  const rejectedCount = payments.filter((payment) => payment.status === "Rejected").length;

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
        .pending{background:#fffbeb;color:#b45309}.verified{background:#ecfdf5;color:#047857}.rejected{background:#fef2f2;color:#b91c1c}
        .payments-empty{padding:50px 20px;text-align:center;color:#64748b;font-weight:700}
        @media(max-width:900px){.payments-stats{grid-template-columns:repeat(2,1fr)}.payments-toolbar{grid-template-columns:1fr}}
        @media(max-width:600px){.payments-page{padding:14px}.payments-hero{align-items:flex-start;flex-direction:column}.payments-stats{grid-template-columns:1fr}}
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
          <span>VERIFIED AMOUNT</span>
          <strong>{formatCurrency(verifiedAmount)}</strong>
        </article>
        <article className="payments-stat">
          <span>PENDING VERIFICATION</span>
          <strong>{pendingCount}</strong>
        </article>
        <article className="payments-stat">
          <span>REJECTED PAYMENTS</span>
          <strong>{rejectedCount}</strong>
        </article>
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
                  <th>Executive</th>
                  <th>Payment Date</th>
                  <th>Mode</th>
                  <th>Amount</th>
                  <th>Status</th>
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
                    <td>{payment.executiveName}</td>
                    <td>{payment.paymentDate}</td>
                    <td>{payment.paymentMode}</td>
                    <td><span className="payments-amount">{formatCurrency(payment.amount)}</span></td>
                    <td>
                      <span className={`payments-badge ${payment.status.toLowerCase()}`}>
                        {payment.status}
                      </span>
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