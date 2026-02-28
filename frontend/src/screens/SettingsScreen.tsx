import { FormEvent, useState } from "react";
import { useAuth } from "../auth";
import { api } from "../api";

const avatars = ["tiger", "star", "lightning", "music", "soccer", "party", "moon", "glasses"];

export function SettingsScreen() {
  const auth = useAuth();
  const profile = auth.profile;
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [avatar, setAvatar] = useState(profile?.avatar ?? "tiger");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    try {
      const updated = await api<any>("/profiles/me", "PATCH", { displayName, avatar });
      auth.setProfile(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  return (
    <div className="stack">
      <section className="panel stack">
        <h1 className="title">Settings</h1>
        <div className="small">Username: @{profile?.username}</div>
        <div className="small">Premium: {profile?.premium ? "Yes" : "No"}</div>

        <form className="stack" onSubmit={onSubmit}>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" />
          <select value={avatar} onChange={(e) => setAvatar(e.target.value)}>
            {avatars.map((option) => (
              <option value={option} key={option}>
                {option}
              </option>
            ))}
          </select>
          <button type="submit">Save profile</button>
        </form>

        {saved ? <p style={{ color: "#86efac", margin: 0 }}>Saved.</p> : null}
        {error ? <p style={{ color: "#fca5a5", margin: 0 }}>{error}</p> : null}
      </section>

      <section className="panel stack">
        <button className="danger" onClick={auth.logout}>
          Log out
        </button>
      </section>
    </div>
  );
}
