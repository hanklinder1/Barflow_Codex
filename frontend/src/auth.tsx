import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { disconnectSocket } from "./socket";
import { me, setToken, signIn, signUp } from "./api";
import type { Profile } from "./types";

const DEMO_STORAGE_KEY = "barflow_demo_mode";

type AuthState = {
  loading: boolean;
  userId: string | null;
  profile: Profile | null;
  needsOnboarding: boolean;
  demoMode: boolean;
  login: (email: string, password: string, mode: "signin" | "signup") => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => void;
  enterDemoMode: () => void;
  setProfile: (profile: Profile) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [demoMode, setDemoMode] = useState(localStorage.getItem(DEMO_STORAGE_KEY) === "true");

  async function refresh() {
    if (demoMode) {
      setUserId("demo-user");
      setProfile({
        userId: "demo-user",
        username: "demo",
        displayName: "Demo User",
        avatar: "star",
        premium: false
      });
      setNeedsOnboarding(false);
      setLoading(false);
      return;
    }

    try {
      const current = await me();
      setUserId(current.userId);
      setProfile(current.profile);
      setNeedsOnboarding(current.needsOnboarding);
    } catch {
      setToken(null);
      setUserId(null);
      setProfile(null);
      setNeedsOnboarding(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode]);

  async function login(email: string, password: string, mode: "signin" | "signup") {
    if (demoMode) {
      setDemoMode(false);
      localStorage.removeItem(DEMO_STORAGE_KEY);
    }
    const data = mode === "signin" ? await signIn(email, password) : await signUp(email, password);
    setToken(data.token);
    await refresh();
  }

  function enterDemoMode() {
    setToken(null);
    disconnectSocket();
    setDemoMode(true);
    localStorage.setItem(DEMO_STORAGE_KEY, "true");
    setNeedsOnboarding(false);
  }

  function logout() {
    setToken(null);
    disconnectSocket();
    localStorage.removeItem(DEMO_STORAGE_KEY);
    setDemoMode(false);
    setUserId(null);
    setProfile(null);
    setNeedsOnboarding(false);
  }

  const value = useMemo(
    () => ({
      loading,
      userId,
      profile,
      needsOnboarding,
      demoMode,
      login,
      refresh,
      logout,
      enterDemoMode,
      setProfile
    }),
    [loading, userId, profile, needsOnboarding, demoMode]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
