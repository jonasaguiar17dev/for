-- =============================================================================
-- Aguiar ERP — Migration 0005: Supabase Storage (documentos de clientes)
-- =============================================================================
-- Bucket privado. Caminho obrigatório dos objetos:
--   {organization_id}/{company_id}/{uuid}-{nome-do-arquivo}
-- O acesso é decidido pelas mesmas funções de autorização das tabelas.
-- Downloads acontecem somente por URLs assinadas de curta duração.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-documents',
  'client-documents',
  false,
  10485760, -- 10 MB
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.ms-excel',
    'text/xml',
    'application/xml'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Extrai o company_id do caminho, conferindo se a organização do caminho é a
-- organização real da empresa. Retorna null para caminhos inválidos.
create or replace function private.storage_company_id(p_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_parts text[] := string_to_array(p_name, '/');
  v_org uuid;
  v_company uuid;
begin
  if array_length(v_parts, 1) <> 3 or coalesce(v_parts[3], '') = '' then
    return null;
  end if;
  begin
    v_org := v_parts[1]::uuid;
    v_company := v_parts[2]::uuid;
  exception when invalid_text_representation then
    return null;
  end;
  if private.company_org(v_company) is distinct from v_org then
    return null;
  end if;
  return v_company;
end;
$$;

revoke all on function private.storage_company_id(text) from public;
grant execute on function private.storage_company_id(text) to authenticated;

create policy client_documents_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'client-documents'
    and private.can_read_company(private.storage_company_id(name))
  );

create policy client_documents_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'client-documents'
    and private.can_write_company(private.storage_company_id(name))
  );

create policy client_documents_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'client-documents'
    and private.can_write_company(private.storage_company_id(name))
  );
-- Sem política de UPDATE: arquivos são imutáveis (substituição = novo upload).
