import ExecutiveRanking from "./ExecutiveRanking";
import RecoveryChart from "./RecoveryChart";
import StatsCards from "./StatsCards";

function DashboardPage() {
  const today = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="dashboard-page">
      <style>{`
        .dashboard-page {
          min-height: 100%;
          padding: 26px;
          background:
            radial-gradient(
              circle at top right,
              rgba(37, 99, 235, 0.09),
              transparent 28%
            ),
            #f5f7fb;
          color: #0f172a;
          box-sizing: border-box;
        }

        .dashboard-page * {
          box-sizing: border-box;
        }

        .dashboard-hero {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          overflow: hidden;
          padding: 28px;
          margin-bottom: 20px;
          border-radius: 22px;
          color: white;
          background:
            linear-gradient(
              135deg,
              rgba(255, 255, 255, 0.06),
              transparent
            ),
            linear-gradient(
              135deg,
              #07192d 0%,
              #0d2f55 55%,
              #12497b 100%
            );
          box-shadow: 0 18px 45px rgba(7, 25, 45, 0.18);
        }

        .dashboard-hero::after {
          content: "";
          position: absolute;
          top: -95px;
          right: -70px;
          width: 230px;
          height: 230px;
          border: 34px solid rgba(255, 255, 255, 0.06);
          border-radius: 999px;
        }

        .dashboard-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 9px;
          color: #bfdbfe;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .dashboard-hero h1 {
          margin: 0;
          font-size: clamp(27px, 3vw, 39px);
          line-height: 1.08;
          letter-spacing: -0.03em;
        }

        .dashboard-hero p {
          max-width: 690px;
          margin: 12px 0 0;
          color: #dbeafe;
          font-size: 15px;
          line-height: 1.65;
        }

        .dashboard-date-card {
          position: relative;
          z-index: 1;
          min-width: 190px;
          padding: 16px 18px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(8px);
        }

        .dashboard-date-card span {
          display: block;
          color: #bfdbfe;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .dashboard-date-card strong {
          display: block;
          margin-top: 7px;
          font-size: 16px;
        }

        .dashboard-section {
          margin-top: 20px;
        }

        .dashboard-section-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 14px;
        }

        .dashboard-section-heading h2 {
          margin: 0;
          color: #0f172a;
          font-size: 19px;
          letter-spacing: -0.02em;
        }

        .dashboard-section-heading p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 13px;
        }

        .dashboard-live-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 8px 11px;
          border-radius: 999px;
          background: #ecfdf5;
          color: #047857;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .dashboard-live-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.13);
        }

        .dashboard-content-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.55fr) minmax(310px, 0.8fr);
          gap: 20px;
          align-items: stretch;
        }

        .dashboard-widget-card {
          min-width: 0;
          overflow: hidden;
          padding: 22px;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          background: white;
          box-shadow: 0 12px 35px rgba(15, 23, 42, 0.07);
        }

        .dashboard-widget-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 17px;
        }

        .dashboard-widget-head h3 {
          margin: 0;
          color: #0f172a;
          font-size: 17px;
          letter-spacing: -0.02em;
        }

        .dashboard-widget-head span {
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
        }

        @media (max-width: 1050px) {
          .dashboard-content-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .dashboard-page {
            padding: 14px;
          }

          .dashboard-hero {
            align-items: flex-start;
            flex-direction: column;
          }

          .dashboard-date-card {
            width: 100%;
          }

          .dashboard-section-heading {
            align-items: flex-start;
            flex-direction: column;
          }

          .dashboard-widget-card {
            padding: 16px;
          }
        }
      `}</style>

      <section className="dashboard-hero">
        <div>
          <div className="dashboard-kicker">
            <span>◆</span>
            Recovery Command Center
          </div>

          <h1>Welcome Back, Admin</h1>

          <p>
            Cases, recovery performance, executive activity aur
            collection progress ko ek hi dashboard se monitor karein.
          </p>
        </div>

        <div className="dashboard-date-card">
          <span>Today</span>
          <strong>{today}</strong>
        </div>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section-heading">
          <div>
            <h2>Business Overview</h2>
            <p>
              Current recovery operations ki live summary.
            </p>
          </div>

          <span className="dashboard-live-badge">
            <span className="dashboard-live-dot" />
            Live Dashboard
          </span>
        </div>

        <StatsCards />
      </section>

      <section className="dashboard-section">
        <div className="dashboard-content-grid">
          <article className="dashboard-widget-card">
            <div className="dashboard-widget-head">
              <h3>Recovery Performance</h3>
              <span>Collection overview</span>
            </div>

            <RecoveryChart />
          </article>

          <article className="dashboard-widget-card">
            <div className="dashboard-widget-head">
              <h3>Executive Ranking</h3>
              <span>Top performers</span>
            </div>

            <ExecutiveRanking />
          </article>
        </div>
      </section>
    </div>
  );
}

export default DashboardPage;