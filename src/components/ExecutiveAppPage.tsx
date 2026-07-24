import { useMemo, useState } from "react";

type ExecutiveStatus = "Active" | "Inactive";

type Executive = {
  id: number;
  code: string;
  name: string;
  mobile: string;
  area: string;
  assignedCases: number;
  completedCases: number;
  recoveryAmount: number;
  status: ExecutiveStatus;
};

const executiveData: Executive[] = [
  {
    id: 1,
    code: "EXE-001",
    name: "Bablu Nagda",
    mobile: "9876543210",
    area: "Neemuch",
    assignedCases: 145,
    completedCases: 82,
    recoveryAmount: 425000,
    status: "Active",
  },
  {
    id: 2,
    code: "EXE-002",
    name: "Kailash Nagda",
    mobile: "9988776655",
    area: "Manasa",
    assignedCases: 126,
    completedCases: 74,
    recoveryAmount: 318500,
    status: "Active",
  },
  {
    id: 3,
    code: "EXE-003",
    name: "Rahul Kumar",
    mobile: "9123456780",
    area: "Mandsaur",
    assignedCases: 112,
    completedCases: 63,
    recoveryAmount: 286000,
    status: "Active",
  },
  {
    id: 4,
    code: "EXE-004",
    name: "Shivam Chouhan",
    mobile: "9001122334",
    area: "Jaora",
    assignedCases: 98,
    completedCases: 57,
    recoveryAmount: 244000,
    status: "Inactive",
  },
  {
    id: 5,
    code: "EXE-005",
    name: "Nayan Singh",
    mobile: "9012345678",
    area: "Sailana",
    assignedCases: 87,
    completedCases: 49,
    recoveryAmount: 198500,
    status: "Active",
  },
];

function ExecutivesPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ExecutiveStatus | "All">(
    "All"
  );

  const filteredExecutives = useMemo(() => {
    const query = search.trim().toLowerCase();

    return executiveData.filter((executive) => {
      const matchesSearch =
        !query ||
        executive.name.toLowerCase().includes(query) ||
        executive.code.toLowerCase().includes(query) ||
        executive.mobile.includes(query) ||
        executive.area.toLowerCase().includes(query);

      const matchesStatus =
        status === "All" || executive.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [search, status]);

  const activeExecutives = executiveData.filter(
    (executive) => executive.status === "Active"
  ).length;

  const totalAssignedCases = executiveData.reduce(
    (total, executive) => total + executive.assignedCases,
    0
  );

  const totalCompletedCases = executiveData.reduce(
    (total, executive) => total + executive.completedCases,
    0
  );

  const totalRecovery = executiveData.reduce(
    (total, executive) => total + executive.recoveryAmount,
    0
  );

  return (
    <div className="executives-page">
      <style>{`
        .executives-page {
          min-height: 100%;
          padding: 26px;
          background:
            radial-gradient(
              circle at top right,
              rgba(37, 99, 235, 0.08),
              transparent 30%
            ),
            #f5f7fb;
          color: #0f172a;
          box-sizing: border-box;
        }

        .executives-page * {
          box-sizing: border-box;
        }

        .executives-hero {
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

        .executives-hero::after {
          content: "";
          position: absolute;
          top: -95px;
          right: -75px;
          width: 230px;
          height: 230px;
          border: 34px solid rgba(255, 255, 255, 0.06);
          border-radius: 50%;
        }

        .executives-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          color: #bfdbfe;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .executives-hero h1 {
          margin: 0;
          font-size: clamp(28px, 3vw, 38px);
          line-height: 1.1;
          letter-spacing: -0.03em;
        }

        .executives-hero p {
          max-width: 700px;
          margin: 12px 0 0;
          color: #dbeafe;
          font-size: 15px;
          line-height: 1.65;
        }

        .executives-hero-card {
          position: relative;
          z-index: 1;
          min-width: 190px;
          padding: 17px 19px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(8px);
        }

        .executives-hero-card span {
          display: block;
          color: #bfdbfe;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .executives-hero-card strong {
          display: block;
          margin-top: 7px;
          font-size: 24px;
        }

        .executives-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 15px;
          margin-top: 20px;
        }

        .executives-stat {
          position: relative;
          overflow: hidden;
          padding: 19px;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          background: white;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
        }

        .executives-stat::after {
          content: "";
          position: absolute;
          top: -34px;
          right: -34px;
          width: 92px;
          height: 92px;
          border-radius: 50%;
          background: #2563eb;
          opacity: 0.07;
        }

        .executives-stat span {
          display: block;
          color: #64748b;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .executives-stat strong {
          display: block;
          margin-top: 8px;
          font-size: 25px;
          letter-spacing: -0.03em;
        }

        .executives-panel {
          margin-top: 20px;
          padding: 22px;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          background: white;
          box-shadow: 0 12px 35px rgba(15, 23, 42, 0.07);
        }

        .executives-panel-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
        }

        .executives-panel-head h2 {
          margin: 0;
          font-size: 19px;
          letter-spacing: -0.02em;
        }

        .executives-panel-head p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 13px;
        }

        .executives-count {
          padding: 8px 12px;
          border-radius: 999px;
          color: #1d4ed8;
          background: #eff6ff;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .executives-filters {
          display: grid;
          grid-template-columns: minmax(260px, 1.5fr) minmax(180px, 0.6fr);
          gap: 14px;
        }

        .executives-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .executives-field label {
          color: #334155;
          font-size: 12px;
          font-weight: 800;
        }

        .executives-input,
        .executives-select {
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

        .executives-input:focus,
        .executives-select:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.11);
        }

        .executives-table-wrap {
          width: 100%;
          overflow: auto;
          border: 1px solid #e2e8f0;
          border-radius: 15px;
        }

        .executives-table {
          width: 100%;
          min-width: 1050px;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 13px;
        }

        .executives-table th {
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

        .executives-table td {
          padding: 14px;
          border-bottom: 1px solid #eef2f7;
          color: #334155;
          vertical-align: middle;
        }

        .executives-table tbody tr:hover td {
          background: #fbfdff;
        }

        .executives-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .executive-profile {
          display: flex;
          align-items: center;
          gap: 11px;
          min-width: 190px;
        }

        .executive-avatar {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border-radius: 13px;
          color: #1d4ed8;
          background: #eff6ff;
          font-size: 14px;
          font-weight: 900;
        }

        .executive-profile strong {
          display: block;
          color: #0f172a;
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

        .executive-money {
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
        }

        .executive-status.active {
          color: #047857;
          background: #ecfdf5;
        }

        .executive-status.inactive {
          color: #b91c1c;
          background: #fef2f2;
        }

        .executive-actions {
          display: flex;
          gap: 7px;
        }

        .executive-btn {
          min-height: 34px;
          padding: 0 11px;
          border: 1px solid #cbd5e1;
          border-radius: 9px;
          background: white;
          color: #334155;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        .executive-btn.primary {
          border-color: #bfdbfe;
          background: #eff6ff;
          color: #1d4ed8;
        }

        .executive-empty {
          padding: 45px 20px;
          color: #64748b;
          text-align: center;
        }

        @media (max-width: 1050px) {
          .executives-stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .executives-filters {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .executives-page {
            padding: 14px;
          }

          .executives-hero,
          .executives-panel-head {
            align-items: flex-start;
            flex-direction: column;
          }

          .executives-hero-card {
            width: 100%;
          }
        }

        @media (max-width: 480px) {
          .executives-stats {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <section className="executives-hero">
        <div>
          <div className="executives-kicker">
            <span>◆</span>
            Workforce Management
          </div>

          <h1>Executive Management</h1>

          <p>
            Field executives, assigned recovery cases, performance
            aur recovery collection ko ek jagah manage karein.
          </p>
        </div>

        <div className="executives-hero-card">
          <span>Active Workforce</span>
          <strong>{activeExecutives}</strong>
        </div>
      </section>

      <section className="executives-stats">
        <article className="executives-stat">
          <span>Total Executives</span>
          <strong>{executiveData.length}</strong>
        </article>

        <article className="executives-stat">
          <span>Assigned Cases</span>
          <strong>{totalAssignedCases}</strong>
        </article>

        <article className="executives-stat">
          <span>Completed Cases</span>
          <strong>{totalCompletedCases}</strong>
        </article>

        <article className="executives-stat">
          <span>Total Recovery</span>
          <strong>
            ₹{totalRecovery.toLocaleString("en-IN")}
          </strong>
        </article>
      </section>

      <section className="executives-panel">
        <div className="executives-panel-head">
          <div>
            <h2>Search & Filter</h2>
            <p>
              Executive name, code, mobile ya area se search karein.
            </p>
          </div>

          <span className="executives-count">
            {filteredExecutives.length} executives
          </span>
        </div>

        <div className="executives-filters">
          <div className="executives-field">
            <label htmlFor="executive-search">
              Search Executive
            </label>

            <input
              id="executive-search"
              className="executives-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, code, mobile, area..."
            />
          </div>

          <div className="executives-field">
            <label htmlFor="executive-status">
              Status
            </label>

            <select
              id="executive-status"
              className="executives-select"
              value={status}
              onChange={(event) =>
                setStatus(
                  event.target.value as ExecutiveStatus | "All"
                )
              }
            >
              <option value="All">All Executives</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
      </section>

      <section className="executives-panel">
        <div className="executives-panel-head">
          <div>
            <h2>Executive Directory</h2>
            <p>
              Executive assignment aur recovery performance overview.
            </p>
          </div>
        </div>

        <div className="executives-table-wrap">
          <table className="executives-table">
            <thead>
              <tr>
                <th>Executive</th>
                <th>Code</th>
                <th>Area</th>
                <th>Assigned Cases</th>
                <th>Completed</th>
                <th>Recovery Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredExecutives.length > 0 ? (
                filteredExecutives.map((executive) => (
                  <tr key={executive.id}>
                    <td>
                      <div className="executive-profile">
                        <div className="executive-avatar">
                          {executive.name
                            .split(" ")
                            .slice(0, 2)
                            .map((part) => part[0])
                            .join("")
                            .toUpperCase()}
                        </div>

                        <div>
                          <strong>{executive.name}</strong>
                          <span>{executive.mobile}</span>
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
                    <td>{executive.completedCases}</td>

                    <td>
                      <span className="executive-money">
                        ₹
                        {executive.recoveryAmount.toLocaleString(
                          "en-IN"
                        )}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`executive-status ${executive.status.toLowerCase()}`}
                      >
                        ● {executive.status}
                      </span>
                    </td>

                    <td>
                      <div className="executive-actions">
                        <button className="executive-btn primary">
                          View
                        </button>

                        <button className="executive-btn">
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8}>
                    <div className="executive-empty">
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

export default ExecutivesPage;

