export function Availability({ available, copies }: { available: number; copies: number }) {
  const ok = available > 0;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        ok ? "bg-emerald-50 text-emerald-800" : "bg-crimson-50 text-crimson"
      }`}
    >
      <span className={`size-1.5 rounded-full ${ok ? "bg-emerald-600" : "bg-crimson"}`} aria-hidden="true" />
      {ok ? `Available · ${available} of ${copies}` : "All copies on loan"}
    </span>
  );
}
