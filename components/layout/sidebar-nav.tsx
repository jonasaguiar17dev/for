"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import { NAV_ITEMS } from "./nav-items";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Menu principal" className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item, index) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-white",
              active && "bg-sidebar-accent text-white",
            )}
          >
            {active && <span aria-hidden className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand-red" />}
            <span className="w-4 text-[10px] text-sidebar-muted tabular-nums">{index + 1}</span>
            <Icon className={cn("size-4 shrink-0", active ? "text-brand-red" : "text-sidebar-muted group-hover:text-white")} />
            <span className="flex-1">{item.label}</span>
            {item.soon && (
              <span className="rounded-sm border border-sidebar-border px-1.5 py-px text-[9px] tracking-wider text-sidebar-muted uppercase">
                Em breve
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
