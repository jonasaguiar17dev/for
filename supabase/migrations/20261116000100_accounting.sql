-- =============================================================================
-- Aguiar ERP — Migration 0009: Contabilidade (escrituração por CNPJ)
-- =============================================================================
-- accounts              -> plano de contas por empresa (sintéticas e analíticas)
-- journal_entries       -> lançamentos contábeis (cabeçalho, numeração por empresa)
-- journal_lines         -> partidas (débito OU crédito em conta analítica)
-- accounting_settings   -> fechamento: data até a qual a escrituração está travada
--
-- Regras garantidas pelo banco:
--   * todo lançamento tem ao menos 2 partidas e débitos = créditos (verificado
--     ao fim da transação, por gatilho de restrição adiado);
--   * só contas analíticas e ativas recebem lançamentos;
--   * nada pode ser criado, alterado ou excluído em período fechado;
--   * somente proprietário/administrador reabre período.
-- Acesso: leitura para quem lê a empresa; escrita para owner/admin/accountant.
-- =============================================================================

create type public.account_type as enum ('ativo', 'passivo', 'patrimonio_liquido', 'receita', 'custo', 'despesa');
create type public.account_nature as enum ('devedora', 'credora');

-- -----------------------------------------------------------------------------
-- Plano de contas
-- -----------------------------------------------------------------------------
create table public.accounts (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  company_id       uuid not null,
  code             text not null check (code ~ '^[0-9]+(\.[0-9]+)*$' and char_length(code) <= 30),
  name             text not null check (char_length(btrim(name)) between 2 and 120),
  type             public.account_type not null,
  nature           public.account_nature not null,
  is_analytic      boolean not null default true,
  parent_id        uuid,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  constraint accounts_company_fk foreign key (company_id, organization_id)
    references public.companies (id, organization_id) on delete cascade,
  constraint accounts_company_code_key unique (company_id, code),
  constraint accounts_id_company_key unique (id, company_id),
  constraint accounts_parent_fk foreign key (parent_id, company_id)
    references public.accounts (id, company_id) on delete restrict
);
create index accounts_company_idx on public.accounts (company_id);

-- A conta-mãe precisa ser sintética e o código da filha começar pelo código da mãe.
create or replace function private.check_account_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_parent public.accounts;
begin
  if new.parent_id is null then
    if position('.' in new.code) > 0 then
      raise exception 'Conta % precisa de uma conta superior', new.code using errcode = '23514';
    end if;
    return new;
  end if;
  select * into v_parent from public.accounts where id = new.parent_id;
  if v_parent.is_analytic then
    raise exception 'A conta superior % é analítica e não pode ter subcontas', v_parent.code using errcode = '23514';
  end if;
  if new.code not like v_parent.code || '.%' or position('.' in substr(new.code, char_length(v_parent.code) + 2)) > 0 then
    raise exception 'O código % deve ser um nível abaixo de %', new.code, v_parent.code using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger accounts_check_parent before insert or update on public.accounts
  for each row execute function private.check_account_parent();

-- Conta com lançamentos não pode virar sintética nem mudar de código.
create or replace function private.guard_account_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.is_analytic is distinct from old.is_analytic or new.code is distinct from old.code)
     and exists (select 1 from public.journal_lines where account_id = old.id) then
    raise exception 'Conta com lançamentos não pode mudar de código nem de tipo (analítica/sintética)' using errcode = '23514';
  end if;
  if new.is_analytic and exists (select 1 from public.accounts where parent_id = old.id) then
    raise exception 'Conta com subcontas precisa ser sintética' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Fechamento de período
-- -----------------------------------------------------------------------------
create table public.accounting_settings (
  company_id       uuid primary key,
  organization_id  uuid not null,
  closed_until     date,
  updated_at       timestamptz not null default now(),
  constraint accounting_settings_company_fk foreign key (company_id, organization_id)
    references public.companies (id, organization_id) on delete cascade
);

-- -----------------------------------------------------------------------------
-- Lançamentos
-- -----------------------------------------------------------------------------
create table public.journal_entries (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null,
  company_id       uuid not null,
  number           integer not null check (number > 0),
  entry_date       date not null,
  description      text not null check (char_length(btrim(description)) between 2 and 300),
  created_by       uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint journal_entries_company_fk foreign key (company_id, organization_id)
    references public.companies (id, organization_id) on delete cascade,
  constraint journal_entries_number_key unique (company_id, number),
  constraint journal_entries_id_company_key unique (id, company_id)
);
create index journal_entries_company_date_idx on public.journal_entries (company_id, entry_date);

create table public.journal_lines (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null,
  company_id  uuid not null,
  account_id  uuid not null,
  debit       numeric(14,2) not null default 0 check (debit >= 0),
  credit      numeric(14,2) not null default 0 check (credit >= 0),
  memo        text check (memo is null or char_length(memo) <= 200),
  position    smallint not null default 0,
  constraint journal_lines_one_side check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0)),
  constraint journal_lines_entry_fk foreign key (entry_id, company_id)
    references public.journal_entries (id, company_id) on delete cascade,
  constraint journal_lines_account_fk foreign key (account_id, company_id)
    references public.accounts (id, company_id) on delete restrict
);
create index journal_lines_entry_idx on public.journal_lines (entry_id);
create index journal_lines_account_idx on public.journal_lines (account_id);

create trigger accounts_guard_update before update on public.accounts
  for each row execute function private.guard_account_update();

-- Somente contas analíticas e ativas recebem lançamentos.
create or replace function private.check_line_account()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_acc public.accounts;
begin
  select * into v_acc from public.accounts where id = new.account_id;
  if not v_acc.is_analytic then
    raise exception 'A conta % é sintética: lance em uma conta analítica', v_acc.code using errcode = '23514';
  end if;
  if not v_acc.active then
    raise exception 'A conta % está inativa', v_acc.code using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger journal_lines_check_account before insert or update on public.journal_lines
  for each row execute function private.check_line_account();

-- Partidas dobradas: ao fim da transação, débitos = créditos e ao menos 2 partidas.
create or replace function private.check_entry_balanced()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry uuid := coalesce(new.entry_id, old.entry_id);
  v_debit numeric;
  v_credit numeric;
  v_count int;
begin
  if not exists (select 1 from public.journal_entries where id = v_entry) then
    return null; -- lançamento excluído junto com as partidas
  end if;
  select coalesce(sum(debit), 0), coalesce(sum(credit), 0), count(*)
    into v_debit, v_credit, v_count
  from public.journal_lines where entry_id = v_entry;
  if v_count < 2 then
    raise exception 'O lançamento precisa de ao menos duas partidas' using errcode = '23514';
  end if;
  if v_debit <> v_credit then
    raise exception 'Lançamento desbalanceado: débitos % e créditos %', v_debit, v_credit using errcode = '23514';
  end if;
  return null;
end;
$$;
create constraint trigger journal_lines_balanced
  after insert or update or delete on public.journal_lines
  deferrable initially deferred
  for each row execute function private.check_entry_balanced();

-- Um lançamento novo também precisa de partidas (verificado ao fim da transação).
create or replace function private.check_entry_has_lines()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.journal_entries where id = new.id)
     and (select count(*) from public.journal_lines where entry_id = new.id) < 2 then
    raise exception 'O lançamento precisa de ao menos duas partidas' using errcode = '23514';
  end if;
  return null;
end;
$$;
create constraint trigger journal_entries_has_lines
  after insert on public.journal_entries
  deferrable initially deferred
  for each row execute function private.check_entry_has_lines();

-- Período fechado: nada entra, muda ou sai.
create or replace function private.closed_until(p_company_id uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select closed_until from public.accounting_settings where company_id = p_company_id;
$$;

create or replace function private.guard_closed_period()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_company uuid := coalesce(new.company_id, old.company_id);
  v_closed date := private.closed_until(v_company);
  v_old date;
  v_new date;
begin
  if v_closed is null then
    return coalesce(new, old);
  end if;
  if tg_table_name = 'journal_entries' then
    v_old := case when tg_op in ('UPDATE', 'DELETE') then old.entry_date end;
    v_new := case when tg_op in ('INSERT', 'UPDATE') then new.entry_date end;
  else
    select entry_date into v_old from public.journal_entries where id = coalesce(old.entry_id, new.entry_id);
    v_new := v_old;
  end if;
  if (v_old is not null and v_old <= v_closed) or (v_new is not null and v_new <= v_closed) then
    raise exception 'Período fechado até %: não é possível alterar lançamentos nessa data', to_char(v_closed, 'DD/MM/YYYY')
      using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger journal_entries_guard_closed before insert or update or delete on public.journal_entries
  for each row execute function private.guard_closed_period();
create trigger journal_lines_guard_closed before insert or update or delete on public.journal_lines
  for each row execute function private.guard_closed_period();

-- Reabrir (recuar a data de fechamento) só proprietário/administrador.
create or replace function private.guard_reopen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
     and old.closed_until is not null
     and (new.closed_until is null or new.closed_until < old.closed_until)
     and not private.can_manage_org(new.organization_id) then
    raise exception 'Somente proprietário ou administrador pode reabrir um período fechado' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger accounting_settings_guard_reopen before update on public.accounting_settings
  for each row execute function private.guard_reopen();

create trigger journal_entries_set_updated_at before update on public.journal_entries
  for each row execute function private.set_updated_at();
create trigger accounts_prevent_tenant_change before update on public.accounts
  for each row execute function private.prevent_tenant_change();
create trigger journal_entries_prevent_tenant_change before update on public.journal_entries
  for each row execute function private.prevent_tenant_change();
create trigger journal_lines_prevent_tenant_change before update on public.journal_lines
  for each row execute function private.prevent_tenant_change();

-- Auditoria
create trigger audit_accounts after insert or update or delete on public.accounts
  for each row execute function private.write_audit_log();
create trigger audit_journal_entries after insert or update or delete on public.journal_entries
  for each row execute function private.write_audit_log();
create trigger audit_accounting_settings after insert or update or delete on public.accounting_settings
  for each row execute function private.write_audit_log();

-- -----------------------------------------------------------------------------
-- Privilégios e RLS
-- -----------------------------------------------------------------------------
revoke all on public.accounts, public.journal_entries, public.journal_lines, public.accounting_settings from anon;
grant select, insert, update, delete on public.accounts, public.journal_entries, public.journal_lines to authenticated;
grant select, insert, update on public.accounting_settings to authenticated;

alter table public.accounts            enable row level security;
alter table public.journal_entries     enable row level security;
alter table public.journal_lines       enable row level security;
alter table public.accounting_settings enable row level security;

create policy accounts_select on public.accounts for select to authenticated
  using (private.can_read_company(company_id));
create policy accounts_write on public.accounts for all to authenticated
  using (private.can_write_finance(organization_id)) with check (private.can_write_finance(organization_id));

create policy journal_entries_select on public.journal_entries for select to authenticated
  using (private.can_read_company(company_id));
create policy journal_entries_write on public.journal_entries for all to authenticated
  using (private.can_write_finance(organization_id)) with check (private.can_write_finance(organization_id));

create policy journal_lines_select on public.journal_lines for select to authenticated
  using (private.can_read_company(company_id));
create policy journal_lines_write on public.journal_lines for all to authenticated
  using (private.can_write_finance(private.company_org(company_id)))
  with check (private.can_write_finance(private.company_org(company_id)));

create policy accounting_settings_select on public.accounting_settings for select to authenticated
  using (private.can_read_company(company_id));
create policy accounting_settings_write on public.accounting_settings for all to authenticated
  using (private.can_write_finance(organization_id)) with check (private.can_write_finance(organization_id));

-- -----------------------------------------------------------------------------
-- Plano de contas padrão (simplificado, compatível com a estrutura do balanço)
-- -----------------------------------------------------------------------------
create or replace function public.setup_chart_of_accounts(p_company_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org uuid := private.company_org(p_company_id);
  v_row record;
  v_parent uuid;
  v_count integer := 0;
begin
  if v_org is null then
    raise exception 'Empresa não encontrada' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.accounts where company_id = p_company_id) then
    raise exception 'A empresa já possui plano de contas' using errcode = '23505';
  end if;
  for v_row in
    select * from (values
      ('1','ATIVO','ativo','devedora',false),
      ('1.1','Ativo Circulante','ativo','devedora',false),
      ('1.1.1','Disponível','ativo','devedora',false),
      ('1.1.1.01','Caixa','ativo','devedora',true),
      ('1.1.1.02','Bancos conta movimento','ativo','devedora',true),
      ('1.1.1.03','Aplicações financeiras de liquidez imediata','ativo','devedora',true),
      ('1.1.2','Créditos','ativo','devedora',false),
      ('1.1.2.01','Clientes','ativo','devedora',true),
      ('1.1.2.02','Adiantamentos a fornecedores','ativo','devedora',true),
      ('1.1.2.03','Adiantamentos a empregados','ativo','devedora',true),
      ('1.1.3','Estoques','ativo','devedora',false),
      ('1.1.3.01','Mercadorias para revenda','ativo','devedora',true),
      ('1.1.4','Tributos a recuperar','ativo','devedora',false),
      ('1.1.4.01','Tributos a recuperar','ativo','devedora',true),
      ('1.2','Ativo Não Circulante','ativo','devedora',false),
      ('1.2.1','Realizável a longo prazo','ativo','devedora',false),
      ('1.2.1.01','Depósitos judiciais','ativo','devedora',true),
      ('1.2.2','Investimentos','ativo','devedora',false),
      ('1.2.2.01','Participações societárias','ativo','devedora',true),
      ('1.2.3','Imobilizado','ativo','devedora',false),
      ('1.2.3.01','Máquinas e equipamentos','ativo','devedora',true),
      ('1.2.3.02','Móveis e utensílios','ativo','devedora',true),
      ('1.2.3.03','Veículos','ativo','devedora',true),
      ('1.2.3.04','Computadores e periféricos','ativo','devedora',true),
      ('1.2.3.90','(-) Depreciação acumulada','ativo','credora',true),
      ('1.2.4','Intangível','ativo','devedora',false),
      ('1.2.4.01','Softwares e marcas','ativo','devedora',true),
      ('2','PASSIVO','passivo','credora',false),
      ('2.1','Passivo Circulante','passivo','credora',false),
      ('2.1.1','Fornecedores','passivo','credora',false),
      ('2.1.1.01','Fornecedores nacionais','passivo','credora',true),
      ('2.1.2','Obrigações trabalhistas','passivo','credora',false),
      ('2.1.2.01','Salários a pagar','passivo','credora',true),
      ('2.1.2.02','FGTS a recolher','passivo','credora',true),
      ('2.1.2.03','INSS a recolher','passivo','credora',true),
      ('2.1.2.04','Férias e 13º a pagar','passivo','credora',true),
      ('2.1.3','Obrigações tributárias','passivo','credora',false),
      ('2.1.3.01','Simples Nacional a recolher','passivo','credora',true),
      ('2.1.3.02','IRPJ a recolher','passivo','credora',true),
      ('2.1.3.03','CSLL a recolher','passivo','credora',true),
      ('2.1.3.04','PIS a recolher','passivo','credora',true),
      ('2.1.3.05','COFINS a recolher','passivo','credora',true),
      ('2.1.3.06','ISS a recolher','passivo','credora',true),
      ('2.1.4','Empréstimos e financiamentos','passivo','credora',false),
      ('2.1.4.01','Empréstimos bancários','passivo','credora',true),
      ('2.1.9','Outras obrigações','passivo','credora',false),
      ('2.1.9.01','Contas a pagar','passivo','credora',true),
      ('2.2','Passivo Não Circulante','passivo','credora',false),
      ('2.2.1','Empréstimos de longo prazo','passivo','credora',false),
      ('2.2.1.01','Financiamentos de longo prazo','passivo','credora',true),
      ('2.3','PATRIMÔNIO LÍQUIDO','patrimonio_liquido','credora',false),
      ('2.3.1','Capital social','patrimonio_liquido','credora',false),
      ('2.3.1.01','Capital social integralizado','patrimonio_liquido','credora',true),
      ('2.3.2','Reservas','patrimonio_liquido','credora',false),
      ('2.3.2.01','Reservas de lucros','patrimonio_liquido','credora',true),
      ('2.3.3','Lucros ou prejuízos acumulados','patrimonio_liquido','credora',false),
      ('2.3.3.01','Lucros ou prejuízos acumulados','patrimonio_liquido','credora',true),
      ('3','RECEITAS','receita','credora',false),
      ('3.1','Receita bruta','receita','credora',false),
      ('3.1.1','Receita de serviços e vendas','receita','credora',false),
      ('3.1.1.01','Receita de prestação de serviços','receita','credora',true),
      ('3.1.1.02','Receita de venda de mercadorias','receita','credora',true),
      ('3.2','Deduções da receita','receita','devedora',false),
      ('3.2.1','Tributos e devoluções','receita','devedora',false),
      ('3.2.1.01','Tributos sobre a receita','receita','devedora',true),
      ('3.2.1.02','Devoluções e cancelamentos','receita','devedora',true),
      ('3.3','Outras receitas','receita','credora',false),
      ('3.3.1','Receitas financeiras','receita','credora',false),
      ('3.3.1.01','Rendimentos de aplicações','receita','credora',true),
      ('3.3.1.02','Juros recebidos','receita','credora',true),
      ('4','CUSTOS','custo','devedora',false),
      ('4.1','Custos operacionais','custo','devedora',false),
      ('4.1.1','Custos dos serviços e mercadorias','custo','devedora',false),
      ('4.1.1.01','Custo dos serviços prestados','custo','devedora',true),
      ('4.1.1.02','Custo das mercadorias vendidas','custo','devedora',true),
      ('5','DESPESAS','despesa','devedora',false),
      ('5.1','Despesas operacionais','despesa','devedora',false),
      ('5.1.1','Despesas administrativas','despesa','devedora',false),
      ('5.1.1.01','Salários e ordenados','despesa','devedora',true),
      ('5.1.1.02','Encargos sociais','despesa','devedora',true),
      ('5.1.1.03','Aluguéis','despesa','devedora',true),
      ('5.1.1.04','Energia, água e telefone','despesa','devedora',true),
      ('5.1.1.05','Honorários profissionais','despesa','devedora',true),
      ('5.1.1.06','Material de escritório','despesa','devedora',true),
      ('5.1.1.07','Depreciação','despesa','devedora',true),
      ('5.1.1.99','Outras despesas administrativas','despesa','devedora',true),
      ('5.1.2','Despesas comerciais','despesa','devedora',false),
      ('5.1.2.01','Propaganda e publicidade','despesa','devedora',true),
      ('5.2','Despesas financeiras','despesa','devedora',false),
      ('5.2.1','Encargos financeiros','despesa','devedora',false),
      ('5.2.1.01','Juros pagos','despesa','devedora',true),
      ('5.2.1.02','Tarifas bancárias','despesa','devedora',true),
      ('5.3','Tributos sobre o lucro','despesa','devedora',false),
      ('5.3.1','IRPJ e CSLL','despesa','devedora',false),
      ('5.3.1.01','IRPJ','despesa','devedora',true),
      ('5.3.1.02','CSLL','despesa','devedora',true)
    ) as t(code, name, type, nature, is_analytic)
    order by string_to_array(code, '.')::int[]
  loop
    select id into v_parent from public.accounts
    where company_id = p_company_id
      and code = nullif(array_to_string((string_to_array(v_row.code, '.'))[1:array_length(string_to_array(v_row.code, '.'), 1) - 1], '.'), '');
    insert into public.accounts (organization_id, company_id, code, name, type, nature, is_analytic, parent_id)
    values (v_org, p_company_id, v_row.code, v_row.name, v_row.type::public.account_type,
            v_row.nature::public.account_nature, v_row.is_analytic, v_parent);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Lançamento: cria ou substitui (cabeçalho + partidas), numeração por empresa
-- -----------------------------------------------------------------------------
create or replace function public.save_journal_entry(
  p_company_id uuid,
  p_entry_id uuid,
  p_entry jsonb,
  p_lines jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org uuid := private.company_org(p_company_id);
  v_id uuid := p_entry_id;
  v_line jsonb;
  v_pos int := 0;
begin
  if (select auth.uid()) is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;
  if v_org is null then
    raise exception 'Empresa não encontrada' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 2 then
    raise exception 'O lançamento precisa de ao menos duas partidas' using errcode = '22023';
  end if;

  if v_id is null then
    perform pg_advisory_xact_lock(hashtextextended(p_company_id::text || ':journal', 0));
    v_id := gen_random_uuid();
    insert into public.journal_entries (id, organization_id, company_id, number, entry_date, description)
    values (
      v_id, v_org, p_company_id,
      (select coalesce(max(number), 0) + 1 from public.journal_entries where company_id = p_company_id),
      (p_entry ->> 'entry_date')::date,
      btrim(p_entry ->> 'description')
    );
  else
    update public.journal_entries set
      entry_date = (p_entry ->> 'entry_date')::date,
      description = btrim(p_entry ->> 'description')
    where id = v_id and company_id = p_company_id;
    if not found then
      raise exception 'Lançamento não encontrado ou sem permissão' using errcode = '42501';
    end if;
    delete from public.journal_lines where entry_id = v_id;
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_pos := v_pos + 1;
    insert into public.journal_lines (entry_id, company_id, account_id, debit, credit, memo, position)
    values (
      v_id, p_company_id, (v_line ->> 'account_id')::uuid,
      coalesce(nullif(v_line ->> 'debit', '')::numeric, 0),
      coalesce(nullif(v_line ->> 'credit', '')::numeric, 0),
      private.nz(v_line ->> 'memo'),
      v_pos
    );
  end loop;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Balancete: saldo anterior, débitos, créditos e saldo final por conta,
-- com totalização das contas sintéticas pelos códigos das subcontas.
-- Saldos com o sinal da natureza da conta (devedora: D - C; credora: C - D).
-- -----------------------------------------------------------------------------
create or replace function public.trial_balance(p_company_id uuid, p_from date, p_to date)
returns table (
  account_id uuid,
  code text,
  name text,
  type public.account_type,
  nature public.account_nature,
  is_analytic boolean,
  level integer,
  opening numeric,
  debit numeric,
  credit numeric,
  closing numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with mov as (
    select l.account_id,
           sum(case when e.entry_date < p_from then l.debit - l.credit else 0 end) as pre,
           sum(case when e.entry_date >= p_from then l.debit else 0 end) as d,
           sum(case when e.entry_date >= p_from then l.credit else 0 end) as c
    from public.journal_lines l
    join public.journal_entries e on e.id = l.entry_id
    where e.company_id = p_company_id and e.entry_date <= p_to
    group by l.account_id
  ), agg as (
    select a.id,
           coalesce(sum(m.pre), 0) as pre,
           coalesce(sum(m.d), 0) as d,
           coalesce(sum(m.c), 0) as c
    from public.accounts a
    left join public.accounts x on x.company_id = a.company_id and (x.code = a.code or x.code like a.code || '.%')
    left join mov m on m.account_id = x.id
    where a.company_id = p_company_id
    group by a.id
  )
  select a.id, a.code, a.name, a.type, a.nature, a.is_analytic,
         array_length(string_to_array(a.code, '.'), 1),
         case when a.nature = 'devedora' then g.pre else -g.pre end,
         g.d, g.c,
         case when a.nature = 'devedora' then g.pre + g.d - g.c else -(g.pre + g.d - g.c) end
  from public.accounts a
  join agg g on g.id = a.id
  order by string_to_array(a.code, '.')::int[];
$$;

revoke all on function public.setup_chart_of_accounts(uuid) from public, anon;
revoke all on function public.save_journal_entry(uuid, uuid, jsonb, jsonb) from public, anon;
revoke all on function public.trial_balance(uuid, date, date) from public, anon;
grant execute on function public.setup_chart_of_accounts(uuid) to authenticated;
grant execute on function public.save_journal_entry(uuid, uuid, jsonb, jsonb) to authenticated;
grant execute on function public.trial_balance(uuid, date, date) to authenticated;
revoke all on function private.closed_until(uuid) from public;
grant execute on function private.closed_until(uuid) to authenticated;
