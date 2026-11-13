"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { type ForgotPasswordInput, forgotPasswordSchema } from "@/schemas/auth";

import { requestPasswordReset } from "../actions";

export function ForgotPasswordForm() {
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await requestPasswordReset(values);
      setFeedback(result.ok ? { ok: true, text: result.message ?? "" } : { ok: false, text: result.error });
    });
  });

  return (
    <form onSubmit={onSubmit} className="mt-8 grid gap-4" noValidate>
      {feedback && <Alert variant={feedback.ok ? "success" : "destructive"}>{feedback.text}</Alert>}
      <FormField id="email" label="E-mail" error={form.formState.errors.email?.message}>
        <Input type="email" autoComplete="email" {...form.register("email")} />
      </FormField>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Enviar link de recuperação
      </Button>
    </form>
  );
}
