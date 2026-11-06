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

export type NavItem = { href: string; label: string; icon: LucideIcon; soon?: boolean };

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/empresas", label: "Empresas", icon: Building2 },
  { href: "/contratos", label: "Contratos", icon: FileSignature, soon: true },
  { href: "/financeiro", label: "Financeiro", icon: Wallet, soon: true },
  { href: "/contabilidade", label: "Contabilidade", icon: Calculator, soon: true },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];
