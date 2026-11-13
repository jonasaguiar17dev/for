import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Estado vazio com ícone, título, descrição e ação opcional. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-6 py-14 text-center", className)}>
      <div className="relative">
        <div className="absolute inset-0 -z-10 scale-150 rounded-full bg-subtle blur-xl" />
        <div className="flex size-11 items-center justify-center rounded-xl border border-border bg-card shadow-sm">
          <Icon className="size-5 text-muted-foreground" />
        </div>
      </div>
      <div className="max-w-sm">
        <p className="text-sm font-semibold">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
