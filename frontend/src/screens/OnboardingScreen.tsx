import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";

const avatars = ["tiger", "star", "lightning", "music", "soccer", "party", "moon", "glasses"];
const avatarEmoji: Record<string, string> = {
  tiger: "🐯",
  star: "⭐",
  lightning: "⚡",
  music: "🎵",
  soccer: "⚽",
  party: "🎉",
  moon: "🌙",
  glasses: "🕶️"
};

export function OnboardingScreen() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState("tiger");
  const [premium, setPremium] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      await api("/profiles", "POST", {
        username,
        displayName,
        avatar,
        premium
      });
      await auth.refresh();
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create profile");
    }
  }

  return (
    <div className="app-main">
      <div className="panel stack">
        <h1 className="title">Create your profile</h1>
        <form className="stack" onSubmit={onSubmit}>
          <input
            placeholder="Username (min 3 chars)"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            minLength={3}
            required
          />
          <input
            placeholder="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          <div className="stack">
            <label>Pick avatar</label>
            <div className="row wrap">
              {avatars.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={avatar === option ? "" : "secondary"}
                  onClick={() => setAvatar(option)}
                >
                  {avatarEmoji[option]} {option}
                </button>
              ))}
            </div>
          </div>
          <label className="row">
            <input
              style={{ width: 18, height: 18 }}
              type="checkbox"
              checked={premium}
              onChange={(e) => setPremium(e.target.checked)}
            />
            Premium status
          </label>
          {error ? <p style={{ color: "#fca5a5", margin: 0 }}>{error}</p> : null}
          <button type="submit">Start using BarFlow</button>
        </form>
      </div>
    </div>
  );
}
