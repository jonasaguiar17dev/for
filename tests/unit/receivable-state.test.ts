import { describe, expect, it } from "vitest";

import { percentChange } from "@/components/dashboard/kpi-card";
import { dueHint, receivableState } from "@/utils/receivable-state";

describe("situação exibida das cobranças", () => {
  const today = "2026-11-13";
  it("classifica por status e vencimento", () => {
    expect(receivableState("pago", "2026-10-01", today)).toBe("pago");
    expect(receivableState("cancelado", "2026-12-01", today)).toBe("cancelado");
    expect(receivableState("aberto", "2026-11-12", today)).toBe("vencido");
    expect(receivableState("aberto", "2026-11-13", today)).toBe("pendente");
    expect(receivableState("aberto", "2026-11-20", today)).toBe("pendente");
    expect(receivableState("aberto", "2026-11-21", today)).toBe("a_receber");
  });
  it("descreve o prazo", () => {
    expect(dueHint("2026-11-13", today)).toBe("vence hoje");
    expect(dueHint("2026-11-14", today)).toBe("vence amanhã");
    expect(dueHint("2026-11-18", today)).toBe("vence em 5 dias");
    expect(dueHint("2026-11-12", today)).toBe("venceu ontem");
    expect(dueHint("2026-11-01", today)).toBe("venceu há 12 dias");
  });
});

describe("comparação com o período anterior", () => {
  it("calcula a variação percentual e trata base zero", () => {
    expect(percentChange(120, 100)).toBe(20);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(10, 0)).toBeNull();
  });
});

describe("datas com horário", () => {
  it("aceita timestamps ISO no vencimento", () => {
    expect(receivableState("aberto", "2026-10-20T03:00:00.000Z", "2026-11-13")).toBe("vencido");
    expect(dueHint("2026-11-20T00:00:00.000Z", "2026-11-13")).toBe("vence em 7 dias");
  });
});
