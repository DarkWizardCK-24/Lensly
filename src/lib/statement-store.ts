/** Parsed statements for the signed-in user, kept in this browser until Phase 6 persists them via the API. */
import { clearRegistry, registerStatement, unregisterStatement, type Statement } from "./statement";

const prefix = (userId: string | undefined) => `fp_${userId ?? "demo"}_statement_`;

export function saveStatement(userId: string | undefined, reportId: string, st: Statement) {
  registerStatement(reportId, st);
  try {
    localStorage.setItem(prefix(userId) + reportId, JSON.stringify(st));
  } catch {
    /* storage full/unavailable: the statement still works for this session */
  }
}

export function deleteStatement(userId: string | undefined, reportId: string) {
  unregisterStatement(reportId);
  try {
    localStorage.removeItem(prefix(userId) + reportId);
  } catch {
    /* ignore */
  }
}

export function hydrateStatements(userId: string | undefined) {
  clearRegistry();
  const p = prefix(userId);
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(p)) registerStatement(k.slice(p.length), JSON.parse(localStorage.getItem(k) ?? "null") as Statement);
    }
  } catch {
    /* corrupted entries are ignored */
  }
}
