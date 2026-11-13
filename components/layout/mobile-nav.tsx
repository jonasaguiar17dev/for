"use client";

import { Menu } from "lucide-react";
import { useState } from "react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

import { SidebarNav } from "./sidebar-nav";

export function MobileNav({ organizationName }: { organizationName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="size-10 rounded-xl lg:hidden" aria-label="Abrir menu">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground" aria-describedby={undefined}>
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <div className="flex h-16 items-center px-4">
          <Logo tone="light" />
        </div>
        <div className="mx-3 mb-3 rounded-lg border border-sidebar-border bg-sidebar-elevated px-3 py-2">
          <p className="text-[10px] tracking-wide text-sidebar-muted uppercase">Empresa atual</p>
          <p className="truncate text-[13px] font-medium text-white">{organizationName}</p>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto px-3 pb-6">
          <SidebarNav onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
