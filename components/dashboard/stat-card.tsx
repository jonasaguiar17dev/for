import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  href,
  emphasis,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  href?: string;
  emphasis?: boolean;
}) {
  const body = (
    <Card
      className={cn(
        "h-full p-5 transition-shadow",
        href && "hover:shadow-md",
        emphasis && "border-brand-graphite bg-brand-graphite text-white",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={cn("text-sm font-medium", emphasis ? "text-sidebar-foreground" : "text-muted-foreground")}>
          {label}
        </p>
        <Icon className={cn("size-4", emphasis ? "text-brand-red" : "text-muted-foreground")} aria-hidden />
      </div>
      <p className="mt-3 font-serif text-4xl font-semibold tabular-nums">{value.toLocaleString("pt-BR")}</p>
    </Card>
  );
  return href ? (
    <Link href={href} className="rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
      {body}
    </Link>
  ) : (
    body
  );
}
