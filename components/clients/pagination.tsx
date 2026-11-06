import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  buildHref,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  buildHref: (page: number) => string;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <nav aria-label="Paginação" className="flex flex-col items-center justify-between gap-3 px-1 pt-4 text-sm sm:flex-row">
      <p className="text-muted-foreground">
        {total === 0 ? "Nenhum registro" : `Exibindo ${from}–${to} de ${total.toLocaleString("pt-BR")}`}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Button asChild variant="outline" size="sm">
            <Link href={buildHref(page - 1)} rel="prev">
              <ChevronLeft /> Anterior
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft /> Anterior
          </Button>
        )}
        <span className="px-2 tabular-nums">
          {page} / {pageCount}
        </span>
        {page < pageCount ? (
          <Button asChild variant="outline" size="sm">
            <Link href={buildHref(page + 1)} rel="next">
              Próxima <ChevronRight />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Próxima <ChevronRight />
          </Button>
        )}
      </div>
    </nav>
  );
}

/** Monta a URL preservando os filtros atuais. */
export function pageHref(basePath: string, params: Record<string, string | undefined>, page: number) {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) search.set(k, v);
  if (page > 1) search.set("page", String(page));
  return `${basePath}${search.size ? `?${search}` : ""}`;
}
