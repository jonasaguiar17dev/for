"use client";

import { Loader2, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { TAX_REGIME_LABELS, TAX_REGIMES } from "@/types/domain";

/**
 * Pesquisa e filtros sincronizados com a URL (compartilháveis e compatíveis
 * com renderização no servidor).
 */
export function ListFilters({
  statusParam,
  statusLabel,
  statusOptions,
}: {
  statusParam: string;
  statusLabel: string;
  statusOptions: { value: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`));
  }

  const debouncedSearch = useDebouncedCallback((value: string) => update("q", value.trim()));
  const hasFilters = params.has("q") || params.has("regime") || params.has(statusParam);

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center" role="search">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label="Pesquisar por razão social, nome fantasia ou CNPJ"
          placeholder="Pesquisar por nome ou CNPJ…"
          defaultValue={params.get("q") ?? ""}
          onChange={(e) => debouncedSearch(e.target.value)}
          className="pl-9"
          maxLength={100}
        />
        {pending && <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>
      <div className="grid grid-cols-2 gap-3 md:flex">
        <NativeSelect
          aria-label="Filtrar por regime tributário"
          value={params.get("regime") ?? ""}
          onChange={(e) => update("regime", e.target.value)}
          className="md:w-48"
        >
          <option value="">Todos os regimes</option>
          {TAX_REGIMES.map((r) => (
            <option key={r} value={r}>
              {TAX_REGIME_LABELS[r]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label={`Filtrar por ${statusLabel.toLowerCase()}`}
          value={params.get(statusParam) ?? ""}
          onChange={(e) => update(statusParam, e.target.value)}
          className="md:w-44"
        >
          <option value="">{statusLabel}: todas</option>
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => startTransition(() => router.replace(pathname))}
          className="self-start md:self-auto"
        >
          <X /> Limpar
        </Button>
      )}
    </div>
  );
}
