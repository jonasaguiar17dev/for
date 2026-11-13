"use client";

import { Loader2, Lock, LockOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setClosedUntil } from "@/app/(app)/contabilidade/actions";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { formatISODate } from "@/utils/dates";

export function ClosingPanel({
  companyId,
  closedUntil,
  suggested,
  canClose,
  canReopen,
}: {
  companyId: string;
  closedUntil: string | null;
  suggested: string;
  canClose: boolean;
  canReopen: boolean;
}) {
  const router = useRouter();
  const [date, setDate] = useState(closedUntil && closedUntil > suggested ? closedUntil : suggested);
  const [pending, startTransition] = useTransition();
  const reopening = Boolean(closedUntil && date < closedUntil);

  const submit = (value: string) =>
    startTransition(async () => {
      const r = await setClosedUntil(companyId, { closed_until: value });
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.message ?? "Atualizado.");
      router.refresh();
    });

  return (
    <div className="grid gap-5 p-4 sm:p-5">
      <div className="flex items-start gap-3 rounded-xl border border-border bg-subtle/50 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card shadow-sm">
          {closedUntil ? <Lock className="size-[18px] text-primary" /> : <LockOpen className="size-[18px] text-muted-foreground" />}
        </span>
        <div className="text-sm">
          <p className="font-semibold">{closedUntil ? `Escrituração fechada até ${formatISODate(closedUntil)}` : "Nenhum período fechado"}</p>
          <p className="mt-0.5 text-muted-foreground">
            Lançamentos com data até o fechamento não podem ser incluídos, alterados ou excluídos — a trava é aplicada pelo banco de dados.
            Reabrir um período é permitido apenas ao proprietário ou administrador e fica registrado no histórico.
          </p>
        </div>
      </div>
      {canClose ? (
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            submit(date);
          }}
        >
          <FormField id="closed_until" label="Fechar escrituração até" className="sm:w-56">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={pending} required />
          </FormField>
          <Button type="submit" disabled={pending || !date || (reopening && !canReopen) || date === closedUntil}>
            {pending ? <Loader2 className="animate-spin" /> : <Lock />}
            {reopening ? "Recuar fechamento" : "Fechar período"}
          </Button>
          {closedUntil && canReopen && (
            <Button type="button" variant="outline" disabled={pending} onClick={() => submit("")}>
              <LockOpen /> Reabrir tudo
            </Button>
          )}
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">Seu papel permite apenas consultar a escrituração.</p>
      )}
      {reopening && !canReopen && (
        <p className="text-sm text-warning">Somente proprietário ou administrador pode recuar a data de fechamento.</p>
      )}
    </div>
  );
}
