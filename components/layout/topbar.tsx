"use client";

import type { ReactNode } from "react";

import { CommandMenu } from "./command-menu";
import { MobileNav } from "./mobile-nav";

/** Barra superior: menu móvel, busca global, notificações e usuário. */
export function Topbar({
  organizationName,
  notifications,
  userMenu,
}: {
  organizationName: string;
  notifications: ReactNode;
  userMenu: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2.5 bg-background/80 px-4 backdrop-blur-md sm:px-6 lg:h-[72px] lg:px-8">
      <MobileNav organizationName={organizationName} />
      <div className="flex min-w-0 flex-1 items-center justify-end md:justify-start">
        <CommandMenu />
      </div>
      {notifications}
      {userMenu}
    </header>
  );
}
