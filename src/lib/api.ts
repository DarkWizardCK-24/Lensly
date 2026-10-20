/** Authenticated JSON client for the FastAPI backend. Errors keep the server's stable `code` and any details. */
import { API_BASE_URL } from "./supabase-auth";

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number, public details?: Record<string, unknown>) {
    super(message);
  }
}

export async function apiFetch<T = unknown>(token: string, path: string, init: { method?: string; json?: unknown; query?: Record<string, string | undefined> } = {}): Promise<T> {
  const url = new URL(`${API_BASE_URL}/api/v1${path}`);
  for (const [k, v] of Object.entries(init.query ?? {})) if (v !== undefined) url.searchParams.set(k, v);
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? (init.json !== undefined ? "POST" : "GET"),
      headers: { Authorization: `Bearer ${token}`, ...(init.json !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new ApiError("unreachable", "Can't reach the server. Check your connection and try again.", 0);
  }
  if (res.status === 204) return undefined as T;
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) {
    const e = (body as { error?: { code?: string; message?: string; details?: Record<string, unknown> } } | null)?.error;
    throw new ApiError(e?.code ?? "error", e?.message ?? "Something went wrong.", res.status, e?.details);
  }
  return body as T;
}

/** Download a file endpoint (export) and hand it to the browser. */
export async function downloadFile(token: string, path: string, fallbackName: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    let msg = "The export failed.";
    try { msg = (await res.json())?.error?.message ?? msg; } catch { /* ignore */ }
    throw new ApiError("export_failed", msg, res.status);
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
