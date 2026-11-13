# Funcionalidades — primeira entrega

## Autenticação
- **Login** (`/login`) com e-mail e senha (Supabase Auth); validação no cliente e no servidor.
- **Recuperação de senha** (`/recuperar-senha`) → e-mail com link → `/auth/confirm` → **nova senha**
  (`/auth/redefinir-senha`, com política de senha forte).
- **Convites**: usuários convidados pelo Supabase definem a senha pelo mesmo fluxo.
- **Sair** pelo menu do usuário. Sessão renovada automaticamente pelo `proxy.ts`.

## Configuração inicial (`/onboarding`)
Usuário sem organização cadastra a organização e o CNPJ próprio (gestão interna) e se torna proprietário.

## Dashboard (`/dashboard`)
Indicadores reais (RPC `dashboard_summary`, respeitando o RLS):
total de empresas cadastradas, clientes ativos, em implantação, suspensos e encerrados (cada cartão abre a
listagem filtrada), gráficos por situação e por regime tributário e últimos clientes cadastrados.

## Clientes (`/clientes`)
- Tabela: razão social, nome fantasia, CNPJ, regime, responsável, situação e data de cadastro (cartões no
  celular).
- Pesquisa por nome (razão social/fantasia) ou CNPJ (com ou sem máscara), filtros por regime e situação,
  paginação de 20 em 20 — tudo refletido na URL.
- **Novo cliente** (`/clientes/novo`): empresa e CNPJ (consulta pública de CNPJ e CEP para pré-preencher),
  regime tributário, CNAE, inscrições, situação cadastral, endereço, responsável, situação do cliente,
  implantação, observações e contatos.
- **Ficha** (`/clientes/[id]`): abas Dados cadastrais, Contatos, Documentos (envio/download/exclusão),
  Acessos (vínculos pontuais) e Histórico de alterações.
- **Edição** (`/clientes/[id]/editar`) e **exclusão** (somente proprietário/administrador, com confirmação
  pelo CNPJ).
- **Exportação CSV** da carteira.

## Empresas (`/empresas`)
Todos os CNPJs da organização, incluindo o interno, com filtro por situação cadastral (RFB).

## Relatórios (`/relatorios`)
Distribuição de clientes por situação e de empresas por regime tributário, e exportação CSV.

## Configurações (`/configuracoes`)
Nome da organização, perfil do usuário, inclusão de membros por e-mail, alteração de papel/status,
remoção, e descrição dos papéis.

## Contratos (`/contratos`)
- **Catálogo de serviços** (`/contratos/servicos`): nome, descrição, valor padrão e periodicidade
  (mensal, trimestral, semestral, anual ou avulso). Somente proprietário/administrador edita.
- **Contratos**: cliente, vigência (início e término opcional), dia de vencimento (1–28), índice e mês de
  reajuste, observações e itens (serviço do catálogo ou personalizado, quantidade, valor unitário e
  periodicidade). Número gerado automaticamente por ano (`CT-2027-0001`). Mostra mensalidade e previsão em
  12 meses durante o preenchimento.
- **Ficha do contrato**: dados, serviços, cobranças geradas e histórico; ações de ativar, suspender,
  encerrar, reabrir e excluir.
- A ficha do cliente ganhou a aba **Contratos e cobranças**.

## Financeiro (`/financeiro`)
- Indicadores: a receber, vencido, recebido no mês (e faturado no mês) e receita recorrente mensal.
- Gráfico de faturado × recebido nos últimos 6 meses.
- **Gerar faturamento**: cria as cobranças da competência para os contratos ativos, respeitando a
  periodicidade de cada item (o avulso é cobrado só no mês de início). Pode ser executado de novo sem
  duplicar cobranças.
- **Cobrança avulsa** para serviços fora do contrato.
- Lista com pesquisa (cliente, CNPJ, descrição), filtro por competência e situação (a vencer, vencido, em
  aberto, pago, cancelado), total filtrado e paginação.
- Registrar pagamento (data, valor e forma), estornar e cancelar cobrança.
- O dashboard passou a mostrar os indicadores financeiros.

## Contabilidade (`/contabilidade`)
- Lista das empresas visíveis ao usuário, com a situação da escrituração (ativa ou sem plano de contas) e a
  data de fechamento.
- **Plano de contas padrão** criado com um clique (cerca de 96 contas: Ativo, Passivo, Patrimônio líquido,
  Receitas, Custos e Despesas). Inclusão de contas e subcontas (código sugerido automaticamente), renomear,
  mudar a natureza (contas redutoras), inativar e excluir (apenas sem movimento e sem subcontas).
- **Lançamentos** em partidas dobradas: número sequencial por empresa, data, histórico e quantas partidas
  forem necessárias. O formulário mostra débitos, créditos e diferença em tempo real e completa a última
  partida com a diferença. Só aceita contas analíticas e ativas.
- **Balancete** (saldo anterior, débitos, créditos e saldo atual, com totais por grupo).
- **DRE** do período (receita bruta, deduções, receita líquida, custos, lucro bruto, despesas, resultado
  antes do IRPJ/CSLL e resultado líquido, com % sobre a receita líquida).
- **Balanço patrimonial** na data final (circulante e não circulante, PL e resultado não encerrado), com a
  verificação ativo = passivo + PL.
- **Razão** por conta, com saldo corrente.
- **Fechamento**: trava lançamentos até uma data; recuar ou reabrir só proprietário/administrador.
- Indicadores do período: receita líquida, custos e despesas, resultado e disponibilidades.

## Em preparação (próximas etapas)
No financeiro, contas a pagar, emissão de boleto/Pix, NFS-e e conciliação bancária; na contabilidade,
integração automática com o financeiro, importação de extratos e SPED.
