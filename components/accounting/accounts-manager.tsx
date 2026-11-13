"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleOff, CirclePlus, Loader2, MoreHorizontal, Pencil, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { type Path, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { deleteAccount, saveAccount, setAccountActive } from "@/app/(app)/contabilidade/actions";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { type AccountInput, accountSchema } from "@/schemas/accounting";
import type { AccountRow } from "@/types/database";
import { ACCOUNT_NATURE_LABELS, ACCOUNT_NATURES, ACCOUNT_TYPE_LABELS, ACCOUNT_TYPES, DEFAULT_NATURE } from "@/types/domain";

type Editing = { id: string | null; values: AccountInput; parent?: string };

/** Sugere o primeiro número livre abaixo da conta superior (ex.: 5.1.1.08). */
function nextChildCode(parent: AccountRow, accounts: AccountRow[]): string {
  const prefix = `${parent.code}.`;
  const level = parent.code.split(".").length;
  const used = new Set(
    accounts.filter((a) => a.code.startsWith(prefix) && a.code.split(".").length === level + 1).map((a) => Number(a.code.split(".").pop())),
  );
  let n = 1;
  while (used.has(n)) n++;
  return prefix + (level >= 3 ? String(n).padStart(2, "0") : String(n));
}

export function AccountsManager({ companyId, accounts, canWrite }: { companyId: string; accounts: AccountRow[]; canWrite: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [pending, startTransition] = useTransition();

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return accounts.filter(
      (a) => (showInactive || a.active) && (!term || a.code.startsWith(term) || a.name.toLowerCase().includes(term)),
    );
  }, [accounts, q, showInactive]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.message ?? "Feito.");
      router.refresh();
    });

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar código ou nome…" className="pl-9" aria-label="Pesquisar contas" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <input type="checkbox" className="accent-primary" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Mostrar inativas
          </label>
          {canWrite && (
            <Button
              size="sm"
              onClick={() =>
                setEditing({ id: null, values: { code: "", name: "", type: "despesa", nature: "devedora", is_analytic: true } })
              }
            >
              <Plus /> Nova conta
            </Button>
          )}
        </div>
      </div>

      <ul className="divide-y divide-border" aria-label="Plano de contas">
        {visible.map((a) => {
          const level = a.code.split(".").length;
          return (
            <li
              key={a.id}
              className={cn("flex items-center gap-3 px-4 py-2.5 sm:px-5", !a.is_analytic && "bg-subtle/50", !a.active && "opacity-60")}
            >
              <div className="flex min-w-0 flex-1 items-baseline gap-3" style={{ paddingLeft: `${Math.min(level - 1, 4) * 14}px` }}>
                <span className="num w-20 shrink-0 font-mono text-[12.5px] text-muted-foreground sm:w-24">{a.code}</span>
                <span className={cn("min-w-0 truncate text-sm", !a.is_analytic && "font-semibold", level === 1 && "uppercase tracking-wide")}>
                  {a.name}
                </span>
              </div>
              <div className="hidden shrink-0 items-center gap-1.5 md:flex">
                <Badge variant="neutral">{ACCOUNT_TYPE_LABELS[a.type]}</Badge>
                <Badge variant={a.nature === "devedora" ? "info" : "warning"}>{ACCOUNT_NATURE_LABELS[a.nature]}</Badge>
                {!a.is_analytic && <Badge variant="outline">Sintética</Badge>}
                {!a.active && <Badge variant="danger">Inativa</Badge>}
              </div>
              {canWrite && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`Ações da conta ${a.code}`} disabled={pending}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {!a.is_analytic && (
                      <DropdownMenuItem
                        onSelect={() =>
                          setEditing({
                            id: null,
                            parent: a.code,
                            values: { code: nextChildCode(a, accounts), name: "", type: a.type, nature: a.nature, is_analytic: true },
                          })
                        }
                      >
                        <CirclePlus /> Nova subconta
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onSelect={() =>
                        setEditing({ id: a.id, values: { code: a.code, name: a.name, type: a.type, nature: a.nature, is_analytic: a.is_analytic } })
                      }
                    >
                      <Pencil /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => run(() => setAccountActive(companyId, a.id, !a.active))}>
                      {a.active ? <CircleOff /> : <RotateCcw />} {a.active ? "Inativar" : "Reativar"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onSelect={() => run(() => deleteAccount(companyId, a.id))}>
                      <Trash2 /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </li>
          );
        })}
        {!visible.length && <li className="px-5 py-10 text-center text-sm text-muted-foreground">Nenhuma conta encontrada.</li>}
      </ul>
      <p className="border-t border-border px-4 py-3 text-[13px] text-muted-foreground sm:px-5">
        {accounts.filter((a) => a.is_analytic && a.active).length} contas analíticas ativas · {accounts.length} contas no total.
        Lançamentos só são feitos em contas analíticas.
      </p>

      {editing && <AccountDialog companyId={companyId} editing={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function AccountDialog({ companyId, editing, onClose }: { companyId: string; editing: Editing; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<AccountInput>({ resolver: zodResolver(accountSchema), defaultValues: editing.values });
  const type = useWatch({ control: form.control, name: "type" });
  const errors = form.formState.errors;
  const isEdit = editing.id !== null;

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const r = await saveAccount(companyId, editing.id, values);
      if (!r.ok) {
        setError(r.error);
        for (const [path, messages] of Object.entries(r.fieldErrors ?? {})) {
          if (messages?.[0]) form.setError(path as Path<AccountInput>, { message: messages[0] });
        }
        return;
      }
      toast.success(r.message ?? "Salvo.");
      onClose();
      router.refresh();
    });
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar conta" : editing.parent ? `Nova subconta de ${editing.parent}` : "Nova conta"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Código, grupo e tipo ficam fixos após a criação para preservar a escrituração."
              : "O código define a hierarquia: a conta superior precisa existir e ser sintética."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {error && <Alert variant="destructive">{error}</Alert>}
          <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
            <FormField id="acc-code" label="Código" required error={errors.code?.message}>
              <Input className="font-mono" disabled={pending || isEdit} {...form.register("code")} />
            </FormField>
            <FormField id="acc-name" label="Nome" required error={errors.name?.message}>
              <Input disabled={pending} maxLength={120} {...form.register("name")} />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="acc-type" label="Grupo" error={errors.type?.message}>
              <NativeSelect
                disabled={pending || isEdit}
                {...form.register("type", {
                  onChange: (e) => form.setValue("nature", DEFAULT_NATURE[e.target.value as keyof typeof DEFAULT_NATURE]),
                })}
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ACCOUNT_TYPE_LABELS[t]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField
              id="acc-nature"
              label="Natureza"
              error={errors.nature?.message}
              hint={DEFAULT_NATURE[type] !== form.getValues("nature") ? "Conta redutora (natureza oposta ao grupo)." : undefined}
            >
              <NativeSelect disabled={pending} {...form.register("nature")}>
                {ACCOUNT_NATURES.map((n) => (
                  <option key={n} value={n}>
                    {ACCOUNT_NATURE_LABELS[n]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          </div>
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" className="mt-0.5 accent-primary" disabled={pending || isEdit} {...form.register("is_analytic")} />
            <span>
              Conta analítica <span className="text-muted-foreground">— recebe lançamentos. Desmarque para criar um agrupador (sintética).</span>
            </span>
          </label>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
