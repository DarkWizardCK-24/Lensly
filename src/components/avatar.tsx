export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span aria-hidden className="grad-brand grid shrink-0 place-items-center rounded-full font-extrabold text-white shadow-lg shadow-rose-500/30" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initialsOf(name)}
    </span>
  );
}
