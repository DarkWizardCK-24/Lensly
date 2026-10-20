"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./auth";

/**
 * Small persisted state, scoped per user (or "demo"). Phase 4 keeps review edits, recommendation
 * statuses, budgets and import history in this browser; Phase 6/7 move them to the API.
 */
export function useScoped<T>(name: string, initial: T): [T, (u: T | ((p: T) => T)) => void] {
  const { session } = useAuth();
  const key = `fp_${session?.userId ?? "demo"}_${name}`;
  const read = (): T => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  };
  const [state, setState] = useState<T>(read);
  const [loadedKey, setLoadedKey] = useState(key);
  if (loadedKey !== key) {
    setLoadedKey(key);
    setState(read());
  }
  const keyRef = useRef(key);
  useEffect(() => {
    keyRef.current = key;
  }, [key]);

  const set = useCallback((u: T | ((p: T) => T)) => {
    setState((prev) => {
      const next = typeof u === "function" ? (u as (p: T) => T)(prev) : u;
      try { localStorage.setItem(keyRef.current, JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
  }, []);
  return [state, set];
}

/** Read a scoped value outside React (e.g. when comparing several reports at once). */
export function readScoped<T>(userId: string | undefined, name: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`fp_${userId ?? "demo"}_${name}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
