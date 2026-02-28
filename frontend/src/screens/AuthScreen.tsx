import { FormEvent, useState } from "react";
import { useAuth } from "../auth";

export function AuthScreen() {
  const auth = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await auth.login(email, password, mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to continue");
    }
  }

  return (
    <div className="app-main">
      <div className="panel stack" style={{ marginTop: 60 }}>
        <h1 className="title">BarFlow</h1>
        <p>Where are my friends and what is going on tonight?</p>
        <form className="stack" onSubmit={onSubmit}>
          <input
            type="email"
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error ? <p style={{ color: "#fca5a5", margin: 0 }}>{error}</p> : null}
          <button type="submit">{mode === "signin" ? "Sign In" : "Create Account"}</button>
        </form>
        <button className="secondary" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
          {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
