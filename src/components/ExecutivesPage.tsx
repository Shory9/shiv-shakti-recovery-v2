import { useMemo, useState } from "react";

type ExecutiveAppStatus =
  | "Online"
  | "Offline"
  | "On Visit"
  | "Completed";

type ExecutiveAppItem = {
  id: number;
  code: string;
  name: string;
  mobile: string;
  area: string;
  assignedCases: number;
  completedToday: number;
  collectionToday: number;
  battery: number;
  lastSeen: string;
  status: ExecutiveAppStatus;
};

const executives: ExecutiveAppItem[] = [
  {
    id: 1,
    code: "EXE-001",
    name: "Bablu Nagda",
    mobile: "9876543210",
    area: "Neemuch",
    assignedCases: 145,
    completedToday: 18,
    collectionToday: 42500,
    battery: 82,
    lastSeen: "Just now",
    status: "Online",
  },
  {
    id: 2,
    code: "EXE-002",
    name: "Kailash Nagda",
    mobile: "9988776655",
    area: "Manasa",
    assignedCases: 126,
    completedToday: 14,
    collectionToday: 28600,
    battery: 64,
    lastSeen: "3 min ago",
    status: "On Visit",
  },
  {
    id: 3,
    code: "EXE-003",
    name: "Rahul Kumar",
    mobile: "9123456780",
    area: "Mandsaur",
    assignedCases: 112,
    completedToday: 11,
    collectionToday: 19300,
    battery: 48,
    lastSeen: "8 min ago",
    status: "Online",
  },
  {
    id: 4,
    code: "EXE-004",
    name: "Shivam Chouhan",
    mobile: "9001122334",
    area: "Jaora",
    assignedCases: 98,
    completedToday: 16,
    collectionToday: 34750,
    battery: 91,
    lastSeen: "12 min ago",
    status: "Completed",
  },
  {
    id: 5,
    code: "EXE-005",
    name: "Nayan Singh",
    mobile: "9012345678",
    area: "Sailana",
    assignedCases: 87,
    completedToday: 7,
    collectionToday: 12800,
    battery: 27,
    lastSeen: "1 hour ago",
    status: "Offline",
  },
  {
    id: 6,
    code: "EXE-006",
    name: "Akshat Parmar",
    mobile: "9090909090",
    area: "Ratlam",
    assignedCases: 104,
    completedToday: 9,
    collectionToday: 15600,
    battery: 73,
    lastSeen: "5 min ago",
    status: "Online",
  },
];

const statusOptions: Array<
  ExecutiveAppStatus | "All"
> = [
  "All",
  "Online",
  "Offline",
  "On Visit",
  "Completed",
];

function ExecutiveAppPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<
    ExecutiveAppStatus | "All"
  >("All");

  const filteredExecutives = useMemo(() => {
    const query = search.trim().toLowerCase();

    return executives.filter((executive) => {
      const matchesSearch =
        !query ||
        executive.name.toLowerCase().includes(query) ||
        executive.code.toLowerCase().includes(query) ||
        executive.mobile.toLowerCase().includes(query) ||
        executive.area.toLowerCase().includes(query);

      const matchesStatus =
        status === "All" ||
        executive.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [search, status]);

  const onlineCount = executives.filter(
    (executive) =>
      executive.status === "Online" ||
      executive.status === "On Visit"
  ).length;

  const completedToday = executives.reduce(
    (total, executive) =>
      total + executive.completedToday,
    0
  );

  const todayCollection = executives.reduce(
    (total, executive) =>
      total + executive.collectionToday,
    0
  );

  const totalAssignedCases = executives.reduce(
    (total, executive) =>
      total + executive.assignedCases,
    0
  );

  return (
    <div className="executive-app-page">
      <style>{`
        .executive-app-page {
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

        .executive-app-page * {
          box-sizing: border-box;
        }

        .executive-app-hero {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 22px;
          overflow: hidden;
          padding: 28px;
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
              #0d2f55 56%,
              #12497b 100%
            );
          box-shadow: 0 18px 45px rgba(7, 25, 45, 0.18);
        }

        .executive-app-hero::after {
          content: "";
          position: absolute;
          top: -95px;
          right: -70px;
          width: 225px;
          height: 225px;
          border: 32px solid rgba(255, 255, 255, 0.06);
          border-radius: 999px;
        }

        .executive-app-kicker {
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

        .executive-app-hero h1 {
          margin: 0;
          font-size: clamp(27px, 3vw, 38px);
          line-height: 1.08;
          letter-spacing: -0.03em;
        }

        .executive-app-hero p {
          max-width: 720px;
          margin: 12px 0 0;
          color: #dbeafe;
          font-size: 15px;
          line-height: 1.65;
        }

        .executive-app-live-card {
          position: relative;
          z-index: 1;
          min-width: 190px;
          padding: 16px 18px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(8px);
        }

        .executive-app-live-card span {
          display: block;
          color: #bfdbfe;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .executive-app-live-card strong {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-top: 7px;
          font-size: 20px;
        }

        .executive-app-live-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 0 5px rgba(34, 197, 94, 0.16);
        }

        .executive-app-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 15px;
          margin-top: 20px;
        }

        .executive-app-stat {
          position: relative;
          overflow: hidden;
          padding: 19px;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          background: white;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
        }

        .executive-app-stat::after {
          content: "";
          position: absolute;
          top: -36px;
          right: -36px;
          width: 96px;
          height: 96px;
          border-radius: 50%;
          background: #2563eb;
          opacity: 0.08;
        }

        .executive-app-stat span {
          display: block;
          color: #64748b;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .executive-app-stat strong {
          display: block;
          margin-top: 8px;
          color: #0f172a;
          font-size: 26px;
          letter-spacing: -0.03em;
        }

        .executive-app-panel {
          margin-top: 20px;
          padding: 22px;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          background: white;
          box-shadow: 0 12px 35px rgba(15, 23, 42, 0.07);
        }

        .executive-app-panel-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
        }

        .executive-app-panel-head h2 {
          margin: 0;
          font-size: 19px;
          letter-spacing: -0.02em;
        }

        .executive-app-panel-head p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 13px;
        }

        .executive-app-count {
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

        .executive-app-filter-grid {
          display: grid;
          grid-template-columns: minmax(260px, 1.5fr) minmax(180px, 0.6fr);
          gap: 14px;
        }

        .executive-app-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .executive-app-field label {
          color: #334155;
          font-size: 12px;
          font-weight: 800;
        }

        .executive-app-input,
        .executive-app-select {
          width: 100%;
          height: 48px;
          padding: 0 14px;
          border: 1px solid #cbd5e1;
          border-radius: 13px;
          background: white;
          color: #0f172a;
          font-size: 14px;
          outline: none;
          transition: 0.2s ease;
        }

        .executive-app-input:focus,
        .executive-app-select:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.11);
        }

        .executive-app-table-wrap {
          width: 100%;
          max-height: 590px;
          overflow: auto;
          border: 1px solid #e2e8f0;
          border-radius: 15px;
        }

        .executive-app-table {
          width: 100%;
          min-width: 1140px;
          border-collapse: separate;
          border-spacing: 0;
          background: white;
          font-size: 13px;
        }

        .executive-app-table th {
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
          letter-spacing: 0.045em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .executive-app-table td {
          padding: 14px;
          border-bottom: 1px solid #eef2f7;
          color: #334155;
          vertical-align: middle;
        }

        .executive-app-table tbody tr:hover td {
          background: #fbfdff;
        }

        .executive-app-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .executive-profile {
          display: flex;
          align-items: center;
          gap: 11px;
          min-width: 190px;
        }

        .executive-profile-avatar {
          width: 42px;
          height: 42px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          border-radius: 13px;
          color: #1d4ed8;
          background: #eff6ff;
          font-size: 14px;
          font-weight: 900;
        }

        .executive-profile strong {
          display: block;
          color: #0f172a;
          font-size: 13px;
        }

        .executive-profile span {
          display: block;
          margin-top: 4px;
          color: #64748b;
          font-size: 12px;
        }

        .executive-code {
          color: #0f172a;
          font-weight: 800;
        }

        .executive-app-money {
          color: #0f172a;
          font-weight: 850;
          white-space: nowrap;
        }

        .executive-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 850;
          white-space: nowrap;
        }

        .executive-status.online {
          color: #047857;
          background: #ecfdf5;
        }

        .executive-status.offline {
          color: #64748b;
          background: #f1f5f9;
        }

        .executive-status.on-visit {
          color: #1d4ed8;
          background: #eff6ff;
        }

        .executive-status.completed {
          color: #6d28d9;
          background: #f5f3ff;
        }

        .executive-battery {
          min-width: 90px;
        }

        .executive-battery-line {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 6px;
          color: #475569;
          font-size: 11px;
          font-weight: 800;
        }

        .executive-battery-track {
          width: 100%;
          height: 7px;
          overflow: hidden;
          border-radius: 999px;
          background: #e2e8f0;
        }

        .executive-battery-fill {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(
            90deg,
            #2563eb,
            #10b981
          );
        }

        .executive-actions {
          display: flex;
          gap: 7px;
        }

        .executive-action-btn {
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

        .executive-action-btn.primary {
          border-color: #bfdbfe;
          background: #eff6ff;
          color: #1d4ed8;
        }

        .executive-app-empty {
          padding: 45px 20px;
          color: #64748b;
          text-align: center;
        }

        @media (max-width: 1050px) {
          .executive-app-stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .executive-app-filter-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .executive-app-page {
            padding: 14px;
          }

          .executive-app-hero,
          .executive-app-panel-head {
            align-items: flex-start;
            flex-direction: column;
          }

          .executive-app-live-card {
            width: 100%;
          }
        }

        @media (max-width: 480px) {
          .executive-app-stats {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <section className="executive-app-hero">
        <div>
          <div className="executive-app-kicker">
            <span>◆</span>
            Field Executive Command Center
          </div>

          <h1>Executive Mobile App</h1>

          <p>
            Field executives ki live activity, assigned cases,
            visits, collection aur mobile status ko monitor karein.
          </p>
        </div>

        <div className="executive-app-live-card">
          <span>Live Executives</span>
          <strong>
            <span className="executive-app-live-dot" />
            {onlineCount} Online
          </strong>
        </div>
      </section>

      <section className="executive-app-stats">
        <article className="executive-app-stat">
          <span>Total Executives</span>
          <strong>{executives.length}</strong>
        </article>

        <article className="executive-app-stat">
          <span>Total Assigned Cases</span>
          <strong>{totalAssignedCases}</strong>
        </article>

        <article className="executive-app-stat">
          <span>Visits Completed Today</span>
          <strong>{completedToday}</strong>
        </article>

        <article className="executive-app-stat">
          <span>Today Collection</span>
          <strong>
            ₹
            {todayCollection.toLocaleString("en-IN")}
          </strong>
        </article>
      </section>

      <section className="executive-app-panel">
        <div className="executive-app-panel-head">
          <div>
            <h2>Search & Filter</h2>
            <p>
              Name, executive code, mobile ya area se search
              karein.
            </p>
          </div>

          <span className="executive-app-count">
            {filteredExecutives.length} executives
          </span>
        </div>

        <div className="executive-app-filter-grid">
          <div className="executive-app-field">
            <label htmlFor="executive-app-search">
              Search Executive
            </label>

            <input
              id="executive-app-search"
              className="executive-app-input"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search name, code, mobile, area..."
            />
          </div>

          <div className="executive-app-field">
            <label htmlFor="executive-app-status">
              App Status
            </label>

            <select
              id="executive-app-status"
              className="executive-app-select"
              value={status}
              onChange={(event) =>
                setStatus(
                  event.target.value as
                    | ExecutiveAppStatus
                    | "All"
                )
              }
            >
              {statusOptions.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="executive-app-panel">
        <div className="executive-app-panel-head">
          <div>
            <h2>Executive Live Activity</h2>
            <p>
              Mobile application activity aur daily performance
              overview.
            </p>
          </div>
        </div>

        <div className="executive-app-table-wrap">
          <table className="executive-app-table">
            <thead>
              <tr>
                <th>Executive</th>
                <th>Code</th>
                <th>Area</th>
                <th>Assigned Cases</th>
                <th>Completed Today</th>
                <th>Collection Today</th>
                <th>Battery</th>
                <th>Status</th>
                <th>Last Seen</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredExecutives.length > 0 ? (
                filteredExecutives.map((executive) => (
                  <tr key={executive.id}>
                    <td>
                      <div className="executive-profile">
                        <div className="executive-profile-avatar">
                          {executive.name
                            .split(" ")
                            .slice(0, 2)
                            .map((part) => part[0])
                            .join("")
                            .toUpperCase()}
                        </div>

                        <div>
                          <strong>
                            {executive.name}
                          </strong>
                          <span>
                            {executive.mobile}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="executive-code">
                        {executive.code}
                      </span>
                    </td>

                    <td>{executive.area}</td>

                    <td>{executive.assignedCases}</td>

                    <td>
                      {executive.completedToday}
                    </td>

                    <td>
                      <span className="executive-app-money">
                        ₹
                        {executive.collectionToday.toLocaleString(
                          "en-IN"
                        )}
                      </span>
                    </td>

                    <td>
                      <div className="executive-battery">
                        <div className="executive-battery-line">
                          <span>Battery</span>
                          <strong>
                            {executive.battery}%
                          </strong>
                        </div>

                        <div className="executive-battery-track">
                          <div
                            className="executive-battery-fill"
                            style={{
                              width: `${executive.battery}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    <td>
                      <span
                        className={`executive-status ${executive.status
                          .toLowerCase()
                          .replace(" ", "-")}`}
                      >
                        ● {executive.status}
                      </span>
                    </td>

                    <td>{executive.lastSeen}</td>

                    <td>
                      <div className="executive-actions">
                        <button className="executive-action-btn primary">
                          Track
                        </button>

                        <button className="executive-action-btn">
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10}>
                    <div className="executive-app-empty">
                      No matching executive found.
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

export default ExecutiveAppPage;