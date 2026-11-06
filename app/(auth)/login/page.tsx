import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, erro } = await searchParams;
  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold">Entrar</h1>
      <p className="mt-2 text-sm text-muted-foreground">Acesse com seu e-mail corporativo e senha.</p>
      <LoginForm next={typeof next === "string" ? next : undefined} linkError={erro === "link"} />
    </div>
  );
}
