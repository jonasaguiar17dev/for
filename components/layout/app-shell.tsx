"use client";

import { type ReactNode, useCallback, useState } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { SIDEBAR_COOKIE } from "./constants";
import { Sidebar } from "./sidebar";

/** Estrutura da área autenticada: menu lateral recolhível + conteúdo. */
export function AppShell({
  organizationName,
  initialCollapsed,
  topbar,
  children,
}: {
  organizationName: string;
  initialCollapsed: boolean;
  topbar: ReactNode;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }, []);

  return (
    <TooltipProvider>
      <div
        className={cn(
          "min-h-dvh lg:grid lg:transition-[grid-template-columns] lg:duration-200 lg:ease-out",
          collapsed ? "lg:grid-cols-[68px_minmax(0,1fr)]" : "lg:grid-cols-[248px_minmax(0,1fr)]",
        )}
      >
        <aside className="sticky top-0 hidden h-dvh lg:block" aria-label="Navegação">
          <Sidebar organizationName={organizationName} collapsed={collapsed} onToggle={toggle} />
        </aside>
        <div className="flex min-w-0 flex-col">
          {topbar}
          <main className="enter mx-auto w-full max-w-[1400px] flex-1 px-4 pt-6 pb-16 sm:px-6 lg:px-8 lg:pt-8">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
