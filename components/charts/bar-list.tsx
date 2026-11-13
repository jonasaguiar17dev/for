import Link from "next/link";

import { cn } from "@/lib/utils";

export type BarListItem = { label: string; value: number; href?: string; color?: string };

/** Lista com barras proporcionais: leitura rápida de distribuição por categoria. */
export function BarList({ items, emptyText = "Sem dados ainda." }: { items: BarListItem[]; emptyText?: string }) {
  const total = items.reduce((a, i) => a + i.value, 0);
  const max = Math.max(1, ...items.map((i) => i.value));
  if (total === 0) return <p className="py-8 text-center text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <ul className="grid gap-2.5">
      {items.map((i) => {
        const pct = total ? Math.round((i.value / total) * 100) : 0;
        const row = (
          <div className="group grid gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="flex items-center gap-2 truncate text-foreground/85">
                {i.color && <span className="size-2 shrink-0 rounded-full" style={{ background: i.color }} />}
                {i.label}
              </span>
              <span className="num shrink-0 font-medium">
                {i.value.toLocaleString("pt-BR")}
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">{pct}%</span>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-subtle">
              <div
                className="h-full origin-left rounded-full transition-[width] duration-700 ease-out"
                style={{ width: `${(i.value / max) * 100}%`, background: i.color ?? "var(--brand-graphite)" }}
              />
            </div>
          </div>
        );
        return (
          <li key={i.label}>
            {i.href ? (
              <Link href={i.href} className={cn("block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/30")}>
                {row}
              </Link>
            ) : (
              row
            )}
          </li>
        );
      })}
    </ul>
  );
}
