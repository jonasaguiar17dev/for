-- =============================================================================
-- Aguiar ERP — Migration 0001: esquema principal (tipos, tabelas, índices)
-- =============================================================================
-- Modelo multiempresa:
--   organizations          -> organização proprietária do ambiente (ex.: Aguiar)
--   companies              -> CNPJs administrados (inclui o CNPJ interno da Aguiar)
--   profiles               -> perfil 1:1 com auth.users
--   organization_members   -> vínculo usuário x organização (papel global)
--   company_members        -> vínculo usuário x empresa (acesso pontual)
--   clients                -> relação comercial da organização com a empresa
--   client_contacts        -> contatos da empresa cliente
--   client_documents       -> metadados de documentos (arquivo no Storage)
--   audit_logs             -> trilha de auditoria imutável
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- Esquema interno (não exposto pela API REST) para funções auxiliares.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- -----------------------------------------------------------------------------
-- Tipos enumerados
-- -----------------------------------------------------------------------------
create type public.org_role as enum (
  'owner',       -- proprietário: acesso total, gestão de membros e proprietários
  'admin',       -- administrador: acesso total, gestão de membros (exceto proprietários)
  'accountant',  -- contador: lê e edita todas as empresas da organização, sem excluir
  'viewer',      -- leitor: lê todas as empresas da organização
  'member'       -- colaborador: acessa apenas empresas vinculadas em company_members
);

create type public.member_status as enum ('active', 'invited', 'suspended');

create type public.company_role as enum (
  'manager',     -- edita dados, contatos e documentos da empresa
  'viewer'       -- somente leitura
);

create type public.tax_regime as enum (
  'simples_nacional',
  'mei',
  'lucro_presumido',
  'lucro_real',
  'lucro_arbitrado',
  'imune',
  'isenta',
  'outro'
);

-- Situação cadastral do CNPJ perante a Receita Federal.
create type public.company_status as enum ('ativa', 'suspensa', 'inapta', 'baixada', 'nula');

-- Situação do relacionamento contratual com o escritório.
create type public.contract_status as enum ('em_implantacao', 'ativo', 'suspenso', 'encerrado');

create type public.onboarding_status as enum ('nao_iniciado', 'em_andamento', 'concluido');

create type public.document_type as enum (
  'contrato_social',
  'alteracao_contratual',
  'cartao_cnpj',
  'procuracao',
  'certidao',
  'contrato_servico',
  'documento_pessoal',
  'outro'
);

-- -----------------------------------------------------------------------------
-- Validação de CNPJ (numérico e alfanumérico — IN RFB nº 2.229/2024)
-- Valor de cada caractere = código ASCII - 48; dígitos verificadores módulo 11.
-- -----------------------------------------------------------------------------
create or replace function public.is_valid_cnpj(p_cnpj text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := upper(coalesce(p_cnpj, ''));
  w1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
  w2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
  s int;
  r int;
  d1 int;
  d2 int;
begin
  if v !~ '^[0-9A-Z]{12}[0-9]{2}$' then
    return false;
  end if;
  if v ~ '^(.)\1{13}$' then
    return false;
  end if;

  s := 0;
  for i in 1..12 loop
    s := s + (ascii(substr(v, i, 1)) - 48) * w1[i];
  end loop;
  r := s % 11;
  d1 := case when r < 2 then 0 else 11 - r end;

  s := 0;
  for i in 1..13 loop
    s := s + (ascii(substr(v, i, 1)) - 48) * w2[i];
  end loop;
  r := s % 11;
  d2 := case when r < 2 then 0 else 11 - r end;

  return substr(v, 13, 1)::int = d1 and substr(v, 14, 1)::int = d2;
end;
$$;

-- -----------------------------------------------------------------------------
-- organizations
-- -----------------------------------------------------------------------------
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 2 and 160),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- profiles (1:1 com auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text check (full_name is null or char_length(full_name) <= 160),
  email       text not null,
  phone       text check (phone is null or phone ~ '^[0-9]{10,13}$'),
  created_at  timestamptz not null default now()
);
create unique index profiles_email_key on public.profiles (lower(email));

-- -----------------------------------------------------------------------------
-- companies (CNPJs administrados)
-- -----------------------------------------------------------------------------
create table public.companies (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references public.organizations (id) on delete cascade,
  corporate_name          text not null check (char_length(btrim(corporate_name)) between 2 and 200),
  trade_name              text check (trade_name is null or char_length(trade_name) <= 200),
  cnpj                    char(14) not null check (public.is_valid_cnpj(cnpj)),
  tax_regime              public.tax_regime not null,
  state_registration      text check (state_registration is null or char_length(state_registration) <= 20),
  municipal_registration  text check (municipal_registration is null or char_length(municipal_registration) <= 20),
  cnae                    char(7) check (cnae is null or cnae ~ '^[0-9]{7}$'),
  address                 jsonb not null default '{}'::jsonb check (jsonb_typeof(address) = 'object'),
  status                  public.company_status not null default 'ativa',
  is_internal             boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint companies_org_cnpj_key unique (organization_id, cnpj),
  -- Permite FK composta (garante que filhos pertençam à mesma organização).
  constraint companies_id_org_key unique (id, organization_id)
);
comment on column public.companies.is_internal is 'true para o CNPJ próprio da organização (gestão interna).';
comment on column public.companies.address is
  'Endereço estruturado: {cep, street, number, complement, district, city, state}.';

-- Apenas um CNPJ interno por organização.
create unique index companies_one_internal_per_org on public.companies (organization_id) where is_internal;
create index companies_org_idx on public.companies (organization_id);
create index companies_org_regime_idx on public.companies (organization_id, tax_regime);
create index companies_corporate_name_idx on public.companies (organization_id, lower(corporate_name));

-- -----------------------------------------------------------------------------
-- organization_members
-- -----------------------------------------------------------------------------
create table public.organization_members (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  role             public.org_role not null default 'member',
  status           public.member_status not null default 'active',
  created_at       timestamptz not null default now(),
  constraint organization_members_org_user_key unique (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members (user_id);

-- -----------------------------------------------------------------------------
-- company_members
-- -----------------------------------------------------------------------------
create table public.company_members (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        public.company_role not null default 'viewer',
  created_at  timestamptz not null default now(),
  constraint company_members_company_user_key unique (company_id, user_id)
);
create index company_members_user_idx on public.company_members (user_id);

-- -----------------------------------------------------------------------------
-- clients (relação da organização com a empresa atendida)
-- -----------------------------------------------------------------------------
create table public.clients (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  company_id         uuid not null unique,
  responsible_name   text not null check (char_length(btrim(responsible_name)) between 2 and 160),
  email              text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone              text check (phone is null or phone ~ '^[0-9]{10,13}$'),
  contract_status    public.contract_status not null default 'em_implantacao',
  onboarding_status  public.onboarding_status not null default 'nao_iniciado',
  notes              text check (notes is null or char_length(notes) <= 2000),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- FK composta: cliente e empresa obrigatoriamente na mesma organização.
  constraint clients_company_fk foreign key (company_id, organization_id)
    references public.companies (id, organization_id) on delete cascade
);
create index clients_org_status_idx on public.clients (organization_id, contract_status);

-- -----------------------------------------------------------------------------
-- client_contacts
-- -----------------------------------------------------------------------------
create table public.client_contacts (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 2 and 160),
  email       text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone       text check (phone is null or phone ~ '^[0-9]{10,13}$'),
  position    text check (position is null or char_length(position) <= 100),
  created_at  timestamptz not null default now()
);
create index client_contacts_company_idx on public.client_contacts (company_id);

-- -----------------------------------------------------------------------------
-- client_documents (arquivo físico no bucket privado "client-documents")
-- -----------------------------------------------------------------------------
create table public.client_documents (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete cascade,
  document_name  text not null check (char_length(btrim(document_name)) between 1 and 200),
  storage_path   text not null unique,
  document_type  public.document_type not null default 'outro',
  mime_type      text,
  size_bytes     bigint check (size_bytes is null or size_bytes >= 0),
  uploaded_by    uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now()
);
create index client_documents_company_idx on public.client_documents (company_id);

-- -----------------------------------------------------------------------------
-- audit_logs (sem FK para entidades: o histórico sobrevive à exclusão)
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid,
  company_id       uuid,
  user_id          uuid references public.profiles (id) on delete set null,
  action           text not null check (action in ('insert', 'update', 'delete')),
  entity           text not null,
  entity_id        uuid,
  changes          jsonb,
  created_at       timestamptz not null default now()
);
create index audit_logs_org_created_idx on public.audit_logs (organization_id, created_at desc);
create index audit_logs_company_created_idx on public.audit_logs (company_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity, entity_id);
