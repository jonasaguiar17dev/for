/**
 * Consultas a serviços públicos (sem credenciais), executadas no navegador
 * apenas para pré-preencher formulários. Os dados SEMPRE passam pela validação
 * do formulário, do servidor e do banco antes de serem gravados.
 */
import type { CompanyStatus } from "@/types/domain";
import { onlyDigits } from "@/utils/format";

export type CepLookup = { street: string; district: string; city: string; state: string; complement: string };

export async function lookupCep(cep: string, signal?: AbortSignal): Promise<CepLookup | null> {
  const digits = onlyDigits(cep);
  if (digits.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.erro) return null;
    return {
      street: data.logradouro ?? "",
      district: data.bairro ?? "",
      city: data.localidade ?? "",
      state: data.uf ?? "",
      complement: data.complemento ?? "",
    };
  } catch {
    return null;
  }
}

export type CnpjLookup = {
  corporate_name: string;
  trade_name: string;
  cnae: string;
  status: CompanyStatus | "";
  address: { cep: string; street: string; number: string; complement: string; district: string; city: string; state: string };
};

const STATUS_MAP: Record<string, CompanyStatus> = {
  ATIVA: "ativa",
  SUSPENSA: "suspensa",
  INAPTA: "inapta",
  BAIXADA: "baixada",
  NULA: "nula",
};

/** Consulta pública de CNPJ (BrasilAPI). */
export async function lookupCnpj(cnpj: string, signal?: AbortSignal): Promise<CnpjLookup | null> {
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${encodeURIComponent(cnpj)}`, { signal });
    if (!res.ok) return null;
    const d = await res.json();
    return {
      corporate_name: d.razao_social ?? "",
      trade_name: d.nome_fantasia ?? "",
      cnae: d.cnae_fiscal ? String(d.cnae_fiscal).padStart(7, "0") : "",
      status: STATUS_MAP[String(d.descricao_situacao_cadastral ?? "").toUpperCase()] ?? "",
      address: {
        cep: onlyDigits(d.cep ?? ""),
        street: [d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(" "),
        number: d.numero ?? "",
        complement: d.complemento ?? "",
        district: d.bairro ?? "",
        city: d.municipio ?? "",
        state: d.uf ?? "",
      },
    };
  } catch {
    return null;
  }
}
