import * as React from "react";

import { cn } from "@/lib/utils";

export const fieldBase =
  "w-full min-w-0 rounded-lg border border-input bg-card text-sm shadow-xs transition-[border-color,box-shadow] duration-150 placeholder:text-faint hover:border-border-strong focus-visible:border-ring/60 focus-visible:ring-[3px] focus-visible:ring-ring/12 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-subtle disabled:opacity-70 aria-invalid:border-danger/60 aria-invalid:ring-danger/10";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        fieldBase,
        "flex h-9 px-3 py-2 file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
