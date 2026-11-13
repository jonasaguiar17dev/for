import { Check, Construction } from "lucide-react";

import { Card } from "@/components/ui/card";

import { PageHeader } from "./page-header";

/** Página de módulo planejado: deixa claro o escopo, sem dados simulados. */
export function ComingSoon({ title, description, planned }: { title: string; description: string; planned: string[] }) {
  return (
    <>
      <PageHeader eyebrow="Próxima etapa" title={title} description={description} />
      <Card className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-brand-red/[0.06] blur-3xl" />
        <div className="relative grid gap-8 p-6 md:grid-cols-[auto_1fr] md:p-8">
          <div className="flex size-12 items-center justify-center rounded-xl border border-border bg-subtle">
            <Construction className="size-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-base font-semibold tracking-tight">Módulo em preparação</p>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              A navegação e as permissões já estão prontas. Estas funcionalidades serão entregues após a validação das etapas atuais:
            </p>
            <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {planned.map((item) => (
                <li key={item} className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-sm">
                  <span className="flex size-5 items-center justify-center rounded-full bg-subtle">
                    <Check className="size-3 text-muted-foreground" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>
    </>
  );
}
