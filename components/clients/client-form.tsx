"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormProvider, type Path, useForm } from "react-hook-form";
import { toast } from "sonner";

import { saveClient, saveCompany } from "@/app/(app)/clientes/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  type ClientFormInput,
  type ClientFormValues,
  clientFormSchema,
  companyFormSchema,
} from "@/schemas/company";
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUSES,
  ONBOARDING_STATUS_LABELS,
  ONBOARDING_STATUSES,
} from "@/types/domain";
import { formatPhone } from "@/utils/format";

import { CompanyFields, emptyCompanyValues } from "./company-fields";
import { ContactsFields } from "./contacts-fields";

export const emptyClientFormValues: ClientFormInput = {
  company: emptyCompanyValues,
  client: {
    responsible_name: "",
    email: "",
    phone: "",
    contract_status: "em_implantacao",
    onboarding_status: "nao_iniciado",
    notes: "",
  },
  contacts: [],
};

/**
 * Formulário de cadastro/edição.
 *   mode "client": empresa + dados do cliente + contatos
 *   mode "company": empresa + contatos (ex.: CNPJ interno)
 */
export function ClientForm({
  companyId,
  defaultValues = emptyClientFormValues,
  mode = "client",
  cancelHref,
}: {
  companyId: string | null;
  defaultValues?: ClientFormInput;
  mode?: "client" | "company";
  cancelHref: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const schema = mode === "client" ? clientFormSchema : companyFormSchema;

  const form = useForm<ClientFormInput, unknown, ClientFormValues>({
    // O schema de empresa é um subconjunto do de cliente.
    resolver: zodResolver(schema as typeof clientFormSchema),
    defaultValues,
    mode: "onTouched",
  });
  const errors = form.formState.errors.client;

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result =
        mode === "client" ? await saveClient(companyId, values) : await saveCompany(companyId!, values);
      if (!result.ok) {
        setError(result.error);
        for (const [path, messages] of Object.entries(result.fieldErrors ?? {})) {
          if (messages?.[0]) form.setError(path as Path<ClientFormInput>, { message: messages[0] });
        }
        return;
      }
      toast.success(result.message ?? "Salvo.");
      router.push(`${mode === "client" ? "/clientes" : "/empresas"}/${result.data.id}`);
      router.refresh();
    });
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} className="grid gap-6" noValidate>
        {error && <Alert variant="destructive">{error}</Alert>}

        <Card>
          <CardHeader>
            <CardTitle>Empresa e CNPJ</CardTitle>
            <CardDescription>Dados cadastrais conforme a Receita Federal.</CardDescription>
          </CardHeader>
          <CardContent>
            <CompanyFields disabled={pending} />
          </CardContent>
        </Card>

        {mode === "client" && (
          <Card>
            <CardHeader>
              <CardTitle>Responsável e situação</CardTitle>
              <CardDescription>Relação contratual da empresa com o escritório.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="grid gap-5 md:grid-cols-3">
                <FormField id="client.responsible_name" label="Responsável" required error={errors?.responsible_name?.message}>
                  <Input disabled={pending} {...form.register("client.responsible_name")} />
                </FormField>
                <FormField id="client.email" label="E-mail do responsável" error={errors?.email?.message}>
                  <Input type="email" disabled={pending} {...form.register("client.email")} />
                </FormField>
                <FormField id="client.phone" label="Telefone" error={errors?.phone?.message}>
                  <Input
                    inputMode="tel"
                    disabled={pending}
                    {...form.register("client.phone", {
                      onChange: (e) => form.setValue("client.phone", formatPhone(e.target.value)),
                    })}
                  />
                </FormField>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField id="client.contract_status" label="Situação do cliente" error={errors?.contract_status?.message}>
                  <NativeSelect disabled={pending} {...form.register("client.contract_status")}>
                    {CONTRACT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {CONTRACT_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
                <FormField id="client.onboarding_status" label="Implantação" error={errors?.onboarding_status?.message}>
                  <NativeSelect disabled={pending} {...form.register("client.onboarding_status")}>
                    {ONBOARDING_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {ONBOARDING_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
              </div>
              <FormField id="client.notes" label="Observações" error={errors?.notes?.message}>
                <Textarea disabled={pending} maxLength={2000} {...form.register("client.notes")} />
              </FormField>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Contatos</CardTitle>
            <CardDescription>Pessoas de referência na empresa (financeiro, RH, sócios…).</CardDescription>
          </CardHeader>
          <CardContent>
            <ContactsFields disabled={pending} />
          </CardContent>
        </Card>

        <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
          <Button type="button" variant="ghost" onClick={() => router.push(cancelHref)} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />}
            Salvar
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
