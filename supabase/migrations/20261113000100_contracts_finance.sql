-- =============================================================================
-- Aguiar ERP — Migration 0006: Contratos, serviços e contas a receber
-- =============================================================================
-- services      -> catálogo de serviços/honorários da organização
-- contracts     -> contrato do escritório com uma empresa cliente
-- contract_items-> serviços e valores de cada contrato
-- receivables   -> cobranças (faturas/honorários) — contas a receber
--
-- Regras de acesso:
--   * catálogo: lido por membros ativos; editado por owner/admin;
--   * contratos e cobranças: lidos por quem lê a empresa; criados/editados
--     somente por owner/admin/accountant (o vínculo pontual de "gestor" de
--     empresa NÃO dá acesso de escrita financeira); excluídos por owner/admin.
-- Valores monetários em numeric(14,2).
-- =============================================================================

create type public.billing_frequency as enum ('mensal', 'trimestral', 'semestral', 'anual', 'avulso');
create type public.contract_state as enum ('rascunho', 'ativo', 'suspenso', 'encerrado');
create type public.adjustment_index as enum ('nenhum', 'ipca', 'igpm', 'inpc', 'percentual_fixo');
create type public.receivable_status as enum ('aberto', 'pago', 'cancelado');
create type public.payment_method as enum ('pix', 'boleto', 'transferencia', 'dinheiro', 'cartao', 'outro');

-- -----------------------------------------------------------------------------
-- services
-- -----------------------------------------------------------------------------
create table public.services (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  name              text not null check (char_length(btrim(name)) between 2 and 120),
  description       text check (description is null or char_length(description) <= 500),
  default_amount    numeric(14,2) not null default 0 check (default_amount >= 0),
  billing_frequency public.billing_frequency not null default 'mensal',
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  constraint services_org_name_key unique (organization_id, name)
);

-- -----------------------------------------------------------------------------
-- contracts
-- -----------------------------------------------------------------------------
create table public.contracts (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  company_id        uuid not null,
  number            text not null,
  status            public.contract_state not null default 'ativo',
  start_date        date not null,
  end_date          date,
  billing_day       smallint not null default 10 check (billing_day between 1 and 28),
  adjustment_index  public.adjustment_index not null default 'nenhum',
  adjustment_month  smallint check (adjustment_month is null or adjustment_month between 1 and 12),
  notes             text check (notes is null or char_length(notes) <= 2000),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint contracts_org_number_key unique (organization_id, number),
  constraint contracts_dates_check check (end_date is null or end_date >= start_date),
  constraint contracts_company_fk foreign key (company_id, organization_id)
    references public.companies (id, organization_id) on delete cascade,
  constraint contracts_id_org_key unique (id, organization_id)
);
create index contracts_org_status_idx on public.contracts (organization_id, status);
create index contracts_company_idx on public.contracts (company_id);

create table public.contract_items (
  id                uuid primary key default gen_random_uuid(),
  contract_id       uuid not null references public.contracts (id) on delete cascade,
  service_id        uuid references public.services (id) on delete set null,
  description       text not null check (char_length(btrim(description)) between 2 and 200),
  quantity          numeric(10,2) not null default 1 check (quantity > 0),
  unit_amount       numeric(14,2) not null check (unit_amount >= 0),
  billing_frequency public.billing_frequency not null default 'mensal',
  created_at        timestamptz not null default now()
);
create index contract_items_contract_idx on public.contract_items (contract_id);

-- -----------------------------------------------------------------------------
-- receivables (contas a receber)
-- -----------------------------------------------------------------------------
create table public.receivables (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  company_id        uuid not null,
  contract_id       uuid,
  description       text not null check (char_length(btrim(description)) between 2 and 200),
  competence        date not null check (extract(day from competence) = 1),
  due_date          date not null,
  amount            numeric(14,2) not null check (amount > 0),
  status            public.receivable_status not null default 'aberto',
  paid_at           date,
  paid_amount       numeric(14,2) check (paid_amount is null or paid_amount > 0),
  payment_method    public.payment_method,
  notes             text check (notes is null or char_length(notes) <= 1000),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint receivables_company_fk foreign key (company_id, organization_id)
    references public.companies (id, organization_id) on delete cascade,
  constraint receivables_contract_fk foreign key (contract_id, organization_id)
    references public.contracts (id, organization_id) on delete set null (contract_id),
  -- Pagamento consistente com o status.
  constraint receivables_paid_check check (
    (status = 'pago' and paid_at is not null and paid_amount is not null and payment_method is not null)
    or (status <> 'pago' and paid_at is null and paid_amount is null)
  )
);
-- Um contrato gera no máximo uma cobrança por competência (faturamento idempotente).
create unique index receivables_contract_competence_key
  on public.receivables (contract_id, competence) where contract_id is not null and status <> 'cancelado';
create index receivables_org_due_idx on public.receivables (organization_id, status, due_date);
create index receivables_company_idx on public.receivables (company_id);

-- -----------------------------------------------------------------------------
-- Gatilhos: updated_at, imutabilidade de vínculo, auditoria
-- -----------------------------------------------------------------------------
create trigger contracts_set_updated_at before update on public.contracts
  for each row execute function private.set_updated_at();
create trigger receivables_set_updated_at before update on public.receivables
  for each row execute function private.set_updated_at();
create trigger contracts_prevent_tenant_change before update on public.contracts
  for each row execute function private.prevent_tenant_change();
create trigger receivables_prevent_tenant_change before update on public.receivables
  for each row execute function private.prevent_tenant_change();
create trigger services_prevent_tenant_change before update on public.services
  for each row execute function private.prevent_tenant_change();

-- O item não pode trocar de contrato.
create or replace function private.prevent_contract_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.contract_id is distinct from old.contract_id then
    raise exception 'contract_id não pode ser alterado' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger contract_items_prevent_contract_change before update on public.contract_items
  for each row execute function private.prevent_contract_change();

-- Auditoria: itens de contrato apontam para a empresa do contrato.
create or replace function private.write_audit_log_contract_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
  v_company uuid;
  v_org uuid;
  v_changes jsonb;
begin
  select c.company_id, c.organization_id into v_company, v_org
  from public.contracts c where c.id = (v_row ->> 'contract_id')::uuid;

  if tg_op = 'UPDATE' then
    select jsonb_object_agg(n.key, jsonb_build_object('old', to_jsonb(old) -> n.key, 'new', n.value))
      into v_changes
    from jsonb_each(to_jsonb(new)) n
    where (to_jsonb(old) -> n.key) is distinct from n.value;
    if v_changes is null then return null; end if;
  elsif tg_op = 'INSERT' then
    v_changes := jsonb_build_object('new', to_jsonb(new));
  else
    v_changes := jsonb_build_object('old', to_jsonb(old));
  end if;

  insert into public.audit_logs (organization_id, company_id, user_id, action, entity, entity_id, changes)
  values (v_org, v_company, (select auth.uid()), lower(tg_op), tg_table_name, (v_row ->> 'id')::uuid, v_changes);
  return null;
end;
$$;
revoke all on function private.write_audit_log_contract_item() from public;

create trigger audit_services after insert or update or delete on public.services
  for each row execute function private.write_audit_log();
create trigger audit_contracts after insert or update or delete on public.contracts
  for each row execute function private.write_audit_log();
create trigger audit_contract_items after insert or update or delete on public.contract_items
  for each row execute function private.write_audit_log_contract_item();
create trigger audit_receivables after insert or update or delete on public.receivables
  for each row execute function private.write_audit_log();

-- -----------------------------------------------------------------------------
-- Autorização financeira
-- -----------------------------------------------------------------------------
create or replace function private.can_write_finance(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_org_role(p_organization_id, '{owner,admin,accountant}');
$$;
revoke all on function private.can_write_finance(uuid) from public;
grant execute on function private.can_write_finance(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Privilégios e RLS
-- -----------------------------------------------------------------------------
revoke all on public.services, public.contracts, public.contract_items, public.receivables from anon;
grant select, insert, update, delete on public.services to authenticated;
grant select, insert, update, delete on public.contracts to authenticated;
grant select, insert, update, delete on public.contract_items to authenticated;
grant select, insert, update, delete on public.receivables to authenticated;

alter table public.services       enable row level security;
alter table public.contracts      enable row level security;
alter table public.contract_items enable row level security;
alter table public.receivables    enable row level security;

create policy services_select on public.services for select to authenticated
  using (private.is_org_member(organization_id));
create policy services_insert on public.services for insert to authenticated
  with check (private.can_manage_org(organization_id));
create policy services_update on public.services for update to authenticated
  using (private.can_manage_org(organization_id)) with check (private.can_manage_org(organization_id));
create policy services_delete on public.services for delete to authenticated
  using (private.can_manage_org(organization_id));

create policy contracts_select on public.contracts for select to authenticated
  using (private.can_read_company(company_id));
create policy contracts_insert on public.contracts for insert to authenticated
  with check (private.can_write_finance(organization_id));
create policy contracts_update on public.contracts for update to authenticated
  using (private.can_write_finance(organization_id)) with check (private.can_write_finance(organization_id));
create policy contracts_delete on public.contracts for delete to authenticated
  using (private.can_manage_org(organization_id));

create policy contract_items_select on public.contract_items for select to authenticated
  using (exists (select 1 from public.contracts c where c.id = contract_id));
create policy contract_items_insert on public.contract_items for insert to authenticated
  with check (exists (select 1 from public.contracts c where c.id = contract_id and private.can_write_finance(c.organization_id)));
create policy contract_items_update on public.contract_items for update to authenticated
  using (exists (select 1 from public.contracts c where c.id = contract_id and private.can_write_finance(c.organization_id)))
  with check (exists (select 1 from public.contracts c where c.id = contract_id and private.can_write_finance(c.organization_id)));
create policy contract_items_delete on public.contract_items for delete to authenticated
  using (exists (select 1 from public.contracts c where c.id = contract_id and private.can_write_finance(c.organization_id)));

create policy receivables_select on public.receivables for select to authenticated
  using (private.can_read_company(company_id));
create policy receivables_insert on public.receivables for insert to authenticated
  with check (private.can_write_finance(organization_id));
create policy receivables_update on public.receivables for update to authenticated
  using (private.can_write_finance(organization_id)) with check (private.can_write_finance(organization_id));
create policy receivables_delete on public.receivables for delete to authenticated
  using (private.can_manage_org(organization_id));

-- -----------------------------------------------------------------------------
-- Funções de negócio
-- -----------------------------------------------------------------------------

-- Valor de um item na competência, conforme a periodicidade e o início do contrato.
create or replace function private.item_due_in(p_frequency public.billing_frequency, p_start date, p_competence date)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_competence < date_trunc('month', p_start)::date then false
    when p_frequency = 'avulso' then p_competence = date_trunc('month', p_start)::date
    else ((extract(year from p_competence) * 12 + extract(month from p_competence))
          - (extract(year from p_start) * 12 + extract(month from p_start)))::int
         % case p_frequency when 'mensal' then 1 when 'trimestral' then 3 when 'semestral' then 6 else 12 end = 0
  end;
$$;
grant execute on function private.item_due_in(public.billing_frequency, date, date) to authenticated;

-- Cria/atualiza contrato e itens de forma atômica (RLS aplicado).
create or replace function public.save_contract(
  p_organization_id uuid,
  p_contract_id uuid,
  p_contract jsonb,
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := p_contract_id;
  v_number text;
  v_item jsonb;
  v_item_id uuid;
  v_keep uuid[] := '{}';
  v_year text := to_char(coalesce((p_contract ->> 'start_date')::date, current_date), 'YYYY');
begin
  if (select auth.uid()) is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Informe ao menos um serviço no contrato' using errcode = '22023';
  end if;

  if v_id is null then
    -- Numeração sequencial por organização e ano: CT-2026-0001.
    perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':contracts', 0));
    select 'CT-' || v_year || '-' || lpad((coalesce(max(substring(number from '\d+$')::int), 0) + 1)::text, 4, '0')
      into v_number
    from public.contracts
    where organization_id = p_organization_id and number like 'CT-' || v_year || '-%';

    v_id := gen_random_uuid();
    insert into public.contracts (id, organization_id, company_id, number, status, start_date, end_date,
                                  billing_day, adjustment_index, adjustment_month, notes)
    values (
      v_id, p_organization_id, (p_contract ->> 'company_id')::uuid, v_number,
      coalesce(private.nz(p_contract ->> 'status'), 'ativo')::public.contract_state,
      (p_contract ->> 'start_date')::date,
      nullif(p_contract ->> 'end_date', '')::date,
      coalesce(nullif(p_contract ->> 'billing_day', '')::smallint, 10),
      coalesce(private.nz(p_contract ->> 'adjustment_index'), 'nenhum')::public.adjustment_index,
      nullif(p_contract ->> 'adjustment_month', '')::smallint,
      private.nz(p_contract ->> 'notes')
    );
  else
    update public.contracts set
      status           = coalesce(private.nz(p_contract ->> 'status'), 'ativo')::public.contract_state,
      start_date       = (p_contract ->> 'start_date')::date,
      end_date         = nullif(p_contract ->> 'end_date', '')::date,
      billing_day      = coalesce(nullif(p_contract ->> 'billing_day', '')::smallint, 10),
      adjustment_index = coalesce(private.nz(p_contract ->> 'adjustment_index'), 'nenhum')::public.adjustment_index,
      adjustment_month = nullif(p_contract ->> 'adjustment_month', '')::smallint,
      notes            = private.nz(p_contract ->> 'notes')
    where id = v_id and organization_id = p_organization_id;
    if not found then
      raise exception 'Contrato não encontrado ou sem permissão de edição' using errcode = '42501';
    end if;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_item_id := nullif(v_item ->> 'id', '')::uuid;
    if v_item_id is not null then
      update public.contract_items set
        service_id        = nullif(v_item ->> 'service_id', '')::uuid,
        description       = btrim(v_item ->> 'description'),
        quantity          = (v_item ->> 'quantity')::numeric,
        unit_amount       = (v_item ->> 'unit_amount')::numeric,
        billing_frequency = (v_item ->> 'billing_frequency')::public.billing_frequency
      where id = v_item_id and contract_id = v_id;
      if not found then
        raise exception 'Item não pertence a este contrato' using errcode = '42501';
      end if;
    else
      v_item_id := gen_random_uuid();
      insert into public.contract_items (id, contract_id, service_id, description, quantity, unit_amount, billing_frequency)
      values (
        v_item_id, v_id, nullif(v_item ->> 'service_id', '')::uuid, btrim(v_item ->> 'description'),
        (v_item ->> 'quantity')::numeric, (v_item ->> 'unit_amount')::numeric,
        (v_item ->> 'billing_frequency')::public.billing_frequency
      );
    end if;
    v_keep := v_keep || v_item_id;
  end loop;

  delete from public.contract_items where contract_id = v_id and not (id = any (v_keep));
  return v_id;
end;
$$;

-- Gera as cobranças de uma competência para os contratos ativos (idempotente).
-- Retorna quantas cobranças foram criadas.
create or replace function public.generate_billing(p_organization_id uuid, p_competence date)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_comp date := date_trunc('month', p_competence)::date;
  v_count integer;
begin
  if not private.can_write_finance(p_organization_id) then
    raise exception 'Sem permissão para gerar faturamento' using errcode = '42501';
  end if;

  with due as (
    select c.id as contract_id, c.company_id, c.number, c.billing_day,
           sum(round(i.quantity * i.unit_amount, 2)) as amount
    from public.contracts c
    join public.contract_items i on i.contract_id = c.id
    where c.organization_id = p_organization_id
      and c.status = 'ativo'
      and date_trunc('month', c.start_date)::date <= v_comp
      and (c.end_date is null or c.end_date >= v_comp)
      and private.item_due_in(i.billing_frequency, c.start_date, v_comp)
    group by c.id, c.company_id, c.number, c.billing_day
    having sum(round(i.quantity * i.unit_amount, 2)) > 0
  ), ins as (
    insert into public.receivables (organization_id, company_id, contract_id, description, competence, due_date, amount)
    select p_organization_id, d.company_id, d.contract_id,
           'Honorários ' || to_char(v_comp, 'MM/YYYY'),
           v_comp,
           (v_comp + (d.billing_day - 1))::date,
           d.amount
    from due d
    on conflict (contract_id, competence) where contract_id is not null and status <> 'cancelado' do nothing
    returning 1
  )
  select count(*) into v_count from ins;
  return v_count;
end;
$$;

-- Indicadores financeiros (RLS aplicado).
create or replace function public.finance_summary(p_organization_id uuid, p_today date default current_date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with r as (
    select * from public.receivables where organization_id = p_organization_id and status <> 'cancelado'
  ), months as (
    select generate_series(date_trunc('month', p_today)::date - interval '5 months',
                           date_trunc('month', p_today)::date, interval '1 month')::date as m
  )
  select jsonb_build_object(
    'open_total',      coalesce((select sum(amount) from r where status = 'aberto'), 0),
    'open_count',      (select count(*) from r where status = 'aberto'),
    'overdue_total',   coalesce((select sum(amount) from r where status = 'aberto' and due_date < p_today), 0),
    'overdue_count',   (select count(*) from r where status = 'aberto' and due_date < p_today),
    'month_billed',    coalesce((select sum(amount) from r where competence = date_trunc('month', p_today)::date), 0),
    'month_received',  coalesce((select sum(paid_amount) from r where status = 'pago'
                                   and date_trunc('month', paid_at) = date_trunc('month', p_today)), 0),
    'active_contracts', (select count(*) from public.contracts where organization_id = p_organization_id and status = 'ativo'),
    'mrr',             coalesce((select sum(round(i.quantity * i.unit_amount, 2))
                                 from public.contracts c join public.contract_items i on i.contract_id = c.id
                                 where c.organization_id = p_organization_id and c.status = 'ativo'
                                   and i.billing_frequency = 'mensal'), 0),
    'received_by_month', (
      select coalesce(jsonb_agg(jsonb_build_object('month', to_char(m.m, 'YYYY-MM'),
        'billed', coalesce((select sum(amount) from r where r.competence = m.m), 0),
        'received', coalesce((select sum(paid_amount) from r where r.status = 'pago' and date_trunc('month', r.paid_at) = m.m), 0))
        order by m.m), '[]'::jsonb)
      from months m
    )
  );
$$;

-- Listagem de cobranças com filtros (status 'vencido' derivado).
create or replace function public.search_receivables(
  p_organization_id uuid,
  p_search text default null,
  p_status text default null,
  p_competence date default null,
  p_company_id uuid default null,
  p_today date default current_date,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id uuid,
  company_id uuid,
  corporate_name text,
  cnpj text,
  contract_id uuid,
  contract_number text,
  description text,
  competence date,
  due_date date,
  amount numeric,
  status public.receivable_status,
  is_overdue boolean,
  paid_at date,
  paid_amount numeric,
  payment_method public.payment_method,
  total_count bigint,
  total_amount numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select private.like_escape(private.nz(p_search)) as term,
           private.like_escape(upper(regexp_replace(coalesce(p_search, ''), '[^0-9A-Za-z]', '', 'g'))) as cnpj_term
  )
  select r.id, r.company_id, co.corporate_name, co.cnpj::text, r.contract_id, ct.number, r.description,
         r.competence, r.due_date, r.amount, r.status,
         (r.status = 'aberto' and r.due_date < p_today),
         r.paid_at, r.paid_amount, r.payment_method,
         count(*) over (), sum(r.amount) over ()
  from public.receivables r
  join public.companies co on co.id = r.company_id
  left join public.contracts ct on ct.id = r.contract_id
  cross join params p
  where r.organization_id = p_organization_id
    and (p_company_id is null or r.company_id = p_company_id)
    and (p_competence is null or r.competence = date_trunc('month', p_competence)::date)
    and (
      p_status is null
      or (p_status = 'vencido' and r.status = 'aberto' and r.due_date < p_today)
      or (p_status = 'a_vencer' and r.status = 'aberto' and r.due_date >= p_today)
      or (p_status in ('aberto', 'pago', 'cancelado') and r.status::text = p_status)
    )
    and (
      p.term is null
      or co.corporate_name ilike '%' || p.term || '%'
      or co.trade_name ilike '%' || p.term || '%'
      or r.description ilike '%' || p.term || '%'
      or (char_length(p.cnpj_term) >= 2 and co.cnpj like '%' || p.cnpj_term || '%')
    )
  -- Em aberto primeiro (vencimento mais próximo); depois pagas/canceladas (mais recentes).
  order by (r.status = 'aberto') desc,
           case when r.status = 'aberto' then r.due_date end asc,
           r.due_date desc, co.corporate_name, r.id
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.save_contract(uuid, uuid, jsonb, jsonb) from public, anon;
revoke all on function public.generate_billing(uuid, date) from public, anon;
revoke all on function public.finance_summary(uuid, date) from public, anon;
revoke all on function public.search_receivables(uuid, text, text, date, uuid, date, int, int) from public, anon;
grant execute on function public.save_contract(uuid, uuid, jsonb, jsonb) to authenticated;
grant execute on function public.generate_billing(uuid, date) to authenticated;
grant execute on function public.finance_summary(uuid, date) to authenticated;
grant execute on function public.search_receivables(uuid, text, text, date, uuid, date, int, int) to authenticated;
