/**
 * Tipos do banco no formato esperado pelo supabase-js.
 *
 * Escritos a partir das migrations em supabase/migrations. Após vincular o
 * projeto ao Supabase, é possível regenerá-los com:
 *   npx supabase gen types typescript --project-id <id> --schema public > types/database.ts
 */
import type {
  Address,
  CompanyRole,
  CompanyStatus,
  ContractStatus,
  DocumentType,
  MemberStatus,
  OnboardingStatus,
  OrgRole,
  TaxRegime,
} from "./domain";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

export type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  created_at: string;
};

export type CompanyRow = {
  id: string;
  organization_id: string;
  corporate_name: string;
  trade_name: string | null;
  cnpj: string;
  tax_regime: TaxRegime;
  state_registration: string | null;
  municipal_registration: string | null;
  cnae: string | null;
  address: Address;
  status: CompanyStatus;
  is_internal: boolean;
  created_at: string;
  updated_at: string;
};

export type OrganizationMemberRow = {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  status: MemberStatus;
  created_at: string;
};

export type CompanyMemberRow = {
  id: string;
  company_id: string;
  user_id: string;
  role: CompanyRole;
  created_at: string;
};

export type ClientRow = {
  id: string;
  organization_id: string;
  company_id: string;
  responsible_name: string;
  email: string | null;
  phone: string | null;
  contract_status: ContractStatus;
  onboarding_status: OnboardingStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientContactRow = {
  id: string;
  company_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  created_at: string;
};

export type ClientDocumentRow = {
  id: string;
  company_id: string;
  document_name: string;
  storage_path: string;
  document_type: DocumentType;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
};

export type AuditLogRow = {
  id: string;
  organization_id: string | null;
  company_id: string | null;
  user_id: string | null;
  action: "insert" | "update" | "delete";
  entity: string;
  entity_id: string | null;
  changes: Json | null;
  created_at: string;
};

export type SearchCompaniesRow = {
  company_id: string;
  client_id: string | null;
  corporate_name: string;
  trade_name: string | null;
  cnpj: string;
  tax_regime: TaxRegime;
  company_status: CompanyStatus;
  is_internal: boolean;
  responsible_name: string | null;
  contract_status: ContractStatus | null;
  created_at: string;
  total_count: number;
};

export type DashboardSummary = {
  total_companies: number;
  clients_by_status: Partial<Record<ContractStatus, number>>;
  companies_by_regime: Partial<Record<TaxRegime, number>>;
  recent_clients: {
    company_id: string;
    corporate_name: string;
    cnpj: string;
    contract_status: ContractStatus;
    created_at: string;
  }[];
};

export type Database = {
  public: {
    Tables: {
      organizations: Table<OrganizationRow, Pick<OrganizationRow, "name" | "slug"> & Partial<OrganizationRow>>;
      profiles: Table<ProfileRow, Pick<ProfileRow, "id" | "email"> & Partial<ProfileRow>>;
      companies: Table<
        CompanyRow,
        Pick<CompanyRow, "organization_id" | "corporate_name" | "cnpj" | "tax_regime"> & Partial<CompanyRow>
      >;
      organization_members: Table<
        OrganizationMemberRow,
        Pick<OrganizationMemberRow, "organization_id" | "user_id"> & Partial<OrganizationMemberRow>
      >;
      company_members: Table<
        CompanyMemberRow,
        Pick<CompanyMemberRow, "company_id" | "user_id"> & Partial<CompanyMemberRow>
      >;
      clients: Table<
        ClientRow,
        Pick<ClientRow, "organization_id" | "company_id" | "responsible_name"> & Partial<ClientRow>
      >;
      client_contacts: Table<
        ClientContactRow,
        Pick<ClientContactRow, "company_id" | "name"> & Partial<ClientContactRow>
      >;
      client_documents: Table<
        ClientDocumentRow,
        Pick<ClientDocumentRow, "company_id" | "document_name" | "storage_path"> & Partial<ClientDocumentRow>
      >;
      audit_logs: Table<AuditLogRow, never, never>;
    };
    Views: Record<string, never>;
    Functions: {
      create_organization: {
        Args: { p_name: string; p_slug: string; p_company: Json };
        Returns: string;
      };
      save_company: {
        Args: {
          p_organization_id: string;
          p_company_id: string | null;
          p_company: Json;
          p_client?: Json | null;
          p_contacts?: Json | null;
        };
        Returns: string;
      };
      search_companies: {
        Args: {
          p_organization_id: string;
          p_search?: string | null;
          p_tax_regime?: TaxRegime | null;
          p_contract_status?: ContractStatus | null;
          p_company_status?: CompanyStatus | null;
          p_clients_only?: boolean;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: SearchCompaniesRow[];
      };
      dashboard_summary: {
        Args: { p_organization_id: string };
        Returns: Json;
      };
      add_organization_member: {
        Args: { p_organization_id: string; p_email: string; p_role: OrgRole };
        Returns: string;
      };
      set_company_member: {
        Args: { p_company_id: string; p_email: string; p_role: CompanyRole };
        Returns: string;
      };
      is_valid_cnpj: {
        Args: { p_cnpj: string };
        Returns: boolean;
      };
    };
    Enums: {
      org_role: OrgRole;
      member_status: MemberStatus;
      company_role: CompanyRole;
      tax_regime: TaxRegime;
      company_status: CompanyStatus;
      contract_status: ContractStatus;
      onboarding_status: OnboardingStatus;
      document_type: DocumentType;
    };
    CompositeTypes: Record<string, never>;
  };
};
