import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "Financeiro" };

export default function FinancePage() {
  return (
    <ComingSoon
      title="Financeiro"
      description="Faturamento de honorários e gestão financeira."
      planned={[
        "Faturamento recorrente a partir dos contratos",
        "Contas a receber e a pagar",
        "Conciliação bancária",
        "Fluxo de caixa por CNPJ",
      ]}
    />
  );
}
