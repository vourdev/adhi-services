"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useTransition } from "react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { ORDER_STATUS_LABELS, ORDER_STATUSES } from "@/lib/domain";

export function OrdersFilter({
  q,
  status,
}: {
  q: string;
  status: string;
}): ReactNode {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function apply(next: { q?: string; status?: string }) {
    const params = new URLSearchParams();
    const merged = { q, status, ...next };
    if (merged.q) params.set("q", merged.q);
    if (merged.status) params.set("status", merged.status);
    startTransition(() =>
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply({ q: String(new FormData(event.currentTarget).get("q") ?? "") });
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <form onSubmit={onSubmit} role="search" className="sm:w-80">
        <InputGroup>
          <InputGroupAddon>
            {pending ? <Spinner /> : <Search />}
          </InputGroupAddon>
          <InputGroupInput
            name="q"
            defaultValue={q}
            placeholder="Nomor pesanan, nama, atau email"
            aria-label="Cari pesanan"
          />
        </InputGroup>
      </form>
      <NativeSelect
        aria-label="Status pesanan"
        value={status}
        onChange={(event) => apply({ status: event.target.value })}
      >
        <NativeSelectOption value="">Semua status</NativeSelectOption>
        {ORDER_STATUSES.map((value) => (
          <NativeSelectOption key={value} value={value}>
            {ORDER_STATUS_LABELS[value]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}
