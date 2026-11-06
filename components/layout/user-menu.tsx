"use client";

import { Building, Check, LogOut, UserRound } from "lucide-react";
import { useTransition } from "react";

import { signOut } from "@/app/(auth)/actions";
import { setActiveOrganization } from "@/app/(app)/actions";
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
        className="flex items-center gap-2 rounded-full p-0.5 pr-2 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Menu do usuário"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-brand-graphite text-xs font-semibold text-white">
          {initials}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block max-w-48 truncate text-sm leading-tight font-medium">{email}</span>
          <span className="block text-xs leading-tight text-muted-foreground">{ORG_ROLE_LABELS[role]}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-2">
          <UserRound className="size-3.5" /> {email}
        </DropdownMenuLabel>
        {organizations.length > 1 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Trocar organização</DropdownMenuLabel>
            {organizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                disabled={pending}
                onSelect={() => startTransition(() => setActiveOrganization(org.id))}
              >
                <Building />
                <span className="flex-1 truncate">{org.name}</span>
                {org.id === activeOrgId && <Check className="text-primary" />}
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => startTransition(() => signOut())}>
          <LogOut /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
