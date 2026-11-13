-- =============================================================================
-- Aguiar ERP — Migration 0004: funções de negócio (RPC)
-- =============================================================================
-- Funções SECURITY INVOKER executam com as permissões do usuário: o RLS se
-- aplica a cada comando. Funções SECURITY DEFINER validam explicitamente a
-- autorização antes de qualquer escrita.
-- =============================================================================

-- Converte texto opcional: string vazia -> null.
create or replace function private.nz(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(btrim(p_value), '');
$$;

-- Escapa curingas do LIKE em texto informado pelo usuário.
create or replace function private.like_escape(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace(replace(replace(p_value, '\', '\\'), '%', '\%'), '_', '\_');
$$;

grant execute on function private.nz(text) to authenticated;
grant execute on function private.like_escape(text) to authenticated;

-- -----------------------------------------------------------------------------
-- create_organization: cria a organização, o vínculo de proprietário do usuário
-- atual e o CNPJ interno (gestão própria).
-- -----------------------------------------------------------------------------
create or replace function public.create_organization(
  p_name text,
  p_slug text,
  p_company jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_org uuid := gen_random_uuid();
begin
  if v_user is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;
  if not exists (select 1 from public.profiles where id = v_user) then
    raise exception 'Perfil do usuário não encontrado' using errcode = 'P0002';
  end if;

  insert into public.organizations (id, name, slug)
  values (v_org, btrim(p_name), lower(btrim(p_slug)));

  insert into public.organization_members (organization_id, user_id, role, status)
  values (v_org, v_user, 'owner', 'active');

  insert into public.companies (
    organization_id, corporate_name, trade_name, cnpj, tax_regime,
    state_registration, municipal_registration, cnae, address, status, is_internal
  ) values (
    v_org,
    btrim(p_company ->> 'corporate_name'),
    private.nz(p_company ->> 'trade_name'),
    upper(p_company ->> 'cnpj'),
    (p_company ->> 'tax_regime')::public.tax_regime,
    private.nz(p_company ->> 'state_registration'),
    private.nz(p_company ->> 'municipal_registration'),
    private.nz(p_company ->> 'cnae'),
    coalesce(p_company -> 'address', '{}'::jsonb),
    coalesce(private.nz(p_company ->> 'status'), 'ativa')::public.company_status,
    true
  );

  return v_org;
end;
$$;

-- -----------------------------------------------------------------------------
-- save_company: cria ou atualiza empresa + (opcional) cliente + (opcional)
-- contatos, de forma atômica. SECURITY INVOKER: o RLS valida cada passo.
--   p_company_id null  -> cria
--   p_client     null  -> não altera dados do cliente
--   p_contacts   null  -> não altera contatos; array -> sincroniza (upsert +
--                         remoção dos ausentes)
-- -----------------------------------------------------------------------------
create or replace function public.save_company(
  p_organization_id uuid,
  p_company_id uuid,
  p_company jsonb,
  p_client jsonb default null,
  p_contacts jsonb default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_company_id uuid := p_company_id;
  v_is_internal boolean := false;
  v_contact jsonb;
  v_keep uuid[] := '{}';
  v_contact_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;

  if v_company_id is null then
    v_company_id := gen_random_uuid();
    insert into public.companies (
      id, organization_id, corporate_name, trade_name, cnpj, tax_regime,
      state_registration, municipal_registration, cnae, address, status
    ) values (
      v_company_id,
      p_organization_id,
      btrim(p_company ->> 'corporate_name'),
      private.nz(p_company ->> 'trade_name'),
      upper(p_company ->> 'cnpj'),
      (p_company ->> 'tax_regime')::public.tax_regime,
      private.nz(p_company ->> 'state_registration'),
      private.nz(p_company ->> 'municipal_registration'),
      private.nz(p_company ->> 'cnae'),
      coalesce(p_company -> 'address', '{}'::jsonb),
      coalesce(private.nz(p_company ->> 'status'), 'ativa')::public.company_status
    );
  else
    update public.companies set
      corporate_name         = btrim(p_company ->> 'corporate_name'),
      trade_name             = private.nz(p_company ->> 'trade_name'),
      cnpj                   = upper(p_company ->> 'cnpj'),
      tax_regime             = (p_company ->> 'tax_regime')::public.tax_regime,
      state_registration     = private.nz(p_company ->> 'state_registration'),
      municipal_registration = private.nz(p_company ->> 'municipal_registration'),
      cnae                   = private.nz(p_company ->> 'cnae'),
      address                = coalesce(p_company -> 'address', '{}'::jsonb),
      status                 = coalesce(private.nz(p_company ->> 'status'), 'ativa')::public.company_status
    where id = v_company_id
      and organization_id = p_organization_id
    returning is_internal into v_is_internal;

    if not found then
      raise exception 'Empresa não encontrada ou sem permissão de edição' using errcode = '42501';
    end if;
  end if;

  if p_client is not null then
    if v_is_internal then
      raise exception 'O CNPJ interno da organização não é um cliente' using errcode = '22023';
    end if;

    insert into public.clients (
      organization_id, company_id, responsible_name, email, phone,
      contract_status, onboarding_status, notes
    ) values (
      p_organization_id,
      v_company_id,
      btrim(p_client ->> 'responsible_name'),
      lower(private.nz(p_client ->> 'email')),
      private.nz(p_client ->> 'phone'),
      coalesce(private.nz(p_client ->> 'contract_status'), 'em_implantacao')::public.contract_status,
      coalesce(private.nz(p_client ->> 'onboarding_status'), 'nao_iniciado')::public.onboarding_status,
      private.nz(p_client ->> 'notes')
    )
    on conflict (company_id) do update set
      responsible_name  = excluded.responsible_name,
      email             = excluded.email,
      phone             = excluded.phone,
      contract_status   = excluded.contract_status,
      onboarding_status = excluded.onboarding_status,
      notes             = excluded.notes;
  end if;

  if p_contacts is not null then
    if jsonb_typeof(p_contacts) <> 'array' then
      raise exception 'Contatos devem ser uma lista' using errcode = '22023';
    end if;

    for v_contact in select * from jsonb_array_elements(p_contacts) loop
      v_contact_id := nullif(v_contact ->> 'id', '')::uuid;
      if v_contact_id is not null then
        update public.client_contacts set
          name     = btrim(v_contact ->> 'name'),
          email    = lower(private.nz(v_contact ->> 'email')),
          phone    = private.nz(v_contact ->> 'phone'),
          position = private.nz(v_contact ->> 'position')
        where id = v_contact_id and company_id = v_company_id;
        if not found then
          raise exception 'Contato não pertence a esta empresa' using errcode = '42501';
        end if;
      else
        v_contact_id := gen_random_uuid();
        insert into public.client_contacts (id, company_id, name, email, phone, position)
        values (
          v_contact_id,
          v_company_id,
          btrim(v_contact ->> 'name'),
          lower(private.nz(v_contact ->> 'email')),
          private.nz(v_contact ->> 'phone'),
          private.nz(v_contact ->> 'position')
        );
      end if;
      v_keep := v_keep || v_contact_id;
    end loop;

    delete from public.client_contacts
    where company_id = v_company_id
      and not (id = any (v_keep));
  end if;

  return v_company_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- search_companies: listagem paginada com pesquisa e filtros (RLS aplicado).
-- -----------------------------------------------------------------------------
create or replace function public.search_companies(
  p_organization_id uuid,
  p_search text default null,
  p_tax_regime public.tax_regime default null,
  p_contract_status public.contract_status default null,
  p_company_status public.company_status default null,
  p_clients_only boolean default true,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  company_id uuid,
  client_id uuid,
  corporate_name text,
  trade_name text,
  cnpj text,
  tax_regime public.tax_regime,
  company_status public.company_status,
  is_internal boolean,
  responsible_name text,
  contract_status public.contract_status,
  created_at timestamptz,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select
      private.like_escape(private.nz(p_search)) as term,
      private.like_escape(upper(regexp_replace(coalesce(p_search, ''), '[^0-9A-Za-z]', '', 'g'))) as cnpj_term
  )
  select
    c.id,
    cl.id,
    c.corporate_name,
    c.trade_name,
    c.cnpj::text,
    c.tax_regime,
    c.status,
    c.is_internal,
    cl.responsible_name,
    cl.contract_status,
    coalesce(cl.created_at, c.created_at),
    count(*) over ()
  from public.companies c
  left join public.clients cl on cl.company_id = c.id
  cross join params p
  where c.organization_id = p_organization_id
    and (not p_clients_only or cl.id is not null)
    and (
      p.term is null
      or c.corporate_name ilike '%' || p.term || '%'
      or c.trade_name ilike '%' || p.term || '%'
      or (char_length(p.cnpj_term) >= 2 and c.cnpj like '%' || p.cnpj_term || '%')
    )
    and (p_tax_regime is null or c.tax_regime = p_tax_regime)
    and (p_contract_status is null or cl.contract_status = p_contract_status)
    and (p_company_status is null or c.status = p_company_status)
  order by c.is_internal desc, lower(c.corporate_name), c.id
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- -----------------------------------------------------------------------------
-- dashboard_summary: indicadores reais (RLS aplicado).
-- -----------------------------------------------------------------------------
create or replace function public.dashboard_summary(p_organization_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
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
    )
  );
$$;

-- -----------------------------------------------------------------------------
-- Gestão de acessos (SECURITY DEFINER com verificação explícita)
-- -----------------------------------------------------------------------------
create or replace function public.add_organization_member(
  p_organization_id uuid,
  p_email text,
  p_role public.org_role
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_id uuid;
begin
  if not private.can_manage_org(p_organization_id) then
    raise exception 'Sem permissão para gerenciar membros' using errcode = '42501';
  end if;

  select id into v_user from public.profiles where lower(email) = lower(btrim(p_email));
  if v_user is null then
    raise exception 'Usuário não encontrado. Cadastre-o primeiro no Supabase Auth.' using errcode = 'P0002';
  end if;

  insert into public.organization_members (organization_id, user_id, role, status)
  values (p_organization_id, v_user, p_role, 'active')
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    raise exception 'Usuário já é membro desta organização' using errcode = '23505';
end;
$$;

create or replace function public.set_company_member(
  p_company_id uuid,
  p_email text,
  p_role public.company_role
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_id uuid;
begin
  if not private.can_manage_org(private.company_org(p_company_id)) then
    raise exception 'Sem permissão para gerenciar acessos desta empresa' using errcode = '42501';
  end if;

  select id into v_user from public.profiles where lower(email) = lower(btrim(p_email));
  if v_user is null then
    raise exception 'Usuário não encontrado. Cadastre-o primeiro no Supabase Auth.' using errcode = 'P0002';
  end if;

  insert into public.company_members (company_id, user_id, role)
  values (p_company_id, v_user, p_role)
  on conflict (company_id, user_id) do update set role = excluded.role
  returning id into v_id;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permissões de execução
-- -----------------------------------------------------------------------------
revoke all on function public.create_organization(text, text, jsonb) from public, anon;
revoke all on function public.save_company(uuid, uuid, jsonb, jsonb, jsonb) from public, anon;
revoke all on function public.search_companies(uuid, text, public.tax_regime, public.contract_status, public.company_status, boolean, int, int) from public, anon;
revoke all on function public.dashboard_summary(uuid) from public, anon;
revoke all on function public.add_organization_member(uuid, text, public.org_role) from public, anon;
revoke all on function public.set_company_member(uuid, text, public.company_role) from public, anon;
revoke all on function public.is_valid_cnpj(text) from anon;

grant execute on function public.create_organization(text, text, jsonb) to authenticated;
grant execute on function public.save_company(uuid, uuid, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.search_companies(uuid, text, public.tax_regime, public.contract_status, public.company_status, boolean, int, int) to authenticated;
grant execute on function public.dashboard_summary(uuid) to authenticated;
grant execute on function public.add_organization_member(uuid, text, public.org_role) to authenticated;
grant execute on function public.set_company_member(uuid, text, public.company_role) to authenticated;
