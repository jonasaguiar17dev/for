import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative flex w-full items-start gap-2 rounded-lg border px-3.5 py-3 text-sm [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-border bg-card",
        destructive: "border-danger/20 bg-danger-soft text-danger",
        success: "border-success/20 bg-success-soft text-success",
        info: "border-info/20 bg-info-soft text-info",
        warning: "border-warning/25 bg-warning-soft text-warning",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

export { Alert };
