"use client";

import { ListTree, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { setupChart } from "@/app/(app)/contabilidade/actions";
import { Button } from "@/components/ui/button";

export function SetupChartButton({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await setupChart(companyId);
          if (!r.ok) return void toast.error(r.error);
          toast.success(r.message ?? "Plano criado.");
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <ListTree />}
      Criar plano de contas padrão
    </Button>
  );
}
