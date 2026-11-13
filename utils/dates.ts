/** Datas sem fuso (AAAA-MM-DD) usadas em contratos e cobranças. */

export function todayISO(timeZone = "America/Sao_Paulo"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}

/** "2027-01-15" -> "2027-01-01" */
export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** "2027-01-15" -> "15/01/2027" (sem conversão de fuso). */
export function formatISODate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** "2027-01-01" -> "01/2027" */
export function formatCompetence(iso: string | null | undefined): string {
  if (!iso) return "—";
  return `${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

export function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
