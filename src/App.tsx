import { useEffect, useMemo, useState } from "react";
import { firebaseReady } from "./lib/firebase";
import {
  getBestLaps,
  getDashboardData,
  type DashboardData,
  type Driver,
  type Lap,
} from "./lib/openf1";

function formatLap(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const minutes = Math.floor(seconds / 60);
  const remainder = (seconds % 60).toFixed(3).padStart(6, "0");
  return minutes > 0 ? `${minutes}:${remainder}` : remainder;
}

function formatDate(date: string | undefined): string {
  if (!date) return "Schedule unavailable";
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}

function driverColor(color: string | undefined): string {
  return color ? `#${color.replace(/^#/, "")}` : "#e10600";
}

function DriverRow({
  driver,
  position,
  lap,
  fastest,
}: {
  driver: Driver;
  position: number;
  lap: Lap | undefined;
  fastest: boolean;
}) {
  const color = driverColor(driver.team_colour);
  return (
    <div className="driver-row" role="row">
      <span className="position mono">{String(position).padStart(2, "0")}</span>
      <span className="team-mark" style={{ backgroundColor: color }} />
      <span className="driver-identity">
        <strong>{driver.full_name || driver.name_acronym}</strong>
        <small>{driver.team_name || "Team unavailable"}</small>
      </span>
      <span className="driver-code mono">{driver.name_acronym}</span>
      <span className={`lap-time mono${fastest ? " fastest" : ""}`}>
        {formatLap(lap?.lap_duration)}
        {fastest && <span className="fastest-tag">FASTEST</span>}
      </span>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    getDashboardData(controller.signal)
      .then(setData)
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Unable to load OpenF1 data.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [refreshKey]);

  const bestLaps = useMemo(() => getBestLaps(data?.laps ?? []), [data?.laps]);
  const leaderboard = useMemo(() => {
    const drivers = data?.drivers ?? [];
    return [...drivers].sort((left, right) => {
      const leftLap = bestLaps.get(left.driver_number)?.lap_duration ?? Infinity;
      const rightLap = bestLaps.get(right.driver_number)?.lap_duration ?? Infinity;
      return leftLap - rightLap || left.driver_number - right.driver_number;
    });
  }, [bestLaps, data?.drivers]);
  const fastestDriverNumber = leaderboard[0]?.driver_number;
  const fastestLap = fastestDriverNumber == null ? undefined : bestLaps.get(fastestDriverNumber);
  const weather = data?.weather[data.weather.length - 1];
  const session = data?.session;

  return (
    <main className="app-shell">
      <aside className="rail" aria-label="Main navigation">
        <a className="brand-mark" href="#" aria-label="Apex home">
          A<span>.</span>
        </a>
        <div className="rail-links">
          <a className="rail-link active" href="#overview" aria-label="Overview" title="Overview">
            <span className="nav-icon icon-grid" />
          </a>
          <a className="rail-link" href="#standings" aria-label="Standings" title="Standings">
            <span className="nav-icon icon-bars" />
          </a>
          <a className="rail-link" href="#weekend" aria-label="Race weekend" title="Race weekend">
            <span className="nav-icon icon-flag" />
          </a>
        </div>
        <span className="rail-bottom mono">26</span>
      </aside>

      <section className="workspace" id="overview">
        <header className="topbar">
          <div className="breadcrumb">
            <span className="breadcrumb-muted">APEX</span>
            <span className="breadcrumb-slash">/</span>
            <span>Race centre</span>
          </div>
          <div className="topbar-right">
            <span className={`firebase-status${firebaseReady ? " configured" : ""}`}>
              <span className="status-dot" />
              {firebaseReady ? "FIREBASE READY" : "FIREBASE SETUP NEEDED"}
            </span>
            <span className="avatar">F</span>
          </div>
        </header>

        <div className="content">
          <section className="hero" id="weekend">
            <div className="hero-copy">
              <div className="eyebrow">
                <span className="live-dot" />
                OPENF1 · RACE WEEKEND
              </div>
              <h1>Formula One,<br /><span>in focus.</span></h1>
              <p>
                Every lap, every detail. Your race weekend starts here.
              </p>
            </div>
            <div className="hero-watermark" aria-hidden="true">F1</div>
            <div className="hero-meta">
              <div className="meta-label">LATEST SESSION</div>
              <div className="meta-title">
                {loading ? "Loading session…" : session?.meeting_name ?? "No session found"}
              </div>
              <div className="meta-subtitle">
                {session
                  ? `${session.circuit_short_name} · ${session.session_name} · ${session.year}`
                  : "OpenF1 historical data"}
              </div>
              <span className="session-date">{formatDate(session?.date_start)}</span>
            </div>
          </section>

          {error && (
            <div className="error-banner" role="alert">
              <span><strong>Data feed unavailable</strong> — {error}</span>
              <button className="text-button" onClick={() => setRefreshKey((key) => key + 1)}>
                Try again
              </button>
            </div>
          )}

          {!loading && !error && !session && (
            <div className="empty-banner">
              No session data was returned. OpenF1 historical data is available from 2023 onward.
            </div>
          )}

          <section className="stats-grid" aria-label="Session overview">
            <article className="stat-card">
              <div className="stat-top"><span>SESSION</span><span className="stat-icon">◎</span></div>
              <div className="stat-value stat-session">{loading ? "—" : session?.session_name ?? "—"}</div>
              <div className="stat-caption">{session?.country_name ?? "Waiting for session data"}</div>
            </article>
            <article className="stat-card">
              <div className="stat-top"><span>DRIVERS ON TRACK</span><span className="stat-icon">↗</span></div>
              <div className="stat-value mono">{loading ? "—" : String(data?.drivers.length ?? 0).padStart(2, "0")}</div>
              <div className="stat-caption">From the latest session feed</div>
            </article>
            <article className="stat-card stat-card-accent">
              <div className="stat-top"><span>FASTEST LAP</span><span className="stat-icon">◷</span></div>
              <div className="stat-value mono">{loading ? "—" : formatLap(fastestLap?.lap_duration)}</div>
              <div className="stat-caption">
                {fastestDriverNumber != null
                  ? data?.drivers.find((driver) => driver.driver_number === fastestDriverNumber)?.name_acronym
                  : "No lap times yet"}
              </div>
            </article>
            <article className="stat-card">
              <div className="stat-top"><span>TRACK TEMPERATURE</span><span className="stat-icon">°</span></div>
              <div className="stat-value mono">{weather ? `${Math.round(weather.track_temperature)}°` : "—"}</div>
              <div className="stat-caption">
                {weather ? `Air ${Math.round(weather.air_temperature)}°C · ${Math.round(weather.humidity)}% humidity` : "Weather feed unavailable"}
              </div>
            </article>
          </section>

          <section className="lower-grid">
            <article className="panel leaderboard-panel" id="standings">
              <div className="panel-heading">
                <div>
                  <div className="eyebrow">TIMING DATA</div>
                  <h2>Fastest laps</h2>
                </div>
                <span className="panel-count mono">{String(leaderboard.length).padStart(2, "0")} DRIVERS</span>
              </div>
              <div className="table-header" role="row">
                <span>POS</span><span>DRIVER</span><span className="table-code">CODE</span><span>BEST LAP</span>
              </div>
              <div className="driver-list">
                {loading ? (
                  <div className="table-message">Fetching timing data…</div>
                ) : leaderboard.length ? (
                  leaderboard.slice(0, 10).map((driver, index) => (
                    <DriverRow
                      key={driver.driver_number}
                      driver={driver}
                      position={index + 1}
                      lap={bestLaps.get(driver.driver_number)}
                      fastest={driver.driver_number === fastestDriverNumber}
                    />
                  ))
                ) : (
                  <div className="table-message">No driver timing data for this session.</div>
                )}
              </div>
              <div className="panel-footer">
                <span>BEST LAP PER DRIVER</span>
                <span>OPENF1 API <span className="footer-arrow">↗</span></span>
              </div>
            </article>

            <aside className="side-column">
              <article className="panel weekend-panel">
                <div className="panel-heading">
                  <div>
                    <div className="eyebrow">THE CIRCUIT</div>
                    <h2>Weekend details</h2>
                  </div>
                  <span className="circuit-icon">⌁</span>
                </div>
                <div className="circuit-art" aria-hidden="true">
                  <svg viewBox="0 0 280 135" fill="none">
                    <path d="M37 87c2-17 5-44 18-50 8-4 19 0 21 8 3 10-11 14-13 3-2-13 20-28 39-20 13 5 14 18 4 27-11 10-28 4-24-7 4-12 29-21 46-9 12 9 10 23-3 28-12 5-22-5-16-14 8-12 31-11 40-1 8 9 4 22-8 24-13 2-19-10-9-18 11-9 33-4 39 10 5 11-2 20-13 19-10-1-15-12-8-18 9-8 24-1 27 9 4 12-6 20-17 17-11-2-11-14-3-18 8-5 20 2 19 11-1 12-12 17-22 11-9-5-6-16 3-18 11-2 21 10 16 20-5 11-19 12-28 4-7-7-3-16 7-16 11 0 20 13 12 23-7 9-20 7-25-1-4-7 1-13 9-12 10 1 15 12 9 20-7 9-19 6-23-2-4-9 6-15 16-10 11 5 15 16 8 24" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
                    <circle cx="37" cy="87" r="3" fill="#E10600"/>
                  </svg>
                  <span className="circuit-label mono">{session?.circuit_short_name ?? "—"}</span>
                </div>
                <div className="detail-list">
                  <div><span>LOCATION</span><strong>{session?.location ?? "—"}</strong></div>
                  <div><span>COUNTRY</span><strong>{session?.country_name ?? "—"}</strong></div>
                  <div><span>SESSION</span><strong>{session?.session_name ?? "—"}</strong></div>
                  <div><span>DATE (UTC)</span><strong>{formatDate(session?.date_start)}</strong></div>
                </div>
              </article>

              <article className="firebase-card">
                <div className="firebase-card-top">
                  <span className="firebase-symbol">✦</span>
                  <span className={`firebase-tag${firebaseReady ? " ready" : ""}`}>
                    {firebaseReady ? "CONFIGURED" : "GET STARTED"}
                  </span>
                </div>
                <h3>Your data layer,<br />ready to build.</h3>
                <p>
                  {firebaseReady
                    ? "Firebase is configured. Add Auth and Firestore features to make this dashboard yours."
                    : "Add your Firebase project keys to .env.local to enable Auth and Firestore."}
                </p>
                <div className="firebase-progress"><span className={firebaseReady ? "complete" : ""} /></div>
                <div className="firebase-foot">
                  <span>{firebaseReady ? "PROJECT CONFIGURED" : "SETUP: 0 / 1"}</span>
                  <span>FIREBASE</span>
                </div>
              </article>
            </aside>
          </section>
          <footer className="page-footer">
            <span>APEX RACE CENTRE <span className="footer-separator">/</span> BUILT FOR THE DETAILS</span>
            <span>DATA BY OPENF1 <span className="footer-separator">·</span> FIREBASE READY</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
