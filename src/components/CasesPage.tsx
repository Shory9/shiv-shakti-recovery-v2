import { useMemo, useState } from "react";

type CaseStatus =
  | "Pending"
  | "Visited"
  | "Paid"
  | "Overdue";

type CaseItem = {
  id: number;
  accountNo: string;
  customer: string;
  mobile: string;
  bank: string;
  area: string;
  executive: string;
  amount: number;
  status: CaseStatus;
};

const sampleCases: CaseItem[] = [
  {
    id: 1,
    accountNo: "575050000850",
    customer: "Rama S O Thavra Tad",
    mobile: "9876543210",
    bank: "Bank of Baroda",
    area: "Bamaniya",
    executive: "Bablu Nagda",
    amount: 341857.84,
    status: "Pending",
  },
  {
    id: 2,
    accountNo: "575050000123",
    customer: "Vinod Kumar",
    mobile: "9988776655",
    bank: "Bank of Baroda",
    area: "Neemuch",
    executive: "Kailash Nagda",
    amount: 222788.36,
    status: "Visited",
  },
  {
    id: 3,
    accountNo: "575050000043",
    customer: "Manguri Narsingh",
    mobile: "9123456780",
    bank: "Bank of Baroda",
    area: "Manasa",
    executive: "Rahul Kumar",
    amount: 200276.72,
    status: "Overdue",
  },
  {
    id: 4,
    accountNo: "575050000786",
    customer: "Shivam Chouhan",
    mobile: "9001122334",
    bank: "State Bank of India",
    area: "Sailana",
    executive: "Shivam Chouhan",
    amount: 155000,
    status: "Paid",
  },
  {
    id: 5,
    accountNo: "575050000444",
    customer: "Rakesh Parmar",
    mobile: "9012345678",
    bank: "Bank of Baroda",
    area: "Jaora",
    executive: "Nayan Singh",
    amount: 187500,
    status: "Pending",
  },
  {
    id: 6,
    accountNo: "575050000221",
    customer: "Suresh Malviya",
    mobile: "9090909090",
    bank: "Bank of Baroda",
    area: "Mandsaur",
    executive: "Akshat Parmar",
    amount: 98500,
    status: "Visited",
  },
];

const statusOptions: Array<CaseStatus | "All"> = [
  "All",
  "Pending",
  "Visited",
  "Paid",
  "Overdue",
];

function CasesPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<
    CaseStatus | "All"
  >("All");
  const [area, setArea] = useState("All");

  const areas = useMemo(() => {
    return [
      "All",
      ...Array.from(
        new Set(sampleCases.map((item) => item.area))
      ),
    ];
  }, []);

  const filteredCases = useMemo(() => {
    const query = search.trim().toLowerCase();

    return sampleCases.filter((item) => {
      const matchesSearch =
        !query ||
        item.customer.toLowerCase().includes(query) ||
        item.accountNo.toLowerCase().includes(query) ||
        item.mobile.toLowerCase().includes(query) ||
        item.executive.toLowerCase().includes(query);

      const matchesStatus =
        status === "All" || item.status === status;

      const matchesArea =
        area === "All" || item.area === area;

      return matchesSearch && matchesStatus && matchesArea;
    });
  }, [search, status, area]);

  const totalAmount = filteredCases.reduce(
    (sum, item) => sum + item.amount,
    0
  );

  const pendingCount = filteredCases.filter(
    (item) => item.status === "Pending"
  ).length;

  const visitedCount = filteredCases.filter(
    (item) => item.status === "Visited"
  ).length;

  const paidCount = filteredCases.filter(
    (item) => item.status === "Paid"
  ).length;

  return (
    <div className="cases-page">
      <style>{`
        .cases-page {
          min-height: 100%;
          padding: 26px;
          background:
            radial-gradient(
              circle at top right,
              rgba(37, 99, 235, 0.08),
              transparent 28%
            ),
            #f5f7fb;
          color: #0f172a;
          box-sizing: border-box;
        }

        .cases-page * {
          box-sizing: border-box;
        }

        .cases-hero {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          overflow: hidden;
          padding: 28px;
          border-radius: 22px;
          color: white;
          background:
            linear-gradient(
              135deg,
              rgba(255,255,255,.06),
              transparent
            ),
            linear-gradient(
              135deg,
              #07192d 0%,
              #0d2f55 56%,
              #12497b 100%
            );
          box-shadow: 0 18px 45px rgba(7, 25, 45, .18);
        }

        .cases-hero::after {
          content: "";
          position: absolute;
          top: -90px;
          right: -70px;
          width: 220px;
          height: 220px;
          border: 32px solid rgba(255,255,255,.06);
          border-radius: 999px;
        }

        .cases-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 9px;
          color: #bfdbfe;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .12em;
          text-transform: uppercase;
        }

        .cases-hero h1 {
          margin: 0;
          font-size: clamp(27px, 3vw, 38px);
          line-height: 1.08;
          letter-spacing: -.03em;
        }

        .cases-hero p {
          max-width: 720px;
          margin: 12px 0 0;
          color: #dbeafe;
          font-size: 15px;
          line-height: 1.65;
        }

        .cases-hero-badge {
          position: relative;
          z-index: 1;
          min-width: 170px;
          padding: 16px 18px;
          border: 1px solid rgba(255,255,255,.18);
          border-radius: 16px;
          background: rgba(255,255,255,.08);
          backdrop-filter: blur(8px);
        }

        .cases-hero-badge span {
          display: block;
          color: #bfdbfe;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .1em;
          text-transform: uppercase;
        }

        .cases-hero-badge strong {
          display: block;
          margin-top: 6px;
          font-size: 20px;
        }

        .cases-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 15px;
          margin-top: 20px;
        }

        .cases-stat {
          padding: 18px;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          background: white;
          box-shadow: 0 10px 30px rgba(15, 23, 42, .06);
        }

        .cases-stat span {
          display: block;
          color: #64748b;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .05em;
          text-transform: uppercase;
        }

        .cases-stat strong {
          display: block;
          margin-top: 7px;
          font-size: 25px;
          letter-spacing: -.03em;
        }

        .cases-panel {
          margin-top: 20px;
          padding: 22px;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          background: white;
          box-shadow: 0 12px 35px rgba(15, 23, 42, .07);
        }

        .cases-panel-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
        }

        .cases-panel-head h2 {
          margin: 0;
          font-size: 19px;
          letter-spacing: -.02em;
        }

        .cases-panel-head p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 13px;
        }

        .cases-count-badge {
          display: inline-flex;
          align-items: center;
          padding: 8px 11px;
          border-radius: 999px;
          color: #1d4ed8;
          background: #eff6ff;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .cases-filter-grid {
          display: grid;
          grid-template-columns: minmax(250px, 1.5fr) repeat(2, minmax(170px, .6fr));
          gap: 14px;
        }

        .cases-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .cases-field label {
          color: #334155;
          font-size: 12px;
          font-weight: 800;
        }

        .cases-input,
        .cases-select {
          width: 100%;
          height: 48px;
          padding: 0 14px;
          border: 1px solid #cbd5e1;
          border-radius: 13px;
          background: white;
          color: #0f172a;
          font-size: 14px;
          outline: none;
          transition: .2s ease;
        }

        .cases-input:focus,
        .cases-select:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37,99,235,.11);
        }

        .cases-table-wrap {
          width: 100%;
          max-height: 580px;
          overflow: auto;
          border: 1px solid #e2e8f0;
          border-radius: 15px;
        }

        .cases-table {
          width: 100%;
          min-width: 1120px;
          border-collapse: separate;
          border-spacing: 0;
          background: white;
          font-size: 13px;
        }

        .cases-table th {
          position: sticky;
          top: 0;
          z-index: 2;
          padding: 13px 14px;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #475569;
          text-align: left;
          font-size: 11px;
          font-weight: 850;
          letter-spacing: .045em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .cases-table td {
          padding: 14px;
          border-bottom: 1px solid #eef2f7;
          color: #334155;
          vertical-align: middle;
        }

        .cases-table tbody tr:hover td {
          background: #fbfdff;
        }

        .cases-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .case-customer {
          min-width: 190px;
        }

        .case-customer strong {
          display: block;
          color: #0f172a;
          font-size: 13px;
        }

        .case-customer span {
          display: block;
          margin-top: 4px;
          color: #64748b;
          font-size: 12px;
        }

        .case-account {
          color: #0f172a;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
        }

        .case-money {
          color: #0f172a;
          font-weight: 850;
          white-space: nowrap;
        }

        .case-status {
          display: inline-flex;
          align-items: center;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 850;
          white-space: nowrap;
        }

        .case-status.pending {
          color: #b45309;
          background: #fffbeb;
        }

        .case-status.visited {
          color: #1d4ed8;
          background: #eff6ff;
        }

        .case-status.paid {
          color: #047857;
          background: #ecfdf5;
        }

        .case-status.overdue {
          color: #b91c1c;
          background: #fef2f2;
        }

        .case-actions {
          display: flex;
          gap: 7px;
        }

        .case-action-btn {
          min-height: 34px;
          padding: 0 10px;
          border: 1px solid #cbd5e1;
          border-radius: 9px;
          background: white;
          color: #334155;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        .case-action-btn.primary {
          border-color: #bfdbfe;
          background: #eff6ff;
          color: #1d4ed8;
        }

        .cases-empty {
          padding: 45px 20px;
          color: #64748b;
          text-align: center;
        }

        @media (max-width: 1050px) {
          .cases-stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .cases-filter-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .cases-page {
            padding: 14px;
          }

          .cases-hero,
          .cases-panel-head {
            align-items: flex-start;
            flex-direction: column;
          }

          .cases-hero-badge {
            width: 100%;
          }
        }

        @media (max-width: 480px) {
          .cases-stats {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <section className="cases-hero">
        <div>
          <div className="cases-kicker">
            <span>◆</span>
            Case Management
          </div>

          <h1>Recovery Cases</h1>

          <p>
            Customer cases ko search, filter, monitor aur
            executive-wise manage karein.
          </p>
        </div>

        <div className="cases-hero-badge">
          <span>Total Records</span>
          <strong>{sampleCases.length}</strong>
        </div>
      </section>

      <section className="cases-stats">
        <article className="cases-stat">
          <span>Visible Cases</span>
          <strong>{filteredCases.length}</strong>
        </article>

        <article className="cases-stat">
          <span>Pending</span>
          <strong>{pendingCount}</strong>
        </article>

        <article className="cases-stat">
          <span>Visited / Paid</span>
          <strong>{visitedCount + paidCount}</strong>
        </article>

        <article className="cases-stat">
          <span>Total Outstanding</span>
          <strong>
            ₹
            {totalAmount.toLocaleString("en-IN", {
              maximumFractionDigits: 0,
            })}
          </strong>
        </article>
      </section>

      <section className="cases-panel">
        <div className="cases-panel-head">
          <div>
            <h2>Search & Filters</h2>
            <p>
              Account number, customer, mobile ya executive se
              case search karein.
            </p>
          </div>

          <span className="cases-count-badge">
            {filteredCases.length} results
          </span>
        </div>

        <div className="cases-filter-grid">
          <div className="cases-field">
            <label htmlFor="case-search">Search Case</label>
            <input
              id="case-search"
              className="cases-input"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search customer, account, mobile..."
            />
          </div>

          <div className="cases-field">
            <label htmlFor="case-status">Status</label>
            <select
              id="case-status"
              className="cases-select"
              value={status}
              onChange={(event) =>
                setStatus(
                  event.target.value as CaseStatus | "All"
                )
              }
            >
              {statusOptions.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>

          <div className="cases-field">
            <label htmlFor="case-area">Market / Area</label>
            <select
              id="case-area"
              className="cases-select"
              value={area}
              onChange={(event) =>
                setArea(event.target.value)
              }
            >
              {areas.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="cases-panel">
        <div className="cases-panel-head">
          <div>
            <h2>All Recovery Cases</h2>
            <p>
              Case details, executive assignment aur current
              recovery status.
            </p>
          </div>
        </div>

        <div className="cases-table-wrap">
          <table className="cases-table">
            <thead>
              <tr>
                <th>Account No.</th>
                <th>Customer</th>
                <th>Bank</th>
                <th>Market</th>
                <th>Executive</th>
                <th>Outstanding</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredCases.length > 0 ? (
                filteredCases.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="case-account">
                        {item.accountNo}
                      </span>
                    </td>

                    <td>
                      <div className="case-customer">
                        <strong>{item.customer}</strong>
                        <span>{item.mobile}</span>
                      </div>
                    </td>

                    <td>{item.bank}</td>
                    <td>{item.area}</td>
                    <td>{item.executive}</td>

                    <td>
                      <span className="case-money">
                        ₹
                        {item.amount.toLocaleString(
                          "en-IN",
                          {
                            maximumFractionDigits: 2,
                          }
                        )}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`case-status ${item.status.toLowerCase()}`}
                      >
                        {item.status}
                      </span>
                    </td>

                    <td>
                      <div className="case-actions">
                        <button className="case-action-btn primary">
                          View
                        </button>
                        <button className="case-action-btn">
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8}>
                    <div className="cases-empty">
                      No matching cases found.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default CasesPage;

