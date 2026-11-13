import { cn } from "@/lib/utils";

/** Monograma "A" da Aguiar. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden className={cn("size-8 shrink-0", className)}>
      <rect width="40" height="40" rx="10" fill="#C8102E" />
      <rect width="40" height="20" rx="10" fill="#FFFFFF" fillOpacity="0.06" />
      <path d="M20 8.5 L30.5 31.5 H25.9 L20 17.9 L14.1 31.5 H9.5 Z" fill="#FFFFFF" />
      <rect x="15.4" y="24.1" width="9.2" height="2.8" rx="1" fill="#F5F0E8" />
    </svg>
  );
}

export function Logo({
  className,
  tone = "dark",
  compact = false,
}: {
  className?: string;
  tone?: "dark" | "light";
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      {!compact && (
        <div className="min-w-0 leading-none">
          <p
            className={cn(
              "flex items-center gap-1.5 text-[16px] font-bold tracking-[0.02em] uppercase",
              tone === "light" ? "text-white" : "text-brand-graphite",
            )}
          >
            Aguiar <span className="text-brand-red">ERP</span>
          </p>
          <p
            className={cn(
              "mt-1 truncate text-[9.5px] tracking-[0.14em] uppercase",
              tone === "light" ? "text-sidebar-muted" : "text-muted-foreground",
            )}
          >
            Contabilidade &amp; Gestão
          </p>
        </div>
      )}
    </div>
  );
}
