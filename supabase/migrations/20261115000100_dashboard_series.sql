-- =============================================================================
-- Aguiar ERP — Migration 0008: séries históricas para o dashboard (v0.4)
-- =============================================================================
-- Somente leitura. finance_summary passa a aceitar a quantidade de meses
-- (6 a 24) e devolve, por mês: faturado, recebido, saldo em aberto e vencido
-- ao fim do mês, receita recorrente vigente, valores por competência e
-- vencimentos do mês (para adimplência/inadimplência). Inclui também os
-- próximos vencimentos e a contagem de contratos para o indicador de retenção.
-- SECURITY INVOKER: o RLS continua sendo aplicado.
-- =============================================================================

drop function if exists public.finance_summary(uuid, date);

create or replace function public.finance_summary(
  p_organization_id uuid,
  p_today date default current_date,
  p_months integer default 6
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with r as (
    select * from public.receivables where organization_id = p_organization_id and status <> 'cancelado'
  ), months as (
    select m::date as m,
           least((m + interval '1 month' - interval '1 day')::date, p_today) as e
    from generate_series(
      date_trunc('month', p_today)::date - make_interval(months => least(greatest(coalesce(p_months, 6), 1), 24) - 1),
      date_trunc('month', p_today)::date, interval '1 month') m
  ), active_items as (
    select c.start_date, c.end_date, round(i.quantity * i.unit_amount, 2) as v
    from public.contracts c join public.contract_items i on i.contract_id = c.id
    where c.organization_id = p_organization_id and c.status = 'ativo' and i.billing_frequency = 'mensal'
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
    'contracts_total',  (select count(*) from public.contracts where organization_id = p_organization_id and status <> 'rascunho'),
    'mrr',             coalesce((select sum(v) from active_items), 0),
    'received_by_month', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'month',         to_char(mo.m, 'YYYY-MM'),
        'billed',        coalesce((select sum(amount) from r where r.competence = mo.m), 0),
        'received',      coalesce((select sum(paid_amount) from r where r.status = 'pago' and date_trunc('month', r.paid_at) = mo.m), 0),
        'open_end',      coalesce((select sum(amount) from r where r.competence <= mo.e
                                    and (r.status = 'aberto' or (r.status = 'pago' and r.paid_at > mo.e))), 0),
        'overdue_end',   coalesce((select sum(amount) from r where r.due_date < mo.e
                                    and (r.status = 'aberto' or (r.status = 'pago' and r.paid_at > mo.e))), 0),
        'mrr',           coalesce((select sum(v) from active_items a
                                    where a.start_date <= (mo.m + interval '1 month' - interval '1 day')::date
                                      and (a.end_date is null or a.end_date >= mo.m)), 0),
        'comp_paid',     coalesce((select sum(paid_amount) from r where r.competence = mo.m and r.status = 'pago'), 0),
        'comp_open',     coalesce((select sum(amount) from r where r.competence = mo.m and r.status = 'aberto'), 0),
        'due_total',     coalesce((select sum(amount) from r where date_trunc('month', r.due_date) = mo.m and r.due_date < p_today), 0),
        'due_paid',      coalesce((select sum(amount) from r where date_trunc('month', r.due_date) = mo.m and r.due_date < p_today and r.status = 'pago'), 0),
        'due_open',      coalesce((select sum(amount) from r where date_trunc('month', r.due_date) = mo.m and r.due_date < p_today and r.status = 'aberto'), 0)
      ) order by mo.m), '[]'::jsonb)
      from months mo
    ),
    'upcoming', (
      select coalesce(jsonb_agg(x order by x.due_date, x.corporate_name), '[]'::jsonb)
      from (
        select r.id, r.company_id, co.corporate_name, r.description, r.due_date, r.amount
        from r join public.companies co on co.id = r.company_id
        where r.status = 'aberto' and r.due_date >= p_today
        order by r.due_date, co.corporate_name
        limit 6
      ) x
    )
  );
$$;

revoke all on function public.finance_summary(uuid, date, integer) from public, anon;
grant execute on function public.finance_summary(uuid, date, integer) to authenticated;
