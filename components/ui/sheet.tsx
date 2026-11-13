"use client";

import { XIcon } from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetTitle = SheetPrimitive.Title;

/** Painel lateral (menu mobile). */
function SheetContent({ className, children, ...props }: React.ComponentProps<typeof SheetPrimitive.Content>) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="overlay-anim fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px]" />
      <SheetPrimitive.Content
        className={cn("sheet-anim fixed inset-y-0 left-0 z-50 flex h-full w-[min(18rem,86vw)] flex-col shadow-2xl", className)}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="absolute top-4 right-3 rounded-md p-1.5 text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-white">
          <XIcon className="size-4" />
          <span className="sr-only">Fechar menu</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

export { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger };
