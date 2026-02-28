import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Map, { Marker, NavigationControl, Popup } from "react-map-gl/mapbox";
import { api } from "../api";
import { connectSocket } from "../socket";
import type { Bar, Friend, Nudge } from "../types";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? "";

type LocationState = "detecting" | "enabled" | "disabled";

export function HomeScreen() {
  const [bars, setBars] = useState<Bar[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [selfCheckIn, setSelfCheckIn] = useState<null | { barId: string; barName: string }>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBarId, setSelectedBarId] = useState<string | null>(null);
  const [locationState, setLocationState] = useState<LocationState>("detecting");

  const checkedInFriends = useMemo(() => friends.filter((f) => f.checkIn), [friends]);
  const selectedBar = useMemo(() => bars.find((bar) => bar.id === selectedBarId) ?? null, [bars, selectedBarId]);

  async function loadAll() {
    setError(null);
    try {
      const [overview, friendData, nudgeData] = await Promise.all([
        api<{ bars: Bar[]; selfCheckIn: { barId: string; barName: string } | null }>("/map/overview"),
        api<Friend[]>("/friends"),
        api<Nudge[]>("/nudges")
      ]);

      setBars(overview.bars);
      setFriends(friendData);
      setNudges(nudgeData);
      setSelfCheckIn(overview.selfCheckIn);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
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
      () => setLocationState("enabled"),
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
          longitude: position.coords.longitude
        });
        loadAll();
      },
      () => {
        setLocationState("disabled");
        setError("Location permission denied");
      }
    );
  }

  async function dismissNudge(nudgeId: string) {
    await api(`/nudges/${nudgeId}/dismiss`, "POST");
    setNudges((current) => current.filter((n) => n.id !== nudgeId));
  }

  async function sendNudge(friendUserId: string) {
    await api("/nudges", "POST", { recipientId: friendUserId });
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

      <section className="panel stack hero-panel">
        <h1 className="title">Tonight in Clemson</h1>
        <p className="small">{selfCheckIn ? `Checked in at ${selfCheckIn.barName}` : "You are currently not checked in"}</p>
        <div className="row wrap">
          <button onClick={autoCheckIn}>Auto Check-In</button>
          <button className="secondary" onClick={checkOut}>
            Check Out
          </button>
        </div>
        {error ? <p className="error-text">{error}</p> : null}
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
              <NavigationControl position="top-right" />
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
        <h2 className="section-title">Bars</h2>
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

      <section className="panel stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 className="section-title">Friends Out ({checkedInFriends.length})</h2>
          <Link to="/friends" className="small">
            Manage friends
          </Link>
        </div>
        {friends.map((friend) => (
          <div className="list-item" key={friend.userId}>
            <div>
              <strong>{friend.displayName}</strong>
              <div className="small">@{friend.username}</div>
              <div>{friend.checkIn ? `At ${friend.checkIn.barName}` : "Not out"}</div>
            </div>
            <div className="row">
              <Link to={`/friends/${friend.userId}`}>
                <button className="secondary">Message</button>
              </Link>
              {selfCheckIn ? <button onClick={() => sendNudge(friend.userId)}>Nudge</button> : null}
            </div>
          </div>
        ))}
      </section>

      <section className="panel stack">
        <h2 className="section-title">Nudges {nudges.length > 0 ? `(${nudges.length})` : ""}</h2>
        {nudges.map((nudge) => (
          <div key={nudge.id} className="list-item">
            <div>
              <strong>{nudge.sender.displayName}</strong> wants you at <strong>{nudge.bar.name}</strong>
              <div className="small">{new Date(nudge.createdAt).toLocaleTimeString()}</div>
            </div>
            <div className="row">
              <button className="secondary" onClick={() => dismissNudge(nudge.id)}>
                Dismiss
              </button>
              <button onClick={() => manualCheckIn(nudge.bar.id)}>See Bar</button>
            </div>
          </div>
        ))}
        {!loading && nudges.length === 0 ? <div className="small">No active nudges.</div> : null}
      </section>
    </div>
  );
}
