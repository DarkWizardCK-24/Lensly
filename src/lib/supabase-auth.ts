/**
 * Minimal client for Supabase Auth (GoTrue) over its public REST API, using the anon/publishable key.
 * The same project and accounts power the CashBook app, so one sign-in works in both.
 * Passwords exist only in the body of a single request and are never stored or logged.
 */

export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
export const authConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export class AuthError extends Error {}

export type Session = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  userId: string;
  email: string;
  displayName?: string;
};

type Json = Record<string, unknown>;

function friendly(status: number, body: Json): string {
  const code = String(body.error_code ?? body.code ?? "");
  const msg = String(body.msg ?? body.message ?? body.error_description ?? "").toLowerCase();
  if (code === "invalid_credentials" || msg.includes("invalid login")) return "Incorrect email or password.";
  if (code === "email_not_confirmed" || msg.includes("not confirmed")) return "Please confirm your email first — check your inbox.";
  if (code === "user_already_exists" || msg.includes("already registered")) return "An account with this email already exists. Try signing in.";
  if (code === "weak_password" || msg.includes("password")) return "Choose a stronger password (at least 8 characters).";
  if (status === 429 || code.includes("rate_limit")) return "Too many attempts. Please wait a moment and try again.";
  return "Something went wrong. Please try again.";
}

async function call(path: string, init: RequestInit & { query?: Record<string, string>; bearer?: string }, fetcher: typeof fetch = fetch): Promise<Json> {
  const url = new URL(`${SUPABASE_URL}/auth/v1${path}`);
  Object.entries(init.query ?? {}).forEach(([k, v]) => url.searchParams.set(k, v));
  let res: Response;
  try {
    res = await fetcher(url, {
      method: init.method,
      body: init.body,
      headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json", ...(init.bearer ? { Authorization: `Bearer ${init.bearer}` } : {}) },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new AuthError("Can't reach the sign-in service. Check your connection and try again.");
  }
  let body: Json = {};
  try {
    const text = await res.text();
    body = text ? (JSON.parse(text) as Json) : {};
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) throw new AuthError(friendly(res.status, body));
  return body;
}

export function toSession(b: Json): Session | null {
  const user = b.user as Json | undefined;
  if (typeof b.access_token !== "string" || typeof b.refresh_token !== "string" || !user) return null;
  const meta = (user.user_metadata as Json | undefined) ?? {};
  return {
    accessToken: b.access_token,
    refreshToken: b.refresh_token,
    expiresAt: Date.now() + (Number(b.expires_in) || 3600) * 1000,
    userId: String(user.id),
    email: String(user.email ?? ""),
    displayName: typeof meta.display_name === "string" ? meta.display_name : undefined,
  };
}

export const isExpired = (s: Session) => Date.now() > s.expiresAt - 30_000;

export async function signIn(email: string, password: string): Promise<Session> {
  const b = await call("/token", { method: "POST", query: { grant_type: "password" }, body: JSON.stringify({ email: email.trim(), password }) });
  return toSession(b) ?? Promise.reject(new AuthError("Sign-in failed. Please try again."));
}

export async function signUp(email: string, password: string, displayName: string): Promise<{ session: Session | null }> {
  const b = await call("/signup", { method: "POST", body: JSON.stringify({ email: email.trim(), password, data: { display_name: displayName.trim() } }) });
  return { session: toSession(b) };
}

export async function refresh(refreshToken: string): Promise<Session> {
  const b = await call("/token", { method: "POST", query: { grant_type: "refresh_token" }, body: JSON.stringify({ refresh_token: refreshToken }) });
  return toSession(b) ?? Promise.reject(new AuthError("Your session has expired. Please sign in again."));
}

export const recover = (email: string) => call("/recover", { method: "POST", body: JSON.stringify({ email: email.trim() }) });

export async function signOutRemote(accessToken: string) {
  try {
    await call("/logout", { method: "POST", bearer: accessToken });
  } catch {
    /* local sign-out proceeds regardless */
  }
}

export const updateDisplayName = (accessToken: string, name: string) =>
  call("/user", { method: "PUT", bearer: accessToken, body: JSON.stringify({ data: { display_name: name.trim() } }) });

// ---- shared profile (same row the CashBook app reads) ----
export type Profile = { id: string; email: string | null; display_name: string | null; default_currency: string; timezone: string };

export async function fetchProfile(token: string): Promise<Profile | null> {
  try {
    const r = await fetch(`${API_BASE_URL}/api/v1/profiles/me`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
    return r.ok ? ((await r.json()) as Profile) : null;
  } catch {
    return null;
  }
}

export async function patchProfile(token: string, changes: Partial<Pick<Profile, "display_name" | "default_currency" | "timezone">>): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE_URL}/api/v1/profiles/me`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(changes), signal: AbortSignal.timeout(8000) });
    return r.ok;
  } catch {
    return false;
  }
}

/** 0 (empty) .. 4 (strong). Length is required; variety raises the score. */
export function passwordStrength(p: string): number {
  if (p.length < 8) return p ? 1 : 0;
  let score = 1;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
  if (/\d/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p) || p.length >= 14) score++;
  return score;
}
