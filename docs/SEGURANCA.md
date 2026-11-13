# Segurança e permissões — Aguiar ERP

## Princípios

1. **O banco é a autoridade.** Todas as tabelas têm RLS habilitado; o papel `anon` não tem privilégio algum;
   `authenticated` recebe apenas os privilégios necessários (inclusive por coluna em `profiles` e
   `client_documents`).
2. **Defesa em camadas.** `proxy.ts` bloqueia rotas sem sessão; páginas e Server Actions revalidam sessão,
   organização ativa e permissão; os dados são validados com Zod no servidor; o banco reaplica RLS, CHECKs,
   FKs e gatilhos.
3. **Sem segredos no navegador.** Apenas URL e chave publicável do Supabase são públicas. A aplicação não
   utiliza a chave service_role. `.env*` está no `.gitignore`.
4. **Identidade sempre do token.** Funções usam `auth.uid()`; nenhum identificador de usuário vindo do
   cliente é confiado. A organização ativa (cookie httpOnly) é sempre conferida contra os vínculos reais.

## Papéis

### Na organização (`organization_members.role`)

| Papel | Lê empresas | Cria/edita | Exclui | Gerencia membros | Observação |
| --- | --- | --- | --- | --- | --- |
| Proprietário (`owner`) | todas | ✔ | ✔ | ✔ (inclusive proprietários) | Sempre há ao menos 1 ativo |
| Administrador (`admin`) | todas | ✔ | ✔ | ✔ (exceto proprietários) | |
| Contador (`accountant`) | todas | ✔ | — | — | |
| Leitor (`viewer`) | todas | — | — | — | |
| Colaborador (`member`) | só as vinculadas | conforme vínculo | — | — | |

Membros com status **suspenso** ou **convidado** não acessam nada (nem por vínculos pontuais).

### Na empresa (`company_members.role`)

| Papel | Permissão |
| --- | --- |
| Gestor (`manager`) | Lê e edita dados, contatos e documentos daquela empresa |
| Leitura (`viewer`) | Somente leitura daquela empresa |

## Funções de autorização (schema `private`, não exposto pela API)

`org_role`, `has_org_role`, `company_role`, `can_read_company`, `can_write_company`, `can_delete_company`,
`can_create_company`, `can_manage_org`, `shares_org_with`, `storage_company_id`. São `SECURITY DEFINER`,
`STABLE` e com `search_path` vazio.

## Proteções adicionais

- Somente proprietários concedem/alteram/removem o papel de proprietário; a organização não fica sem
  proprietário ativo (gatilho `guard_organization_members`).
- O CNPJ interno não pode ser excluído nem ter a marcação `is_internal` alterada.
- Registros não podem ser movidos entre organizações/empresas (gatilho `prevent_tenant_change`).
- `save_company` só atualiza contatos que pertencem à própria empresa.
- Pesquisa escapa curingas do `LIKE`; parâmetros de URL inválidos são descartados pelo Zod.
- `?next=` do login aceita apenas caminhos internos (proteção contra *open redirect*).
- Login com mensagem genérica; recuperação de senha responde igual exista ou não a conta.
- Cabeçalhos de segurança (HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy).
- Exportação CSV neutraliza fórmulas (proteção contra *CSV injection*).

## Financeiro

| Ação | Quem pode |
| --- | --- |
| Ver contratos e cobranças | Quem lê a empresa (inclusive acesso pontual) |
| Criar/editar contratos, gerar faturamento, lançar e baixar cobranças | Proprietário, administrador, contador |
| Excluir contratos e cobranças | Proprietário, administrador |
| Editar o catálogo de serviços | Proprietário, administrador |

O vínculo pontual de **gestor** de uma empresa não dá acesso de escrita financeira. Os valores usam
`numeric(14,2)`; um contrato gera no máximo uma cobrança por competência (índice único), e o pagamento só
é aceito com data, valor e forma preenchidos (restrição no banco).

## Contabilidade

| Ação | Quem pode |
| --- | --- |
| Ver plano de contas, lançamentos e relatórios | Quem lê a empresa (inclusive acesso pontual) |
| Criar plano, contas e lançamentos; fechar período | Proprietário, administrador, contador |
| Recuar ou reabrir um período fechado | Proprietário, administrador |
| Apurar, contabilizar e excluir impostos | Proprietário, administrador, contador |

Regras garantidas pelo banco (gatilhos e restrições, não apenas pela tela):

- Todo lançamento precisa de ao menos duas partidas e débitos = créditos (gatilho adiado, verificado no
  fim da transação).
- Cada partida tem débito **ou** crédito, em conta analítica e ativa da mesma empresa (FK composta).
- Datas até o fechamento não aceitam inclusão, alteração ou exclusão de lançamentos.
- Conta com movimento não muda de código nem de tipo e não pode ser excluída; a conta superior precisa ser
  sintética e o código, um nível abaixo.
- Plano de contas, lançamentos e fechamento são auditados.

## Auditoria

Gatilhos `AFTER INSERT/UPDATE/DELETE` em organizações, empresas, clientes, contatos, documentos, vínculos,
serviços, contratos, itens de contrato e cobranças
gravam em `audit_logs`: autor (`auth.uid()`), ação, entidade, id, organização, empresa e — nas alterações —
apenas os campos modificados (`{campo: {old, new}}`). Usuários não podem inserir, alterar ou excluir logs.
A aba **Histórico** da ficha do cliente exibe essa trilha.

## Documentos

- Bucket **privado** `client-documents`, limite de 10 MB e lista de tipos permitidos (PDF, imagens, Word,
  Excel, XML).
- Caminho obrigatório `{organization_id}/{company_id}/{uuid}-{arquivo}`; a política confere que a
  organização do caminho é a dona real da empresa.
- Download apenas por **URL assinada de 60 segundos**, gerada após checagem de leitura.
- Sem política de UPDATE: arquivos são imutáveis.
