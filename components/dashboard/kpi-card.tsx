import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

import { AnimatedNumber } from "./animated-number";

export type Tone = "default" | "success" | "danger" | "warning" | "neutral" | "dark";

const ICON_TONE: Record<Tone, string> = {
  default: "bg-subtle text-foreground",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  neutral: "bg-neutral-soft text-neutral",
  dark: "bg-white/10 text-white",
};

/** Variação percentual entre dois períodos; null quando não há base de comparação. */
export function percentChange(current: number, previous: number): number | null {
  if (!previous) return current ? null : 0;
  return ((current - previous) / previous) * 100;
}

export function Delta({
  value,
  positiveIsGood = true,
  label = "vs. mês anterior",
  dark,
}: {
  value: number | null;
  positiveIsGood?: boolean;
  label?: string;
  dark?: boolean;
}) {
  if (value === null) {
    return <span className={cn("text-xs", dark ? "text-sidebar-muted" : "text-muted-foreground")}>Sem base no mês anterior</span>;
  }
  const flat = Math.abs(value) < 0.05;
  const good = flat ? null : value > 0 === positiveIsGood;
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium num",
          good === null && (dark ? "bg-white/10 text-sidebar-foreground" : "bg-neutral-soft text-neutral"),
          good === true && (dark ? "bg-success/25 text-[#86efac]" : "bg-success-soft text-success"),
          good === false && (dark ? "bg-danger/30 text-[#fda4af]" : "bg-danger-soft text-danger"),
        )}
      >
        <Icon className="size-3" />
        {Math.abs(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
      </span>
      <span className={dark ? "text-sidebar-muted" : "text-muted-foreground"}>{label}</span>
    </span>
  );
}

export function KpiCard({
  label,
  value,
  format = "number",
  icon: Icon,
  tone = "default",
  href,
  footer,
  className,
}: {
  label: string;
  value: number;
  format?: "number" | "currency";
  icon: LucideIcon;
  tone?: Tone;
  href?: string;
  footer?: React.ReactNode;
  className?: string;
}) {
  const dark = tone === "dark";
  const body = (
    <div
      className={cn(
        "group relative flex h-full flex-col justify-between gap-4 overflow-hidden rounded-xl border p-4 shadow-sm transition-[box-shadow,border-color,transform] duration-200 sm:p-5",
        dark
          ? "border-brand-graphite bg-brand-graphite text-white"
          : "border-border bg-card hover:border-border-strong",
        href && "hover:-translate-y-px hover:shadow-md",
        !href && className,
      )}
    >
      {dark && (
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-brand-red/25 blur-3xl"
        />
      )}
      <div className="relative flex items-start justify-between gap-3">
        <p className={cn("text-[12.5px] leading-snug font-medium sm:text-[13px]", dark ? "text-sidebar-foreground" : "text-muted-foreground")}>
          {label}
        </p>
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", ICON_TONE[tone])}>
          <Icon className="size-4" />
        </span>
      </div>
      <div className="relative">
        <p
          className={cn(
            "text-[19px] leading-none font-semibold tracking-tight min-[400px]:text-[21px] sm:text-[26px] xl:text-[28px]",
            tone === "danger" && value > 0 && "text-danger",
          )}
        >
          <AnimatedNumber value={value} format={format} />
        </p>
        {footer && <div className="mt-2.5 min-h-5">{footer}</div>}
      </div>
    </div>
  );
  return href ? (
    <Link
      href={href}
      className={cn("block min-w-0 rounded-xl focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none", className)}
    >
      {body}
    </Link>
  ) : (
    body
  );
}
