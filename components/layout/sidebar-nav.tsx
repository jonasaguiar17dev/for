"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { NAV_GROUPS } from "./nav-items";

export function SidebarNav({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Menu principal" className="flex flex-col gap-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <p
            className={cn(
              "mb-1 px-3 text-[10.5px] font-medium tracking-[0.08em] text-sidebar-muted/80 uppercase transition-opacity duration-200",
              collapsed && "pointer-events-none h-0 overflow-hidden opacity-0 mb-0",
            )}
          >
            {group.label}
          </p>
          {group.items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Tooltip key={item.href} content={item.soon ? `${item.label} · em breve` : item.label} disabled={!collapsed}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  className={cn(
                    "group relative flex h-9 items-center gap-3 rounded-lg px-3 text-[13.5px] font-medium text-sidebar-foreground/75 transition-colors duration-150 hover:bg-sidebar-accent hover:text-white focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none",
                    active && "bg-sidebar-accent text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]",
                    collapsed && "justify-center px-0",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "absolute top-2 bottom-2 left-0 w-[3px] rounded-r-full bg-brand-red transition-opacity duration-200",
                      active ? "opacity-100" : "opacity-0",
                      collapsed && "-left-2",
                    )}
                  />
                  <Icon
                    className={cn(
                      "size-[17px] shrink-0 transition-colors",
                      active ? "text-white" : "text-sidebar-muted group-hover:text-sidebar-foreground",
                    )}
                    strokeWidth={1.9}
                  />
                  {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                  {!collapsed && item.soon && (
                    <span className="rounded-[5px] border border-sidebar-border px-1.5 py-px text-[9.5px] font-medium tracking-wide whitespace-nowrap text-sidebar-muted uppercase">
                      Em breve
                    </span>
                  )}
                </Link>
              </Tooltip>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
