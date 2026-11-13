/** Indicador em anel (0–100%). */
export function Ring({ value, color, label, hint, title }: { value: number | null; color: string; label: string; hint: string; title: string }) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const v = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="text-center" title={title}>
      <div className="relative mx-auto size-[84px]">
        <svg viewBox="0 0 84 84" className="size-full -rotate-90" aria-hidden>
          <circle cx="42" cy="42" r={r} fill="none" strokeWidth={8} className="stroke-subtle" />
          <circle
            cx="42"
            cy="42"
            r={r}
            fill="none"
            strokeWidth={8}
            stroke={color}
            strokeLinecap="round"
            strokeDasharray={c.toFixed(1)}
            strokeDashoffset={(c * (1 - v / 100)).toFixed(1)}
            className="transition-[stroke-dashoffset] duration-1000 ease-out"
          />
        </svg>
        <span className="num absolute inset-0 flex items-center justify-center text-base font-bold">
          {value === null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
        </span>
      </div>
      <p className="mt-2 text-[13px] font-medium">{label}</p>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
