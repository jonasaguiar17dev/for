/**
 * Matriz de permissões da aplicação.
 *
 * Espelha as funções private.can_* do banco. Serve para decidir o que exibir
 * na interface e para negar cedo nas Server Actions — mas a decisão final é
 * sempre do PostgreSQL (RLS). Alterar aqui NÃO concede acesso no banco.
 */
import type { CompanyRole, OrgRole } from "@/types/domain";

export type Permission =
  | "company:read_all"
  | "company:create"
  | "company:update"
  | "company:delete"
  | "document:write"
  | "members:manage"
  | "organization:update"
  | "audit:read_all"
  | "finance:write"
  | "services:manage";

const ROLE_PERMISSIONS: Record<OrgRole, readonly Permission[]> = {
  owner: [
    "company:read_all",
    "company:create",
    "company:update",
    "company:delete",
    "document:write",
    "members:manage",
    "organization:update",
    "audit:read_all",
    "finance:write",
    "services:manage",
  ],
  admin: [
    "company:read_all",
    "company:create",
    "company:update",
    "company:delete",
    "document:write",
    "members:manage",
    "organization:update",
    "audit:read_all",
    "finance:write",
    "services:manage",
  ],
  accountant: ["company:read_all", "company:create", "company:update", "document:write", "finance:write"],
  viewer: ["company:read_all"],
  member: [],
};

export function can(role: OrgRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Pode editar uma empresa específica (papel global ou vínculo de gestor). */
export function canEditCompany(orgRole: OrgRole | null | undefined, companyRole?: CompanyRole | null): boolean {
  return can(orgRole, "company:update") || companyRole === "manager";
}

/** Somente proprietários concedem ou alteram o papel de proprietário. */
export function canAssignRole(actor: OrgRole | null | undefined, target: OrgRole): boolean {
  if (!can(actor, "members:manage")) return false;
  if (target === "owner") return actor === "owner";
  return true;
}
