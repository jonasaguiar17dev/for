import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-brand-graphite p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Logo tone="light" />
        <div className="max-w-md">
          <p className="font-serif text-4xl leading-tight font-semibold">
            Gestão contábil e financeira com <span className="text-brand-red">precisão</span>.
          </p>
          <p className="mt-4 text-sidebar-muted">
            Clientes, contratos, faturamento e escrituração da Aguiar Contabilidade &amp; Gestão em um só ambiente,
            com isolamento de dados por organização e por CNPJ.
          </p>
        </div>
        <p className="text-xs text-sidebar-muted">© {new Date().getFullYear()} Aguiar Contabilidade &amp; Gestão</p>
        <div aria-hidden className="absolute -right-24 -bottom-24 size-96 rounded-full border-[40px] border-brand-red/15" />
      </aside>
      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <Logo className="mb-10 lg:hidden" />
          {children}
        </div>
      </main>
    </div>
  );
}
