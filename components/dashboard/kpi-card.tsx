import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

import { Sparkline } from "@/components/charts/sparkline";

import { AnimatedNumber } from "./animated-number";

export type Tone = "default" | "success" | "danger" | "warning" | "neutral" | "dark" | "violet";

const ICON_TONE: Record<Tone, string> = {
  default: "bg-subtle text-foreground",
  success: "bg-success text-white shadow-[0_6px_16px_-6px_rgb(21_128_61/0.5)]",
  danger: "bg-primary text-white shadow-[0_6px_16px_-6px_rgb(200_16_46/0.55)]",
  warning: "bg-[#d97706] text-white shadow-[0_6px_16px_-6px_rgb(217_119_6/0.5)]",
  neutral: "bg-[#ede8e1] text-foreground",
  dark: "border border-white/10 bg-white/[0.08] text-white",
  violet: "bg-[#ede9fe] text-[#6d28d9]",
};

const CARD_TONE: Record<Tone, string> = {
  default: "bg-card",
  success: "bg-[linear-gradient(160deg,#fff_40%,#eefbf3_100%)]",
  danger: "bg-[linear-gradient(160deg,#fff_40%,#fff1f3_100%)]",
  warning: "bg-[linear-gradient(160deg,#fff_40%,#fff8ea_100%)]",
  neutral: "bg-[linear-gradient(160deg,#fff_40%,#f6f3ef_100%)]",
  dark: "",
  violet: "bg-[linear-gradient(160deg,#fff_40%,#f3f0ff_100%)]",
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
  spark,
  sparkColor = "#C8102E",
}: {
  label: string;
  value: number;
  format?: "number" | "currency";
  icon: LucideIcon;
  tone?: Tone;
  href?: string;
  footer?: React.ReactNode;
  className?: string;
  spark?: number[];
  sparkColor?: string;
}) {
  const dark = tone === "dark";
  const body = (
    <div
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border p-4 shadow-sm transition-[box-shadow,border-color,transform] duration-200 sm:p-5",
        spark && "pb-0 sm:pb-0",
        dark
          ? "border-brand-graphite bg-[radial-gradient(260px_160px_at_100%_100%,rgb(200_16_46/0.28),transparent_70%),linear-gradient(145deg,#26201e,#141110)] text-white"
          : cn("border-border hover:border-border-strong", CARD_TONE[tone]),
        href && "hover:-translate-y-px hover:shadow-md",
        !href && className,
      )}
    >
      <div className="relative flex items-center gap-3">
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full sm:size-11", ICON_TONE[tone])}>
          <Icon className="size-[18px] sm:size-5" />
        </span>
        <p className={cn("text-[13px] leading-snug font-medium sm:text-sm", dark ? "text-white" : "text-foreground")}>{label}</p>
      </div>
      <div className="relative mt-3 flex-1">
        <p
          className={cn(
            "text-[21px] leading-none font-semibold tracking-tight sm:text-[26px]",
            tone === "danger" && value > 0 && "text-danger",
          )}
        >
          <AnimatedNumber value={value} format={format} />
        </p>
        {footer && <div className="mt-2 min-h-5">{footer}</div>}
      </div>
      {spark && <Sparkline values={spark} color={sparkColor} id={label.replace(/\W/g, "")} className="relative mt-1 -mx-4 block h-11 w-[calc(100%+2rem)] max-w-none sm:-mx-5 sm:w-[calc(100%+2.5rem)]" />}
    </div>
  );
  return href ? (
    <Link
      href={href}
      className={cn("block min-w-0 rounded-2xl focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none", className)}
    >
      {body}
    </Link>
  ) : (
    body
  );
}
