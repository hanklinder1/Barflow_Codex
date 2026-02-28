import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth";
import { api } from "../api";
import { applyTheme, getStoredTheme } from "../theme";

type Theme = "dark" | "light";
type PremiumTier = "FREE" | "PREMIUM" | "VIP";

type AvatarOption = {
  value: string;
  label: string;
  emoji: string;
  requiredTier: PremiumTier;
};

type Plan = {
  id: PremiumTier;
  name: string;
  monthlyPrice: number;
  features: string[];
};

const avatarOptions: AvatarOption[] = [
  { value: "star", label: "Star", emoji: "⭐", requiredTier: "FREE" },
  { value: "lightning", label: "Lightning", emoji: "⚡", requiredTier: "FREE" },
  { value: "music", label: "Music", emoji: "🎵", requiredTier: "FREE" },
  { value: "soccer", label: "Soccer", emoji: "⚽", requiredTier: "FREE" },
  { value: "moon", label: "Moon", emoji: "🌙", requiredTier: "FREE" },
  { value: "tiger", label: "Tiger", emoji: "🐯", requiredTier: "PREMIUM" },
  { value: "party", label: "Party", emoji: "🎉", requiredTier: "PREMIUM" },
  { value: "glasses", label: "Shades", emoji: "🕶️", requiredTier: "PREMIUM" },
  { value: "fire", label: "Fire", emoji: "🔥", requiredTier: "PREMIUM" },
  { value: "rocket", label: "Rocket", emoji: "🚀", requiredTier: "PREMIUM" },
  { value: "diamond", label: "Diamond", emoji: "💎", requiredTier: "VIP" },
  { value: "crown", label: "Crown", emoji: "👑", requiredTier: "VIP" },
  { value: "trophy", label: "Trophy", emoji: "🏆", requiredTier: "VIP" },
  { value: "champagne", label: "Champagne", emoji: "🍾", requiredTier: "VIP" }
];

const plans: Plan[] = [
  { id: "FREE", name: "Free", monthlyPrice: 0, features: ["Core check-ins", "Friends + messaging"] },
  { id: "PREMIUM", name: "Premium", monthlyPrice: 4.99, features: ["Premium icon set", "Priority nudge delivery"] },
  { id: "VIP", name: "VIP", monthlyPrice: 9.99, features: ["VIP icon set", "Future concierge features"] }
];

const tierRank: Record<PremiumTier, number> = {
  FREE: 0,
  PREMIUM: 1,
  VIP: 2
};

export function SettingsScreen() {
  const auth = useAuth();
  const profile = auth.profile;

  const currentTier: PremiumTier = profile?.premium ? "PREMIUM" : "FREE";

  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [avatar, setAvatar] = useState(profile?.avatar ?? "star");
  const [theme, setTheme] = useState<Theme>("dark");
  const [planRows, setPlanRows] = useState<Plan[]>(plans);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [billingNotice, setBillingNotice] = useState<string | null>(null);

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  useEffect(() => {
    api<{ plans: Plan[] }>("/billing/plans")
      .then((data) => {
        setPlanRows(data.plans);
      })
      .catch(() => undefined);
  }, []);

  const selectedAvatar = useMemo(
    () => avatarOptions.find((option) => option.value === avatar) ?? avatarOptions[0],
    [avatar]
  );

  function isLocked(option: AvatarOption) {
    return tierRank[currentTier] < tierRank[option.requiredTier];
  }

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

  async function onUpgradeClick(targetTier: PremiumTier) {
    try {
      const checkout = await api<{ checkoutUrl: string; sessionId: string; status: string }>(
        "/billing/checkout-session",
        "POST",
        { planId: targetTier }
      );
      setBillingNotice(`Billing session ready (${checkout.sessionId}). Redirect URL prepared.`);
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
            const locked = isLocked(option);
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
                {locked ? <span className="lock-pill">{option.requiredTier}</span> : null}
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
            <strong>Location Services</strong>
            <div className="small">Enable automatic check-ins</div>
          </div>
          <span className="small">Managed in browser</span>
        </div>

        <div className="stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>Premium Plans</strong>
            <span className="small">Payment integration staged</span>
          </div>

          {planRows.map((plan) => (
            <div key={plan.id} className="plan-row">
              <div>
                <strong>{plan.name}</strong>
                <div className="small">{plan.monthlyPrice === 0 ? "$0/mo" : `$${plan.monthlyPrice}/mo`}</div>
                <div className="small">{plan.features.join(" • ")}</div>
              </div>
              <button
                type="button"
                className={currentTier === plan.id ? "secondary" : ""}
                onClick={() => onUpgradeClick(plan.id)}
                disabled={plan.id === "FREE" || currentTier === plan.id}
              >
                {currentTier === plan.id ? "Active" : "Upgrade"}
              </button>
            </div>
          ))}
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
