import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { signOut } from "@/app/(auth)/actions";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { getMemberships, requireUser } from "@/lib/auth/session";

import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Configuração inicial" };

export default async function OnboardingPage() {
  const user = await requireUser();
  const memberships = await getMemberships();
  if (memberships.length) redirect("/dashboard");

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-center justify-between gap-4">
        <Logo />
        <form action={signOut}>
          <Button variant="ghost" size="sm" type="submit">
            Sair
          </Button>
        </form>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Configuração inicial</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Olá, {user.email}. Você ainda não pertence a nenhuma organização. Se a sua conta deveria ter acesso a um
        ambiente existente, peça a um administrador para incluí-la. Para criar o ambiente da Aguiar, cadastre a
        organização e o CNPJ próprio do escritório — você será o proprietário.
      </p>
      <OnboardingForm />
    </main>
  );
}
