"use client";

import { ChevronsLeft, ChevronsRight } from "lucide-react";

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
    <div className="flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className={cn("flex h-16 shrink-0 items-center px-4", collapsed && "justify-center px-0")}>
        {collapsed ? <LogoMark /> : <Logo tone="light" />}
      </div>

      <div className={cn("px-3 pb-3", collapsed && "px-2")}>
        <Tooltip content={organizationName} disabled={!collapsed}>
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-lg border border-sidebar-border bg-sidebar-elevated px-2.5 py-2",
              collapsed && "justify-center px-0",
            )}
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-white/8 text-[11px] font-semibold text-white">
              {organizationName.slice(0, 1).toUpperCase()}
            </span>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-[10px] tracking-wide text-sidebar-muted uppercase">Organização</p>
                <p className="truncate text-[13px] font-medium text-white" title={organizationName}>
                  {organizationName}
                </p>
              </div>
            )}
          </div>
        </Tooltip>
      </div>

      <div className={cn("scroll-thin flex-1 overflow-y-auto px-3 py-2", collapsed && "px-2")}>
        <SidebarNav collapsed={collapsed} />
      </div>

      <div className={cn("flex items-center gap-2 border-t border-sidebar-border px-3 py-3", collapsed && "justify-center px-2")}>
        {!collapsed && <p className="flex-1 truncate font-mono text-[10.5px] text-sidebar-muted">v0.3 · Aguiar ERP</p>}
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
