import { useMemo, useState } from "react";

type ReportType =
  | "Overview"
  | "Recovery"
  | "Executive"
  | "Bank"
  | "Cases";

type ReportPeriod =
  | "Today"
  | "Last 7 Days"
  | "Last 30 Days"
  | "This Month"
  | "Custom";

type ReportRecord = {
  id: number;
  date: string;
  customerName: string;
  caseNumber: string;
  bankName: string;
  executiveName: string;
  status: string;
  recoveryAmount: number;
};

const reportRecords: ReportRecord[] = [];

function ReportsPage() {
  const [reportType, setReportType] =
    useState<ReportType>("Overview");

  const [reportPeriod, setReportPeriod] =
    useState<ReportPeriod>("This Month");

  const [search, setSearch] = useState("");

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    return reportRecords.filter((record) => {
      return (
        !query ||
        record.customerName.toLowerCase().includes(query) ||
        record.caseNumber.toLowerCase().includes(query) ||
        record.bankName.toLowerCase().includes(query) ||
        record.executiveName.toLowerCase().includes(query) ||
        record.status.toLowerCase().includes(query)
      );
    });
  }, [search]);

  const totalCases = reportRecords.length;

  const totalRecovery = reportRecords.reduce(
    (total, record) => total + record.recoveryAmount,
    0
  );

  const recoveredCases = reportRecords.filter(
    (record) =>
      record.status.toLowerCase() === "paid" ||
      record.status.toLowerCase() === "recovered"
  ).length;

  const pendingCases = reportRecords.filter(
    (record) =>
      record.status.toLowerCase() === "pending" ||
      record.status.toLowerCase() === "overdue"
  ).length;

  const recoveryRate =
    totalCases > 0
      ? Math.round((recoveredCases / totalCases) * 100)
      : 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="reports-page">
      <style>{`
        .reports-page {
          min-height: 100%;
          padding: 26px;
          background:
            radial-gradient(
              circle at top right,
              rgba(99, 102, 241, 0.09),
              transparent 28%
            ),
            #f5f7fb;
          color: #0f172a;
          box-sizing: border-box;
        }

        .reports-page * {
          box-sizing: border-box;
        }

        .reports-hero {
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
              #172554 55%,
              #312e81 100%
            );
          box-shadow: 0 18px 45px rgba(7, 25, 45, 0.18);
        }

        .reports-hero::after {
          content: "";
          position: absolute;
          top: -95px;
          right: -70px;
          width: 240px;
          height: 240px;
          border: 35px solid rgba(255, 255, 255, 0.06);
          border-radius: 50%;
        }

        .reports-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          color: #c7d2fe;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .reports-hero h1 {
          margin: 0;
          font-size: clamp(28px, 3vw, 38px);
          line-height: 1.1;
          letter-spacing: -0.03em;
        }

        .reports-hero p {
          max-width: 720px;
          margin: 12px 0 0;
          color: #e0e7ff;
          font-size: 15px;
          line-height: 1.65;
        }

        .reports-hero-status {
          position: relative;
          z-index: 1;
          min-width: 210px;
          padding: 17px 19px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(8px);
        }

        .reports-hero-status span {
          display: block;
          color: #c7d2fe;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .reports-hero-status strong {
          display: block;
          margin-top: 7px;
          font-size: 22px;
        }

        .reports-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 15px;
          margin-top: 20px;
        }

        .reports-stat-card {
          padding: 19px;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          background: white;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
        }

        .reports-stat-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .reports-stat-card span {
          display: block;
          color: #64748b;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .reports-stat-icon {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background: #eef2ff;
          font-size: 18px;
        }

        .reports-stat-card strong {
          display: block;
          margin-top: 10px;
          font-size: 25px;
          letter-spacing: -0.03em;
        }

        .reports-panel {
          margin-top: 20px;
          padding: 22px;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          background: white;
          box-shadow: 0 12px 35px rgba(15, 23, 42, 0.07);
        }

        .reports-panel-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 18px;
        }

        .reports-panel-heading h2 {
          margin: 0;
          font-size: 19px;
          letter-spacing: -0.02em;
        }

        .reports-panel-heading p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 13px;
        }

        .reports-status-badge {
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

        .reports-toolbar {
          display: grid;
          grid-template-columns:
            minmax(240px, 1fr)
            180px
            180px
            150px;
          gap: 12px;
          margin-bottom: 18px;
        }

        .reports-input,
        .reports-select {
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

        .reports-input:focus,
        .reports-select:focus {
          border-color: #4f46e5;
          box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.1);
        }

        .reports-export-button {
          height: 46px;
          border: 1px solid #cbd5e1;
          border-radius: 13px;
          color: #475569;
          background: white;
          font-size: 13px;
          font-weight: 800;
          cursor: not-allowed;
          opacity: 0.65;
        }

        .reports-dashboard-grid {
          display: grid;
          grid-template-columns:
            minmax(0, 1.35fr)
            minmax(300px, 0.65fr);
          gap: 20px;
          margin-top: 20px;
        }

        .reports-chart-box {
          min-height: 390px;
          display: grid;
          place-items: center;
          padding: 35px;
          border: 1px dashed #a5b4fc;
          border-radius: 18px;
          background:
            linear-gradient(
              rgba(255, 255, 255, 0.88),
              rgba(255, 255, 255, 0.88)
            ),
            repeating-linear-gradient(
              0deg,
              #eef2ff,
              #eef2ff 1px,
              transparent 1px,
              transparent 42px
            );
          text-align: center;
        }

        .reports-chart-icon {
          width: 82px;
          height: 82px;
          display: grid;
          place-items: center;
          margin: 0 auto 17px;
          border-radius: 24px;
          background: #eef2ff;
          font-size: 37px;
        }

        .reports-chart-box h3 {
          margin: 0;
          font-size: 21px;
          color: #0f172a;
        }

        .reports-chart-box p {
          max-width: 510px;
          margin: 10px auto 0;
          color: #64748b;
          font-size: 13px;
          line-height: 1.65;
        }

        .reports-summary-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .reports-summary-card {
          padding: 16px;
          border: 1px solid #e2e8f0;
          border-radius: 15px;
          background: #f8fafc;
        }

        .reports-summary-card span {
          display: block;
          color: #64748b;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .reports-summary-card strong {
          display: block;
          margin-top: 7px;
          color: #0f172a;
          font-size: 19px;
        }

        .reports-summary-card p {
          margin: 6px 0 0;
          color: #94a3b8;
          font-size: 11px;
          line-height: 1.5;
        }

        .reports-table-wrapper {
          overflow-x: auto;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
        }

        .reports-table {
          width: 100%;
          min-width: 1050px;
          border-collapse: collapse;
        }

        .reports-table th {
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

        .reports-table td {
          padding: 15px;
          border-bottom: 1px solid #eef2f7;
          color: #475569;
          font-size: 12px;
        }

        .reports-table tbody tr:last-child td {
          border-bottom: none;
        }

        .reports-customer strong {
          display: block;
          color: #0f172a;
          font-size: 13px;
        }

        .reports-customer span {
          display: block;
          margin-top: 4px;
          color: #94a3b8;
          font-size: 11px;
        }

        .reports-amount {
          color: #0f172a;
          font-weight: 900;
        }

        .reports-empty-state {
          min-height: 330px;
          display: grid;
          place-items: center;
          padding: 40px 20px;
          text-align: center;
        }

        .reports-empty-icon {
          width: 76px;
          height: 76px;
          display: grid;
          place-items: center;
          margin: 0 auto 16px;
          border-radius: 22px;
          background: #eef2ff;
          font-size: 34px;
        }

        .reports-empty-state h3 {
          margin: 0;
          color: #0f172a;
          font-size: 20px;
        }

        .reports-empty-state p {
          max-width: 520px;
          margin: 10px auto 0;
          color: #64748b;
          font-size: 13px;
          line-height: 1.65;
        }

        .reports-info-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .reports-info-card {
          padding: 17px;
          border: 1px solid #e2e8f0;
          border-radius: 15px;
          background: #f8fafc;
        }

        .reports-info-card strong {
          display: block;
          color: #0f172a;
          font-size: 13px;
        }

        .reports-info-card p {
          margin: 7px 0 0;
          color: #64748b;
          font-size: 12px;
          line-height: 1.55;
        }

        @media (max-width: 1100px) {
          .reports-stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .reports-dashboard-grid {
            grid-template-columns: 1fr;
          }

          .reports-info-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 820px) {
          .reports-toolbar {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 650px) {
          .reports-page {
            padding: 14px;
          }

          .reports-hero,
          .reports-panel-heading {
            align-items: flex-start;
            flex-direction: column;
          }

          .reports-hero-status {
            width: 100%;
          }

          .reports-toolbar {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 500px) {
          .reports-stats {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <section className="reports-hero">
        <div>
          <div className="reports-kicker">
            <span>◆</span>
            Business Intelligence Center
          </div>

          <h1>Reports & Analytics</h1>

          <p>
            Recovery performance, executive productivity, bank-wise
            collection aur case status ko analyse karne ke liye
            enterprise reporting module.
          </p>
        </div>

        <div className="reports-hero-status">
          <span>Analytics Database</span>
          <strong>Not Connected</strong>
        </div>
      </section>

      <section className="reports-stats">
        <article className="reports-stat-card">
          <div className="reports-stat-top">
            <span>Total Cases</span>
            <div className="reports-stat-icon">▣</div>
          </div>

          <strong>{totalCases}</strong>
        </article>

        <article className="reports-stat-card">
          <div className="reports-stat-top">
            <span>Total Recovery</span>
            <div className="reports-stat-icon">₹</div>
          </div>

          <strong>{formatCurrency(totalRecovery)}</strong>
        </article>

        <article className="reports-stat-card">
          <div className="reports-stat-top">
            <span>Recovery Rate</span>
            <div className="reports-stat-icon">%</div>
          </div>

          <strong>{recoveryRate}%</strong>
        </article>

        <article className="reports-stat-card">
          <div className="reports-stat-top">
            <span>Pending Cases</span>
            <div className="reports-stat-icon">⌛</div>
          </div>

          <strong>{pendingCases}</strong>
        </article>
      </section>

      <section className="reports-panel">
        <div className="reports-panel-heading">
          <div>
            <h2>Report Controls</h2>
            <p>
              Report category, date period aur search filters select
              karein.
            </p>
          </div>

          <span className="reports-status-badge">
            No analytics data connected
          </span>
        </div>

        <div className="reports-toolbar">
          <input
            className="reports-input"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search customer, case, bank, executive..."
          />

          <select
            className="reports-select"
            value={reportType}
            onChange={(event) =>
              setReportType(event.target.value as ReportType)
            }
          >
            <option value="Overview">Overview Report</option>
            <option value="Recovery">Recovery Report</option>
            <option value="Executive">Executive Report</option>
            <option value="Bank">Bank-wise Report</option>
            <option value="Cases">Case Status Report</option>
          </select>

          <select
            className="reports-select"
            value={reportPeriod}
            onChange={(event) =>
              setReportPeriod(event.target.value as ReportPeriod)
            }
          >
            <option value="Today">Today</option>
            <option value="Last 7 Days">Last 7 Days</option>
            <option value="Last 30 Days">Last 30 Days</option>
            <option value="This Month">This Month</option>
            <option value="Custom">Custom Range</option>
          </select>

          <button
            className="reports-export-button"
            type="button"
            disabled
          >
            Export Report
          </button>
        </div>
      </section>

      <section className="reports-dashboard-grid">
        <article className="reports-panel">
          <div className="reports-panel-heading">
            <div>
              <h2>Recovery Analytics</h2>
              <p>
                Selected period ke recovery trend aur performance
                chart.
              </p>
            </div>

            <span className="reports-status-badge">
              {reportPeriod}
            </span>
          </div>

          <div className="reports-chart-box">
            <div>
              <div className="reports-chart-icon">📊</div>

              <h3>No Analytics Data Available</h3>

              <p>
                Abhi koi fake graph, sample collection ya dummy
                performance percentage show nahi ki gayi hai.
                Supabase connect hone ke baad real recovery trend
                yahan दिखाई देगा.
              </p>
            </div>
          </div>
        </article>

        <article className="reports-panel">
          <div className="reports-panel-heading">
            <div>
              <h2>Report Summary</h2>
              <p>
                Current selected report ka quick summary.
              </p>
            </div>
          </div>

          <div className="reports-summary-list">
            <div className="reports-summary-card">
              <span>Selected Report</span>
              <strong>{reportType}</strong>
              <p>
                Current analytics category.
              </p>
            </div>

            <div className="reports-summary-card">
              <span>Selected Period</span>
              <strong>{reportPeriod}</strong>
              <p>
                Report date filter.
              </p>
            </div>

            <div className="reports-summary-card">
              <span>Recovered Cases</span>
              <strong>{recoveredCases}</strong>
              <p>
                Verified recovered or paid cases.
              </p>
            </div>

            <div className="reports-summary-card">
              <span>Available Records</span>
              <strong>{filteredRecords.length}</strong>
              <p>
                Current search aur filter ke matching records.
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="reports-panel">
        <div className="reports-panel-heading">
          <div>
            <h2>Detailed Report Records</h2>
            <p>
              Customer, bank, executive aur recovery amount ka
              detailed report.
            </p>
          </div>
        </div>

        <div className="reports-table-wrapper">
          {filteredRecords.length > 0 ? (
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Case Number</th>
                  <th>Bank</th>
                  <th>Executive</th>
                  <th>Status</th>
                  <th>Recovery Amount</th>
                </tr>
              </thead>

              <tbody>
                {filteredRecords.map((record) => (
                  <tr key={record.id}>
                    <td>{record.date}</td>

                    <td>
                      <div className="reports-customer">
                        <strong>{record.customerName}</strong>
                        <span>{record.caseNumber}</span>
                      </div>
                    </td>

                    <td>{record.caseNumber}</td>
                    <td>{record.bankName}</td>
                    <td>{record.executiveName}</td>
                    <td>{record.status}</td>

                    <td>
                      <span className="reports-amount">
                        {formatCurrency(record.recoveryAmount)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="reports-empty-state">
              <div>
                <div className="reports-empty-icon">📄</div>

                <h3>No Report Records Connected</h3>

                <p>
                  Supabase database connect hone ke baad real case,
                  payment, executive aur recovery records ke basis
                  par detailed reports automatically generate hongi.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="reports-panel">
        <div className="reports-panel-heading">
          <div>
            <h2>Reporting Controls</h2>
            <p>
              Final backend integration ke waqt ye reporting rules
              apply honge.
            </p>
          </div>
        </div>

        <div className="reports-info-grid">
          <article className="reports-info-card">
            <strong>Real Database Values</strong>
            <p>
              Total cases, recovery amount aur performance percentage
              sirf Supabase ke verified records se calculate honge.
            </p>
          </article>

          <article className="reports-info-card">
            <strong>Date-wise Filtering</strong>
            <p>
              Reports ko today, weekly, monthly aur custom date range
              ke hisaab se filter kiya jayega.
            </p>
          </article>

          <article className="reports-info-card">
            <strong>Export Ready</strong>
            <p>
              Backend connection ke baad filtered reports ko Excel
              ya PDF format me export karne ka option activate hoga.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}

export default ReportsPage;

