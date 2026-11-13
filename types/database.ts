/**
 * Tipos do banco no formato esperado pelo supabase-js.
 *
 * Escritos a partir das migrations em supabase/migrations. Após vincular o
 * projeto ao Supabase, é possível regenerá-los com:
 *   npx supabase gen types typescript --project-id <id> --schema public > types/database.ts
 */
import type {
  Address,
  AdjustmentIndex,
  BillingFrequency,
  ContractState,
  PaymentMethod,
  ReceivableStatus,
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
  new_clients_by_month: { month: string; count: number }[];
  recent_clients: {
    company_id: string;
    corporate_name: string;
    cnpj: string;
    contract_status: ContractStatus;
    created_at: string;
  }[];
};

export type ServiceRow = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  default_amount: number;
  billing_frequency: BillingFrequency;
  active: boolean;
  created_at: string;
};

export type ContractRow = {
  id: string;
  organization_id: string;
  company_id: string;
  number: string;
  status: ContractState;
  start_date: string;
  end_date: string | null;
  billing_day: number;
  adjustment_index: AdjustmentIndex;
  adjustment_month: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ContractItemRow = {
  id: string;
  contract_id: string;
  service_id: string | null;
  description: string;
  quantity: number;
  unit_amount: number;
  billing_frequency: BillingFrequency;
  created_at: string;
};

export type ReceivableRow = {
  id: string;
  organization_id: string;
  company_id: string;
  contract_id: string | null;
  description: string;
  competence: string;
  due_date: string;
  amount: number;
  status: ReceivableStatus;
  paid_at: string | null;
  paid_amount: number | null;
  payment_method: PaymentMethod | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SearchReceivablesRow = {
  id: string;
  company_id: string;
  corporate_name: string;
  cnpj: string;
  contract_id: string | null;
  contract_number: string | null;
  description: string;
  competence: string;
  due_date: string;
  amount: number;
  status: ReceivableStatus;
  is_overdue: boolean;
  paid_at: string | null;
  paid_amount: number | null;
  payment_method: PaymentMethod | null;
  total_count: number;
  total_amount: number;
};

export type FinanceSummary = {
  open_total: number;
  open_count: number;
  overdue_total: number;
  overdue_count: number;
  due_soon_total: number;
  due_soon_count: number;
  month_billed: number;
  month_received: number;
  active_contracts: number;
  mrr: number;
  received_by_month: { month: string; billed: number; received: number }[];
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
      services: Table<ServiceRow, Pick<ServiceRow, "organization_id" | "name"> & Partial<ServiceRow>>;
      contracts: Table<
        ContractRow,
        Pick<ContractRow, "organization_id" | "company_id" | "number" | "start_date"> & Partial<ContractRow>
      >;
      contract_items: Table<
        ContractItemRow,
        Pick<ContractItemRow, "contract_id" | "description" | "unit_amount"> & Partial<ContractItemRow>
      >;
      receivables: Table<
        ReceivableRow,
        Pick<ReceivableRow, "organization_id" | "company_id" | "description" | "competence" | "due_date" | "amount"> &
          Partial<ReceivableRow>
      >;
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
      save_contract: {
        Args: { p_organization_id: string; p_contract_id: string | null; p_contract: Json; p_items: Json };
        Returns: string;
      };
      generate_billing: {
        Args: { p_organization_id: string; p_competence: string };
        Returns: number;
      };
      finance_summary: {
        Args: { p_organization_id: string; p_today?: string };
        Returns: Json;
      };
      search_receivables: {
        Args: {
          p_organization_id: string;
          p_search?: string | null;
          p_status?: string | null;
          p_competence?: string | null;
          p_company_id?: string | null;
          p_today?: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: SearchReceivablesRow[];
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
      billing_frequency: BillingFrequency;
      contract_state: ContractState;
      adjustment_index: AdjustmentIndex;
      receivable_status: ReceivableStatus;
      payment_method: PaymentMethod;
    };
    CompositeTypes: Record<string, never>;
  };
};
