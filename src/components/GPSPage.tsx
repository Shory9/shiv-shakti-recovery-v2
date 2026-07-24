import { useMemo, useState } from "react";

type GPSStatus = "Not Connected" | "Waiting for GPS";

type ExecutiveLocation = {
  id: number;
  name: string;
  code: string;
  mobile: string;
  area: string;
  status: GPSStatus;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  lastUpdated: string | null;
};

const executives: ExecutiveLocation[] = [
  {
    id: 1,
    name: "Bablu Nagda",
    code: "EXE-001",
    mobile: "9876543210",
    area: "Neemuch",
    status: "Not Connected",
    latitude: null,
    longitude: null,
    accuracy: null,
    lastUpdated: null,
  },
  {
    id: 2,
    name: "Kailash Nagda",
    code: "EXE-002",
    mobile: "9988776655",
    area: "Manasa",
    status: "Not Connected",
    latitude: null,
    longitude: null,
    accuracy: null,
    lastUpdated: null,
  },
  {
    id: 3,
    name: "Rahul Kumar",
    code: "EXE-003",
    mobile: "9123456780",
    area: "Mandsaur",
    status: "Waiting for GPS",
    latitude: null,
    longitude: null,
    accuracy: null,
    lastUpdated: null,
  },
  {
    id: 4,
    name: "Shivam Chouhan",
    code: "EXE-004",
    mobile: "9001122334",
    area: "Jaora",
    status: "Not Connected",
    latitude: null,
    longitude: null,
    accuracy: null,
    lastUpdated: null,
  },
  {
    id: 5,
    name: "Nayan Singh",
    code: "EXE-005",
    mobile: "9012345678",
    area: "Sailana",
    status: "Not Connected",
    latitude: null,
    longitude: null,
    accuracy: null,
    lastUpdated: null,
  },
];

function GPSPage() {
  const [search, setSearch] = useState("");

  const filteredExecutives = useMemo(() => {
    const query = search.trim().toLowerCase();

    return executives.filter((executive) => {
      return (
        !query ||
        executive.name.toLowerCase().includes(query) ||
        executive.code.toLowerCase().includes(query) ||
        executive.mobile.includes(query) ||
        executive.area.toLowerCase().includes(query)
      );
    });
  }, [search]);

  const connectedCount = executives.filter(
    (executive) =>
      executive.latitude !== null &&
      executive.longitude !== null
  ).length;

  return (
    <div className="gps-page">
      <style>{`
        .gps-page {
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

        .gps-page * {
          box-sizing: border-box;
        }

        .gps-hero {
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

        .gps-hero::after {
          content: "";
          position: absolute;
          top: -95px;
          right: -75px;
          width: 230px;
          height: 230px;
          border: 34px solid rgba(255, 255, 255, 0.06);
          border-radius: 50%;
        }

        .gps-kicker {
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

        .gps-hero h1 {
          margin: 0;
          font-size: clamp(28px, 3vw, 38px);
          line-height: 1.1;
          letter-spacing: -0.03em;
        }

        .gps-hero p {
          max-width: 720px;
          margin: 12px 0 0;
          color: #dbeafe;
          font-size: 15px;
          line-height: 1.65;
        }

        .gps-hero-card {
          position: relative;
          z-index: 1;
          min-width: 200px;
          padding: 17px 19px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(8px);
        }

        .gps-hero-card span {
          display: block;
          color: #bfdbfe;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .gps-hero-card strong {
          display: block;
          margin-top: 7px;
          font-size: 23px;
        }

        .gps-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 15px;
          margin-top: 20px;
        }

        .gps-stat {
          padding: 19px;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          background: white;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
        }

        .gps-stat span {
          display: block;
          color: #64748b;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .gps-stat strong {
          display: block;
          margin-top: 8px;
          font-size: 25px;
          letter-spacing: -0.03em;
        }

        .gps-main-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.5fr) minmax(320px, 0.7fr);
          gap: 20px;
          margin-top: 20px;
        }

        .gps-panel {
          padding: 22px;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          background: white;
          box-shadow: 0 12px 35px rgba(15, 23, 42, 0.07);
        }

        .gps-panel-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
        }

        .gps-panel-head h2 {
          margin: 0;
          font-size: 19px;
          letter-spacing: -0.02em;
        }

        .gps-panel-head p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 13px;
        }

        .gps-badge {
          display: inline-flex;
          align-items: center;
          padding: 8px 11px;
          border-radius: 999px;
          color: #b45309;
          background: #fffbeb;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .gps-map-placeholder {
          min-height: 430px;
          display: grid;
          place-items: center;
          padding: 30px;
          border: 1px dashed #94a3b8;
          border-radius: 17px;
          background:
            linear-gradient(
              rgba(255, 255, 255, 0.84),
              rgba(255, 255, 255, 0.84)
            ),
            repeating-linear-gradient(
              45deg,
              #e2e8f0,
              #e2e8f0 18px,
              #f8fafc 18px,
              #f8fafc 36px
            );
          text-align: center;
        }

        .gps-map-icon {
          width: 78px;
          height: 78px;
          display: grid;
          place-items: center;
          margin: 0 auto 16px;
          border-radius: 22px;
          background: #eff6ff;
          font-size: 36px;
        }

        .gps-map-placeholder h3 {
          margin: 0;
          color: #0f172a;
          font-size: 21px;
        }

        .gps-map-placeholder p {
          max-width: 500px;
          margin: 10px auto 0;
          color: #64748b;
          font-size: 14px;
          line-height: 1.65;
        }

        .gps-warning {
          margin-top: 16px;
          padding: 13px 15px;
          border: 1px solid #fde68a;
          border-radius: 12px;
          color: #92400e;
          background: #fffbeb;
          font-size: 12px;
          font-weight: 700;
          line-height: 1.55;
        }

        .gps-search {
          width: 100%;
          height: 48px;
          margin-bottom: 15px;
          padding: 0 14px;
          border: 1px solid #cbd5e1;
          border-radius: 13px;
          background: white;
          color: #0f172a;
          font-size: 14px;
          outline: none;
          transition: 0.2s ease;
        }

        .gps-search:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.11);
        }

        .gps-list {
          display: flex;
          flex-direction: column;
          gap: 11px;
          max-height: 500px;
          overflow-y: auto;
        }

        .gps-executive-card {
          padding: 14px;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          background: #ffffff;
        }

        .gps-executive-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .gps-profile {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .gps-avatar {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border-radius: 13px;
          color: #1d4ed8;
          background: #eff6ff;
          font-size: 13px;
          font-weight: 900;
        }

        .gps-profile strong {
          display: block;
          color: #0f172a;
          font-size: 13px;
        }

        .gps-profile span {
          display: block;
          margin-top: 4px;
          color: #64748b;
          font-size: 11px;
        }

        .gps-status {
          padding: 6px 9px;
          border-radius: 999px;
          color: #b45309;
          background: #fffbeb;
          font-size: 10px;
          font-weight: 850;
          white-space: nowrap;
        }

        .gps-executive-meta {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 13px;
          padding-top: 12px;
          border-top: 1px solid #eef2f7;
        }

        .gps-meta-item span {
          display: block;
          color: #94a3b8;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .gps-meta-item strong {
          display: block;
          margin-top: 4px;
          color: #475569;
          font-size: 12px;
        }

        .gps-empty {
          padding: 35px 15px;
          color: #64748b;
          text-align: center;
        }

        .gps-rules {
          margin-top: 20px;
        }

        .gps-rule-list {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .gps-rule {
          padding: 16px;
          border: 1px solid #e2e8f0;
          border-radius: 15px;
          background: #f8fafc;
        }

        .gps-rule strong {
          display: block;
          color: #0f172a;
          font-size: 13px;
        }

        .gps-rule p {
          margin: 7px 0 0;
          color: #64748b;
          font-size: 12px;
          line-height: 1.55;
        }

        @media (max-width: 1100px) {
          .gps-stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .gps-main-grid {
            grid-template-columns: 1fr;
          }

          .gps-rule-list {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .gps-page {
            padding: 14px;
          }

          .gps-hero,
          .gps-panel-head {
            align-items: flex-start;
            flex-direction: column;
          }

          .gps-hero-card {
            width: 100%;
          }
        }

        @media (max-width: 480px) {
          .gps-stats {
            grid-template-columns: 1fr;
          }

          .gps-executive-meta {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <section className="gps-hero">
        <div>
          <div className="gps-kicker">
            <span>◆</span>
            Location Control Center
          </div>

          <h1>GPS Tracking</h1>

          <p>
            Executive ki verified real-time location, GPS accuracy
            aur last update ko monitor karne ke liye ready module.
          </p>
        </div>

        <div className="gps-hero-card">
          <span>GPS Integration</span>
          <strong>Not Connected</strong>
        </div>
      </section>

      <section className="gps-stats">
        <article className="gps-stat">
          <span>Total Executives</span>
          <strong>{executives.length}</strong>
        </article>

        <article className="gps-stat">
          <span>Live Locations</span>
          <strong>{connectedCount}</strong>
        </article>

        <article className="gps-stat">
          <span>Waiting for GPS</span>
          <strong>{executives.length - connectedCount}</strong>
        </article>

        <article className="gps-stat">
          <span>Invalid Locations</span>
          <strong>0</strong>
        </article>
      </section>

      <section className="gps-main-grid">
        <article className="gps-panel">
          <div className="gps-panel-head">
            <div>
              <h2>Live Location Map</h2>
              <p>
                Supabase GPS integration ke baad verified locations
                yahan दिखाई देंगी.
              </p>
            </div>

            <span className="gps-badge">
              No live data
            </span>
          </div>

          <div className="gps-map-placeholder">
            <div>
              <div className="gps-map-icon">📍</div>

              <h3>No Live Location Connected</h3>

              <p>
                Map par abhi koi fake pin ya sample coordinate nahi
                dikhaya gaya hai. Real executive GPS data connect
                hone ke baad hi location दिखाई जाएगी.
              </p>

              <div className="gps-warning">
                Wrong location avoid karne ke liye latitude,
                longitude, GPS accuracy aur latest timestamp verify
                kiya jayega.
              </div>
            </div>
          </div>
        </article>

        <article className="gps-panel">
          <div className="gps-panel-head">
            <div>
              <h2>Executive GPS Status</h2>
              <p>
                Location connection aur device update status.
              </p>
            </div>
          </div>

          <input
            className="gps-search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search executive, code, mobile, area..."
          />

          <div className="gps-list">
            {filteredExecutives.length > 0 ? (
              filteredExecutives.map((executive) => (
                <div
                  className="gps-executive-card"
                  key={executive.id}
                >
                  <div className="gps-executive-top">
                    <div className="gps-profile">
                      <div className="gps-avatar">
                        {executive.name
                          .split(" ")
                          .slice(0, 2)
                          .map((part) => part[0])
                          .join("")
                          .toUpperCase()}
                      </div>

                      <div>
                        <strong>{executive.name}</strong>
                        <span>
                          {executive.code} • {executive.mobile}
                        </span>
                      </div>
                    </div>

                    <span className="gps-status">
                      {executive.status}
                    </span>
                  </div>

                  <div className="gps-executive-meta">
                    <div className="gps-meta-item">
                      <span>Area</span>
                      <strong>{executive.area}</strong>
                    </div>

                    <div className="gps-meta-item">
                      <span>Last Update</span>
                      <strong>
                        {executive.lastUpdated ?? "No location"}
                      </strong>
                    </div>

                    <div className="gps-meta-item">
                      <span>GPS Accuracy</span>
                      <strong>
                        {executive.accuracy !== null
                          ? `${executive.accuracy} metres`
                          : "Not available"}
                      </strong>
                    </div>

                    <div className="gps-meta-item">
                      <span>Coordinates</span>
                      <strong>
                        {executive.latitude !== null &&
                        executive.longitude !== null
                          ? `${executive.latitude}, ${executive.longitude}`
                          : "Not available"}
                      </strong>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="gps-empty">
                No matching executive found.
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="gps-panel gps-rules">
        <div className="gps-panel-head">
          <div>
            <h2>Real GPS Validation Rules</h2>
            <p>
              Supabase connection ke waqt ye safety checks use honge.
            </p>
          </div>
        </div>

        <div className="gps-rule-list">
          <article className="gps-rule">
            <strong>Verified Coordinates</strong>
            <p>
              Empty, invalid aur zero coordinates map par show nahi
              honge.
            </p>
          </article>

          <article className="gps-rule">
            <strong>Fresh Location Only</strong>
            <p>
              Purani location ko live status nahi diya jayega. Last
              update clearly dikhaya jayega.
            </p>
          </article>

          <article className="gps-rule">
            <strong>GPS Accuracy Check</strong>
            <p>
              Location ke saath mobile GPS accuracy bhi save aur
              verify ki jayegi.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}

export default GPSPage;

