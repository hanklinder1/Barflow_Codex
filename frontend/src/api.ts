const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

let token: string | null = localStorage.getItem("barflow_token");

export function setToken(next: string | null) {
  token = next;
  if (next) {
    localStorage.setItem("barflow_token", next);
  } else {
    localStorage.removeItem("barflow_token");
  }
}

export function getToken() {
  return token;
}

type Method = "GET" | "POST" | "PATCH";

export async function api<T>(path: string, method: Method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error ?? "Request failed");
  }

  return response.json() as Promise<T>;
}

export async function signUp(email: string, password: string) {
  return api<{ token: string; userId: string; needsOnboarding: boolean }>("/auth/signup", "POST", {
    email,
    password
  });
}

export async function signIn(email: string, password: string) {
  return api<{ token: string; userId: string; needsOnboarding: boolean }>("/auth/signin", "POST", {
    email,
    password
  });
}

export async function me() {
  return api<{ userId: string; profile: any; needsOnboarding: boolean }>("/auth/me");
}
