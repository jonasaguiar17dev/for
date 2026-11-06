import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido")),
  password: z.string().min(1, "Informe a senha"),
});
export type LoginInput = z.input<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido")),
});
export type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>;

/** Política mínima de senha (complementa a configuração do Supabase Auth). */
export const passwordSchema = z
  .string()
  .min(10, "A senha deve ter ao menos 10 caracteres")
  .max(72, "A senha deve ter no máximo 72 caracteres")
  .regex(/[a-z]/, "Inclua ao menos uma letra minúscula")
  .regex(/[A-Z]/, "Inclua ao menos uma letra maiúscula")
  .regex(/[0-9]/, "Inclua ao menos um número");

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
  });
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;
