import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth";
import { api } from "../api";
import { applyTheme, getStoredTheme } from "../theme";

type Theme = "dark" | "light";

const avatarOptions: Array<{ value: string; label: string; emoji: string; premium?: boolean }> = [
  { value: "tiger", label: "Tiger", emoji: "🐯", premium: true },
  { value: "star", label: "Star", emoji: "⭐" },
  { value: "lightning", label: "Lightning", emoji: "⚡" },
  { value: "music", label: "Music", emoji: "🎵" },
  { value: "soccer", label: "Soccer", emoji: "⚽" },
  { value: "party", label: "Party", emoji: "🎉", premium: true },
  { value: "moon", label: "Moon", emoji: "🌙" },
  { value: "glasses", label: "Glasses", emoji: "🕶️", premium: true }
];

export function SettingsScreen() {
  const auth = useAuth();
  const profile = auth.profile;
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [avatar, setAvatar] = useState(profile?.avatar ?? "tiger");
  const [theme, setTheme] = useState<Theme>("dark");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  const selectedAvatar = useMemo(
    () => avatarOptions.find((option) => option.value === avatar) ?? avatarOptions[0],
    [avatar]
  );

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

  function onThemeToggle(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }

  return (
    <div className="stack">
      <section className="panel stack">
        <h1 className="title">Profile</h1>
        <div className="icon-preview">
          <div className="icon-preview-circle">{selectedAvatar.emoji}</div>
          <div>
            <strong>{selectedAvatar.label}</strong>
            <div className="small">This is how you appear to friends</div>
          </div>
        </div>
      </section>

      <section className="panel stack">
        <h2 className="section-title">Choose Icon</h2>
        <div className="avatar-grid">
          {avatarOptions.map((option) => {
            const locked = option.premium && !profile?.premium;
            const active = avatar === option.value;
            return (
              <button
                key={option.value}
                type="button"
                className={`avatar-card ${active ? "active" : ""}`}
                onClick={() => {
                  if (!locked) setAvatar(option.value);
                }}
              >
                <span className="avatar-emoji">{option.emoji}</span>
                <span>{option.label}</span>
                {locked ? <span className="lock-pill">Premium</span> : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel stack">
        <h2 className="section-title">Settings</h2>

        <form className="stack" onSubmit={onSubmit}>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" />
          <button type="submit">Save profile</button>
        </form>

        <div className="settings-row">
          <div>
            <strong>Theme</strong>
            <div className="small">Choose light or dark mode</div>
          </div>
          <div className="row">
            <button className={theme === "dark" ? "" : "secondary"} onClick={() => onThemeToggle("dark")}>
              Dark
            </button>
            <button className={theme === "light" ? "" : "secondary"} onClick={() => onThemeToggle("light")}>
              Light
            </button>
          </div>
        </div>

        <div className="settings-row">
          <div>
            <strong>Location Services</strong>
            <div className="small">Enable automatic check-ins</div>
          </div>
          <span className="small">Managed in browser</span>
        </div>

        <div className="settings-row">
          <div>
            <strong>Premium Status</strong>
            <div className="small">{profile?.premium ? "Premium active" : "Unlock premium icons"}</div>
          </div>
          <button className="secondary">{profile?.premium ? "Active" : "Upgrade"}</button>
        </div>

        <div className="small">Username: @{profile?.username}</div>
        {saved ? <p style={{ color: "#53cf8b", margin: 0 }}>Saved.</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </section>

      <section className="panel stack">
        <button className="danger" onClick={auth.logout}>
          Log out
        </button>
      </section>
    </div>
  );
}
