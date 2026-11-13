"use client";

import { CornerDownLeft, FilePlus2, Receipt, Search, UserPlus } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { NAV_ITEMS } from "./nav-items";

type Command = { id: string; label: string; group: string; href: string; icon: React.ComponentType<{ className?: string }>; keywords?: string };

const ACTIONS: Command[] = [
  { id: "new-client", label: "Novo cliente", group: "Ações", href: "/clientes/novo", icon: UserPlus, keywords: "cadastrar empresa cnpj" },
  { id: "new-contract", label: "Novo contrato", group: "Ações", href: "/contratos/novo", icon: FilePlus2, keywords: "honorarios servico" },
  { id: "billing", label: "Cobranças vencidas", group: "Ações", href: "/financeiro?status=vencido", icon: Receipt, keywords: "atraso inadimplencia" },
];

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Paleta de comandos (Ctrl/⌘ + K): navegação e ações rápidas pelo teclado. */
export function CommandMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const commands = useMemo<Command[]>(
    () => [
      ...NAV_ITEMS.filter((i) => !i.soon).map((i) => ({ id: i.href, label: i.label, group: "Ir para", href: i.href, icon: i.icon })),
      ...ACTIONS,
    ],
    [],
  );
  const results = useMemo(() => {
    const q = normalize(query.trim());
    return q ? commands.filter((c) => normalize(`${c.label} ${c.keywords ?? ""}`).includes(q)) : commands;
  }, [commands, query]);

  const run = (c: Command) => {
    setOpen(false);
    setQuery("");
    router.push(c.href);
  };

  const groups = [...new Set(results.map((r) => r.group))];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group hidden h-9 w-full max-w-xs cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground shadow-xs transition-colors hover:border-border-strong md:flex"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Buscar ou ir para…</span>
        <kbd className="rounded border border-border bg-subtle px-1.5 font-mono text-[10.5px] text-muted-foreground">Ctrl K</kbd>
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Buscar"
        className="flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-accent md:hidden"
      >
        <Search className="size-[18px]" />
      </button>

      <DialogPrimitive.Root
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setQuery("");
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="overlay-anim fixed inset-0 z-50 bg-brand-graphite/40 backdrop-blur-[2px]" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="popover-anim fixed top-[12vh] left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-card shadow-lg"
          >
            <DialogPrimitive.Title className="sr-only">Buscar ou ir para</DialogPrimitive.Title>
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search className="size-4 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIndex(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setIndex((i) => Math.min(i + 1, results.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setIndex((i) => Math.max(i - 1, 0));
                  } else if (e.key === "Enter" && results[index]) {
                    e.preventDefault();
                    run(results[index]);
                  }
                }}
                placeholder="Digite um módulo ou ação…"
                aria-label="Buscar comando"
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
              />
              <kbd className="rounded border border-border bg-subtle px-1.5 font-mono text-[10.5px] text-muted-foreground">Esc</kbd>
            </div>
            <ul ref={listRef} role="listbox" className="scroll-thin max-h-80 overflow-y-auto p-2">
              {results.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted-foreground">Nada encontrado.</li>}
              {groups.map((g) => (
                <li key={g} role="presentation">
                  <p className="px-2.5 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{g}</p>
                  <ul role="presentation">
                    {results
                      .filter((r) => r.group === g)
                      .map((c) => {
                        const i = results.indexOf(c);
                        const Icon = c.icon;
                        return (
                          <li
                            key={c.id}
                            role="option"
                            aria-selected={i === index}
                            onMouseEnter={() => setIndex(i)}
                            onClick={() => run(c)}
                            className={cn(
                              "flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm",
                              i === index && "bg-accent",
                            )}
                          >
                            <Icon className="size-4 text-muted-foreground" />
                            <span className="flex-1">{c.label}</span>
                            {i === index && <CornerDownLeft className="size-3.5 text-muted-foreground" />}
                          </li>
                        );
                      })}
                  </ul>
                </li>
              ))}
            </ul>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
