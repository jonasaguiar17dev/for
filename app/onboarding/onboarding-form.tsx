"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { FormProvider, useForm } from "react-hook-form";
import type { z } from "zod";

import { CompanyFields, emptyCompanyValues } from "@/components/clients/company-fields";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { organizationSetupSchema } from "@/schemas/organization";
import { slugify } from "@/utils/format";

import { createOrganization } from "./actions";

type Input = z.input<typeof organizationSetupSchema>;
type Output = z.output<typeof organizationSetupSchema>;

export function OnboardingForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<Input, unknown, Output>({
    resolver: zodResolver(organizationSetupSchema),
    defaultValues: { name: "Aguiar Contabilidade & Gestão", slug: "aguiar", company: emptyCompanyValues },
  });

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await createOrganization(values);
      if (result && !result.ok) setError(result.error);
    });
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} className="mt-8 grid gap-6" noValidate>
        {error && <Alert variant="destructive">{error}</Alert>}
        <Card>
          <CardHeader>
            <CardTitle>Organização</CardTitle>
            <CardDescription>Ambiente proprietário que administrará os CNPJs dos clientes.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <FormField id="name" label="Nome" required error={form.formState.errors.name?.message}>
              <Input
                {...form.register("name", {
                  onChange: (e) => {
                    if (!form.formState.dirtyFields.slug) form.setValue("slug", slugify(e.target.value));
                  },
                })}
              />
            </FormField>
            <FormField
              id="slug"
              label="Identificador"
              required
              hint="Letras minúsculas, números e hífens."
              error={form.formState.errors.slug?.message}
            >
              <Input {...form.register("slug")} />
            </FormField>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>CNPJ próprio (gestão interna)</CardTitle>
            <CardDescription>Dados cadastrais da própria Aguiar Contabilidade &amp; Gestão.</CardDescription>
          </CardHeader>
          <CardContent>
            <CompanyFields />
          </CardContent>
        </Card>
        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Criar organização
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
