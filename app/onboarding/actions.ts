"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ACTIVE_ORG_COOKIE, getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { toCompanyPayload } from "@/schemas/company";
import { organizationSetupSchema } from "@/schemas/organization";
import type { ActionResult } from "@/types/domain";
import { friendlyDbError } from "@/utils/errors";
import { fieldErrors } from "@/utils/validation";

export async function createOrganization(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const parsed = organizationSetupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Verifique os campos informados.", fieldErrors: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_organization", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_company: toCompanyPayload(parsed.data.company),
  });
  if (error || !data) return { ok: false, error: friendlyDbError(error) };

  (await cookies()).set(ACTIVE_ORG_COOKIE, data, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/dashboard");
}
