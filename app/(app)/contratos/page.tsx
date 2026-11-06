import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "Contratos" };

export default function ContractsPage() {
  return (
    <ComingSoon
      title="Contratos"
      description="Contratos e serviços contratados pelos clientes."
      planned={[
        "Catálogo de serviços e honorários",
        "Contratos por CNPJ com vigência e reajuste",
        "Assinatura e anexos do contrato",
        "Alertas de renovação e encerramento",
      ]}
    />
  );
}
