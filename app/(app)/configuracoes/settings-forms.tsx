"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { formatPhone } from "@/utils/format";

import { updateOrganization, updateProfile } from "./actions";

export function OrganizationForm({ name, canEdit }: { name: string; canEdit: boolean }) {
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await updateOrganization({ name: value });
          setError(r.ok ? undefined : (r.fieldErrors?.name?.[0] ?? r.error));
          if (r.ok) toast.success(r.message);
        });
      }}
    >
      <FormField id="org-name" label="Nome da organização" error={error}>
        <Input value={value} onChange={(e) => setValue(e.target.value)} disabled={!canEdit || pending} />
      </FormField>
      {canEdit && (
        <div>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />} Salvar
          </Button>
        </div>
      )}
    </form>
  );
}

export function ProfileForm({ fullName, phone }: { fullName: string; phone: string }) {
  const [values, setValues] = useState({ full_name: fullName, phone });
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await updateProfile(values);
          setErrors(r.ok ? {} : (r.fieldErrors ?? {}));
          if (r.ok) toast.success(r.message);
          else toast.error(r.error);
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="profile-name" label="Nome completo" error={errors.full_name?.[0]}>
          <Input value={values.full_name} onChange={(e) => setValues({ ...values, full_name: e.target.value })} />
        </FormField>
        <FormField id="profile-phone" label="Telefone" error={errors.phone?.[0]}>
          <Input
            inputMode="tel"
            value={values.phone}
            onChange={(e) => setValues({ ...values, phone: formatPhone(e.target.value) })}
          />
        </FormField>
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} Salvar perfil
        </Button>
      </div>
    </form>
  );
}
