"use client";

import { Loader2, Search } from "lucide-react";
import { useState } from "react";
import { type FieldErrors, useFormContext } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { companySchema } from "@/schemas/company";
import { lookupCep, lookupCnpj } from "@/services/public-lookup";
import {
  BRAZILIAN_STATES,
  COMPANY_STATUS_LABELS,
  COMPANY_STATUSES,
  TAX_REGIME_LABELS,
  TAX_REGIMES,
} from "@/types/domain";
import { isValidCnpj, normalizeCnpj, formatCnpj } from "@/utils/cnpj";
import { formatCep, formatCnae } from "@/utils/format";

import type { z } from "zod";

type WithCompany = { company: z.input<typeof companySchema> };

/** Campos de empresa/CNPJ reutilizados no onboarding e no cadastro de clientes. */
export function CompanyFields({ disabled }: { disabled?: boolean }) {
  const { register, setValue, getValues, formState } = useFormContext<WithCompany>();
  const errors = (formState.errors.company ?? {}) as FieldErrors<WithCompany["company"]>;
  const [lookingUp, setLookingUp] = useState(false);

  const fill = (path: `company.${string}`, value: string | undefined) => {
    if (value) setValue(path as "company.corporate_name", value, { shouldDirty: true, shouldValidate: true });
  };

  async function handleCnpjLookup() {
    const cnpj = normalizeCnpj(getValues("company.cnpj") ?? "");
    if (!isValidCnpj(cnpj)) {
      toast.error("Informe um CNPJ válido para consultar.");
      return;
    }
    setLookingUp(true);
    const data = await lookupCnpj(cnpj);
    setLookingUp(false);
    if (!data) {
      toast.error("Não foi possível consultar o CNPJ agora. Preencha os dados manualmente.");
      return;
    }
    fill("company.corporate_name", data.corporate_name);
    fill("company.trade_name", data.trade_name);
    fill("company.cnae", formatCnae(data.cnae));
    fill("company.status", data.status);
    fill("company.address.cep", formatCep(data.address.cep));
    fill("company.address.street", data.address.street);
    fill("company.address.number", data.address.number);
    fill("company.address.complement", data.address.complement);
    fill("company.address.district", data.address.district);
    fill("company.address.city", data.address.city);
    fill("company.address.state", data.address.state);
    toast.success("Dados públicos do CNPJ carregados. Confira antes de salvar.");
  }

  async function handleCepBlur(value: string) {
    const data = await lookupCep(value);
    if (!data) return;
    if (!getValues("company.address.street")) fill("company.address.street", data.street);
    if (!getValues("company.address.district")) fill("company.address.district", data.district);
    fill("company.address.city", data.city);
    fill("company.address.state", data.state);
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
        <FormField id="company.cnpj" label="CNPJ" required error={errors.cnpj?.message} hint="Aceita CNPJ numérico ou alfanumérico.">
          <Input
            inputMode="text"
            autoCapitalize="characters"
            placeholder="00.000.000/0000-00"
            maxLength={18}
            disabled={disabled}
            {...register("company.cnpj", {
              onChange: (e) => setValue("company.cnpj", formatCnpj(e.target.value)),
            })}
          />
        </FormField>
        <Button
          type="button"
          variant="outline"
          onClick={handleCnpjLookup}
          disabled={disabled || lookingUp}
          className="sm:mb-6"
        >
          {lookingUp ? <Loader2 className="animate-spin" /> : <Search />}
          Consultar CNPJ
        </Button>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <FormField id="company.corporate_name" label="Razão social" required error={errors.corporate_name?.message}>
          <Input disabled={disabled} {...register("company.corporate_name")} />
        </FormField>
        <FormField id="company.trade_name" label="Nome fantasia" error={errors.trade_name?.message}>
          <Input disabled={disabled} {...register("company.trade_name")} />
        </FormField>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <FormField id="company.tax_regime" label="Regime tributário" required error={errors.tax_regime?.message}>
          <NativeSelect disabled={disabled} {...register("company.tax_regime")}>
            <option value="">Selecione…</option>
            {TAX_REGIMES.map((r) => (
              <option key={r} value={r}>
                {TAX_REGIME_LABELS[r]}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="company.cnae" label="CNAE principal" error={errors.cnae?.message}>
          <Input
            inputMode="numeric"
            placeholder="0000-0/00"
            maxLength={9}
            disabled={disabled}
            {...register("company.cnae", { onChange: (e) => setValue("company.cnae", formatCnae(e.target.value)) })}
          />
        </FormField>
        <FormField id="company.status" label="Situação cadastral (RFB)" error={errors.status?.message}>
          <NativeSelect disabled={disabled} {...register("company.status")}>
            {COMPANY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {COMPANY_STATUS_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="company.state_registration" label="Inscrição estadual" error={errors.state_registration?.message}>
          <Input disabled={disabled} {...register("company.state_registration")} />
        </FormField>
        <FormField
          id="company.municipal_registration"
          label="Inscrição municipal"
          error={errors.municipal_registration?.message}
        >
          <Input disabled={disabled} {...register("company.municipal_registration")} />
        </FormField>
      </div>

      <fieldset className="grid gap-5 rounded-lg border border-dashed p-4">
        <legend className="px-1 text-sm font-semibold">Endereço</legend>
        <div className="grid gap-5 sm:grid-cols-[180px_1fr_120px]">
          <FormField id="company.address.cep" label="CEP" error={errors.address?.cep?.message}>
            <Input
              inputMode="numeric"
              placeholder="00000-000"
              maxLength={9}
              disabled={disabled}
              {...register("company.address.cep", {
                onChange: (e) => setValue("company.address.cep", formatCep(e.target.value)),
                onBlur: (e) => handleCepBlur(e.target.value),
              })}
            />
          </FormField>
          <FormField id="company.address.street" label="Logradouro" error={errors.address?.street?.message}>
            <Input disabled={disabled} {...register("company.address.street")} />
          </FormField>
          <FormField id="company.address.number" label="Número" error={errors.address?.number?.message}>
            <Input disabled={disabled} {...register("company.address.number")} />
          </FormField>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_110px]">
          <FormField id="company.address.complement" label="Complemento" error={errors.address?.complement?.message}>
            <Input disabled={disabled} {...register("company.address.complement")} />
          </FormField>
          <FormField id="company.address.district" label="Bairro" error={errors.address?.district?.message}>
            <Input disabled={disabled} {...register("company.address.district")} />
          </FormField>
          <FormField id="company.address.city" label="Município" error={errors.address?.city?.message}>
            <Input disabled={disabled} {...register("company.address.city")} />
          </FormField>
          <FormField id="company.address.state" label="UF" error={errors.address?.state?.message}>
            <NativeSelect disabled={disabled} {...register("company.address.state")}>
              <option value="">—</option>
              {BRAZILIAN_STATES.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        </div>
      </fieldset>
    </div>
  );
}

export const emptyCompanyValues: WithCompany["company"] = {
  corporate_name: "",
  trade_name: "",
  cnpj: "",
  tax_regime: "" as unknown as WithCompany["company"]["tax_regime"],
  state_registration: "",
  municipal_registration: "",
  cnae: "",
  status: "ativa",
  address: { cep: "", street: "", number: "", complement: "", district: "", city: "", state: "" },
};
