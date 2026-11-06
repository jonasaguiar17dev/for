"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { grantCompanyAccess, revokeCompanyAccess } from "@/app/(app)/clientes/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { type CompanyAccessInput, companyAccessSchema } from "@/schemas/organization";
import type { CompanyAccessEntry } from "@/services/companies";
import { COMPANY_ROLE_LABELS, COMPANY_ROLES } from "@/types/domain";

/** Acessos pontuais (company_members): colaboradores e usuários externos. */
export function CompanyAccessPanel({
  companyId,
  access,
  canManage,
}: {
  companyId: string;
  access: CompanyAccessEntry[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<CompanyAccessInput>({
    resolver: zodResolver(companyAccessSchema),
    defaultValues: { email: "", role: "viewer" },
  });

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await grantCompanyAccess(companyId, values);
      if (!result.ok) return void toast.error(result.error);
      toast.success(result.message ?? "Acesso concedido.");
      form.reset();
      router.refresh();
    }),
  );

  function revoke(id: string) {
    startTransition(async () => {
      const result = await revokeCompanyAccess(companyId, id);
      if (!result.ok) return void toast.error(result.error);
      toast.success(result.message ?? "Acesso removido.");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6">
      <p className="text-sm text-muted-foreground">
        Proprietários, administradores, contadores e leitores da organização já acessam todas as empresas. Use esta
        lista para dar acesso a <strong>colaboradores</strong> restritos ou a usuários do próprio cliente.
      </p>
      {canManage && (
        <form onSubmit={onSubmit} className="grid gap-4 rounded-lg border border-dashed p-4 sm:grid-cols-[1fr_200px_auto] sm:items-start" noValidate>
          <FormField id="access-email" label="E-mail do usuário" error={form.formState.errors.email?.message}>
            <Input type="email" {...form.register("email")} />
          </FormField>
          <FormField id="access-role" label="Acesso" error={form.formState.errors.role?.message}>
            <NativeSelect {...form.register("role")}>
              {COMPANY_ROLES.map((r) => (
                <option key={r} value={r}>
                  {COMPANY_ROLE_LABELS[r]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <Button type="submit" disabled={pending} className="sm:mt-[22px]">
            {pending ? <Loader2 className="animate-spin" /> : <UserPlus />}
            Conceder
          </Button>
        </form>
      )}
      {access.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Nenhum acesso pontual concedido.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {access.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{a.profile?.full_name || a.profile?.email || "Usuário"}</p>
                <p className="truncate text-xs text-muted-foreground">{a.profile?.email}</p>
              </div>
              <Badge variant={a.role === "manager" ? "default" : "neutral"}>{COMPANY_ROLE_LABELS[a.role]}</Badge>
              {canManage && (
                <Button variant="ghost" size="icon" onClick={() => revoke(a.id)} disabled={pending} aria-label="Remover acesso">
                  <Trash2 className="text-destructive" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
