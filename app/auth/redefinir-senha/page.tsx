import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { getCurrentUser } from "@/lib/auth/session";

import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Nova senha" };

export default async function ResetPasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?erro=link");

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Logo className="mb-10" />
        <h1 className="text-2xl font-semibold tracking-tight">Definir nova senha</h1>
        <p className="mt-2 text-sm text-muted-foreground">Conta: {user.email}</p>
        <ResetPasswordForm />
      </div>
    </main>
  );
}
