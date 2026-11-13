# Arquitetura — Aguiar ERP

## Visão geral

```
Navegador ──► Vercel (Next.js 16)
               ├─ proxy.ts ............ renova a sessão Supabase e bloqueia rotas privadas
               ├─ Server Components ... leem dados com a sessão do usuário
               ├─ Server Actions ...... validam com Zod, checam permissão e chamam RPC/tabelas
               └─ Route Handlers ...... /auth/confirm, /relatorios/clientes.csv
                       │ (JWT do usuário — nunca service_role)
                       ▼
              Supabase  ├─ Auth (e-mail/senha, convites, recuperação)
                        ├─ PostgREST ─► PostgreSQL com RLS em todas as tabelas
                        └─ Storage (bucket privado, políticas por empresa)
```

Toda consulta usa o token do usuário logado; o PostgreSQL decide o que cada um vê (RLS). A interface e as
Server Actions repetem as checagens apenas para dar respostas rápidas e mensagens claras.

## Modelo multiempresa

| Conceito | Tabela | Observação |
| --- | --- | --- |
| Organização proprietária do ambiente | `organizations` | Ex.: Aguiar Contabilidade & Gestão |
| CNPJs administrados | `companies` | Inclui o CNPJ próprio (`is_internal = true`, um por organização) |
| Usuários | `profiles` (1:1 com `auth.users`) | Criado automaticamente por gatilho |
| Vínculo usuário × organização | `organization_members` | Papel global e status (ativo/convidado/suspenso) |
| Vínculo usuário × empresa | `company_members` | Acesso pontual (colaboradores restritos ou usuários do cliente) |
| Relação comercial | `clients` | 1:1 com a empresa; situação contratual e de implantação |
| Contatos | `client_contacts` | N por empresa |
| Documentos | `client_documents` | Metadados; arquivo no Storage |
| Auditoria | `audit_logs` | Gravada por gatilhos, imutável |
| Catálogo de serviços | `services` | Valor padrão e periodicidade |
| Contratos | `contracts` + `contract_items` | Vigência, vencimento, reajuste e itens |
| Contas a receber | `receivables` | Cobranças por competência; pagamento com data, valor e forma |
| Plano de contas | `accounts` | Por empresa; hierarquia pelo código (`1.1.1.02`), sintética/analítica, natureza |
| Lançamentos | `journal_entries` + `journal_lines` | Número sequencial por empresa; partidas com débito ou crédito |
| Fechamento contábil | `accounting_settings` | `closed_until` por empresa |
| Apuração de tributos | `tax_assessments` | Uma por empresa, competência e regime; entradas, resultado e lançamento gerado |

Regras de integridade relevantes:

- UUID em todas as chaves; FKs com `on delete cascade` dentro da mesma organização.
- `unique (organization_id, cnpj)` — o mesmo CNPJ não se repete numa organização (mas duas organizações
  distintas podem atender o mesmo CNPJ, cada uma com seus dados isolados).
- FK composta `clients (company_id, organization_id) → companies (id, organization_id)`: impossível criar um
  cliente de uma organização apontando para empresa de outra.
- Gatilhos impedem alterar `organization_id`, `company_id` e `user_id` após a criação.
- CNPJ validado no banco (`public.is_valid_cnpj`) — numérico e **alfanumérico** (IN RFB 2.229/2024),
  com a mesma regra em `utils/cnpj.ts`.
- `audit_logs` não possui FK para as entidades: o histórico sobrevive a exclusões.

### Diagrama

```
organizations 1─┬─N organization_members N─1 profiles 1─1 auth.users
                │
                └─N companies 1─┬─1 clients
                                ├─N client_contacts
                                ├─N client_documents ──► storage.objects (client-documents/{org}/{empresa}/…)
                                └─N company_members N─1 profiles
audit_logs (organization_id, company_id, user_id, action, entity, entity_id, changes, created_at)
```

## Funções de banco (RPC)

| Função | Segurança | Uso |
| --- | --- | --- |
| `create_organization(name, slug, company)` | DEFINER, exige usuário autenticado | Onboarding: cria organização, proprietário e CNPJ interno |
| `save_company(org, company_id, company, client?, contacts?)` | INVOKER (RLS aplicado) | Cria/edita empresa + cliente + contatos numa única transação |
| `search_companies(org, busca, regime, situação…, limite, offset)` | INVOKER | Listagem paginada com contagem total |
| `dashboard_summary(org)` | INVOKER | Indicadores reais do dashboard e relatórios |
| `add_organization_member(org, email, papel)` | DEFINER, checa owner/admin | Inclusão de membros |
| `set_company_member(empresa, email, papel)` | DEFINER, checa owner/admin | Acesso pontual a empresas |
| `save_contract(org, contrato, itens)` | INVOKER | Cria/edita contrato e itens; numeração `CT-AAAA-NNNN` com trava por organização |
| `generate_billing(org, competência)` | INVOKER, checa escrita financeira | Gera cobranças dos contratos ativos, sem duplicar |
| `search_receivables(org, …)` | INVOKER | Lista cobranças com situação derivada (a vencer/vencido) |
| `finance_summary(org)` | INVOKER | Indicadores e série de 6 meses |
| `setup_chart_of_accounts(empresa)` | INVOKER | Cria o plano de contas padrão |
| `save_journal_entry(empresa, lançamento, cabeçalho, partidas)` | INVOKER | Cria/edita lançamento com numeração sob trava |
| `trial_balance(empresa, de, até)` | INVOKER | Balancete; base da DRE e do Balanço (`utils/accounting.ts`) |

O cálculo dos tributos (`utils/taxes.ts`) é uma função pura executada no navegador (prévia) e **refeita no
servidor** na gravação — o valor enviado pelo navegador é descartado. As tabelas do Simples estão no
código e cobertas por testes unitários (soma da repartição, faixas, Fator R, teto do ISS, arredondamento).

## Organização do código

- `app/` — somente rotas, layouts e Server Actions (`actions.ts` de cada área).
- `components/ui` — primitivos no padrão shadcn/ui (`components.json` permite usar a CLI do shadcn).
- `components/clients`, `components/dashboard`, `components/layout` — componentes de domínio reutilizáveis.
- `services/` — leitura de dados no servidor (`server-only`), sempre com o cliente Supabase do usuário.
- `schemas/` — Zod compartilhado entre o formulário (React Hook Form) e a Server Action.
- `lib/permissions.ts` — matriz de permissões usada pela interface (espelho das funções do banco).
- `types/database.ts` — tipos do banco; podem ser regenerados com `supabase gen types`.

## Decisões

- **Cache Components desativado**: todas as telas são por usuário e dependem de cookies; a renderização é
  dinâmica e nada sensível é cacheado entre usuários.
- **Escritas via RPC transacional** (`save_company`): empresa, cliente e contatos ficam consistentes mesmo em
  falhas parciais, e o RLS continua valendo (SECURITY INVOKER).
- **Upload direto ao Storage com URL assinada**: evita o limite de 4,5 MB do corpo de requisição na Vercel;
  a URL só é emitida se o usuário tiver permissão de escrita (RLS do Storage).
- **Consultas públicas de CEP (ViaCEP) e CNPJ (BrasilAPI)** no navegador, apenas para pré-preencher o
  formulário; nada é gravado sem validação.
