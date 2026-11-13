# AGUIAR ERP

Plataforma de gestão da **Aguiar Contabilidade & Gestão** — ERP web multiempresa e multiusuário.

Entregas até aqui:

1. **Fundação** — autenticação, controle de permissões, isolamento multiempresa com RLS, dashboard com
   indicadores reais, cadastro/listagem/pesquisa/edição de clientes e empresas, contatos, documentos,
   histórico de alterações e exportação CSV.
2. **Contratos e Financeiro** — catálogo de serviços, contratos com itens e periodicidade, numeração
   automática, faturamento mensal idempotente, contas a receber, registro de pagamentos e indicadores
   financeiros.
3. **Contabilidade** — plano de contas por empresa, lançamentos em partidas dobradas, balancete, DRE,
   balanço patrimonial, razão e fechamento de período com trava no banco.

| Camada | Tecnologia |
| --- | --- |
| Aplicação | Next.js 16 (App Router, Server Actions, `proxy.ts`), React 19, TypeScript |
| Interface | Tailwind CSS 4, componentes no padrão shadcn/ui (Radix), Recharts, lucide-react, fontes Geist |
| Formulários | React Hook Form + Zod (validação no cliente **e** no servidor) |
| Backend | Supabase (PostgreSQL, Auth, Storage) com Row Level Security |
| Testes | Vitest (unitários + integração do banco/RLS em PostgreSQL local) |
| Hospedagem | Vercel + Supabase Cloud |

Documentação complementar:

- [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) — modelo de dados, multiempresa, organização do código.
- [`docs/SEGURANCA.md`](docs/SEGURANCA.md) — papéis, matriz de permissões, RLS, auditoria, documentos.
- [`docs/FUNCIONALIDADES.md`](docs/FUNCIONALIDADES.md) — o que cada tela faz.
- [`docs/DESIGN.md`](docs/DESIGN.md) — design system: tokens, tipografia, componentes e responsividade.

---

## 1. Requisitos

- Node.js **20.9+** (recomendado 22 LTS) e npm.
- Um projeto no **Supabase Cloud** (gratuito para começar).
- Opcional, para os testes de banco: PostgreSQL 15+ local.

## 2. Instalação local

```bash
npm install
cp .env.example .env.local      # preencha com os dados do seu projeto Supabase
npm run dev                     # http://localhost:3000
```

Sem as variáveis do Supabase, a aplicação abre a página **/configuracao-pendente** com as instruções.

### Variáveis de ambiente

| Variável | Onde obter | Observação |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase › Project Settings › API › Project URL | Pública |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase › Project Settings › API Keys › *Publishable key* (ou a antiga *anon key*) | Pública; protegida pelo RLS |
| `NEXT_PUBLIC_SITE_URL` | URL do sistema (ex.: `https://erp.aguiar.com.br`) | Usada no link de recuperação de senha |

> A aplicação **não usa** a chave *secret/service_role*. Se uma chave secreta for configurada por engano, o
> sistema se recusa a iniciar o cliente Supabase.

## 3. Configuração do Supabase

### 3.1 Banco de dados (migrations)

As migrations versionadas estão em `supabase/migrations/` e devem ser aplicadas **em ordem**:

| Arquivo | Conteúdo |
| --- | --- |
| `20261106000100_core_schema.sql` | Tipos, tabelas, índices, unicidades, validação de CNPJ |
| `20261106000200_authorization_and_rls.sql` | Funções de autorização, gatilhos de proteção, privilégios e políticas RLS |
| `20261106000300_audit.sql` | Trilha de auditoria por gatilhos |
| `20261106000400_rpc_functions.sql` | Funções de negócio (criar organização, salvar empresa, pesquisa, dashboard, acessos) |
| `20261106000500_storage.sql` | Bucket privado `client-documents` e políticas do Storage |
| `20261113000100_contracts_finance.sql` | Catálogo de serviços, contratos, itens, contas a receber, faturamento e indicadores financeiros |
| `20261114000100_dashboard_trends.sql` | Indicadores de tendência (novos clientes por mês, vencimentos em 7 dias) — somente leitura |
| `20261115000100_dashboard_series.sql` | Séries mensais do dashboard (saldo, vencido, receita recorrente, adimplência) e próximos vencimentos — somente leitura |
| `20261116000100_accounting.sql` | Contabilidade: plano de contas, lançamentos, partidas, fechamento, balancete e regras de partidas dobradas |

**Opção A — Supabase CLI (recomendado):**

```bash
npx supabase login
npx supabase link --project-ref <ref-do-projeto>
npx supabase db push
```

**Opção B — SQL Editor:** abra Supabase › SQL Editor e execute o conteúdo de cada arquivo, na ordem acima.

> ⚠️ `supabase/tests/supabase_stub.sql` é **somente para testes locais**. Não execute no Supabase Cloud.

### 3.2 Autenticação

1. **Authentication › Sign In / Providers**: mantenha *Email* habilitado e **desative "Allow new users to sign up"**.
   O acesso é somente por convite.
2. **Authentication › URL Configuration**:
   - *Site URL*: a URL de produção (igual a `NEXT_PUBLIC_SITE_URL`).
   - *Redirect URLs*: adicione `http://localhost:3000/**` e `https://<seu-dominio>/**`
     (e, se quiser usar previews, `https://*-<sua-conta>.vercel.app/**`).
3. **Authentication › Emails › Templates** — para que os links funcionem em qualquer navegador, ajuste:
   - **Reset Password**: troque o link por
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/redefinir-senha`
   - **Invite user**: troque o link por
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/auth/redefinir-senha`
     (o convidado define a própria senha no primeiro acesso).
4. Recomendado: **Authentication › Policies/Passwords** — tamanho mínimo 10 e exigência de letras e números;
   em produção, configure um SMTP próprio (Authentication › Emails › SMTP Settings).

### 3.3 Primeiro acesso (organização da Aguiar)

1. Em **Authentication › Users › Invite user**, convide o e-mail do responsável (será o proprietário).
2. Ao aceitar o convite e definir a senha, o usuário é levado a **/onboarding**, onde cadastra a organização
   *Aguiar Contabilidade & Gestão* e o **CNPJ próprio** do escritório (gestão interna).
3. Demais usuários: convide-os pelo Supabase e, em **Configurações › Usuários e permissões**, adicione-os pelo
   e-mail com o papel adequado.

## 4. Scripts

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Ambiente de desenvolvimento |
| `npm run build` / `npm start` | Build e execução de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | Gera tipos de rotas e roda `tsc` |
| `npm test` | Testes unitários (CNPJ, schemas, permissões, formatação, segurança) |
| `npm run test:db` | Testes de integração do banco e do RLS (requer `TEST_DATABASE_URL`) |

### Testes do banco (RLS)

Executam as migrations reais num PostgreSQL **local e descartável** (o banco é recriado a cada execução):

```bash
createdb aguiar_test   # ou crie pelo seu cliente PostgreSQL
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/aguiar_test npm run test:db
```

Cobrem: isolamento entre organizações, papéis (proprietário, contador, leitor, colaborador), membro suspenso,
usuário sem vínculo, imutabilidade da auditoria, proteção do papel de proprietário, validação de CNPJ
(numérico e alfanumérico), duplicidade, pesquisa/paginação e políticas do Storage; e, no financeiro,
numeração de contratos, faturamento por periodicidade sem duplicidade, consistência de pagamentos,
indicadores e isolamento de contratos e cobranças entre organizações; na contabilidade, plano padrão,
numeração, recusa de lançamento desbalanceado, balancete fechando, travas do plano de contas, fechamento
de período (reabertura só pelo proprietário) e leitura sem escrita para leitor e gestor.

## 5. Publicação na Vercel

1. Envie o repositório ao GitHub (já está em `jonasaguiar17dev/for`).
2. Na Vercel: **Add New › Project › Import** o repositório. O *framework preset* é detectado como **Next.js**
   (build `next build`, sem configuração adicional).
3. Em **Settings › Environment Variables**, cadastre para *Production* (e *Preview*, se desejar):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `NEXT_PUBLIC_SITE_URL`
   (com a URL definitiva, ex.: `https://erp.aguiar.com.br`).
   Variáveis `NEXT_PUBLIC_*` entram no build: após alterá-las, faça **Redeploy**.
4. **Deploy**. Depois, em **Settings › Domains**, aponte o domínio próprio.
5. Volte ao Supabase e confira *Site URL* e *Redirect URLs* com o domínio final (item 3.2).
6. Recomendado: escolha na Vercel a mesma região do banco Supabase (Settings › Functions › Region,
   ex.: `gru1` São Paulo) para reduzir latência.

Checklist pós-deploy: login, recuperação de senha (e-mail chega e o link abre a tela de nova senha),
onboarding, cadastro de cliente, pesquisa, edição, envio e download de documento, cadastro de serviço,
contrato, geração de faturamento, registro de pagamento, plano de contas, lançamento contábil e DRE.

## 6. Estrutura do projeto

```
app/                 Rotas (App Router): (auth) login/recuperação, (app) área autenticada, auth/confirm
components/          ui/ (primitivos shadcn), layout/, clients/, dashboard/, brand/
hooks/               Hooks React reutilizáveis
lib/                 supabase/ (clientes server/browser/proxy), auth/ (sessão e contexto), permissions, env
services/            Acesso a dados no servidor (server-only) e consultas públicas (CEP/CNPJ)
schemas/             Schemas Zod compartilhados entre formulários e Server Actions
types/               Tipos de domínio e do banco
utils/               CNPJ, formatação, erros, CSV, redirecionamento seguro
supabase/migrations/ Migrations SQL versionadas
supabase/tests/      Stub do Supabase para testes locais (não aplicar em produção)
tests/               unit/ e db/ (Vitest)
proxy.ts             Renovação de sessão e bloqueio de rotas privadas
```
