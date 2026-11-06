import { cn } from "@/lib/utils";

/** Monograma "A" estilizado + nome do produto. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden className={cn("size-9", className)}>
      <rect width="40" height="40" rx="9" fill="#C8102E" />
      <path d="M20 8 L31 32 H26.2 L20 17.6 L13.8 32 H9 Z" fill="#FFFFFF" />
      <rect x="15.2" y="24.2" width="9.6" height="3" rx="1" fill="#F5F0E8" />
    </svg>
  );
}

export function Logo({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <LogoMark />
      <div className="leading-none">
        <p
          className={cn(
            "font-serif text-lg font-semibold tracking-[0.18em]",
            tone === "light" ? "text-white" : "text-brand-graphite",
          )}
        >
          AGUIAR <span className="text-brand-red">ERP</span>
        </p>
        <p className={cn("mt-1 text-[10px] tracking-[0.2em] uppercase", tone === "light" ? "text-sidebar-muted" : "text-muted-foreground")}>
          Contabilidade &amp; Gestão
        </p>
      </div>
    </div>
  );
}
