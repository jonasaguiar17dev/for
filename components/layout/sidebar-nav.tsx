"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { NAV_GROUPS } from "./nav-items";

export function SidebarNav({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Menu principal" className="flex flex-col gap-3">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <p
            className={cn(
              "sr-only",
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
                    "group relative flex h-11 items-center gap-3 rounded-xl px-3.5 text-[14px] font-medium text-sidebar-foreground/80 transition-[background-color,color,box-shadow] duration-150 hover:bg-sidebar-accent hover:text-white focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none",
                    active &&
                      "bg-gradient-to-br from-[#d3163a] to-[#a70d26] text-white shadow-[0_8px_20px_-6px_rgb(200_16_46/0.55),inset_0_1px_0_rgb(255_255_255/0.18)] hover:bg-transparent",
                    collapsed && "justify-center px-0",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-[18px] shrink-0 transition-colors",
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
