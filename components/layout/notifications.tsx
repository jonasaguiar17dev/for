"use client";

import { Bell } from "lucide-react";
import Link from "next/link";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatISODate, todayISO } from "@/utils/dates";
import { formatBRL } from "@/utils/money";
import { dueHint, receivableState } from "@/utils/receivable-state";

export type AttentionItem = {
  id: string;
  company_id: string;
  corporate_name: string;
  description: string;
  due_date: string;
  amount: number;
};

/** Sino com as cobranças vencidas e as que vencem em até 7 dias (dados reais, sob RLS). */
export function Notifications({ total, items }: { total: number; items: AttentionItem[] }) {
  const today = todayISO();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Notificações: ${total}`}
        className="relative flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-xs outline-none transition-colors hover:bg-subtle focus-visible:ring-2 focus-visible:ring-ring/30"
      >
        <Bell className="size-[18px]" />
        {total > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10.5px] font-semibold text-white ring-2 ring-background">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-1.5rem))] p-0">
        <DropdownMenuLabel className="px-3.5 py-3 text-[13px] font-semibold text-foreground">Cobranças que pedem atenção</DropdownMenuLabel>
        <DropdownMenuSeparator className="m-0" />
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma cobrança vencida ou vencendo nos próximos 7 dias.</p>
        ) : (
          <div className="max-h-80 overflow-y-auto p-1">
            {items.map((r) => {
              const overdue = receivableState("aberto", r.due_date, today) === "vencido";
              return (
                <DropdownMenuItem key={r.id} asChild className="items-start gap-3 rounded-lg px-2.5 py-2">
                  <Link href={`/financeiro?status=${overdue ? "vencido" : "vence_em_breve"}`}>
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${overdue ? "bg-danger" : "bg-warning"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.corporate_name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {formatISODate(r.due_date)} · {dueHint(r.due_date, today)}
                      </span>
                    </span>
                    <span className="num shrink-0 font-semibold">{formatBRL(r.amount)}</span>
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </div>
        )}
        {total > items.length && (
          <>
            <DropdownMenuSeparator className="m-0" />
            <DropdownMenuItem asChild className="justify-center rounded-none py-2.5 text-[13px] font-medium text-primary">
              <Link href="/financeiro?status=vencido">Ver todas no Financeiro</Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
