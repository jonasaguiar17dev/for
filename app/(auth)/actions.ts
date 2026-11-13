"use server";

import { redirect } from "next/navigation";

import { getSiteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { forgotPasswordSchema, loginSchema, resetPasswordSchema } from "@/schemas/auth";
import type { ActionResult } from "@/types/domain";
import { safeRedirectPath } from "@/utils/safe-redirect";
import { fieldErrors } from "@/utils/validation";

export async function signIn(input: unknown, next?: string): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Verifique os campos informados.", fieldErrors: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Mensagem genérica: não revela se o e-mail existe.
    if (error.code === "email_not_confirmed") {
      return { ok: false, error: "E-mail ainda não confirmado. Verifique sua caixa de entrada." };
    }
    if (error.status === 429) {
      return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." };
    }
    return { ok: false, error: "E-mail ou senha inválidos." };
  }

  redirect(safeRedirectPath(next));
}

export async function requestPasswordReset(input: unknown): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Informe um e-mail válido.", fieldErrors: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getSiteUrl()}/auth/confirm?next=/auth/redefinir-senha`,
  });
  if (error?.status === 429) {
    return { ok: false, error: "Muitas solicitações. Aguarde alguns minutos e tente novamente." };
  }

  // Resposta idêntica exista ou não a conta (evita enumeração de usuários).
  return {
    ok: true,
    data: undefined,
    message: "Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.",
  };
}

export async function updatePassword(input: unknown): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Verifique os campos informados.", fieldErrors: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    return { ok: false, error: "Link expirado. Solicite uma nova recuperação de senha." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return { ok: false, error: "A nova senha deve ser diferente da atual." };
    if (error.code === "weak_password") return { ok: false, error: "Senha fraca. Escolha uma senha mais forte." };
    return { ok: false, error: "Não foi possível atualizar a senha." };
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
