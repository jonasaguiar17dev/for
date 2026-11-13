"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { CommandMenu } from "./command-menu";
import { MobileNav } from "./mobile-nav";
import { sectionFor } from "./nav-items";

const SUB: Record<string, string> = { novo: "Novo", editar: "Editar", servicos: "Catálogo de serviços" };

/** Barra superior: menu móvel, trilha de navegação, busca e usuário. */
export function Topbar({ organizationName, userMenu }: { organizationName: string; userMenu: ReactNode }) {
  const pathname = usePathname();
  const section = sectionFor(pathname);
  const parts = pathname.split("/").filter(Boolean).slice(1);
  const sub = parts.length ? (SUB[parts[parts.length - 1]] ?? (parts.length >= 1 ? "Detalhes" : null)) : null;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6 lg:h-16 lg:px-8">
      <MobileNav organizationName={organizationName} />
      <nav aria-label="Trilha" className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
        {section ? (
          <>
            <Link href={section.href} className={sub ? "truncate text-muted-foreground hover:text-foreground" : "truncate font-medium"}>
              {section.label}
            </Link>
            {sub && (
              <>
                <ChevronRight className="size-3.5 shrink-0 text-faint" />
                <span className="truncate font-medium">{sub}</span>
              </>
            )}
          </>
        ) : (
          <span className="font-medium">Aguiar ERP</span>
        )}
      </nav>
      <div className="flex items-center gap-2">
        <CommandMenu />
        {userMenu}
      </div>
    </header>
  );
}
