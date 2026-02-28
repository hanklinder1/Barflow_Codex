import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Map, { Marker, Popup } from "react-map-gl/mapbox";
import { api } from "../api";
import { connectSocket } from "../socket";
import type { Bar } from "../types";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? "";

type LocationState = "detecting" | "enabled" | "disabled";

export function HomeScreen() {
  const [bars, setBars] = useState<Bar[]>([]);
  const [selfCheckIn, setSelfCheckIn] = useState<null | { barId: string; barName: string }>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedBarId, setSelectedBarId] = useState<string | null>(null);
  const [locationState, setLocationState] = useState<LocationState>("detecting");

  const selectedBar = useMemo(() => bars.find((bar) => bar.id === selectedBarId) ?? null, [bars, selectedBarId]);

  async function loadAll() {
    setError(null);
    try {
      const overview = await api<{ bars: Bar[]; selfCheckIn: { barId: string; barName: string } | null }>(
        "/map/overview"
      );

      setBars(overview.bars);
      setSelfCheckIn(overview.selfCheckIn);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }

  useEffect(() => {
    loadAll();
    const socket = connectSocket();
    if (!socket) return;

    const handler = () => loadAll();
    socket.on("checkin:update", handler);
    socket.on("nudge:new", handler);
    socket.on("friend:accepted", handler);

    return () => {
      socket.off("checkin:update", handler);
      socket.off("nudge:new", handler);
      socket.off("friend:accepted", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationState("disabled");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setLocationState("enabled");
        try {
          await api("/checkins/auto", "POST", {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
          loadAll();
        } catch {
          // Ignore single-shot auto-detect failures on initial page load.
        }
      },
      () => setLocationState("disabled")
    );
  }, []);

  async function manualCheckIn(barId: string) {
    await api("/checkins/manual", "POST", { barId });
    loadAll();
  }

  async function checkOut() {
    await api("/checkins/checkout", "POST");
    loadAll();
  }

  async function autoCheckIn() {
    if (!navigator.geolocation) {
      setLocationState("disabled");
      setError("Geolocation not supported");
      return;
    }

    setLocationState("detecting");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setLocationState("enabled");
        await api("/checkins/auto", "POST", {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
        loadAll();
      },
      () => {
        setLocationState("disabled");
        setError("Location permission denied");
      }
    );
  }

  const locationSubtext =
    locationState === "detecting"
      ? "Location enabled • Detecting..."
      : locationState === "enabled"
        ? "Location enabled"
        : "Location permission not enabled";

  return (
    <div className="stack">
      <section className="status-strip panel">
        <div className="status-main row">
          <span className={`status-dot ${selfCheckIn ? "online" : "idle"}`} />
          <div>
            <div className="status-title">{selfCheckIn ? `At ${selfCheckIn.barName}` : "Not currently at a bar"}</div>
            <div className="small">{locationSubtext}</div>
          </div>
        </div>
        <Link to="/settings">
          <button className="secondary">Settings</button>
        </Link>
      </section>

      <section className="panel">
        <div className="map-wrap">
          {MAPBOX_TOKEN ? (
            <Map
              mapboxAccessToken={MAPBOX_TOKEN}
              initialViewState={{
                latitude: 34.6832,
                longitude: -82.8375,
                zoom: 16.2
              }}
              mapStyle="mapbox://styles/mapbox/light-v11"
              style={{ width: "100%", height: "100%" }}
            >
              {bars.map((bar) => (
                <Marker key={bar.id} latitude={bar.latitude} longitude={bar.longitude}>
                  <button
                    className="bar-marker"
                    title={bar.name}
                    aria-label={bar.name}
                    onClick={() => setSelectedBarId(bar.id)}
                    onMouseEnter={() => setSelectedBarId(bar.id)}
                    onMouseLeave={() => setSelectedBarId((current) => (current === bar.id ? null : current))}
                    onFocus={() => setSelectedBarId(bar.id)}
                    onBlur={() => setSelectedBarId((current) => (current === bar.id ? null : current))}
                  />
                </Marker>
              ))}
              {selectedBar ? (
                <Popup
                  latitude={selectedBar.latitude}
                  longitude={selectedBar.longitude}
                  closeButton={false}
                  closeOnClick={false}
                  anchor="top"
                  offset={18}
                >
                  <div className="map-popup-title">{selectedBar.name}</div>
                  <div className="small">Friends here: {selectedBar.friendsHere?.length ?? 0}</div>
                </Popup>
              ) : null}
            </Map>
          ) : (
            <div className="map-token-warning">
              Missing Mapbox token. Set <code>VITE_MAPBOX_TOKEN</code> in frontend env vars.
            </div>
          )}
        </div>
      </section>

      <section className="panel stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 className="section-title">Bars</h2>
          <div className="row">
            <button onClick={autoCheckIn}>Auto Check-In</button>
            <button className="secondary" onClick={checkOut}>
              Check Out
            </button>
          </div>
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        {bars.map((bar) => (
          <div className="list-item" key={bar.id}>
            <div>
              <strong>{bar.name}</strong>
              <div className="small">Friends here: {bar.friendsHere?.length ?? 0}</div>
            </div>
            <button onClick={() => manualCheckIn(bar.id)}>Check In</button>
          </div>
        ))}
      </section>
    </div>
  );
}
