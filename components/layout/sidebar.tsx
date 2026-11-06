import { Logo } from "@/components/brand/logo";

import { SidebarNav } from "./sidebar-nav";

export function SidebarContents({ organizationName }: { organizationName: string }) {
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-5 pt-6 pb-5">
        <Logo tone="light" />
      </div>
      <div className="mx-5 mb-4 rounded-md border border-sidebar-border px-3 py-2">
        <p className="text-[10px] tracking-widest text-sidebar-muted uppercase">Organização</p>
        <p className="truncate text-sm font-medium text-white" title={organizationName}>
          {organizationName}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-3">
        <SidebarNav />
      </div>
      <p className="px-5 py-4 text-[11px] text-sidebar-muted">v0.1 · Fundação</p>
    </div>
  );
}
