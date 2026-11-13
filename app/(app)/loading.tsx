import { Skeleton } from "@/components/ui/skeleton";

/** Esqueleto exibido enquanto a página carrega os dados no servidor. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Carregando">
      <div className="mb-8 grid gap-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5">
            <div className="flex justify-between">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="size-8 rounded-lg" />
            </div>
            <Skeleton className="mt-6 h-7 w-20" />
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 xl:col-span-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-6 h-56 w-full" />
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="mt-5 h-6 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
