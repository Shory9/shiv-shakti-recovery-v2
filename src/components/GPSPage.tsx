import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

type RawRow = Record<string, unknown>;

type GPSStatus = "Live" | "Recently Active" | "Offline" | "Not Connected";

type ExecutiveLocation = {
  id: number | string;
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

const LIVE_MINUTES = 5;
const RECENT_MINUTES = 30;
const AUTO_REFRESH_MS = 30_000;

function textValue(row: RawRow, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return fallback;
}

function numberValue(row: RawRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value === null || value === undefined || value === "") continue;

    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function validCoordinate(latitude: number | null, longitude: number | null) {
  return (
    latitude !== null &&
    longitude !== null &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    !(latitude === 0 && longitude === 0)
  );
}

function minutesSince(value: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;

  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return Number.POSITIVE_INFINITY;

  return Math.max(0, (Date.now() - time) / 60_000);
}

function getStatus(
  latitude: number | null,
  longitude: number | null,
  lastUpdated: string | null
): GPSStatus {
  if (!validCoordinate(latitude, longitude)) return "Not Connected";

  const age = minutesSince(lastUpdated);

  if (age <= LIVE_MINUTES) return "Live";
  if (age <= RECENT_MINUTES) return "Recently Active";
  return "Offline";
}

function formatDateTime(value: string | null) {
  if (!value) return "No location";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No location";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mapUrl(latitude: number, longitude: number) {
  const delta = 0.012;
  const left = longitude - delta;
  const right = longitude + delta;
  const top = latitude + delta;
  const bottom = latitude - delta;

  return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${latitude}%2C${longitude}`;
}

function googleMapsUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

function GPSPage() {
  const [executives, setExecutives] = useState<ExecutiveLocation[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadGPSData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    setError("");

    try {
      const allExecutives: RawRow[] = [];
      const allLocations: RawRow[] = [];
      const pageSize = 1000;
      let from = 0;

      while (true) {
        const { data, error: executivesError } = await supabase
          .from("executives")
          .select("*")
          .range(from, from + pageSize - 1);

        if (executivesError) throw executivesError;

        const rows = (data ?? []) as RawRow[];
        allExecutives.push(...rows);
        if (rows.length < pageSize) break;
        from += pageSize;
      }

      from = 0;
      while (true) {
        const { data, error: locationsError } = await supabase
          .from("gps_locations")
          .select("*")
          .range(from, from + pageSize - 1);

        if (locationsError) throw locationsError;

        const rows = (data ?? []) as RawRow[];
        allLocations.push(...rows);
        if (rows.length < pageSize) break;
        from += pageSize;
      }

      const latestLocationByExecutive = new Map<string, RawRow>();

      allLocations.forEach((location) => {
        const executiveId = textValue(location, [
          "executive_id",
          "profile_id",
          "user_id",
          "executive_uuid",
        ]);
        if (!executiveId) return;

        const current = latestLocationByExecutive.get(executiveId);
        const locationTime = textValue(location, [
          "recorded_at",
          "updated_at",
          "created_at",
          "last_location_time",
          "timestamp",
        ]);
        const currentTime = current
          ? textValue(current, [
              "recorded_at",
              "updated_at",
              "created_at",
              "last_location_time",
              "timestamp",
            ])
          : "";

        if (!current || new Date(locationTime).getTime() >= new Date(currentTime).getTime()) {
          latestLocationByExecutive.set(executiveId, location);
        }
      });

      const executiveRows = allExecutives.filter((executive) => {
        const status = textValue(executive, ["status"]).toLowerCase();
        return status === "active" || status === "approved";
      });

      const merged = executiveRows.map((executive, index) => {
        const id = textValue(executive, ["id"], String(index + 1));
        const location = latestLocationByExecutive.get(id) ?? {};
        const latitude = numberValue(location, ["latitude", "lat"]);
        const longitude = numberValue(location, ["longitude", "lng", "lon"]);
        const accuracy = numberValue(location, ["accuracy", "accuracy_meters"]);
        const lastUpdated = textValue(location, [
          "recorded_at",
          "updated_at",
          "created_at",
          "last_location_time",
          "timestamp",
        ]);

        return {
          id,
          name: textValue(executive, ["full_name"], "Unnamed Executive"),
          code: textValue(
            executive,
            ["executive_code"],
            `EXE-${String(index + 1).padStart(3, "0")}`
          ),
          mobile: textValue(
            executive,
            ["phone", "mobile_number"],
            "Not available"
          ),
          area: textValue(executive, ["area"], "Not assigned"),
          latitude,
          longitude,
          accuracy,
          lastUpdated,
          status: getStatus(latitude, longitude, lastUpdated),
        } satisfies ExecutiveLocation;
      });

      merged.sort((a, b) => {
        const rank: Record<GPSStatus, number> = {
          Live: 0,
          "Recently Active": 1,
          Offline: 2,
          "Not Connected": 3,
        };

        const statusDifference = rank[a.status] - rank[b.status];
        return statusDifference !== 0 ? statusDifference : a.name.localeCompare(b.name);
      });

      setExecutives(merged);
      setLastRefresh(new Date());
      setSelectedId((current) => {
        if (current && merged.some((item) => String(item.id) === current)) return current;
        const firstConnected = merged.find((item) => validCoordinate(item.latitude, item.longitude));
        return firstConnected ? String(firstConnected.id) : "";
      });
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "GPS data load nahi ho saka.";
      setError(message);
      console.error("GPS Tracking load error:", caughtError);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadGPSData();

    const timer = window.setInterval(() => {
      void loadGPSData(true);
    }, AUTO_REFRESH_MS);

    const channel = supabase
      .channel("admin-gps-tracking")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "gps_locations",
        },
        () => {
          void loadGPSData(true);
        }
      )
      .subscribe();

    return () => {
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [loadGPSData]);

  const filteredExecutives = useMemo(() => {
    const query = search.trim().toLowerCase();

    return executives.filter((executive) => {
      return (
        !query ||
        executive.name.toLowerCase().includes(query) ||
        executive.code.toLowerCase().includes(query) ||
        executive.mobile.toLowerCase().includes(query) ||
        executive.area.toLowerCase().includes(query) ||
        executive.status.toLowerCase().includes(query)
      );
    });
  }, [executives, search]);

  const selectedExecutive = useMemo(
    () =>
      executives.find((executive) => String(executive.id) === selectedId) ??
      null,
    [executives, selectedId]
  );

  const liveCount = executives.filter(
    (executive) => executive.status === "Live"
  ).length;

  const recentCount = executives.filter(
    (executive) => executive.status === "Recently Active"
  ).length;

  const offlineCount = executives.filter(
    (executive) => executive.status === "Offline"
  ).length;

  const invalidCount = executives.filter(
    (executive) =>
      (executive.latitude !== null || executive.longitude !== null) &&
      !validCoordinate(executive.latitude, executive.longitude)
  ).length;

  return (
    <div className="gps-page">
      <style>{`
        .gps-page {
          min-height: 100%;
          padding: 26px;
          background:
            radial-gradient(circle at top right, rgba(37, 99, 235, 0.08), transparent 28%),
            #f5f7fb;
          color: #0f172a;
          box-sizing: border-box;
        }

        .gps-page * { box-sizing: border-box; }

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
            linear-gradient(135deg, rgba(255, 255, 255, 0.06), transparent),
            linear-gradient(135deg, #07192d 0%, #0d2f55 56%, #12497b 100%);
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

        .gps-hero-actions {
          position: relative;
          z-index: 1;
          min-width: 220px;
        }

        .gps-hero-card {
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

        .gps-refresh-button {
          width: 100%;
          height: 42px;
          margin-top: 10px;
          border: 1px solid rgba(255, 255, 255, 0.24);
          border-radius: 12px;
          color: white;
          background: rgba(255, 255, 255, 0.11);
          font-weight: 800;
          cursor: pointer;
        }

        .gps-refresh-button:disabled {
          cursor: wait;
          opacity: 0.7;
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

        .gps-error {
          margin-top: 18px;
          padding: 14px 16px;
          border: 1px solid #fecaca;
          border-radius: 14px;
          color: #991b1b;
          background: #fef2f2;
          font-size: 13px;
          font-weight: 700;
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
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .gps-badge.live { color: #047857; background: #ecfdf5; }
        .gps-badge.recent { color: #1d4ed8; background: #eff6ff; }
        .gps-badge.offline { color: #b45309; background: #fffbeb; }
        .gps-badge.none { color: #64748b; background: #f1f5f9; }

        .gps-map-frame {
          width: 100%;
          min-height: 430px;
          border: 0;
          border-radius: 17px;
          background: #e2e8f0;
        }

        .gps-map-placeholder {
          min-height: 430px;
          display: grid;
          place-items: center;
          padding: 30px;
          border: 1px dashed #94a3b8;
          border-radius: 17px;
          background:
            linear-gradient(rgba(255, 255, 255, 0.84), rgba(255, 255, 255, 0.84)),
            repeating-linear-gradient(45deg, #e2e8f0, #e2e8f0 18px, #f8fafc 18px, #f8fafc 36px);
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

        .gps-location-details {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-top: 14px;
        }

        .gps-location-box {
          padding: 12px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background: #f8fafc;
        }

        .gps-location-box span {
          display: block;
          color: #94a3b8;
          font-size: 9px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .gps-location-box strong {
          display: block;
          margin-top: 5px;
          color: #334155;
          font-size: 12px;
          overflow-wrap: anywhere;
        }

        .gps-map-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 40px;
          margin-top: 12px;
          padding: 0 15px;
          border-radius: 11px;
          color: white;
          background: #2563eb;
          font-size: 13px;
          font-weight: 800;
          text-decoration: none;
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
          max-height: 595px;
          overflow-y: auto;
        }

        .gps-executive-card {
          width: 100%;
          padding: 14px;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          background: #ffffff;
          text-align: left;
          cursor: pointer;
          transition: 0.18s ease;
        }

        .gps-executive-card:hover,
        .gps-executive-card.selected {
          border-color: #93c5fd;
          box-shadow: 0 8px 24px rgba(37, 99, 235, 0.10);
          transform: translateY(-1px);
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
          min-width: 0;
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
          overflow-wrap: anywhere;
        }

        .gps-status {
          padding: 6px 9px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 850;
          white-space: nowrap;
        }

        .gps-status.live { color: #047857; background: #ecfdf5; }
        .gps-status.recent { color: #1d4ed8; background: #eff6ff; }
        .gps-status.offline { color: #b45309; background: #fffbeb; }
        .gps-status.none { color: #64748b; background: #f1f5f9; }

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
          overflow-wrap: anywhere;
        }

        .gps-empty {
          padding: 35px 15px;
          color: #64748b;
          text-align: center;
        }

        .gps-loading {
          min-height: 300px;
          display: grid;
          place-items: center;
          color: #64748b;
          font-weight: 800;
        }

        @media (max-width: 1100px) {
          .gps-stats { grid-template-columns: repeat(2, 1fr); }
          .gps-main-grid { grid-template-columns: 1fr; }
          .gps-location-details { grid-template-columns: repeat(2, 1fr); }
        }

        @media (max-width: 720px) {
          .gps-page { padding: 14px; }
          .gps-hero,
          .gps-panel-head {
            align-items: flex-start;
            flex-direction: column;
          }
          .gps-hero-actions { width: 100%; }
          .gps-location-details { grid-template-columns: 1fr; }
        }

        @media (max-width: 480px) {
          .gps-stats { grid-template-columns: 1fr; }
          .gps-executive-meta { grid-template-columns: 1fr; }
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
            Executive ki latest verified location, GPS accuracy aur last update
            ko Supabase se live monitor karein.
          </p>
        </div>

        <div className="gps-hero-actions">
          <div className="gps-hero-card">
            <span>GPS Integration</span>
            <strong>{liveCount > 0 ? `${liveCount} Live` : "Connected"}</strong>
          </div>

          <button
            className="gps-refresh-button"
            type="button"
            disabled={refreshing}
            onClick={() => void loadGPSData(true)}
          >
            {refreshing ? "Refreshing..." : "Refresh Locations"}
          </button>
        </div>
      </section>

      {error ? <div className="gps-error">GPS Error: {error}</div> : null}

      <section className="gps-stats">
        <article className="gps-stat">
          <span>Total Executives</span>
          <strong>{executives.length}</strong>
        </article>

        <article className="gps-stat">
          <span>Live Locations</span>
          <strong>{liveCount}</strong>
        </article>

        <article className="gps-stat">
          <span>Recently Active</span>
          <strong>{recentCount}</strong>
        </article>

        <article className="gps-stat">
          <span>Offline / Invalid</span>
          <strong>{offlineCount + invalidCount}</strong>
        </article>
      </section>

      <section className="gps-main-grid">
        <article className="gps-panel">
          <div className="gps-panel-head">
            <div>
              <h2>Live Location Map</h2>
              <p>
                {lastRefresh
                  ? `Last refresh: ${lastRefresh.toLocaleTimeString("en-IN")}`
                  : "GPS data loading..."}
              </p>
            </div>

            <span
              className={`gps-badge ${
                selectedExecutive?.status === "Live"
                  ? "live"
                  : selectedExecutive?.status === "Recently Active"
                    ? "recent"
                    : selectedExecutive?.status === "Offline"
                      ? "offline"
                      : "none"
              }`}
            >
              {selectedExecutive?.status ?? "No location selected"}
            </span>
          </div>

          {loading ? (
            <div className="gps-loading">GPS locations load ho rahi hain...</div>
          ) : selectedExecutive &&
            validCoordinate(
              selectedExecutive.latitude,
              selectedExecutive.longitude
            ) ? (
            <>
              <iframe
                className="gps-map-frame"
                title={`${selectedExecutive.name} live location`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={mapUrl(
                  selectedExecutive.latitude as number,
                  selectedExecutive.longitude as number
                )}
              />

              <div className="gps-location-details">
                <div className="gps-location-box">
                  <span>Executive</span>
                  <strong>{selectedExecutive.name}</strong>
                </div>

                <div className="gps-location-box">
                  <span>Coordinates</span>
                  <strong>
                    {selectedExecutive.latitude?.toFixed(6)},{" "}
                    {selectedExecutive.longitude?.toFixed(6)}
                  </strong>
                </div>

                <div className="gps-location-box">
                  <span>Accuracy</span>
                  <strong>
                    {selectedExecutive.accuracy !== null
                      ? `${Math.round(selectedExecutive.accuracy)} metres`
                      : "Not available"}
                  </strong>
                </div>

                <div className="gps-location-box">
                  <span>Last Update</span>
                  <strong>
                    {formatDateTime(selectedExecutive.lastUpdated)}
                  </strong>
                </div>
              </div>

              <a
                className="gps-map-link"
                href={googleMapsUrl(
                  selectedExecutive.latitude as number,
                  selectedExecutive.longitude as number
                )}
                target="_blank"
                rel="noreferrer"
              >
                Open in Google Maps
              </a>
            </>
          ) : (
            <div className="gps-map-placeholder">
              <div>
                <div className="gps-map-icon">📍</div>
                <h3>No Live Location Connected</h3>
                <p>
                  Executive App se GPS location save hone ke baad real map
                  yahan automatically dikhega. Koi fake coordinate use nahi
                  kiya gaya hai.
                </p>
              </div>
            </div>
          )}
        </article>

        <article className="gps-panel">
          <div className="gps-panel-head">
            <div>
              <h2>Executive GPS Status</h2>
              <p>Executive select karke uski location map par dekhein.</p>
            </div>
          </div>

          <input
            className="gps-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search executive, code, mobile, area..."
          />

          <div className="gps-list">
            {loading ? (
              <div className="gps-loading">Executives load ho rahe hain...</div>
            ) : filteredExecutives.length > 0 ? (
              filteredExecutives.map((executive) => {
                const statusClass =
                  executive.status === "Live"
                    ? "live"
                    : executive.status === "Recently Active"
                      ? "recent"
                      : executive.status === "Offline"
                        ? "offline"
                        : "none";

                return (
                  <button
                    className={`gps-executive-card ${
                      String(executive.id) === selectedId ? "selected" : ""
                    }`}
                    key={executive.id}
                    type="button"
                    onClick={() => setSelectedId(String(executive.id))}
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

                      <span className={`gps-status ${statusClass}`}>
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
                        <strong>{formatDateTime(executive.lastUpdated)}</strong>
                      </div>

                      <div className="gps-meta-item">
                        <span>GPS Accuracy</span>
                        <strong>
                          {executive.accuracy !== null
                            ? `${Math.round(executive.accuracy)} metres`
                            : "Not available"}
                        </strong>
                      </div>

                      <div className="gps-meta-item">
                        <span>Coordinates</span>
                        <strong>
                          {validCoordinate(
                            executive.latitude,
                            executive.longitude
                          )
                            ? `${executive.latitude?.toFixed(5)}, ${executive.longitude?.toFixed(5)}`
                            : "Not available"}
                        </strong>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="gps-empty">No matching executive found.</div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}

export default GPSPage;