import { ChevronsUpDown } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

import { fieldBase } from "./input";

/** Select nativo estilizado: acessível, leve e ideal para formulários e mobile. */
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative w-full">
      <select
        data-slot="native-select"
        className={cn(fieldBase, "flex h-9 cursor-pointer appearance-none py-2 pr-8 pl-3", className)}
        {...props}
      >
        {children}
      </select>
      <ChevronsUpDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-faint" />
    </div>
  );
}

export { NativeSelect };
