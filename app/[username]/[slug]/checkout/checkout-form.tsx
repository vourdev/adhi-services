"use client";

import Link from "next/link";
import { type ReactNode, useActionState, useState } from "react";

import {
  type AppliedDiscount,
  DiscountCodeField,
} from "@/components/profile/discount-code-field";
import { formatRupiah } from "@/lib/format";

import { checkoutAction, type CheckoutState } from "./actions";

const inputClass =
  "mt-1.5 block h-12 w-full rounded-xl border border-p-line bg-p-card px-3.5 text-base text-p-fg placeholder:text-p-muted/70 aria-invalid:border-red-500";

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string | undefined;
  children: ReactNode;
}): ReactNode {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p
          id={`${id}-error`}
          className="mt-1.5 text-sm text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-p-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function CheckoutForm({
  productId,
  idempotencyKey,
  price,
  discountEnabled,
}: {
  productId: string;
  idempotencyKey: string;
  price: number;
  /** Shows the code field; only when the owner has a code that could apply. */
  discountEnabled: boolean;
}): ReactNode {
  const [state, action, pending] = useActionState<CheckoutState, FormData>(
    checkoutAction,
    null
  );
  const [discount, setDiscount] = useState<AppliedDiscount | null>(null);
  const errors = state?.fieldErrors ?? {};
  const total = discount?.finalPrice ?? price;

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="productId" value={productId} />
      <input
        type="hidden"
        name="idempotencyKey"
        value={discount?.idempotencyKey ?? idempotencyKey}
      />
      <input type="hidden" name="expectedAmount" value={total} />
      <input type="hidden" name="discountCode" value={discount?.code ?? ""} />

      <Field id="buyerName" label="Nama lengkap" error={errors.buyerName}>
        <input
          id="buyerName"
          name="buyerName"
          autoComplete="name"
          required
          minLength={2}
          maxLength={80}
          aria-invalid={Boolean(errors.buyerName)}
          aria-describedby={errors.buyerName ? "buyerName-error" : undefined}
          className={inputClass}
        />
      </Field>
      <Field
        id="buyerEmail"
        label="Email"
        hint="Bukti pembayaran dari Midtrans dikirim ke email ini."
        error={errors.buyerEmail}
      >
        <input
          id="buyerEmail"
          name="buyerEmail"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          aria-invalid={Boolean(errors.buyerEmail)}
          aria-describedby={
            errors.buyerEmail ? "buyerEmail-error" : "buyerEmail-hint"
          }
          className={inputClass}
        />
      </Field>
      <Field
        id="buyerPhone"
        label="Nomor WhatsApp (opsional)"
        hint="Hanya dipakai jika perlu menghubungi Anda soal pesanan."
        error={errors.buyerPhone}
      >
        <input
          id="buyerPhone"
          name="buyerPhone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          aria-invalid={Boolean(errors.buyerPhone)}
          aria-describedby={
            errors.buyerPhone ? "buyerPhone-error" : "buyerPhone-hint"
          }
          className={inputClass}
        />
      </Field>

      {discountEnabled ? (
        <DiscountCodeField
          productId={productId}
          applied={discount}
          onChange={setDiscount}
        />
      ) : null}

      {discount ? (
        <dl className="flex flex-col gap-2 border-t border-p-line pt-4 text-[15px] tabular-nums">
          <div className="flex justify-between gap-4 text-p-muted">
            <dt>Harga</dt>
            <dd>{formatRupiah(price)}</dd>
          </div>
          <div className="flex justify-between gap-4 text-p-muted">
            <dt>Diskon ({discount.code})</dt>
            <dd>−{formatRupiah(discount.discountAmount)}</dd>
          </div>
          <div className="flex justify-between gap-4 text-base font-bold">
            <dt>Total</dt>
            <dd>{formatRupiah(total)}</dd>
          </div>
        </dl>
      ) : null}

      {state?.error ? (
        <p
          role="alert"
          className="rounded-xl bg-red-500/10 px-3.5 py-3 text-sm text-red-700 dark:text-red-300"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 flex h-13 w-full items-center justify-center rounded-full bg-p-accent px-6 text-base font-semibold text-p-accent-fg transition-[transform,opacity] active:scale-[0.98] disabled:opacity-70 motion-reduce:active:scale-100"
      >
        {pending ? "Menyiapkan pembayaran..." : `Bayar ${formatRupiah(total)}`}
      </button>
      <p className="text-center text-xs leading-relaxed text-p-muted">
        Anda akan diarahkan ke halaman pembayaran Midtrans. Data di atas dipakai
        untuk memproses pesanan ini saja.{" "}
        <Link href="/privasi" className="underline underline-offset-2">
          Privasi
        </Link>
      </p>
    </form>
  );
}
