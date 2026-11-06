-- =============================================================================
-- Aguiar ERP — Migration 0002: funções de autorização, gatilhos e RLS
-- =============================================================================
-- Regras de acesso (resumo):
--   * owner/admin/accountant/viewer da organização leem todas as empresas dela;
--   * owner/admin/accountant editam; somente owner/admin excluem e gerem membros;
--   * 'member' (e usuários externos) só acessam empresas vinculadas em
--     company_members ('manager' edita, 'viewer' lê);
--   * membros com status diferente de 'active' não têm acesso algum.
-- As funções abaixo são SECURITY DEFINER (ignoram RLS internamente para evitar
-- recursão) e sempre usam auth.uid() — nunca um identificador vindo do cliente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Gatilhos utilitários
-- -----------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger companies_set_updated_at before update on public.companies
  for each row execute function private.set_updated_at();
create trigger clients_set_updated_at before update on public.clients
  for each row execute function private.set_updated_at();

-- Impede mover registros entre organizações/empresas (isolamento).
create or replace function private.prevent_tenant_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if to_jsonb(new) ? 'organization_id'
     and (to_jsonb(new) ->> 'organization_id') is distinct from (to_jsonb(old) ->> 'organization_id') then
    raise exception 'organization_id não pode ser alterado' using errcode = '42501';
  end if;
  if to_jsonb(new) ? 'company_id'
     and (to_jsonb(new) ->> 'company_id') is distinct from (to_jsonb(old) ->> 'company_id') then
    raise exception 'company_id não pode ser alterado' using errcode = '42501';
  end if;
  if to_jsonb(new) ? 'user_id'
     and (to_jsonb(new) ->> 'user_id') is distinct from (to_jsonb(old) ->> 'user_id') then
    raise exception 'user_id não pode ser alterado' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger companies_prevent_tenant_change before update on public.companies
  for each row execute function private.prevent_tenant_change();
create trigger clients_prevent_tenant_change before update on public.clients
  for each row execute function private.prevent_tenant_change();
create trigger client_contacts_prevent_tenant_change before update on public.client_contacts
  for each row execute function private.prevent_tenant_change();
create trigger client_documents_prevent_tenant_change before update on public.client_documents
  for each row execute function private.prevent_tenant_change();
create trigger organization_members_prevent_tenant_change before update on public.organization_members
  for each row execute function private.prevent_tenant_change();
create trigger company_members_prevent_tenant_change before update on public.company_members
  for each row execute function private.prevent_tenant_change();

-- O CNPJ interno não pode ser marcado/desmarcado depois de criado.
create or replace function private.prevent_internal_flag_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_internal is distinct from old.is_internal then
    raise exception 'is_internal não pode ser alterado' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger companies_prevent_internal_flag_change before update on public.companies
  for each row execute function private.prevent_internal_flag_change();

-- -----------------------------------------------------------------------------
-- Perfis: criação automática a partir de auth.users
-- -----------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, lower(new.email), nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = lower(new.email) where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

-- Usuários já existentes antes da migration.
insert into public.profiles (id, email, full_name)
select u.id, lower(u.email), nullif(u.raw_user_meta_data ->> 'full_name', '')
from auth.users u
where u.email is not null
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Funções de autorização
-- -----------------------------------------------------------------------------
create or replace function private.org_role(p_organization_id uuid)
returns public.org_role
language sql
stable
security definer
set search_path = ''
as $$
  select om.role
  from public.organization_members om
  where om.organization_id = p_organization_id
    and om.user_id = (select auth.uid())
    and om.status = 'active';
$$;

create or replace function private.is_org_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.org_role(p_organization_id) is not null;
$$;

create or replace function private.has_org_role(p_organization_id uuid, p_roles public.org_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.org_role(p_organization_id) = any (p_roles), false);
$$;

-- Papel do usuário na empresa via company_members. Um vínculo à organização
-- suspenso/convidado anula também o acesso pontual às empresas dela.
create or replace function private.company_role(p_company_id uuid)
returns public.company_role
language sql
stable
security definer
set search_path = ''
as $$
  select cm.role
  from public.company_members cm
  where cm.company_id = p_company_id
    and cm.user_id = (select auth.uid())
    and not exists (
      select 1
      from public.companies c
      join public.organization_members om
        on om.organization_id = c.organization_id
       and om.user_id = cm.user_id
      where c.id = p_company_id
        and om.status <> 'active'
    );
$$;

create or replace function private.company_org(p_company_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.organization_id from public.companies c where c.id = p_company_id;
$$;

create or replace function private.can_read_company(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_org_role(private.company_org(p_company_id), '{owner,admin,accountant,viewer}')
      or private.company_role(p_company_id) is not null;
$$;

create or replace function private.can_write_company(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_org_role(private.company_org(p_company_id), '{owner,admin,accountant}')
      or private.company_role(p_company_id) = 'manager';
$$;

create or replace function private.can_delete_company(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_org_role(private.company_org(p_company_id), '{owner,admin}');
$$;

create or replace function private.can_create_company(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_org_role(p_organization_id, '{owner,admin,accountant}');
$$;

create or replace function private.can_manage_org(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_org_role(p_organization_id, '{owner,admin}');
$$;

-- O usuário atual pode ver o perfil de outro usuário? Sim, quando ambos
-- pertencem à mesma organização (estando o atual ativo) ou quando o outro tem
-- acesso pontual a uma empresa de organização que o atual administra.
create or replace function private.shares_org_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members me
    join public.organization_members other
      on other.organization_id = me.organization_id
    where me.user_id = (select auth.uid())
      and me.status = 'active'
      and other.user_id = p_user_id
  )
  or exists (
    select 1
    from public.company_members cm
    join public.companies c on c.id = cm.company_id
    where cm.user_id = p_user_id
      and private.can_manage_org(c.organization_id)
  );
$$;

revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated;

-- -----------------------------------------------------------------------------
-- Proteções de membros da organização
--   * apenas proprietários concedem, alteram ou removem o papel 'owner';
--   * a organização nunca fica sem ao menos um proprietário ativo.
-- -----------------------------------------------------------------------------
create or replace function private.guard_organization_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := coalesce(new.organization_id, old.organization_id);
  v_caller uuid := (select auth.uid());
  v_touches_owner boolean :=
    (tg_op in ('INSERT', 'UPDATE') and new.role = 'owner')
    or (tg_op in ('UPDATE', 'DELETE') and old.role = 'owner');
  v_remaining int;
begin
  -- Chamadas administrativas (SQL editor / service role) não têm auth.uid().
  if v_caller is not null and v_touches_owner then
    if private.org_role(v_org) is distinct from 'owner'
       -- Primeiro proprietário de uma organização recém-criada.
       and not (tg_op = 'INSERT' and new.user_id = v_caller
                and not exists (select 1 from public.organization_members where organization_id = v_org)) then
      raise exception 'Somente proprietários podem gerenciar o papel de proprietário'
        using errcode = '42501';
    end if;
  end if;

  if tg_op in ('UPDATE', 'DELETE') and old.role = 'owner' and old.status = 'active'
     and (tg_op = 'DELETE' or new.role <> 'owner' or new.status <> 'active') then
    select count(*) into v_remaining
    from public.organization_members
    where organization_id = v_org and role = 'owner' and status = 'active' and id <> old.id;
    if v_remaining = 0 then
      raise exception 'A organização precisa de ao menos um proprietário ativo'
        using errcode = '23514';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger organization_members_guard
  before insert or update or delete on public.organization_members
  for each row execute function private.guard_organization_members();

-- -----------------------------------------------------------------------------
-- Privilégios: nada para anon; authenticated somente o necessário.
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

grant select, update on public.organizations to authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
grant select, insert, update, delete on public.companies to authenticated;
grant select, insert, update, delete on public.clients to authenticated;
grant select, insert, update, delete on public.client_contacts to authenticated;
grant select, insert, delete on public.client_documents to authenticated;
grant update (document_name, document_type) on public.client_documents to authenticated;
grant select, insert, update, delete on public.organization_members to authenticated;
grant select, insert, update, delete on public.company_members to authenticated;
grant select on public.audit_logs to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.organizations        enable row level security;
alter table public.profiles             enable row level security;
alter table public.companies            enable row level security;
alter table public.organization_members enable row level security;
alter table public.company_members      enable row level security;
alter table public.clients              enable row level security;
alter table public.client_contacts      enable row level security;
alter table public.client_documents     enable row level security;
alter table public.audit_logs           enable row level security;

-- organizations ---------------------------------------------------------------
create policy organizations_select on public.organizations
  for select to authenticated
  using (private.is_org_member(id));

create policy organizations_update on public.organizations
  for update to authenticated
  using (private.can_manage_org(id))
  with check (private.can_manage_org(id));
-- INSERT/DELETE apenas via função public.create_organization / administração.

-- profiles --------------------------------------------------------------------
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.shares_org_with(id));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- companies -------------------------------------------------------------------
-- Usa as colunas da própria linha (sem autoconsulta), o que também funciona
-- em INSERT ... RETURNING.
create policy companies_select on public.companies
  for select to authenticated
  using (
    private.has_org_role(organization_id, '{owner,admin,accountant,viewer}')
    or private.company_role(id) is not null
  );

create policy companies_insert on public.companies
  for insert to authenticated
  with check (private.can_create_company(organization_id));

create policy companies_update on public.companies
  for update to authenticated
  using (
    private.has_org_role(organization_id, '{owner,admin,accountant}')
    or private.company_role(id) = 'manager'
  )
  with check (
    private.has_org_role(organization_id, '{owner,admin,accountant}')
    or private.company_role(id) = 'manager'
  );

create policy companies_delete on public.companies
  for delete to authenticated
  using (private.has_org_role(organization_id, '{owner,admin}') and not is_internal);

-- organization_members --------------------------------------------------------
create policy organization_members_select on public.organization_members
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_org_member(organization_id));

create policy organization_members_insert on public.organization_members
  for insert to authenticated
  with check (private.can_manage_org(organization_id));

create policy organization_members_update on public.organization_members
  for update to authenticated
  using (private.can_manage_org(organization_id))
  with check (private.can_manage_org(organization_id));

create policy organization_members_delete on public.organization_members
  for delete to authenticated
  using (private.can_manage_org(organization_id));

-- company_members -------------------------------------------------------------
create policy company_members_select on public.company_members
  for select to authenticated
  using (user_id = (select auth.uid()) or private.can_read_company(company_id));

create policy company_members_insert on public.company_members
  for insert to authenticated
  with check (private.can_manage_org(private.company_org(company_id)));

create policy company_members_update on public.company_members
  for update to authenticated
  using (private.can_manage_org(private.company_org(company_id)))
  with check (private.can_manage_org(private.company_org(company_id)));

create policy company_members_delete on public.company_members
  for delete to authenticated
  using (private.can_manage_org(private.company_org(company_id)));

-- clients ---------------------------------------------------------------------
create policy clients_select on public.clients
  for select to authenticated
  using (private.can_read_company(company_id));

create policy clients_insert on public.clients
  for insert to authenticated
  with check (private.can_create_company(organization_id) and private.can_write_company(company_id));

create policy clients_update on public.clients
  for update to authenticated
  using (private.can_write_company(company_id))
  with check (private.can_write_company(company_id));

create policy clients_delete on public.clients
  for delete to authenticated
  using (private.can_delete_company(company_id));

-- client_contacts -------------------------------------------------------------
create policy client_contacts_select on public.client_contacts
  for select to authenticated
  using (private.can_read_company(company_id));

create policy client_contacts_insert on public.client_contacts
  for insert to authenticated
  with check (private.can_write_company(company_id));

create policy client_contacts_update on public.client_contacts
  for update to authenticated
  using (private.can_write_company(company_id))
  with check (private.can_write_company(company_id));

create policy client_contacts_delete on public.client_contacts
  for delete to authenticated
  using (private.can_write_company(company_id));

-- client_documents ------------------------------------------------------------
create policy client_documents_select on public.client_documents
  for select to authenticated
  using (private.can_read_company(company_id));

create policy client_documents_insert on public.client_documents
  for insert to authenticated
  with check (
    private.can_write_company(company_id)
    and uploaded_by = (select auth.uid())
    and storage_path like private.company_org(company_id)::text || '/' || company_id::text || '/%'
  );

create policy client_documents_update on public.client_documents
  for update to authenticated
  using (private.can_write_company(company_id))
  with check (private.can_write_company(company_id));

create policy client_documents_delete on public.client_documents
  for delete to authenticated
  using (private.can_write_company(company_id));

-- audit_logs (somente leitura; gravação exclusiva pelos gatilhos) ------------
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (
    (organization_id is not null and private.can_manage_org(organization_id))
    or (company_id is not null and private.can_read_company(company_id))
  );
