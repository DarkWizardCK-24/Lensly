/** CSV export. Cells that start with = + - @ are prefixed so spreadsheets can't run them as formulas. */
const cell = (v: string | number): string => {
  let s = String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (rows: (string | number)[][]) => rows.map((r) => r.map(cell).join(",")).join("\n");

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const blob = new Blob(["﻿" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/[^\w.-]+/g, "_");
  a.click();
  URL.revokeObjectURL(url);
}

/** Minor units → plain decimal string for exports (no currency symbol, no float math). */
export const minorToDecimal = (m: number) => `${m < 0 ? "-" : ""}${Math.floor(Math.abs(m) / 100)}.${String(Math.abs(m) % 100).padStart(2, "0")}`;
