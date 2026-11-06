"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteCompany } from "@/app/(app)/clientes/actions";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCnpj } from "@/utils/cnpj";

export function DeleteCompanyButton({ companyId, cnpj }: { companyId: string; cnpj: string }) {
  const [confirmText, setConfirmText] = useState("");
  const [pending, startTransition] = useTransition();
  const expected = formatCnpj(cnpj);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="text-destructive">
          <Trash2 /> Excluir
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir empresa</DialogTitle>
          <DialogDescription>
            Remove a empresa, o cadastro de cliente, contatos, acessos e documentos. O histórico de auditoria é
            preservado. Digite o CNPJ <strong className="text-foreground">{expected}</strong> para confirmar.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="confirm-cnpj">CNPJ</Label>
          <Input id="confirm-cnpj" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancelar</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={pending || formatCnpj(confirmText) !== expected}
            onClick={() =>
              startTransition(async () => {
                const result = await deleteCompany(companyId);
                if (result && !result.ok) toast.error(result.error);
              })
            }
          >
            {pending && <Loader2 className="animate-spin" />}
            Excluir definitivamente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
