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
    <nav aria-label="Paginação" className="flex flex-col items-center justify-between gap-3 py-3 text-[13px] sm:flex-row">
      <p className="text-muted-foreground">
        {total === 0 ? (
          "Nenhum registro"
        ) : (
          <>
            <span className="num font-medium text-foreground">
              {from}–{to}
            </span>{" "}
            de <span className="num font-medium text-foreground">{total.toLocaleString("pt-BR")}</span>
          </>
        )}
      </p>
      <div className="flex items-center gap-1.5">
        {page > 1 ? (
          <Button asChild variant="outline" size="sm">
            <Link href={buildHref(page - 1)} rel="prev" scroll={false}>
              <ChevronLeft /> Anterior
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft /> Anterior
          </Button>
        )}
        <span className="num px-2 text-muted-foreground">
          {page} / {pageCount}
        </span>
        {page < pageCount ? (
          <Button asChild variant="outline" size="sm">
            <Link href={buildHref(page + 1)} rel="next" scroll={false}>
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
