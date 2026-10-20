/**
 * Client-side pre-checks for statement uploads. These improve the experience but are NOT a security
 * boundary: the API re-validates type, size, page count and contents on the server (Phase 5).
 */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export type FileKind = "pdf" | "csv" | "xlsx" | "xls";
export type Check = { ok: true; kind: FileKind; encrypted: boolean } | { ok: false; error: string };

const EXT: Record<string, FileKind> = { pdf: "pdf", csv: "csv", xlsx: "xlsx", xls: "xls" };

function startsWith(b: Uint8Array, sig: number[]) {
  return sig.every((v, i) => b[i] === v);
}

function containsAscii(b: Uint8Array, needle: string): boolean {
  const n = Array.from(needle, (c) => c.charCodeAt(0));
  outer: for (let i = 0; i <= b.length - n.length; i++) {
    for (let j = 0; j < n.length; j++) if (b[i + j] !== n[j]) continue outer;
    return true;
  }
  return false;
}

/** Display-safe file name: strips path separators and control characters. Never used as a storage path. */
export const safeName = (name: string) => name.replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 120);

export async function checkFile(file: File): Promise<Check> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const kind = EXT[ext];
  if (!kind) return { ok: false, error: "Unsupported file type. Use PDF, CSV, XLSX or XLS." };
  if (file.size === 0) return { ok: false, error: "This file is empty." };
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: `Too large (${(file.size / 1048576).toFixed(1)} MB). The limit is ${MAX_FILE_BYTES / 1048576} MB.` };

  const bytes = new Uint8Array(await file.arrayBuffer());
  switch (kind) {
    case "pdf":
      if (!startsWith(bytes.subarray(0, 1024), [0x25, 0x50, 0x44, 0x46]) && !containsAscii(bytes.subarray(0, 1024), "%PDF-")) return { ok: false, error: "This doesn't look like a real PDF." };
      return { ok: true, kind, encrypted: containsAscii(bytes, "/Encrypt") };
    case "xlsx":
      return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])
        ? { ok: true, kind, encrypted: false }
        : startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0])
          ? { ok: true, kind, encrypted: true } // OLE container = password-protected OOXML
          : { ok: false, error: "This doesn't look like a real Excel (.xlsx) file." };
    case "xls":
      return startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0]) ? { ok: true, kind, encrypted: false } : { ok: false, error: "This doesn't look like a real Excel (.xls) file." };
    case "csv": {
      if (bytes.subarray(0, 4096).includes(0)) return { ok: false, error: "This doesn't look like a text CSV file." };
      return { ok: true, kind, encrypted: false };
    }
  }
}

export const formatBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);
