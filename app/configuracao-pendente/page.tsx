import { Logo } from "@/components/brand/logo";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Configuração pendente" };

export default function SetupPendingPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <Logo className="mb-8" />
        <Card>
          <CardContent className="space-y-3 text-sm">
            <h1 className="text-lg font-semibold">Integração com o Supabase não configurada</h1>
            <p className="text-muted-foreground">
              Defina as variáveis de ambiente abaixo (em <code>.env.local</code> ou no painel da Vercel) e reinicie a
              aplicação:
            </p>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
              {`NEXT_PUBLIC_SUPABASE_URL=https://<projeto>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<chave publicável>
NEXT_PUBLIC_SITE_URL=https://<seu-dominio>`}
            </pre>
            <p className="text-muted-foreground">Consulte o README para o passo a passo completo.</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
