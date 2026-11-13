import { Building2, ShieldCheck, Wallet } from "lucide-react";

import { Logo } from "@/components/brand/logo";

const FEATURES = [
  { icon: Building2, title: "Multiempresa", text: "Cada CNPJ com seus dados isolados e auditados." },
  { icon: Wallet, title: "Financeiro integrado", text: "Contratos, faturamento e recebimentos em um só lugar." },
  { icon: ShieldCheck, title: "Segurança por padrão", text: "Permissões por papel validadas no próprio banco." },
];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden bg-sidebar p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse at 30% 40%, black 20%, transparent 75%)",
          }}
        />
        <div aria-hidden className="pointer-events-none absolute -top-40 -left-24 size-[28rem] rounded-full bg-brand-red/20 blur-[120px]" />
        <Logo tone="light" className="relative" />
        <div className="relative max-w-md">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-sidebar-foreground">
            <span className="size-1.5 rounded-full bg-brand-red" /> Plataforma Aguiar Contabilidade &amp; Gestão
          </p>
          <h2 className="text-[34px] leading-[1.15] font-semibold tracking-tight xl:text-[40px]">
            A gestão contábil e financeira do escritório, com precisão.
          </h2>
          <ul className="mt-10 grid gap-5">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                  <f.icon className="size-4 text-sidebar-foreground" />
                </span>
                <span>
                  <span className="block text-sm font-medium">{f.title}</span>
                  <span className="block text-sm text-sidebar-muted">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-sidebar-muted">© {new Date().getFullYear()} Aguiar Contabilidade &amp; Gestão</p>
      </aside>
      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="enter w-full max-w-[380px]">
          <Logo className="mb-10 lg:hidden" />
          {children}
        </div>
      </main>
    </div>
  );
}
