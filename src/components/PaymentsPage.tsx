import { useMemo, useState } from "react";

type PaymentStatus = "All" | "Pending" | "Verified" | "Rejected";

type PaymentRecord = {
  id: number;
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

const payments: PaymentRecord[] = [];

function PaymentsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<PaymentStatus>("All");

  const filteredPayments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return payments.filter((payment) => {
      const matchesSearch =
        !query ||
        payment.customerName.toLowerCase().includes(query) ||
        payment.mobile.includes(query) ||
        payment.caseNumber.toLowerCase().includes(query) ||
        payment.receiptNumber.toLowerCase().includes(query) ||
        payment.executiveName.toLowerCase().includes(query) ||
        payment.bankName.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "All" || payment.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter]);

  const totalAmount = payments.reduce(
    (total, payment) => total + payment.amount,
    0
  );

  const verifiedAmount = payments
    .filter((payment) => payment.status === "Verified")
    .reduce((total, payment) => total + payment.amount, 0);

  const pendingCount = payments.filter(
    (payment) => payment.status === "Pending"
  ).length;

  const rejectedCount = payments.filter(
    (payment) => payment.status === "Rejected"
  ).length;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusClass = (
    status: Exclude<PaymentStatus, "All">
  ) => {
    return status.toLowerCase();
  };

  return (
    <div className="payments-page">
      <style>{`
        .payments-page {
          min-height: 100%;
          padding: 26px;
          background:
            radial-gradient(
              circle at top right,
              rgba(14, 165, 233, 0.09),
              transparent 27%
            ),
            #f5f7fb;
          color: #0f172a;
          box-sizing: border-box;
        }

        .payments-page * {
          box-sizing: border-box;
        }

        .payments-hero {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          overflow: hidden;
          padding: 30px;
          border-radius: 22px;
          color: white;
          background:
            linear-gradient(
              135deg,
              rgba(255, 255, 255, 0.05),
              transparent
            ),
            linear-gradient(
              135deg,
              #07192d 0%,
              #0c3157 55%,
              #075985 100%
            );
          box-shadow: 0 18px 45px rgba(7, 25, 45, 0.18);
        }

        .payments-hero::after {
          content: "";
          position: absolute;
          top: -90px;
          right: -70px;
          width: 230px;
          height: 230px;
          border: 34px solid rgba(255, 255, 255, 0.06);
          border-radius: 50%;
        }

        .payments-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          color: #bae6fd;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .payments-hero h1 {
          margin: 0;
          font-size: clamp(28px, 3vw, 38px);
          line-height: 1.1;
          letter-spacing: -0.03em;
        }

        .payments-hero p {
          max-width: 700px;
          margin: 12px 0 0;
          color: #e0f2fe;
          font-size: 15px;
          line-height: 1.65;
        }

        .payments-hero-status {
          position: relative;
          z-index: 1;
          min-width: 210px;
          padding: 17px 19px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(8px);
        }

        .payments-hero-status span {
          display: block;
          color: #bae6fd;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .payments-hero-status strong {
          display: block;
          margin-top: 7px;
          font-size: 22px;
        }

        .payments-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 15px;
          margin-top: 20px;
        }

        .payments-stat-card {
          padding: 19px;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          background: white;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
        }

        .payments-stat-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .payments-stat-card span {
          display: block;
          color: #64748b;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .payments-stat-icon {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background: #f0f9ff;
          font-size: 18px;
        }

        .payments-stat-card strong {
          display: block;
          margin-top: 10px;
          font-size: 25px;
          letter-spacing: -0.03em;
        }

        .payments-panel {
          margin-top: 20px;
          padding: 22px;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          background: white;
          box-shadow: 0 12px 35px rgba(15, 23, 42, 0.07);
        }

        .payments-panel-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 18px;
        }

        .payments-panel-heading h2 {
          margin: 0;
          font-size: 19px;
          letter-spacing: -0.02em;
        }

        .payments-panel-heading p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 13px;
        }

        .payments-not-connected {
          display: inline-flex;
          align-items: center;
          padding: 8px 12px;
          border-radius: 999px;
          color: #b45309;
          background: #fffbeb;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }

        .payments-toolbar {
          display: grid;
          grid-template-columns: minmax(250px, 1fr) 180px 150px;
          gap: 12px;
          margin-bottom: 18px;
        }

        .payments-input,
        .payments-select {
          width: 100%;
          height: 46px;
          padding: 0 14px;
          border: 1px solid #cbd5e1;
          border-radius: 13px;
          background: white;
          color: #0f172a;
          font-size: 13px;
          outline: none;
          transition: 0.2s ease;
        }

        .payments-input:focus,
        .payments-select:focus {
          border-color: #0284c7;
          box-shadow: 0 0 0 4px rgba(2, 132, 199, 0.1);
        }

        .payments-export-button {
          height: 46px;
          border: 1px solid #cbd5e1;
          border-radius: 13px;
          color: #334155;
          background: white;
          font-size: 13px;
          font-weight: 800;
          cursor: not-allowed;
          opacity: 0.65;
        }

        .payments-table-wrapper {
          overflow-x: auto;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
        }

        .payments-table {
          width: 100%;
          min-width: 1100px;
          border-collapse: collapse;
        }

        .payments-table th {
          padding: 13px 15px;
          border-bottom: 1px solid #e2e8f0;
          color: #64748b;
          background: #f8fafc;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.06em;
          text-align: left;
          text-transform: uppercase;
        }

        .payments-table td {
          padding: 15px;
          border-bottom: 1px solid #eef2f7;
          color: #475569;
          font-size: 12px;
          vertical-align: middle;
        }

        .payments-table tbody tr:last-child td {
          border-bottom: none;
        }

        .payments-customer strong {
          display: block;
          color: #0f172a;
          font-size: 13px;
        }

        .payments-customer span {
          display: block;
          margin-top: 4px;
          color: #94a3b8;
          font-size: 11px;
        }

        .payments-amount {
          color: #0f172a;
          font-size: 13px;
          font-weight: 900;
        }

        .payments-status-badge {
          display: inline-flex;
          align-items: center;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 900;
        }

        .payments-status-badge.pending {
          color: #b45309;
          background: #fffbeb;
        }

        .payments-status-badge.verified {
          color: #047857;
          background: #ecfdf5;
        }

        .payments-status-badge.rejected {
          color: #b91c1c;
          background: #fef2f2;
        }

        .payments-empty-state {
          min-height: 390px;
          display: grid;
          place-items: center;
          padding: 40px 20px;
          text-align: center;
        }

        .payments-empty-icon {
          width: 82px;
          height: 82px;
          display: grid;
          place-items: center;
          margin: 0 auto 17px;
          border-radius: 24px;
          background: #f0f9ff;
          font-size: 37px;
        }

        .payments-empty-state h3 {
          margin: 0;
          color: #0f172a;
          font-size: 21px;
        }

        .payments-empty-state p {
          max-width: 520px;
          margin: 10px auto 0;
          color: #64748b;
          font-size: 13px;
          line-height: 1.65;
        }

        .payments-info-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          margin-top: 20px;
        }

        .payments-info-card {
          padding: 17px;
          border: 1px solid #e2e8f0;
          border-radius: 15px;
          background: #f8fafc;
        }

        .payments-info-card strong {
          display: block;
          color: #0f172a;
          font-size: 13px;
        }

        .payments-info-card p {
          margin: 7px 0 0;
          color: #64748b;
          font-size: 12px;
          line-height: 1.55;
        }

        @media (max-width: 1100px) {
          .payments-stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .payments-info-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .payments-page {
            padding: 14px;
          }

          .payments-hero,
          .payments-panel-heading {
            align-items: flex-start;
            flex-direction: column;
          }

          .payments-hero-status {
            width: 100%;
          }

          .payments-toolbar {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 500px) {
          .payments-stats {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <section className="payments-hero">
        <div>
          <div className="payments-kicker">
            <span>◆</span>
            Financial Control Center
          </div>

          <h1>Payment Management</h1>

          <p>
            Customer recovery payments, receipts, executive
            collections aur verification status ko ek hi jagah
            manage karne ke liye premium payment module.
          </p>
        </div>

        <div className="payments-hero-status">
          <span>Payment Database</span>
          <strong>Not Connected</strong>
        </div>
      </section>

      <section className="payments-stats">
        <article className="payments-stat-card">
          <div className="payments-stat-top">
            <span>Total Collection</span>
            <div className="payments-stat-icon">₹</div>
          </div>
          <strong>{formatCurrency(totalAmount)}</strong>
        </article>

        <article className="payments-stat-card">
          <div className="payments-stat-top">
            <span>Verified Amount</span>
            <div className="payments-stat-icon">✓</div>
          </div>
          <strong>{formatCurrency(verifiedAmount)}</strong>
        </article>

        <article className="payments-stat-card">
          <div className="payments-stat-top">
            <span>Pending Verification</span>
            <div className="payments-stat-icon">⌛</div>
          </div>
          <strong>{pendingCount}</strong>
        </article>

        <article className="payments-stat-card">
          <div className="payments-stat-top">
            <span>Rejected Payments</span>
            <div className="payments-stat-icon">!</div>
          </div>
          <strong>{rejectedCount}</strong>
        </article>
      </section>

      <section className="payments-panel">
        <div className="payments-panel-heading">
          <div>
            <h2>Payment Records</h2>
            <p>
              Customer, case, executive aur receipt ke hisaab se
              payment records manage karein.
            </p>
          </div>

          <span className="payments-not-connected">
            No payment data connected
          </span>
        </div>

        <div className="payments-toolbar">
          <input
            className="payments-input"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search customer, mobile, case, receipt..."
          />

          <select
            className="payments-select"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as PaymentStatus)
            }
          >
            <option value="All">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Verified">Verified</option>
            <option value="Rejected">Rejected</option>
          </select>

          <button
            className="payments-export-button"
            type="button"
            disabled
          >
            Export Payments
          </button>
        </div>

        <div className="payments-table-wrapper">
          {filteredPayments.length > 0 ? (
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

                    <td>
                      <span className="payments-amount">
                        {formatCurrency(payment.amount)}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`payments-status-badge ${getStatusClass(
                          payment.status
                        )}`}
                      >
                        {payment.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="payments-empty-state">
              <div>
                <div className="payments-empty-icon">₹</div>

                <h3>No Payment Records Connected</h3>

                <p>
                  Abhi koi fake payment ya sample collection record
                  show nahi kiya gaya hai. Supabase payment database
                  connect hone ke baad real payment records yahan
                  automatically दिखाई देंगे.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="payments-panel">
        <div className="payments-panel-heading">
          <div>
            <h2>Payment Verification Rules</h2>
            <p>
              Real payment integration ke waqt ye controls use
              honge.
            </p>
          </div>
        </div>

        <div className="payments-info-grid">
          <article className="payments-info-card">
            <strong>Receipt Verification</strong>
            <p>
              Har payment ke saath unique receipt number aur
              executive details verify ki jayengi.
            </p>
          </article>

          <article className="payments-info-card">
            <strong>Case Matching</strong>
            <p>
              Payment ko customer ke correct recovery case aur bank
              account ke saath link kiya jayega.
            </p>
          </article>

          <article className="payments-info-card">
            <strong>Approval Control</strong>
            <p>
              Pending payment ko authorised verification ke baad hi
              verified collection me count kiya jayega.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}

export default PaymentsPage;

