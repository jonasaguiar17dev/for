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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
          className="grid gap-4 rounded-lg border border-dashed p-4 sm:grid-cols-[1fr_220px_auto] sm:items-start"
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

      <div className="-mx-5 sm:-mx-6">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Usuário</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => {
              const editable = canManage && m.user_id !== actorId && (m.role !== "owner" || actorRole === "owner");
              return (
                <TableRow key={m.id}>
                  <TableCell>
                    <p className="font-medium">{m.profile?.full_name || m.profile?.email || "—"}</p>
                    <p className="text-xs text-muted-foreground">{m.profile?.email}</p>
                  </TableCell>
                  <TableCell>
                    {editable ? (
                      <NativeSelect
                        aria-label="Papel"
                        defaultValue={m.role}
                        disabled={pending}
                        className="h-8 min-w-36"
                        onChange={(e) => run(() => updateMember({ memberId: m.id, role: e.target.value }))}
                      >
                        {ORG_ROLES.filter((r) => canAssignRole(actorRole, r) || r === m.role).map((r) => (
                          <option key={r} value={r}>
                            {ORG_ROLE_LABELS[r]}
                          </option>
                        ))}
                      </NativeSelect>
                    ) : (
                      <Badge variant={m.role === "owner" ? "dark" : "neutral"}>{ORG_ROLE_LABELS[m.role]}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {editable ? (
                      <NativeSelect
                        aria-label="Status"
                        defaultValue={m.status}
                        disabled={pending}
                        className="h-8 min-w-32"
                        onChange={(e) =>
                          run(() => updateMember({ memberId: m.id, status: e.target.value as MemberStatus }))
                        }
                      >
                        {MEMBER_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {MEMBER_STATUS_LABELS[s]}
                          </option>
                        ))}
                      </NativeSelect>
                    ) : (
                      <Badge variant={m.status === "active" ? "success" : "warning"}>{MEMBER_STATUS_LABELS[m.status]}</Badge>
                    )}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      {editable && (
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={pending}
                          aria-label="Remover membro"
                          onClick={() => {
                            if (window.confirm("Remover este usuário da organização?")) run(() => removeMember(m.id));
                          }}
                        >
                          <Trash2 className="text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
