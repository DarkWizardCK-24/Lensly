"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as sb from "./supabase-auth";

type Status = "loading" | "signedOut" | "signedIn" | "demo";

type AuthValue = {
  status: Status;
  session: sb.Session | null;
  displayName: string;
  email: string;
  busy: boolean;
  error: string | null;
  info: string | null;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (name: string, email: string, password: string) => Promise<boolean>;
  sendReset: (email: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  enterDemo: () => void;
  updateName: (name: string) => Promise<string | null>;
  getToken: () => Promise<string | null>;
  clearMessages: () => void;
};

const Ctx = createContext<AuthValue | null>(null);
const SESSION_KEY = "fp_session"; // tokens only — passwords are never stored
const DEMO_KEY = "fp_demo";

function readSession(): sb.Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as sb.Session) : null;
  } catch {
    return null;
  }
}
const writeSession = (s: sb.Session | null) => {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable */
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [session, setSession] = useState<sb.Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const sessionRef = useRef<sb.Session | null>(null);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    (async () => {
      if (typeof localStorage !== "undefined" && localStorage.getItem(DEMO_KEY) === "1") return setStatus("demo");
      if (!sb.authConfigured) return setStatus("signedOut");
      let s = readSession();
      if (s && sb.isExpired(s)) {
        try {
          s = await sb.refresh(s.refreshToken);
          writeSession(s);
        } catch {
          writeSession(null);
          s = null;
        }
      }
      sessionRef.current = s; // ready before any child effect asks for a token
      setSession(s);
      setStatus(s ? "signedIn" : "signedOut");
    })();
  }, []);

  const setBoth = (s: sb.Session | null) => {
    sessionRef.current = s;
    setSession(s);
  };

  const begin = () => {
    setBusy(true);
    setError(null);
    setInfo(null);
  };

  const run = useCallback(async (fn: () => Promise<boolean>) => {
    begin();
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof sb.AuthError ? e.message : "Something went wrong. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const signIn = useCallback((email: string, password: string) => run(async () => {
    const s = await sb.signIn(email, password);
    writeSession(s);
    setBoth(s);
    setStatus("signedIn");
    return true;
  }), [run]);

  const signUp = useCallback((name: string, email: string, password: string) => run(async () => {
    const { session: s } = await sb.signUp(email, password, name);
    if (s) {
      writeSession(s);
      setBoth(s);
      setStatus("signedIn");
    } else {
      setInfo(`Account created. Check ${email} for a confirmation link, then sign in.`);
    }
    return true;
  }), [run]);

  const sendReset = useCallback((email: string) => run(async () => {
    await sb.recover(email);
    // Same message whether or not the email exists, so accounts cannot be enumerated.
    setInfo(`If an account exists for ${email}, a reset link is on its way.`);
    return true;
  }), [run]);

  const signOut = useCallback(async () => {
    const s = sessionRef.current;
    if (s) await sb.signOutRemote(s.accessToken);
    writeSession(null);
    try { localStorage.removeItem(DEMO_KEY); } catch { /* ignore */ }
    setBoth(null);
    setStatus("signedOut");
  }, []);

  const enterDemo = useCallback(() => {
    try { localStorage.setItem(DEMO_KEY, "1"); } catch { /* ignore */ }
    setStatus("demo");
  }, []);

  const getToken = useCallback(async () => {
    let s = sessionRef.current;
    if (!s) return null;
    if (sb.isExpired(s)) {
      try {
        s = await sb.refresh(s.refreshToken);
        writeSession(s);
        setBoth(s);
      } catch {
        await signOut();
        return null;
      }
    }
    return s.accessToken;
  }, [signOut]);

  const updateName = useCallback(async (name: string) => {
    const token = await getToken();
    if (!token || !sessionRef.current) return "You are not signed in.";
    try {
      await sb.updateDisplayName(token, name);
    } catch (e) {
      return e instanceof sb.AuthError ? e.message : "Couldn't save your name.";
    }
    const updated = { ...sessionRef.current, displayName: name.trim() };
    writeSession(updated);
    setBoth(updated);
    const ok = await sb.patchProfile(token, { display_name: name.trim() });
    return ok ? null : "Saved to your account, but the shared profile service is unreachable right now.";
  }, [getToken]);

  const value = useMemo<AuthValue>(() => {
    const demo = status === "demo";
    const displayName = demo ? "Guest" : session?.displayName?.trim() || session?.email.split("@")[0] || "";
    return {
      status, session, displayName, email: demo ? "Sample workspace" : session?.email ?? "", busy, error, info,
      configured: sb.authConfigured, signIn, signUp, sendReset, signOut, enterDemo, updateName, getToken,
      clearMessages: () => { setError(null); setInfo(null); },
    };
  }, [status, session, busy, error, info, signIn, signUp, sendReset, signOut, enterDemo, updateName, getToken]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}
