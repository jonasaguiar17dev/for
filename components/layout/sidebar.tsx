"use client";

import { Building2, ChevronsLeft, ChevronsRight } from "lucide-react";

import { Logo, LogoMark } from "@/components/brand/logo";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { SidebarNav } from "./sidebar-nav";

export function Sidebar({
  organizationName,
  collapsed,
  onToggle,
}: {
  organizationName: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden border-r border-sidebar-border bg-gradient-to-b from-[#171312] to-[#110e0d] text-sidebar-foreground">
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-24 size-80 rounded-full bg-brand-red/25 blur-[90px]" />
      <div className={cn("relative flex h-[72px] shrink-0 items-center px-4", collapsed && "justify-center px-0")}>
        {collapsed ? <LogoMark /> : <Logo tone="light" />}
      </div>

      <div className={cn("relative px-3 pb-4", collapsed && "px-2")}>
        <Tooltip content={organizationName} disabled={!collapsed}>
          <div
            className={cn(
              "flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-2.5",
              collapsed && "justify-center px-0",
            )}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.08] text-white">
              <Building2 className="size-4" />
            </span>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-[10px] tracking-wide text-sidebar-muted uppercase">Empresa atual</p>
                <p className="truncate text-[13px] font-medium text-white" title={organizationName}>
                  {organizationName}
                </p>
              </div>
            )}
          </div>
        </Tooltip>
      </div>

      <div className={cn("scroll-thin relative flex-1 overflow-y-auto px-3 py-1", collapsed && "px-2")}>
        <SidebarNav collapsed={collapsed} />
      </div>

      <div className={cn("relative flex items-center gap-2 border-t border-white/[0.06] px-3 py-3", collapsed && "justify-center px-2")}>
        {!collapsed && <p className="flex-1 truncate font-mono text-[10.5px] text-sidebar-muted">v0.4 · Aguiar ERP</p>}
        <Tooltip content={collapsed ? "Expandir menu" : "Recolher menu"} disabled={false}>
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            className="flex size-8 cursor-pointer items-center justify-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-white focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none"
          >
            {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
