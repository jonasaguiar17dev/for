"use client";

import { Loader2, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { deleteEntry } from "@/app/(app)/contabilidade/actions";
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

export function EntryActions({ companyId, entryId, number }: { companyId: string; entryId: string; number: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-1">
      <Button asChild variant="ghost" size="icon" aria-label={`Editar lançamento ${number}`}>
        <Link href={`/contabilidade/${companyId}/lancamentos/${entryId}/editar`}>
          <Pencil />
        </Link>
      </Button>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Excluir lançamento ${number}`}>
            <Trash2 className="text-destructive" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir lançamento nº {number}</DialogTitle>
            <DialogDescription>
              As partidas serão removidas e os saldos recalculados. A exclusão fica registrada no histórico de alterações.
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
                  const r = await deleteEntry(companyId, entryId);
                  if (!r.ok) return void toast.error(r.error);
                  toast.success(r.message ?? "Excluído.");
                  router.refresh();
                })
              }
            >
              {pending ? <Loader2 className="animate-spin" /> : <Trash2 />} Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
