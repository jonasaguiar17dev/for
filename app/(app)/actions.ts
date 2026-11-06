"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ACTIVE_ORG_COOKIE, getMemberships } from "@/lib/auth/session";
import { uuidSchema } from "@/schemas/common";

/** Troca a organização ativa — somente para organizações em que o usuário é membro ativo. */
export async function setActiveOrganization(organizationId: string) {
  const parsed = uuidSchema.safeParse(organizationId);
  if (!parsed.success) return;
  const memberships = await getMemberships();
  if (!memberships.some((m) => m.organization.id === parsed.data)) return;

  (await cookies()).set(ACTIVE_ORG_COOKIE, parsed.data, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/dashboard");
}
