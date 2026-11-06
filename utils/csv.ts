/** Gera CSV (separador ";" e BOM, compatível com Excel pt-BR). */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (value: string | number | null | undefined) => {
    let text = value == null ? "" : String(value);
    // Evita injeção de fórmulas em planilhas.
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return "﻿" + [headers, ...rows].map((r) => r.map(escape).join(";")).join("\r\n");
}
