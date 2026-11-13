"use client";

import { useEffect, useRef } from "react";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const integer = new Intl.NumberFormat("pt-BR");

/**
 * Exibe o valor final já na renderização do servidor e, no navegador, anima de
 * 0 até ele na primeira exibição (desligado se o usuário prefere menos movimento).
 */
export function AnimatedNumber({ value, format = "number" }: { value: number; format?: "number" | "currency" }) {
  const ref = useRef<HTMLSpanElement>(null);
  const fmt = (n: number) => (format === "currency" ? currency.format(n) : integer.format(Math.round(n)));
  const finalText = fmt(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || value === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const f = (n: number) => (format === "currency" ? currency.format(n) : integer.format(Math.round(n)));
    const duration = 700;
    const t0 = performance.now();
    let frame = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      el.textContent = f(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      el.textContent = f(value);
    };
  }, [value, format]);

  return (
    <span ref={ref} className="num" aria-label={finalText}>
      {finalText}
    </span>
  );
}
