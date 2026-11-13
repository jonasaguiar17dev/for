import {
  BarChart3,
  Building2,
  Calculator,
  FileSignature,
  LayoutDashboard,
  type LucideIcon,
  Settings,
  Users,
  Wallet,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; soon?: boolean; shortcut?: string };
export type NavGroup = { label: string; items: NavItem[] };

/** Módulos agrupados por área de trabalho. A ordem preserva a numeração original (1 a 8). */
export const NAV_GROUPS: NavGroup[] = [
  { label: "Geral", items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, shortcut: "G D" }] },
  {
    label: "Cadastros",
    items: [
      { href: "/clientes", label: "Clientes", icon: Users, shortcut: "G C" },
      { href: "/empresas", label: "Empresas", icon: Building2, shortcut: "G E" },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { href: "/contratos", label: "Contratos", icon: FileSignature, shortcut: "G T" },
      { href: "/financeiro", label: "Financeiro", icon: Wallet, shortcut: "G F" },
    ],
  },
  {
    label: "Contábil",
    items: [
      { href: "/contabilidade", label: "Contabilidade", icon: Calculator, shortcut: "G B" },
      { href: "/relatorios", label: "Relatórios", icon: BarChart3, shortcut: "G R" },
    ],
  },
  { label: "Sistema", items: [{ href: "/configuracoes", label: "Configurações", icon: Settings }] },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** Título da seção a partir do caminho (para a barra superior). */
export function sectionFor(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));
}
