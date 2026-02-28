import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import { connectSocket } from "../socket";
import type { Friend, Profile } from "../types";

type FriendRequest = {
  id: string;
  fromUserId: string;
  createdAt: string;
  profile: Profile;
};

export function FriendsScreen() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [friendData, requestData] = await Promise.all([
      api<Friend[]>("/friends"),
      api<FriendRequest[]>("/friends/requests")
    ]);
    setFriends(friendData);
    setIncoming(requestData);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Load failed"));

    const socket = connectSocket();
    if (!socket) return;

    const handler = () => load();
    socket.on("friend:request", handler);
    socket.on("friend:accepted", handler);

    return () => {
      socket.off("friend:request", handler);
      socket.off("friend:accepted", handler);
    };
  }, []);

  async function search(e: FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    const data = await api<Profile[]>(`/friends/search?q=${encodeURIComponent(query.trim())}`);
    setResults(data);
  }

  async function sendRequest(toUserId: string) {
    await api("/friends/requests", "POST", { toUserId });
    setResults((rows) => rows.filter((row) => row.userId !== toUserId));
  }

  async function respond(requestId: string, action: "ACCEPT" | "DECLINE") {
    await api(`/friends/requests/${requestId}/respond`, "POST", { action });
    load();
  }

  return (
    <div className="stack">
      <section className="panel stack">
        <h1 className="title">Friends</h1>
        <form className="row" onSubmit={search}>
          <input
            placeholder="Search by username"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="submit">Search</button>
        </form>
        {results.map((profile) => (
          <div key={profile.userId} className="list-item">
            <div>
              <strong>{profile.displayName}</strong>
              <div className="small">@{profile.username}</div>
            </div>
            <button onClick={() => sendRequest(profile.userId)}>Add</button>
          </div>
        ))}
      </section>

      <section className="panel stack">
        <h2 style={{ margin: 0 }}>Requests ({incoming.length})</h2>
        {incoming.map((request) => (
          <div key={request.id} className="list-item">
            <div>
              <strong>{request.profile.displayName}</strong>
              <div className="small">@{request.profile.username}</div>
            </div>
            <div className="row">
              <button onClick={() => respond(request.id, "ACCEPT")}>Accept</button>
              <button className="secondary" onClick={() => respond(request.id, "DECLINE")}>
                Decline
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="panel stack">
        <h2 style={{ margin: 0 }}>Your Friends ({friends.length})</h2>
        {friends.map((friend) => (
          <div key={friend.userId} className="list-item">
            <div>
              <strong>{friend.displayName}</strong>
              <div className="small">@{friend.username}</div>
            </div>
            <span className="badge">{friend.checkIn ? `At ${friend.checkIn.barName}` : "Not out"}</span>
          </div>
        ))}
        {error ? <p style={{ color: "#fca5a5", margin: 0 }}>{error}</p> : null}
      </section>
    </div>
  );
}
