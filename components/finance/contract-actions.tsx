"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { changeContractStatus, deleteContract } from "@/app/(app)/contratos/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ContractState } from "@/types/domain";

const NEXT_ACTIONS: Record<ContractState, { to: ContractState; label: string }[]> = {
  rascunho: [{ to: "ativo", label: "Ativar" }],
  ativo: [
    { to: "suspenso", label: "Suspender" },
    { to: "encerrado", label: "Encerrar" },
  ],
  suspenso: [
    { to: "ativo", label: "Reativar" },
    { to: "encerrado", label: "Encerrar" },
  ],
  encerrado: [{ to: "ativo", label: "Reabrir" }],
};

export function ContractActions({
  contractId,
  status,
  canDelete,
}: {
  contractId: string;
  status: ContractState;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <>
      {NEXT_ACTIONS[status].map((a) => (
        <Button
          key={a.to}
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await changeContractStatus(contractId, a.to);
              if (!r.ok) return void toast.error(r.error);
              toast.success(r.message ?? "Atualizado.");
              router.refresh();
            })
          }
        >
          {a.label}
        </Button>
      ))}
      {canDelete && (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="text-destructive">
              <Trash2 /> Excluir
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Excluir contrato</DialogTitle>
              <DialogDescription>
                Remove o contrato e seus itens. As cobranças já geradas continuam no Financeiro, sem vínculo com o
                contrato. Para interromper a cobrança mantendo o histórico, prefira encerrar o contrato.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Cancelar</Button>
              </DialogClose>
              <Button
                variant="destructive"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await deleteContract(contractId);
                    if (r && !r.ok) toast.error(r.error);
                  })
                }
              >
                {pending && <Loader2 className="animate-spin" />}
                Excluir contrato
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
