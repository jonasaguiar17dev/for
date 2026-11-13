"use client";

import { Loader2, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";

type SelectFilter = { param: string; label: string; allLabel: string; options: { value: string; label: string }[] };

/** Pesquisa + filtros sincronizados com a URL (genérico). */
export function SearchFilters({
  placeholder,
  selects = [],
  monthParam,
}: {
  placeholder: string;
  selects?: SelectFilter[];
  monthParam?: { param: string; label: string };
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
    startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  }
  const debounced = useDebouncedCallback((v: string) => update("q", v.trim()));
  const managed = ["q", ...selects.map((s) => s.param), ...(monthParam ? [monthParam.param] : [])];
  const active = managed.some((k) => params.has(k));

  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center" role="search">
      <div className="relative min-w-0 flex-1 sm:min-w-64">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
        <Input
          type="search"
          aria-label={placeholder}
          placeholder={placeholder}
          defaultValue={params.get("q") ?? ""}
          onChange={(e) => debounced(e.target.value)}
          className="pl-9"
          maxLength={100}
        />
        {pending && <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>
      {(monthParam || selects.length > 0) && (
        <div className="grid grid-cols-2 gap-2.5 sm:flex">
          {monthParam && (
            <Input
              type="month"
              aria-label={monthParam.label}
              title={monthParam.label}
              value={params.get(monthParam.param) ?? ""}
              onChange={(e) => update(monthParam.param, e.target.value)}
              className="sm:w-44"
            />
          )}
          {selects.map((s) => (
            <NativeSelect
              key={s.param}
              aria-label={s.label}
              value={params.get(s.param) ?? ""}
              onChange={(e) => update(s.param, e.target.value)}
              className="sm:w-48"
            >
              <option value="">{s.allLabel}</option>
              {s.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          ))}
        </div>
      )}
      {active && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start sm:self-auto"
          onClick={() => {
            const next = new URLSearchParams(params.toString());
            managed.forEach((k) => next.delete(k));
            next.delete("page");
            startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
          }}
        >
          <X /> Limpar
        </Button>
      )}
    </div>
  );
}
