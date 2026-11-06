import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { DashboardSummary } from "@/types/database";

/** Indicadores reais do dashboard (RPC dashboard_summary, sob RLS). */
export async function getDashboardSummary(organizationId: string): Promise<DashboardSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_summary", { p_organization_id: organizationId });
  if (error) throw new Error("Não foi possível carregar os indicadores.");
  return data as unknown as DashboardSummary;
}
