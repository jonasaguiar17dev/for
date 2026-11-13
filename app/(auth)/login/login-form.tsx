"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { type LoginInput, loginSchema } from "@/schemas/auth";

import { signIn } from "../actions";

export function LoginForm({ next, linkError }: { next?: string; linkError?: boolean }) {
  const [error, setError] = useState<string | null>(
    linkError ? "Link inválido ou expirado. Solicite um novo." : null,
  );
  const [pending, startTransition] = useTransition();
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await signIn(values, next);
      if (result && !result.ok) setError(result.error);
    });
  });

  return (
    <form onSubmit={onSubmit} className="mt-8 grid gap-4" noValidate>
      {error && <Alert variant="destructive">{error}</Alert>}
      <FormField id="email" label="E-mail" error={form.formState.errors.email?.message}>
        <Input type="email" autoComplete="email" placeholder="voce@empresa.com.br" {...form.register("email")} />
      </FormField>
      <FormField id="password" label="Senha" error={form.formState.errors.password?.message}>
        <Input type="password" autoComplete="current-password" {...form.register("password")} />
      </FormField>
      <div className="-mt-2 text-right">
        <Link href="/recuperar-senha" className="text-sm font-medium text-primary hover:underline">
          Esqueci minha senha
        </Link>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Entrar
      </Button>
    </form>
  );
}
