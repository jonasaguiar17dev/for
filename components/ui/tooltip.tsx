"use client";

import { Tooltip as TooltipPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;

/** Dica curta ao passar o mouse / focar. */
function Tooltip({
  content,
  children,
  side = "right",
  disabled,
}: {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  disabled?: boolean;
}) {
  if (disabled) return children;
  return (
    <TooltipPrimitive.Root delayDuration={150}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={8}
          className={cn(
            "popover-anim z-[60] rounded-md bg-brand-graphite px-2 py-1 text-xs font-medium text-white shadow-lg",
          )}
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export { Tooltip, TooltipProvider };
