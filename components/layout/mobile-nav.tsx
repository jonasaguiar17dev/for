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
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent className="bg-sidebar text-sidebar-foreground" aria-describedby={undefined}>
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <div className="px-5 pt-6 pb-4">
          <Logo tone="light" />
          <p className="mt-4 truncate text-xs text-sidebar-muted">{organizationName}</p>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-6">
          <SidebarNav onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
