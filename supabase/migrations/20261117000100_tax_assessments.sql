-- =============================================================================
-- Aguiar ERP — Apuração de tributos (DAS do Simples Nacional e Lucro Presumido)
--
-- O cálculo é feito no servidor da aplicação (utils/taxes.ts, testado contra as
-- tabelas da LC 123/2006) e gravado aqui com os dados de entrada, para conferência
-- e histórico. A contabilização gera um lançamento comum (journal_entries), sujeito
-- às mesmas regras de partidas dobradas e de período fechado.
-- =============================================================================

create table public.tax_assessments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  company_id      uuid not null,
  competence      date not null check (extract(day from competence) = 1),
  regime          text not null check (regime in ('simples_nacional', 'lucro_presumido')),
  inputs          jsonb not null,
  result          jsonb not null,
  total           numeric(14, 2) not null check (total >= 0),
  due_date        date,
  entry_id        uuid,
  created_by      uuid default auth.uid() references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint tax_assessments_company_fk foreign key (company_id, organization_id)
    references public.companies (id, organization_id) on delete cascade,
  constraint tax_assessments_entry_fk foreign key (entry_id, company_id)
    references public.journal_entries (id, company_id) on delete set null (entry_id),
  constraint tax_assessments_company_competence_key unique (company_id, competence, regime)
);

create index tax_assessments_org_idx on public.tax_assessments (organization_id, competence desc);

create trigger tax_assessments_set_updated_at before update on public.tax_assessments
  for each row execute function private.set_updated_at();
create trigger tax_assessments_prevent_tenant_change before update on public.tax_assessments
  for each row execute function private.prevent_tenant_change();
create trigger audit_tax_assessments after insert or update or delete on public.tax_assessments
  for each row execute function private.write_audit_log();

revoke all on public.tax_assessments from anon;
grant select, insert, update, delete on public.tax_assessments to authenticated;
alter table public.tax_assessments enable row level security;

create policy tax_assessments_select on public.tax_assessments for select to authenticated
  using (private.can_read_company(company_id));
create policy tax_assessments_write on public.tax_assessments for all to authenticated
  using (private.can_write_finance(organization_id)) with check (private.can_write_finance(organization_id));
