-- =============================================================================
-- Aguiar ERP — Migration 0003: trilha de auditoria
-- =============================================================================
-- Todas as operações de escrita nas tabelas de negócio são registradas por
-- gatilhos no próprio banco: o registro não depende da interface e não pode ser
-- omitido nem alterado pelo usuário (audit_logs não concede INSERT/UPDATE/DELETE).
-- =============================================================================

create or replace function private.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
  v_changes jsonb;
  v_org uuid;
  v_company uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_old := to_jsonb(old);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_new := to_jsonb(new);
  end if;
  v_row := coalesce(v_new, v_old);

  if tg_table_name = 'organizations' then
    v_org := (v_row ->> 'id')::uuid;
  elsif tg_table_name = 'companies' then
    v_org := (v_row ->> 'organization_id')::uuid;
    v_company := (v_row ->> 'id')::uuid;
  else
    v_company := (v_row ->> 'company_id')::uuid;
    v_org := (v_row ->> 'organization_id')::uuid;
    if v_org is null and v_company is not null then
      select c.organization_id into v_org from public.companies c where c.id = v_company;
    end if;
  end if;

  if tg_op = 'UPDATE' then
    select jsonb_object_agg(n.key, jsonb_build_object('old', v_old -> n.key, 'new', n.value))
      into v_changes
    from jsonb_each(v_new) n
    where n.key not in ('updated_at')
      and (v_old -> n.key) is distinct from n.value;
    if v_changes is null then
      return null; -- nada mudou de fato
    end if;
  elsif tg_op = 'INSERT' then
    v_changes := jsonb_build_object('new', v_new);
  else
    v_changes := jsonb_build_object('old', v_old);
  end if;

  insert into public.audit_logs (organization_id, company_id, user_id, action, entity, entity_id, changes)
  values (
    v_org,
    v_company,
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    (v_row ->> 'id')::uuid,
    v_changes
  );

  return null;
end;
$$;

revoke all on function private.write_audit_log() from public;

create trigger audit_organizations after insert or update or delete on public.organizations
  for each row execute function private.write_audit_log();
create trigger audit_companies after insert or update or delete on public.companies
  for each row execute function private.write_audit_log();
create trigger audit_clients after insert or update or delete on public.clients
  for each row execute function private.write_audit_log();
create trigger audit_client_contacts after insert or update or delete on public.client_contacts
  for each row execute function private.write_audit_log();
create trigger audit_client_documents after insert or update or delete on public.client_documents
  for each row execute function private.write_audit_log();
create trigger audit_organization_members after insert or update or delete on public.organization_members
  for each row execute function private.write_audit_log();
create trigger audit_company_members after insert or update or delete on public.company_members
  for each row execute function private.write_audit_log();
