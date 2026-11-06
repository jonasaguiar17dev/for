import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const alertVariants = cva("relative w-full rounded-lg border px-4 py-3 text-sm [&>svg]:mr-2 [&>svg]:inline [&>svg]:size-4", {
  variants: {
    variant: {
      default: "bg-card",
      destructive: "border-destructive/30 bg-destructive/5 text-destructive",
      success: "border-success/30 bg-success/5 text-success",
      info: "border-info/30 bg-info/5 text-info",
    },
  },
  defaultVariants: { variant: "default" },
});

function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

export { Alert };
