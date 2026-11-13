import Link from "next/link";

import { cn } from "@/lib/utils";

/** Abas de filtro por situação, preservando os demais parâmetros da URL. */
export function StatusTabs({
  basePath,
  param,
  current,
  options,
  keep,
}: {
  basePath: string;
  param: string;
  current?: string;
  options: { value: string; label: string; dot?: string }[];
  keep: Record<string, string | undefined>;
}) {
  const href = (value?: string) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(keep)) if (v && k !== param) p.set(k, v);
    if (value) p.set(param, value);
    return `${basePath}${p.size ? `?${p}` : ""}`;
  };
  const all = [{ value: "", label: "Todas" }, ...options];
  return (
    <nav aria-label="Filtrar por situação" className="scroll-thin -mb-px flex gap-1 overflow-x-auto">
      {all.map((o) => {
        const active = (current ?? "") === o.value;
        return (
          <Link
            key={o.value || "all"}
            href={href(o.value || undefined)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors",
              active ? "bg-brand-graphite text-white shadow-sm" : "text-muted-foreground hover:bg-subtle hover:text-foreground",
            )}
          >
            {"dot" in o && o.dot && <span className="size-1.5 rounded-full" style={{ background: o.dot }} />}
            {o.label}
          </Link>
        );
      })}
    </nav>
  );
}
