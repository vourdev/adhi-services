"use client";

import {
  Alert02Icon,
  BankIcon,
  CreditCardIcon,
  Mail01Icon,
  QrCode01Icon,
  SquareLock02Icon,
  UserIcon,
  Wallet01Icon,
  WhatsappIcon,
} from "@hugeicons/core-free-icons";
import Link from "next/link";
import { type ReactNode, useActionState, useState } from "react";

import {
  type AppliedDiscount,
  DiscountCodeField,
} from "@/components/profile/discount-code-field";
import { Icon, type IconSvgElement } from "@/components/profile/icon";
import { MediaImage } from "@/components/profile/media-image";
import { formatRupiah } from "@/lib/format";

import { checkoutAction, type CheckoutState } from "./actions";

const PAYMENT_METHODS: { icon: IconSvgElement; label: string }[] = [
  { icon: QrCode01Icon, label: "QRIS" },
  { icon: BankIcon, label: "Virtual account" },
  { icon: Wallet01Icon, label: "E-wallet" },
  { icon: CreditCardIcon, label: "Kartu" },
];

function Field({
  id,
  label,
  optional = false,
  icon,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  icon: IconSvgElement;
  hint?: string;
  error?: string | undefined;
  children: ReactNode;
}): ReactNode {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[14px] font-medium">
        {label}
        {optional ? (
          <span className="font-normal text-p-muted"> (opsional)</span>
        ) : null}
      </label>
      <div className="relative">
        <Icon
          icon={icon}
          className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-p-muted"
        />
        {children}
      </div>
      {error ? (
        <p
          id={`${id}-error`}
          className="flex items-center gap-1.5 text-[13px] text-red-600"
        >
          <Icon icon={Alert02Icon} className="size-4 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[12.5px] text-p-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const inputClass = "p-input block h-12 w-full pr-3.5 pl-11 text-base";

/**
 * The checkout form and the order summary beside it (below it on phones).
 * Totals follow the discount code as it is applied; the server recomputes
 * the price and refuses the order if it no longer matches.
 */
export function CheckoutForm({
  product,
  seller,
  idempotencyKey,
  price,
  discountEnabled,
}: {
  product: {
    id: string;
    name: string;
    coverUrl: string | null;
    hasDelivery: boolean;
  };
  seller: string;
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
    <form
      action={action}
      noValidate
      className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8"
    >
      <input type="hidden" name="productId" value={product.id} />
      <input
        type="hidden"
        name="idempotencyKey"
        value={discount?.idempotencyKey ?? idempotencyKey}
      />
      <input type="hidden" name="expectedAmount" value={total} />
      <input type="hidden" name="discountCode" value={discount?.code ?? ""} />

      <div className="flex flex-col gap-4">
        <section
          aria-label="Produk"
          className="p-card flex items-center gap-3.5 p-3.5"
        >
          {product.coverUrl ? (
            <MediaImage
              src={product.coverUrl}
              alt=""
              width={144}
              height={144}
              eager
              className="size-[4.5rem] shrink-0 rounded-[var(--p-r-media)] bg-p-line object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="grid size-[4.5rem] shrink-0 place-items-center rounded-[var(--p-r-media)] bg-p-accent-soft text-2xl font-bold text-p-accent-ink"
            >
              {product.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="line-clamp-2 text-[15px] leading-snug font-semibold">
              {product.name}
            </span>
            <span className="truncate text-[13px] text-p-muted">
              oleh {seller}
            </span>
            <span className="text-[15px] font-bold text-p-price tabular-nums">
              {formatRupiah(price)}
            </span>
          </div>
        </section>

        <section
          aria-labelledby="data-pembeli"
          className="p-card flex flex-col gap-4 p-5"
        >
          <div className="flex flex-col gap-1">
            <h2 id="data-pembeli" className="text-[17px] font-semibold">
              Data pembeli
            </h2>
            <p className="text-[13.5px] text-p-muted">
              {product.hasDelivery
                ? "Link produk dikirim ke halaman pesanan setelah pembayaran."
                : "Penjual memakai data ini untuk menghubungi Anda."}
            </p>
          </div>
          <Field
            id="buyerName"
            label="Nama lengkap"
            icon={UserIcon}
            error={errors.buyerName}
          >
            <input
              id="buyerName"
              name="buyerName"
              autoComplete="name"
              placeholder="Nama lengkap Anda"
              required
              minLength={2}
              maxLength={80}
              aria-invalid={Boolean(errors.buyerName)}
              aria-describedby={
                errors.buyerName ? "buyerName-error" : undefined
              }
              className={inputClass}
            />
          </Field>
          <Field
            id="buyerEmail"
            label="Email"
            icon={Mail01Icon}
            hint="Bukti pembayaran dikirim ke email ini."
            error={errors.buyerEmail}
          >
            <input
              id="buyerEmail"
              name="buyerEmail"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="nama@email.com"
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
            label="Nomor WhatsApp"
            optional
            icon={WhatsappIcon}
            hint="Hanya dipakai jika penjual perlu menghubungi Anda soal pesanan."
            error={errors.buyerPhone}
          >
            <input
              id="buyerPhone"
              name="buyerPhone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="08xx xxxx xxxx"
              aria-invalid={Boolean(errors.buyerPhone)}
              aria-describedby={
                errors.buyerPhone ? "buyerPhone-error" : "buyerPhone-hint"
              }
              className={inputClass}
            />
          </Field>
        </section>

        <section
          aria-labelledby="cara-bayar"
          className="p-card flex flex-col gap-3 p-5"
        >
          <h2 id="cara-bayar" className="text-[17px] font-semibold">
            Pembayaran
          </h2>
          <p className="text-[13.5px] text-p-muted">
            Setelah menekan Bayar, Anda diarahkan ke halaman pembayaran yang
            aman untuk memilih metode.
          </p>
          <ul className="flex flex-wrap gap-2">
            {PAYMENT_METHODS.map((method) => (
              <li
                key={method.label}
                className="flex items-center gap-1.5 rounded-[var(--p-r-btn)] bg-p-fg/[0.05] px-3 py-1.5 text-[13px] font-medium"
              >
                <Icon icon={method.icon} className="size-4 text-p-muted" />
                {method.label}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <aside
        aria-label="Ringkasan pembayaran"
        className="mt-4 flex flex-col gap-3 lg:sticky lg:top-8 lg:mt-0"
      >
        <section className="p-card flex flex-col gap-4 p-5">
          <h2 className="text-[17px] font-semibold">Ringkasan</h2>
          {discountEnabled ? (
            <DiscountCodeField
              productId={product.id}
              applied={discount}
              onChange={setDiscount}
            />
          ) : null}
          <dl className="flex flex-col gap-2.5 text-[14.5px] tabular-nums">
            <div className="flex justify-between gap-4">
              <dt className="text-p-muted">Harga</dt>
              <dd>{formatRupiah(price)}</dd>
            </div>
            {discount ? (
              <div className="flex justify-between gap-4">
                <dt className="text-p-muted">Diskon ({discount.code})</dt>
                <dd className="text-p-accent-ink">
                  −{formatRupiah(discount.discountAmount)}
                </dd>
              </div>
            ) : null}
            <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-p-line pt-3.5">
              <dt className="font-semibold">Total</dt>
              <dd className="text-[1.375rem] leading-none font-bold">
                {formatRupiah(total)}
              </dd>
            </div>
          </dl>
        </section>

        {state?.error ? (
          <p
            role="alert"
            className="flex gap-2.5 rounded-[var(--p-r-card)] bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-700"
          >
            <Icon icon={Alert02Icon} className="mt-0.5 size-[18px] shrink-0" />
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="p-btn p-press flex h-13 w-full items-center justify-center gap-2.5 bg-p-accent px-6 text-base font-semibold text-p-accent-fg disabled:opacity-75"
        >
          {pending ? (
            <>
              <span
                aria-hidden
                className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
              />
              Menyiapkan pembayaran...
            </>
          ) : (
            <>
              <Icon icon={SquareLock02Icon} className="size-[18px]" />
              Bayar {formatRupiah(total)}
            </>
          )}
        </button>
        <p className="text-center text-[12px] leading-relaxed text-p-muted">
          Data di atas hanya dipakai untuk memproses pesanan ini.{" "}
          <Link href="/privasi" className="underline underline-offset-2">
            Privasi
          </Link>
        </p>
      </aside>
    </form>
  );
}
