-- =============================================================================
-- Aguiar ERP — Migration 0007: indicadores de tendência para o redesign
-- =============================================================================
-- Somente leitura: acrescenta campos aos indicadores (comparação com o mês
-- anterior, novos clientes por mês e cobranças que vencem nos próximos 7 dias)
-- e o filtro "vence_em_breve" na pesquisa de cobranças. Nenhuma regra de
-- negócio, tabela ou permissão é alterada. Todas as funções seguem
-- SECURITY INVOKER (RLS aplicado).
-- =============================================================================

create or replace function public.dashboard_summary(p_organization_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with months as (
    select generate_series(date_trunc('month', current_date)::date - interval '5 months',
                           date_trunc('month', current_date)::date, interval '1 month')::date as m
  )
  select jsonb_build_object(
    'total_companies', (
      select count(*) from public.companies c
      where c.organization_id = p_organization_id and not c.is_internal
    ),
    'clients_by_status', (
      select coalesce(jsonb_object_agg(s.contract_status, s.total), '{}'::jsonb)
      from (
        select cl.contract_status, count(*) as total
        from public.clients cl
        where cl.organization_id = p_organization_id
        group by cl.contract_status
      ) s
    ),
    'companies_by_regime', (
      select coalesce(jsonb_object_agg(r.tax_regime, r.total), '{}'::jsonb)
      from (
        select c.tax_regime, count(*) as total
        from public.companies c
        where c.organization_id = p_organization_id and not c.is_internal
        group by c.tax_regime
      ) r
    ),
    'recent_clients', (
      select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb)
      from (
        select c.id as company_id, c.corporate_name, c.cnpj, cl.contract_status, cl.created_at
        from public.clients cl
        join public.companies c on c.id = cl.company_id
        where cl.organization_id = p_organization_id
        order by cl.created_at desc
        limit 5
      ) x
    ),
    'new_clients_by_month', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'month', to_char(m.m, 'YYYY-MM'),
               'count', (select count(*) from public.clients cl
                         where cl.organization_id = p_organization_id
                           and date_trunc('month', cl.created_at at time zone 'America/Sao_Paulo') = m.m))
             order by m.m), '[]'::jsonb)
      from months m
    )
  );
$$;

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
    'due_soon_total',  coalesce((select sum(amount) from r where status = 'aberto' and due_date between p_today and p_today + 7), 0),
    'due_soon_count',  (select count(*) from r where status = 'aberto' and due_date between p_today and p_today + 7),
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
      or (p_status = 'vence_em_breve' and r.status = 'aberto' and r.due_date between p_today and p_today + 7)
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
