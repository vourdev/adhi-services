import { Cancel01Icon, DiscountTag01Icon } from "@hugeicons/core-free-icons";
import {
  type KeyboardEvent,
  type ReactNode,
  useId,
  useState,
  useTransition,
} from "react";

import { previewDiscountCodeAction } from "@/app/_actions/discount-code";
import { formatRupiah } from "@/lib/format";

import { Icon } from "./icon";

export type AppliedDiscount = {
  code: string;
  discountAmount: number;
  finalPrice: number;
  idempotencyKey: string;
};

/**
 * "Punya kode diskon?": collapsed until the buyer opens it, then a code
 * input checked on the server. Lives inside the checkout form, so Enter
 * applies the code instead of submitting the order.
 *
 * Rendered only from client components (the checkout form and the
 * WhatsApp order box), which is why this file has no "use client".
 */
export function DiscountCodeField({
  productId,
  applied,
  onChange,
}: {
  productId: string;
  applied: AppliedDiscount | null;
  onChange: (applied: AppliedDiscount | null) => void;
}): ReactNode {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function apply() {
    const code = value.trim();
    if (!code) {
      setError("Masukkan kode diskon.");
      return;
    }
    startTransition(async () => {
      const result = await previewDiscountCodeAction(productId, code);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      onChange({
        code: result.code,
        discountAmount: result.discountAmount,
        finalPrice: result.finalPrice,
        idempotencyKey: result.idempotencyKey,
      });
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      apply();
    }
  }

  if (applied) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-p-accent-soft py-2.5 pr-2 pl-3.5">
        <Icon
          icon={DiscountTag01Icon}
          className="size-5 shrink-0 text-p-accent"
        />
        <p className="min-w-0 flex-1 text-[14px] leading-snug" role="status">
          Kode <span className="font-semibold">{applied.code}</span> dipakai,
          hemat {formatRupiah(applied.discountAmount)}
        </p>
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setValue("");
          }}
          aria-label="Hapus kode diskon"
          className="grid size-10 shrink-0 place-items-center rounded-full text-p-muted transition-colors hover:text-p-fg"
        >
          <Icon icon={Cancel01Icon} className="size-5" />
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-fit items-center gap-2 rounded-full py-2 text-[14px] font-semibold text-p-accent"
      >
        <Icon icon={DiscountTag01Icon} className="size-5" />
        Punya kode diskon?
      </button>
    );
  }

  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        Kode diskon
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          id={id}
          value={value}
          onChange={(event) => {
            setValue(event.target.value.toUpperCase());
            if (error) setError(null);
          }}
          onKeyDown={onKeyDown}
          // The buyer just opened the field to type a code.
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          enterKeyHint="done"
          maxLength={32}
          placeholder="Contoh: 1010"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="block h-12 min-w-0 flex-1 rounded-xl border border-p-line bg-p-card px-3.5 text-base font-semibold tracking-wide text-p-fg uppercase placeholder:font-normal placeholder:tracking-normal placeholder:text-p-muted/70 placeholder:normal-case aria-invalid:border-red-500"
        />
        <button
          type="button"
          onClick={apply}
          disabled={pending}
          className="h-12 shrink-0 rounded-xl bg-p-fg px-5 text-[15px] font-semibold text-p-bg transition-opacity disabled:opacity-60"
        >
          {pending ? "Mengecek..." : "Pakai"}
        </button>
      </div>
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1.5 text-sm text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
