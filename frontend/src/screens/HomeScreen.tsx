import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Map, { Marker, Popup } from "react-map-gl/mapbox";
import { api } from "../api";
import { connectSocket } from "../socket";
import type { Bar, Friend } from "../types";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? "";

type LocationState = "detecting" | "enabled" | "disabled";

export function HomeScreen() {
  const [bars, setBars] = useState<Bar[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selfCheckIn, setSelfCheckIn] = useState<null | { barId: string; barName: string }>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedBarId, setSelectedBarId] = useState<string | null>(null);
  const [locationState, setLocationState] = useState<LocationState>("detecting");

  const lastSentAtRef = useRef(0);
  const watchIdRef = useRef<number | null>(null);

  const selectedBar = useMemo(() => bars.find((bar) => bar.id === selectedBarId) ?? null, [bars, selectedBarId]);
  const checkedInFriends = useMemo(() => friends.filter((friend) => friend.checkIn), [friends]);

  async function loadAll() {
    setError(null);
    try {
      const [overview, friendData] = await Promise.all([
        api<{ bars: Bar[]; selfCheckIn: { barId: string; barName: string } | null }>("/map/overview"),
        api<Friend[]>("/friends")
      ]);

      setBars(overview.bars);
      setFriends(friendData);
      setSelfCheckIn(overview.selfCheckIn);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }

  async function sendAutoLocation(latitude: number, longitude: number, accuracy: number) {
    const now = Date.now();
    if (now - lastSentAtRef.current < 6000) return;
    lastSentAtRef.current = now;

    try {
      await api("/checkins/auto", "POST", { latitude, longitude, accuracy });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update location");
    }
  }

  useEffect(() => {
    loadAll();
    const socket = connectSocket();
    if (!socket) return;

    const handler = () => loadAll();
    socket.on("checkin:update", handler);
    socket.on("friend:accepted", handler);

    return () => {
      socket.off("checkin:update", handler);
      socket.off("friend:accepted", handler);
    };
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationState("disabled");
      return;
    }

    setLocationState("detecting");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setLocationState("enabled");
        await sendAutoLocation(position.coords.latitude, position.coords.longitude, position.coords.accuracy);
      },
      () => {
        setLocationState("disabled");
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        setLocationState("enabled");
        await sendAutoLocation(position.coords.latitude, position.coords.longitude, position.coords.accuracy);
      },
      () => {
        setLocationState("disabled");
      },
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 12000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
                zoom: 16.25
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
            </div>
          </div>
        ))}
        {friends.length === 0 ? <div className="small">No friends yet.</div> : null}
      </section>

      {error ? <p className="error-text">{error}</p> : null}
    </div>
  );
}
