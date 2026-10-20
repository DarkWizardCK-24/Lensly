"use client";

import { Briefcase, Folder, House, Landmark, Users, Wallet } from "lucide-react";
import { useState } from "react";
import { clsx } from "clsx";
import { Modal } from "./modal";
import { BOOK_COLORS, BOOK_ICONS, useReports, type ReportBook } from "@/lib/reports";

export const ICONS = { folder: Folder, wallet: Wallet, briefcase: Briefcase, users: Users, house: House, landmark: Landmark } as const;
export const iconOf = (key: string) => ICONS[key as keyof typeof ICONS] ?? Folder;

const SUGGESTIONS = [
  { name: "Personal accounts", description: "Savings and salary account statements", icon: "wallet" },
  { name: "Business", description: "Current account and card statements", icon: "briefcase" },
  { name: "Joint account", description: "Shared household account", icon: "users" },
  { name: "Home loan", description: "EMI and loan account statements", icon: "house" },
];

/** Create or edit a Report Book — a named group that keeps related statements and reports together. */
export function BookFormModal({ open, onClose, edit, onSaved }: { open: boolean; onClose: () => void; edit?: ReportBook; onSaved?: (b: ReportBook) => void }) {
  return (
    <Modal open={open} onClose={onClose} title={edit ? "Edit Report Book" : "New Report Book"} wide>
      {/* Modal only renders its children while open, so this form's state starts fresh every time. */}
      <BookForm edit={edit} onClose={onClose} onSaved={onSaved} />
    </Modal>
  );
}

function BookForm({ onClose, edit, onSaved }: { onClose: () => void; edit?: ReportBook; onSaved?: (b: ReportBook) => void }) {
  const { books, addBook, updateBook } = useReports();
  const [name, setName] = useState(edit?.name ?? "");
  const [description, setDescription] = useState(edit?.description ?? "");
  const [icon, setIcon] = useState<string>(edit?.icon ?? "folder");
  const [color, setColor] = useState(edit?.color ?? BOOK_COLORS[books.length % BOOK_COLORS.length]);
  const [error, setError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const n = name.trim();
    if (n.length < 2) return setError("Give the book a name (at least 2 characters).");
    if (n.length > 60) return setError("Keep the name under 60 characters.");
    if (books.some((b) => b.id !== edit?.id && b.name.toLowerCase() === n.toLowerCase())) return setError("You already have a Report Book with this name.");
    const data = { name: n, description: description.trim().slice(0, 200), icon, color };
    setBusy(true);
    setError(null);
    if (edit) {
      const err = await updateBook(edit.id, data);
      setBusy(false);
      if (err) return setError(err);
      onSaved?.({ ...edit, ...data });
    } else {
      const res = await addBook(data);
      setBusy(false);
      if (res.error || !res.book) return setError(res.error ?? "Could not create the book.");
      onSaved?.(res.book);
    }
    onClose();
  };

  return (
      <form onSubmit={save} className="space-y-4">
        {!edit && (
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Start from a suggestion</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button type="button" key={s.name} onClick={() => { setName(s.name); setDescription(s.description); setIcon(s.icon); }} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface-muted">{s.name}</button>
              ))}
            </div>
          </div>
        )}
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={60} className="h-12 w-full rounded-2xl border border-border bg-surface px-4 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/40" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Description <span className="font-normal text-muted">(optional)</span></span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} className="h-12 w-full rounded-2xl border border-border bg-surface px-4 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/40" />
        </label>
        <div>
          <p className="mb-2 text-sm font-semibold">Icon</p>
          <div className="flex flex-wrap gap-2">
            {BOOK_ICONS.map((k) => {
              const I = iconOf(k);
              return <button type="button" key={k} onClick={() => setIcon(k)} aria-label={k} aria-pressed={icon === k} className={clsx("grid size-11 place-items-center rounded-xl border transition", icon === k ? "border-brand bg-brand-soft text-brand" : "border-border hover:bg-surface-muted")}><I size={19} /></button>;
            })}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold">Color</p>
          <div className="flex flex-wrap gap-3">
            {BOOK_COLORS.map((c) => <button type="button" key={c} onClick={() => setColor(c)} aria-label={`Color ${c}`} aria-pressed={color === c} className={clsx("size-9 rounded-full ring-offset-2 ring-offset-surface transition", color === c && "ring-2 ring-foreground")} style={{ background: c }} />)}
          </div>
        </div>
        {error && <p role="alert" className="text-sm font-medium text-expense">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-surface-muted">Cancel</button>
          <button type="submit" className="grad-brand rounded-xl px-5 py-2.5 text-sm font-bold text-white">{edit ? "Save changes" : "Create book"}</button>
        </div>
      </form>
  );
}
