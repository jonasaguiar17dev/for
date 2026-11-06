"use client";

import { useEffect, useMemo, useRef } from "react";

/** Retorna uma versão com atraso (debounce) do callback informado. */
export function useDebouncedCallback<A extends unknown[]>(callback: (...args: A) => void, delay = 350) {
  const ref = useRef(callback);
  useEffect(() => {
    ref.current = callback;
  }, [callback]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return useMemo(
    () =>
      (...args: A) => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => ref.current(...args), delay);
      },
    [delay],
  );
}
