const stats = [
  {
    title: "Total Cases",
    value: "2,444",
    icon: "▦",
    note: "All recovery cases",
    trend: "+12.4%",
    tone: "blue",
  },
  {
    title: "Pending Cases",
    value: "1,286",
    icon: "◷",
    note: "Cases requiring action",
    trend: "52.6%",
    tone: "amber",
  },
  {
    title: "Visited Today",
    value: "148",
    icon: "✓",
    note: "Field visits completed",
    trend: "+18 today",
    tone: "green",
  },
  {
    title: "Total Recovery",
    value: "₹8,42,500",
    icon: "₹",
    note: "Current collection value",
    trend: "+8.7%",
    tone: "purple",
  },
];

function StatsCards() {
  return (
    <section className="stats-cards-grid">
      <style>{`
        .stats-cards-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }

        .premium-stat-card {
          position: relative;
          overflow: hidden;
          min-width: 0;
          padding: 20px;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          background: #ffffff;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease,
            border-color 0.2s ease;
        }

        .premium-stat-card:hover {
          transform: translateY(-3px);
          border-color: #cbd5e1;
          box-shadow: 0 16px 36px rgba(15, 23, 42, 0.1);
        }

        .premium-stat-card::after {
          content: "";
          position: absolute;
          top: -42px;
          right: -42px;
          width: 112px;
          height: 112px;
          border-radius: 999px;
          opacity: 0.14;
        }

        .premium-stat-card.blue::after {
          background: #2563eb;
        }

        .premium-stat-card.amber::after {
          background: #f59e0b;
        }

        .premium-stat-card.green::after {
          background: #10b981;
        }

        .premium-stat-card.purple::after {
          background: #7c3aed;
        }

        .premium-stat-top {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
        }

        .premium-stat-copy {
          min-width: 0;
        }

        .premium-stat-copy p {
          margin: 0;
          color: #64748b;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .premium-stat-copy h3 {
          margin: 9px 0 0;
          color: #0f172a;
          font-size: clamp(24px, 2.4vw, 31px);
          line-height: 1;
          letter-spacing: -0.04em;
          overflow-wrap: anywhere;
        }

        .premium-stat-icon {
          width: 48px;
          height: 48px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          border-radius: 15px;
          font-size: 22px;
          font-weight: 900;
        }

        .blue .premium-stat-icon {
          color: #1d4ed8;
          background: #eff6ff;
        }

        .amber .premium-stat-icon {
          color: #b45309;
          background: #fffbeb;
        }

        .green .premium-stat-icon {
          color: #047857;
          background: #ecfdf5;
        }

        .purple .premium-stat-icon {
          color: #6d28d9;
          background: #f5f3ff;
        }

        .premium-stat-bottom {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 20px;
          padding-top: 15px;
          border-top: 1px solid #eef2f7;
        }

        .premium-stat-note {
          min-width: 0;
          color: #64748b;
          font-size: 12px;
          line-height: 1.4;
        }

        .premium-stat-trend {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 28px;
          padding: 0 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 850;
          white-space: nowrap;
        }

        .blue .premium-stat-trend {
          color: #1d4ed8;
          background: #eff6ff;
        }

        .amber .premium-stat-trend {
          color: #b45309;
          background: #fffbeb;
        }

        .green .premium-stat-trend {
          color: #047857;
          background: #ecfdf5;
        }

        .purple .premium-stat-trend {
          color: #6d28d9;
          background: #f5f3ff;
        }

        @media (max-width: 1100px) {
          .stats-cards-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 560px) {
          .stats-cards-grid {
            grid-template-columns: 1fr;
          }

          .premium-stat-card {
            padding: 17px;
          }
        }
      `}</style>

      {stats.map((stat) => (
        <article
          className={`premium-stat-card ${stat.tone}`}
          key={stat.title}
        >
          <div className="premium-stat-top">
            <div className="premium-stat-copy">
              <p>{stat.title}</p>
              <h3>{stat.value}</h3>
            </div>

            <div className="premium-stat-icon">
              {stat.icon}
            </div>
          </div>

          <div className="premium-stat-bottom">
            <span className="premium-stat-note">
              {stat.note}
            </span>

            <span className="premium-stat-trend">
              {stat.trend}
            </span>
          </div>
        </article>
      ))}
    </section>
  );
}

export default StatsCards;

