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

export type ProductFilters = {
  q: string;
  status: string;
  method: string;
  sort: string;
};

/** Filters live in the URL; the server does the filtering, sorting and paging. */
export function ProductsToolbar({
  filters,
}: {
  filters: ProductFilters;
}): ReactNode {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function apply(next: Partial<ProductFilters>) {
    const merged = { ...filters, ...next };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(merged))
      if (value) params.set(key, value);
    startTransition(() =>
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    );
  }

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply({ q: String(new FormData(event.currentTarget).get("q") ?? "") });
  }

  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center">
      <form onSubmit={onSearch} role="search" className="md:w-72">
        <InputGroup>
          <InputGroupAddon>
            {pending ? <Spinner /> : <Search />}
          </InputGroupAddon>
          <InputGroupInput
            name="q"
            defaultValue={filters.q}
            placeholder="Cari nama atau slug..."
            aria-label="Cari produk"
          />
        </InputGroup>
      </form>
      <div className="grid grid-cols-3 gap-2 md:flex">
        <NativeSelect
          aria-label="Status"
          value={filters.status}
          onChange={(event) => apply({ status: event.target.value })}
        >
          <NativeSelectOption value="">Semua status</NativeSelectOption>
          <NativeSelectOption value="published">
            Dipublikasikan
          </NativeSelectOption>
          <NativeSelectOption value="draft">Draf</NativeSelectOption>
        </NativeSelect>
        <NativeSelect
          aria-label="Metode checkout"
          value={filters.method}
          onChange={(event) => apply({ method: event.target.value })}
        >
          <NativeSelectOption value="">Semua metode</NativeSelectOption>
          <NativeSelectOption value="whatsapp">WhatsApp</NativeSelectOption>
          <NativeSelectOption value="direct">
            Checkout langsung
          </NativeSelectOption>
        </NativeSelect>
        <NativeSelect
          aria-label="Urutkan"
          value={filters.sort}
          onChange={(event) => apply({ sort: event.target.value })}
        >
          <NativeSelectOption value="updated">
            Terakhir diubah
          </NativeSelectOption>
          <NativeSelectOption value="name">Nama A-Z</NativeSelectOption>
          <NativeSelectOption value="price-asc">
            Harga termurah
          </NativeSelectOption>
          <NativeSelectOption value="price-desc">
            Harga termahal
          </NativeSelectOption>
        </NativeSelect>
      </div>
    </div>
  );
}
