import { NextResponse } from "next/server";

import { getOrgContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { COMPANY_STATUS_LABELS, CONTRACT_STATUS_LABELS, TAX_REGIME_LABELS } from "@/types/domain";
import { formatCnpj } from "@/utils/cnpj";
import { toCsv } from "@/utils/csv";
import { formatDate } from "@/utils/format";

/** Exporta a carteira de clientes visível ao usuário (RLS aplicado). */
export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const supabase = await createClient();
  const rows = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.rpc("search_companies", {
      p_organization_id: ctx.organization.id,
      p_clients_only: true,
      p_limit: 100,
      p_offset: offset,
    });
    if (error) return NextResponse.json({ error: "Falha ao gerar o relatório" }, { status: 500 });
    rows.push(...(data ?? []));
    if (!data || data.length < 100 || offset > 50_000) break;
  }

  const csv = toCsv(
    ["Razão social", "Nome fantasia", "CNPJ", "Regime tributário", "Responsável", "Situação do cliente", "Situação RFB", "Data de cadastro"],
    rows.map((r) => [
      r.corporate_name,
      r.trade_name,
      formatCnpj(r.cnpj),
      TAX_REGIME_LABELS[r.tax_regime],
      r.responsible_name,
      r.contract_status ? CONTRACT_STATUS_LABELS[r.contract_status] : "",
      COMPANY_STATUS_LABELS[r.company_status],
      formatDate(r.created_at),
    ]),
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clientes-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
