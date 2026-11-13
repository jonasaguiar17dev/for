import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-primary/15 bg-danger-soft text-primary",
        neutral: "border-border bg-neutral-soft text-neutral",
        success: "border-success/15 bg-success-soft text-success",
        warning: "border-warning/20 bg-warning-soft text-warning",
        info: "border-info/15 bg-info-soft text-info",
        danger: "border-danger/15 bg-danger-soft text-danger",
        dark: "border-transparent bg-brand-graphite text-white",
        outline: "border-border-strong bg-card text-foreground",
      },
      dot: { true: "", false: "" },
    },
    defaultVariants: { variant: "default", dot: false },
  },
);

const DOT: Record<string, string> = {
  default: "bg-primary",
  neutral: "bg-faint",
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-info",
  danger: "bg-danger",
  dark: "bg-white",
  outline: "bg-faint",
};

function Badge({
  className,
  variant,
  dot,
  children,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span aria-hidden className={cn("size-1.5 rounded-full", DOT[variant ?? "default"])} />}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
