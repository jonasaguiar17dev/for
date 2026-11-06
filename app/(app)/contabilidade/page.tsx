import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "Contabilidade" };

export default function AccountingPage() {
  return (
    <ComingSoon
      title="Contabilidade"
      description="Escrituração contábil, DRE e Balanço Patrimonial."
      planned={[
        "Plano de contas por empresa",
        "Lançamentos e partidas dobradas",
        "DRE e Balanço Patrimonial",
        "Fechamento de períodos com trava de edição",
      ]}
    />
  );
}
