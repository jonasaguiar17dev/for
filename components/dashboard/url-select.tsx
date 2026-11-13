"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { NativeSelect } from "@/components/ui/native-select";

/** Select que grava a escolha na URL (mantém a página compartilhável e renderizada no servidor). */
export function UrlSelect({
  param,
  value,
  options,
  label,
  className,
}: {
  param: string;
  value: string;
  options: { value: string; label: string }[];
  label: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  return (
    <NativeSelect
      aria-label={label}
      value={value}
      disabled={pending}
      className={className}
      onChange={(e) => {
        const next = new URLSearchParams(params.toString());
        next.set(param, e.target.value);
        startTransition(() => router.replace(`${pathname}?${next}`, { scroll: false }));
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </NativeSelect>
  );
}
