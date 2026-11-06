import { MobileNav } from "@/components/layout/mobile-nav";
import { SidebarContents } from "@/components/layout/sidebar";
import { UserMenu } from "@/components/layout/user-menu";
import { requireOrgContext } from "@/lib/auth/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const ctx = await requireOrgContext();

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="sticky top-0 hidden h-dvh lg:block">
        <SidebarContents organizationName={ctx.organization.name} />
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-background/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <MobileNav organizationName={ctx.organization.name} />
            <p className="truncate text-sm text-muted-foreground lg:hidden">{ctx.organization.name}</p>
          </div>
          <UserMenu
            email={ctx.user.email}
            role={ctx.role}
            activeOrgId={ctx.organization.id}
            organizations={ctx.memberships.map((m) => ({ id: m.organization.id, name: m.organization.name }))}
          />
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
