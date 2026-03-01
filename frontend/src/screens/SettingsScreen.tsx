import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth";
import { api } from "../api";
import { applyTheme, getStoredTheme } from "../theme";

type Theme = "dark" | "light";
type PremiumTier = "FREE" | "PREMIUM";

type AvatarOption = {
  value: string;
  label: string;
  emoji: string;
  premium?: boolean;
};

type Plan = {
  id: PremiumTier;
  name: string;
  price: number;
  priceType: "ONE_TIME";
  features: string[];
};

const avatarOptions: AvatarOption[] = [
  { value: "star", label: "Star", emoji: "⭐" },
  { value: "lightning", label: "Lightning", emoji: "⚡" },
  { value: "music", label: "Music", emoji: "🎵" },
  { value: "soccer", label: "Soccer", emoji: "⚽" },
  { value: "moon", label: "Moon", emoji: "🌙" },
  { value: "tiger", label: "Tiger", emoji: "🐯", premium: true },
  { value: "party", label: "Party", emoji: "🎉", premium: true },
  { value: "glasses", label: "Shades", emoji: "🕶️", premium: true },
  { value: "fire", label: "Fire", emoji: "🔥", premium: true },
  { value: "rocket", label: "Rocket", emoji: "🚀", premium: true },
  { value: "diamond", label: "Diamond", emoji: "💎", premium: true },
  { value: "crown", label: "Crown", emoji: "👑", premium: true },
  { value: "trophy", label: "Trophy", emoji: "🏆", premium: true },
  { value: "champagne", label: "Champagne", emoji: "🍾", premium: true }
];

const defaultPlans: Plan[] = [
  { id: "FREE", name: "Free", price: 0, priceType: "ONE_TIME", features: ["Core check-ins", "Friends + messaging"] },
  { id: "PREMIUM", name: "Premium", price: 3.99, priceType: "ONE_TIME", features: ["Premium icon pack access"] }
];

export function SettingsScreen() {
  const auth = useAuth();
  const profile = auth.profile;

  const currentTier: PremiumTier = profile?.premium ? "PREMIUM" : "FREE";

  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [avatar, setAvatar] = useState(profile?.avatar ?? "star");
  const [theme, setTheme] = useState<Theme>("dark");
  const [planRows, setPlanRows] = useState<Plan[]>(defaultPlans);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [billingNotice, setBillingNotice] = useState<string | null>(null);

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  useEffect(() => {
    api<{ plans: Plan[] }>("/billing/plans")
      .then((data) => setPlanRows(data.plans))
      .catch(() => undefined);
  }, []);

  const selectedAvatar = useMemo(
    () => avatarOptions.find((option) => option.value === avatar) ?? avatarOptions[0],
    [avatar]
  );
  const premiumPlan = useMemo(
    () => planRows.find((plan) => plan.id === "PREMIUM") ?? defaultPlans.find((plan) => plan.id === "PREMIUM")!,
    [planRows]
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

  async function onUpgradeClick() {
    try {
      const checkout = await api<{ sessionId: string }>("/billing/checkout-session", "POST", { planId: "PREMIUM" });
      setBillingNotice(`Premium checkout session ready (${checkout.sessionId}). Payment integration comes next.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout");
    }
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
            <div className="small">Tier: {currentTier}</div>
          </div>
        </div>
      </section>

      <section className="panel stack">
        <h2 className="section-title">Choose Icon</h2>
        <div className="avatar-grid">
          {avatarOptions.map((option) => {
            const locked = Boolean(option.premium) && !profile?.premium;
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
                {locked ? <span className="lock-pill">PREMIUM</span> : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel stack">
        <h2 className="section-title">Settings</h2>

        <form className="stack" onSubmit={onSubmit}>
          <div className="field-wrap">
            <label className="small">Username</label>
            <input value={`@${profile?.username ?? ""}`} readOnly />
          </div>

          <div className="field-wrap">
            <label className="small">Display Name</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" />
          </div>

          <button type="submit">Save profile</button>
        </form>

        <div className="settings-row">
          <div>
            <strong>Theme</strong>
            <div className="small">Choose light or dark mode</div>
          </div>
          <div className="row">
            <button type="button" className={theme === "dark" ? "" : "secondary"} onClick={() => onThemeToggle("dark")}>
              Dark
            </button>
            <button
              type="button"
              className={theme === "light" ? "" : "secondary"}
              onClick={() => onThemeToggle("light")}
            >
              Light
            </button>
          </div>
        </div>

        <div className="settings-row">
          <div>
            <strong>Premium (One-Time)</strong>
            <div className="small">Unlock premium icon pack forever with a one-time payment</div>
          </div>
          {currentTier === "PREMIUM" ? (
            <button type="button" className="secondary" disabled>
              Active
            </button>
          ) : (
            <button type="button" onClick={onUpgradeClick}>
              Upgrade ${premiumPlan.price.toFixed(2)} one-time
            </button>
          )}
        </div>

        {billingNotice ? <div className="notice-pill">{billingNotice}</div> : null}
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
