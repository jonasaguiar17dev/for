"use client";

import { Building, Check, ChevronDown, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";

import { setActiveOrganization } from "@/app/(app)/actions";
import { signOut } from "@/app/(auth)/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ORG_ROLE_LABELS, type OrgRole } from "@/types/domain";

type Props = {
  email: string;
  role: OrgRole;
  activeOrgId: string;
  organizations: { id: string; name: string }[];
};

export function UserMenu({ email, role, activeOrgId, organizations }: Props) {
  const [pending, startTransition] = useTransition();
  const initials = email.slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex cursor-pointer items-center gap-2 rounded-lg p-1 pr-1.5 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/30 sm:pr-2"
        aria-label="Menu do usuário"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-[#2b2724] to-brand-graphite text-xs font-semibold text-white ring-2 ring-white">
          {initials}
        </span>
        <span className="hidden text-left lg:block">
          <span className="block max-w-44 truncate text-[13px] leading-tight font-medium">{email}</span>
          <span className="block text-[11px] leading-tight text-muted-foreground">{ORG_ROLE_LABELS[role]}</span>
        </span>
        <ChevronDown className="hidden size-3.5 text-muted-foreground lg:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <span className="block truncate font-medium text-foreground">{email}</span>
          <span>{ORG_ROLE_LABELS[role]}</span>
        </DropdownMenuLabel>
        {organizations.length > 1 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Trocar organização</DropdownMenuLabel>
            {organizations.map((org) => (
              <DropdownMenuItem key={org.id} disabled={pending} onSelect={() => startTransition(() => setActiveOrganization(org.id))}>
                <Building />
                <span className="flex-1 truncate">{org.name}</span>
                {org.id === activeOrgId && <Check className="!text-primary" />}
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/configuracoes">
            <Settings /> Configurações
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => startTransition(() => signOut())}>
          <LogOut /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
