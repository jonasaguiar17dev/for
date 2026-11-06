"use client";

import { Plus, Trash2 } from "lucide-react";
import { type FieldErrors, useFieldArray, useFormContext } from "react-hook-form";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import type { contactSchema } from "@/schemas/company";
import { formatPhone } from "@/utils/format";

type WithContacts = { contacts: z.input<typeof contactSchema>[] };

export function ContactsFields({ disabled }: { disabled?: boolean }) {
  const { control, register, setValue, formState } = useFormContext<WithContacts>();
  const { fields, append, remove } = useFieldArray({ control, name: "contacts", keyName: "key" });
  const errors = (formState.errors.contacts ?? []) as FieldErrors<WithContacts["contacts"][number]>[];

  return (
    <div className="grid gap-4">
      {fields.length === 0 && (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhum contato adicionado.
        </p>
      )}
      {fields.map((field, index) => (
        <div key={field.key} className="relative grid gap-4 rounded-lg border bg-background/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <input type="hidden" {...register(`contacts.${index}.id`)} />
          <FormField id={`contacts.${index}.name`} label="Nome" required error={errors[index]?.name?.message}>
            <Input disabled={disabled} {...register(`contacts.${index}.name`)} />
          </FormField>
          <FormField id={`contacts.${index}.position`} label="Cargo" error={errors[index]?.position?.message}>
            <Input disabled={disabled} {...register(`contacts.${index}.position`)} />
          </FormField>
          <FormField id={`contacts.${index}.email`} label="E-mail" error={errors[index]?.email?.message}>
            <Input type="email" disabled={disabled} {...register(`contacts.${index}.email`)} />
          </FormField>
          <div className="flex items-end gap-2">
            <FormField
              id={`contacts.${index}.phone`}
              label="Telefone"
              error={errors[index]?.phone?.message}
              className="flex-1"
            >
              <Input
                inputMode="tel"
                disabled={disabled}
                {...register(`contacts.${index}.phone`, {
                  onChange: (e) => setValue(`contacts.${index}.phone`, formatPhone(e.target.value)),
                })}
              />
            </FormField>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              onClick={() => remove(index)}
              aria-label={`Remover contato ${index + 1}`}
              className={errors[index]?.phone ? "mb-6" : ""}
            >
              <Trash2 className="text-destructive" />
            </Button>
          </div>
        </div>
      ))}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || fields.length >= 20}
          onClick={() => append({ id: "", name: "", email: "", phone: "", position: "" })}
        >
          <Plus /> Adicionar contato
        </Button>
      </div>
    </div>
  );
}
