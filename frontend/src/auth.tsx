import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { disconnectSocket } from "./socket";
import { me, setToken, signIn, signUp } from "./api";
import type { Profile } from "./types";

type AuthState = {
  loading: boolean;
  userId: string | null;
  profile: Profile | null;
  needsOnboarding: boolean;
  login: (email: string, password: string, mode: "signin" | "signup") => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => void;
  setProfile: (profile: Profile) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  async function refresh() {
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
  }, []);

  async function login(email: string, password: string, mode: "signin" | "signup") {
    const data = mode === "signin" ? await signIn(email, password) : await signUp(email, password);
    setToken(data.token);
    await refresh();
  }

  function logout() {
    setToken(null);
    disconnectSocket();
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
      login,
      refresh,
      logout,
      setProfile
    }),
    [loading, userId, profile, needsOnboarding]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
