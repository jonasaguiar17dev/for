import { cookies } from "next/headers";

import { AppShell } from "@/components/layout/app-shell";
import { SIDEBAR_COOKIE } from "@/components/layout/constants";
import { Topbar } from "@/components/layout/topbar";
import { UserMenu } from "@/components/layout/user-menu";
import { requireOrgContext } from "@/lib/auth/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const ctx = await requireOrgContext();
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";

  return (
    <AppShell
      organizationName={ctx.organization.name}
      initialCollapsed={collapsed}
      topbar={
        <Topbar
          organizationName={ctx.organization.name}
          userMenu={
            <UserMenu
              email={ctx.user.email}
              role={ctx.role}
              activeOrgId={ctx.organization.id}
              organizations={ctx.memberships.map((m) => ({ id: m.organization.id, name: m.organization.name }))}
            />
          }
        />
      }
    >
      {children}
    </AppShell>
  );
}
