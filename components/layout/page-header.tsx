import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-[12px] font-medium text-muted-foreground">{eyebrow}</div>}
        <h1 className="text-[22px] leading-tight font-semibold tracking-tight break-words sm:text-[26px]">{title}</h1>
        {description && <div className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 md:shrink-0 md:justify-end">{actions}</div>}
    </div>
  );
}
