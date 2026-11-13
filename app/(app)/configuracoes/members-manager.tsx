"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { canAssignRole } from "@/lib/permissions";
import { type AddMemberInput, addMemberSchema } from "@/schemas/organization";
import type { MemberEntry } from "@/services/organization";
import {
  MEMBER_STATUS_LABELS,
  MEMBER_STATUSES,
  ORG_ROLE_LABELS,
  ORG_ROLES,
  type MemberStatus,
  type OrgRole,
} from "@/types/domain";

import { addMember, removeMember, updateMember } from "./actions";

export function MembersManager({
  members,
  actorRole,
  actorId,
  canManage,
}: {
  members: MemberEntry[];
  actorRole: OrgRole;
  actorId: string;
  canManage: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const form = useForm<AddMemberInput>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: { email: "", role: "member" },
  });

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    startTransition(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message ?? "Salvo.");
      else toast.error(r.error);
    });

  const assignable = ORG_ROLES.filter((r) => canAssignRole(actorRole, r));

  return (
    <div className="grid gap-6">
      {canManage && (
        <form
          noValidate
          onSubmit={form.handleSubmit((values) =>
            run(async () => {
              const r = await addMember(values);
              if (r.ok) form.reset();
              return r.ok ? r : { ok: false, error: r.error };
            }),
          )}
          className="grid gap-4 rounded-xl border border-border bg-subtle/50 p-4 sm:grid-cols-[1fr_200px_auto] sm:items-start"
        >
          <FormField id="member-email" label="E-mail do usuário" error={form.formState.errors.email?.message}>
            <Input type="email" {...form.register("email")} />
          </FormField>
          <FormField id="member-role" label="Papel" error={form.formState.errors.role?.message}>
            <NativeSelect {...form.register("role")}>
              {assignable.map((r) => (
                <option key={r} value={r}>
                  {ORG_ROLE_LABELS[r]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <Button type="submit" disabled={pending} className="sm:mt-[22px]">
            {pending ? <Loader2 className="animate-spin" /> : <UserPlus />} Adicionar
          </Button>
        </form>
      )}

      <ul className="-mx-5 divide-y divide-border border-t border-border">
        {members.map((m) => {
          const editable = canManage && m.user_id !== actorId && (m.role !== "owner" || actorRole === "owner");
          const name = m.profile?.full_name || m.profile?.email || "—";
          return (
            <li key={m.id} className="flex flex-col gap-3 px-5 py-3.5 md:flex-row md:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-subtle text-[11px] font-semibold text-muted-foreground">
                  {name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {name}
                    {m.user_id === actorId && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(você)</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{m.profile?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 pl-11 md:pl-0">
                {editable ? (
                  <>
                    <NativeSelect
                      aria-label={`Papel de ${name}`}
                      defaultValue={m.role}
                      disabled={pending}
                      className="h-8 md:w-40"
                      onChange={(e) => run(() => updateMember({ memberId: m.id, role: e.target.value }))}
                    >
                      {ORG_ROLES.filter((r) => canAssignRole(actorRole, r) || r === m.role).map((r) => (
                        <option key={r} value={r}>
                          {ORG_ROLE_LABELS[r]}
                        </option>
                      ))}
                    </NativeSelect>
                    <NativeSelect
                      aria-label={`Status de ${name}`}
                      defaultValue={m.status}
                      disabled={pending}
                      className="h-8 md:w-32"
                      onChange={(e) => run(() => updateMember({ memberId: m.id, status: e.target.value as MemberStatus }))}
                    >
                      {MEMBER_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {MEMBER_STATUS_LABELS[st]}
                        </option>
                      ))}
                    </NativeSelect>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={pending}
                      aria-label={`Remover ${name}`}
                      onClick={() => {
                        if (window.confirm("Remover este usuário da organização?")) run(() => removeMember(m.id));
                      }}
                    >
                      <Trash2 className="text-danger" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Badge variant={m.role === "owner" ? "dark" : "neutral"}>{ORG_ROLE_LABELS[m.role]}</Badge>
                    <Badge dot variant={m.status === "active" ? "success" : "warning"}>
                      {MEMBER_STATUS_LABELS[m.status]}
                    </Badge>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
