/**
 * Aceita somente caminhos internos relativos para evitar open redirect
 * (ex.: "?next=https://site-malicioso.com" ou "//site-malicioso.com").
 */
export function safeRedirectPath(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value || typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\r\n\t]/.test(value)) return fallback;
  try {
    const url = new URL(value, "http://localhost");
    if (url.origin !== "http://localhost") return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}
