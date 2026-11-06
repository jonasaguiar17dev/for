import { Construction } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

import { PageHeader } from "./page-header";

/** Página de módulo planejado: deixa claro o escopo, sem dados simulados. */
export function ComingSoon({ title, description, planned }: { title: string; description: string; planned: string[] }) {
  return (
    <>
      <PageHeader eyebrow="Próxima etapa" title={title} description={description} />
      <Card>
        <CardContent className="flex flex-col gap-6 md:flex-row">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Construction className="size-7 text-primary" />
          </div>
          <div>
            <p className="font-medium">Módulo em preparação</p>
            <p className="mt-1 text-sm text-muted-foreground">
              A estrutura de navegação e permissões já está pronta. As funcionalidades abaixo serão entregues após a
              validação da fundação:
            </p>
            <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              {planned.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
