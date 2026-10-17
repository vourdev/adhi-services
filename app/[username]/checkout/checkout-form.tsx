"use client";

import {
  Alert02Icon,
  Cancel01Icon,
  MinusSignIcon,
  PlusSignIcon,
  SquareLock02Icon,
} from "@hugeicons/core-free-icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  startTransition,
  useActionState,
  useEffect,
  useState,
  useTransition,
} from "react";

import { setCartQuantityAction } from "@/app/_actions/cart";
import { PRODUCT_TYPE_ICONS } from "@/components/profile/blocks";
import {
  type AppliedDiscount,
  DiscountCodeField,
} from "@/components/profile/discount-code-field";
import { Icon } from "@/components/profile/icon";
import { MediaImage } from "@/components/profile/media-image";
import { notify } from "@/components/profile/toaster";
import type { ProductType } from "@/lib/domain";
import { formatRupiah } from "@/lib/format";
import { quantityProblem } from "@/lib/quantity";

import { checkoutAction, type CheckoutState } from "./actions";

export type CheckoutItem = {
  id: string;
  name: string;
  href: string;
  coverUrl: string | null;
  productType: ProductType;
  /** Price of one unit. */
  price: number;
  /** The struck-through price of one unit, when the product is on sale. */
  compareAt: number | null;
  quantity: number;
  min: number;
  max: number;
};

function Field({
  id,
  label,
  optional = false,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
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
      {children}
      {error ? (
        <p
          id={`${id}-error`}
          className="flex items-center gap-1.5 text-[13px] text-p-sale"
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

const inputClass = "p-input block h-12 w-full px-3.5 text-base";
const panel = "p-card flex flex-col gap-4 p-5";
const panelTitle = "text-[16px] font-semibold tracking-tight";

/**
 * Checkout for one product ("Beli sekarang") or the cart: the products, the
 * buyer's details, and the payment summary with the discount code and the
 * pay button. The payment method is chosen on the payment page that opens
 * next. Totals follow the discount code as it is applied; the server
 * recomputes the price and refuses the order if it no longer matches.
 */
export function CheckoutForm({
  items,
  fromCart,
  idempotencyKey,
  discountEnabled,
  hasDelivery,
}: {
  items: CheckoutItem[];
  /** The list is the cart: products can be removed, and leave it once ordered. */
  fromCart: boolean;
  idempotencyKey: string;
  /** Shows the code field; only when the owner has a code that could apply. */
  discountEnabled: boolean;
  hasDelivery: boolean;
}): ReactNode {
  const router = useRouter();
  const [state, action, pending] = useActionState<CheckoutState, FormData>(
    checkoutAction,
    null
  );
  const [discount, setDiscount] = useState<AppliedDiscount | null>(null);
  // A different list of products is a different order, not a double submit.
  const [orderKey, setOrderKey] = useState(idempotencyKey);
  const [removing, startRemoving] = useTransition();
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((item) => [item.id, item.quantity]))
  );
  const errors = state?.fieldErrors ?? {};
  const quantityOf = (item: CheckoutItem) =>
    quantities[item.id] ?? item.quantity;
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * quantityOf(item),
    0
  );
  const total = discount?.finalPrice ?? subtotal;

  // Problems the server found (price changed, product gone) also pop up.
  useEffect(() => {
    if (state?.error && !state.fieldErrors) notify("error", state.error);
  }, [state]);

  /** The order changed: a new submit key, and an applied code is checked again. */
  function orderChanged() {
    setOrderKey(crypto.randomUUID());
    if (discount) {
      setDiscount(null);
      notify(
        "info",
        `Kode ${discount.code} dilepas karena isi pesanan berubah. Pakai lagi untuk menghitung ulang.`
      );
    }
  }

  function changeQuantity(item: CheckoutItem, next: number) {
    // Minus at one unit in the cart means "take it out" (with undo).
    if (next === 0 && fromCart) {
      remove(item);
      return;
    }
    const problem = quantityProblem(item.name, next, item);
    if (problem) {
      notify("warning", problem);
      return;
    }
    const previous = quantityOf(item);
    setQuantities((current) => ({ ...current, [item.id]: next }));
    orderChanged();
    if (!fromCart) return;
    startRemoving(async () => {
      const result = await setCartQuantityAction(item.id, next);
      if (!result.ok) {
        notify(result.tone, result.message);
        setQuantities((current) => ({ ...current, [item.id]: previous }));
      }
    });
  }

  function remove(item: CheckoutItem) {
    const previous = quantityOf(item);
    startRemoving(async () => {
      const result = await setCartQuantityAction(item.id, 0);
      if (!result.ok) {
        notify(result.tone, result.message);
        return;
      }
      orderChanged();
      router.refresh();
      notify("info", `${item.name} dihapus dari keranjang.`, {
        label: "Batalkan",
        onClick: () =>
          startRemoving(async () => {
            const undo = await setCartQuantityAction(item.id, previous);
            if (!undo.ok) notify(undo.tone, undo.message);
            setQuantities((current) => ({ ...current, [item.id]: previous }));
            router.refresh();
          }),
      });
    });
  }

  return (
    <form
      // Submitted from onSubmit rather than action={...}: a form action resets
      // the fields when it finishes, and a buyer who mistyped their email
      // would have to fill everything in again.
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => action(data));
      }}
      noValidate
      className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-6"
    >
      {items.map((item) => (
        <span key={item.id} hidden>
          <input type="hidden" name="productId" value={item.id} />
          <input type="hidden" name="quantity" value={quantityOf(item)} />
        </span>
      ))}
      <input type="hidden" name="fromCart" value={fromCart ? "1" : "0"} />
      <input
        type="hidden"
        name="idempotencyKey"
        value={discount?.idempotencyKey ?? orderKey}
      />
      <input type="hidden" name="expectedAmount" value={total} />
      <input type="hidden" name="discountCode" value={discount?.code ?? ""} />

      <div className="flex flex-col gap-4">
        <section aria-labelledby="produk" className={panel}>
          <h2 id="produk" className={panelTitle}>
            Produk{items.length > 1 ? ` (${items.length})` : ""}
          </h2>
          <ul className="flex flex-col divide-y divide-p-line">
            {items.map((item) => {
              const quantity = quantityOf(item);
              const line = item.price * quantity;
              const off = discount?.lineDiscounts[item.id] ?? 0;
              // Struck through: the price before the code, else the product's sale reference.
              const struck =
                off > 0
                  ? line
                  : item.compareAt && item.compareAt > item.price
                    ? item.compareAt * quantity
                    : null;
              return (
                <li
                  key={item.id}
                  className="flex items-start gap-3.5 py-3.5 first:pt-0 last:pb-0"
                >
                  {item.coverUrl ? (
                    <MediaImage
                      src={item.coverUrl}
                      alt=""
                      width={144}
                      height={144}
                      eager
                      className="size-16 shrink-0 rounded-[var(--p-r-media)] bg-p-quiet object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="grid size-16 shrink-0 place-items-center rounded-[var(--p-r-media)] bg-p-quiet text-p-muted"
                    >
                      <Icon
                        icon={PRODUCT_TYPE_ICONS[item.productType]}
                        className="size-6"
                      />
                    </span>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-start sm:gap-x-4">
                    {/* Phones: name, price, link. Wider: name and link, price on the right. */}
                    <div className="contents sm:flex sm:min-w-0 sm:flex-1 sm:flex-col sm:gap-1">
                      <span className="line-clamp-2 text-[15px] leading-snug font-semibold">
                        {item.name}
                      </span>
                      <Link
                        href={item.href}
                        className="order-last w-fit text-[13px] font-medium text-p-muted underline underline-offset-4 hover:text-p-fg sm:order-none"
                      >
                        Lihat deskripsi
                      </Link>
                    </div>
                    <div className="flex shrink-0 items-baseline gap-2 sm:flex-col sm:items-end sm:gap-1">
                      <span className="text-[15px] font-semibold tabular-nums">
                        {formatRupiah(line - off)}
                      </span>
                      {struck ? (
                        <span className="text-[13px] text-p-muted tabular-nums line-through">
                          <span className="sr-only">Sebelumnya </span>
                          {formatRupiah(struck)}
                        </span>
                      ) : null}
                    </div>
                    {item.max > 1 ? (
                      <div className="order-last mt-1 sm:order-none sm:basis-full">
                        <div
                          role="group"
                          aria-label={`Jumlah ${item.name}`}
                          className="flex w-fit items-center rounded-[var(--p-r-btn)] border border-p-line"
                        >
                          <button
                            type="button"
                            onClick={() => changeQuantity(item, quantity - 1)}
                            disabled={pending}
                            aria-label="Kurangi"
                            className="grid size-9 place-items-center text-p-fg disabled:opacity-50"
                          >
                            <Icon icon={MinusSignIcon} className="size-4" />
                          </button>
                          <span
                            aria-live="polite"
                            className="min-w-7 text-center text-[14px] font-semibold tabular-nums"
                          >
                            {quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => changeQuantity(item, quantity + 1)}
                            disabled={pending}
                            aria-label="Tambah"
                            className="grid size-9 place-items-center text-p-fg disabled:opacity-50"
                          >
                            <Icon icon={PlusSignIcon} className="size-4" />
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  {fromCart ? (
                    <button
                      type="button"
                      onClick={() => remove(item)}
                      disabled={removing || pending}
                      aria-label={`Hapus ${item.name} dari keranjang`}
                      className="-mt-1 -mr-2 grid size-9 shrink-0 place-items-center rounded-full text-p-muted transition-colors hover:text-p-fg disabled:opacity-50"
                    >
                      <Icon icon={Cancel01Icon} className="size-[18px]" />
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="data-pembeli" className={panel}>
          <div className="flex flex-col gap-1">
            <h2 id="data-pembeli" className={panelTitle}>
              Data pembeli
            </h2>
            <p className="text-[13.5px] text-p-muted">
              {hasDelivery
                ? "Link produk dan bukti pembayaran dikirim ke email ini."
                : "Penjual memakai data ini untuk menghubungi Anda."}
            </p>
          </div>
          <Field id="buyerEmail" label="Email" error={errors.buyerEmail}>
            <input
              id="buyerEmail"
              name="buyerEmail"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="nama@email.com"
              required
              maxLength={120}
              aria-invalid={Boolean(errors.buyerEmail)}
              aria-describedby={
                errors.buyerEmail ? "buyerEmail-error" : undefined
              }
              className={inputClass}
            />
          </Field>
          <Field id="buyerName" label="Nama" error={errors.buyerName}>
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
            id="buyerPhone"
            label="Nomor WhatsApp"
            optional
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
              maxLength={20}
              aria-invalid={Boolean(errors.buyerPhone)}
              aria-describedby={
                errors.buyerPhone ? "buyerPhone-error" : "buyerPhone-hint"
              }
              className={inputClass}
            />
          </Field>
        </section>
      </div>

      <aside
        aria-labelledby="rincian"
        className={`${panel} lg:sticky lg:top-6`}
      >
        <h2 id="rincian" className={panelTitle}>
          Rincian pembayaran
        </h2>
        <dl className="flex flex-col gap-2.5 text-[15px] tabular-nums">
          <div className="flex justify-between gap-4">
            <dt className="text-p-muted">Subtotal</dt>
            <dd>{formatRupiah(subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-p-muted">
              Diskon{discount ? ` (${discount.code})` : ""}
            </dt>
            <dd>
              {discount ? `- ${formatRupiah(discount.discountAmount)}` : "Rp0"}
            </dd>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-p-line pt-3.5">
            <dt className="font-semibold">Total</dt>
            <dd className="text-[1.375rem] font-bold tracking-tight">
              {formatRupiah(total)}
            </dd>
          </div>
        </dl>

        {discountEnabled ? (
          <DiscountCodeField
            items={items.map((item) => ({
              productId: item.id,
              quantity: quantityOf(item),
            }))}
            applied={discount}
            onChange={setDiscount}
          />
        ) : null}

        <p className="flex gap-3 rounded-[var(--p-r-media)] bg-p-quiet px-3.5 py-3 text-[13px] leading-snug text-p-fg/80">
          <Icon
            icon={SquareLock02Icon}
            className="mt-px size-[18px] shrink-0 text-p-fg"
          />
          <span>
            Pembayaran diproses oleh payment gateway berizin. Metode pembayaran
            (QRIS, virtual account, e-wallet, kartu) dipilih di langkah
            berikutnya.
          </span>
        </p>

        <div className="flex flex-col gap-1.5">
          <label className="flex cursor-pointer gap-3 text-[14px] leading-snug">
            <input
              type="checkbox"
              name="agree"
              required
              aria-invalid={Boolean(errors.agree)}
              aria-describedby={errors.agree ? "agree-error" : undefined}
              className="mt-0.5 size-[18px] shrink-0 accent-[var(--p-accent)]"
            />
            <span>
              Saya setuju dengan{" "}
              <Link
                href="/syarat-ketentuan"
                target="_blank"
                className="font-medium underline underline-offset-2"
              >
                Syarat & Ketentuan
              </Link>{" "}
              dan{" "}
              <Link
                href="/kebijakan-refund"
                target="_blank"
                className="font-medium underline underline-offset-2"
              >
                Kebijakan Refund
              </Link>
              .
            </span>
          </label>
          {errors.agree ? (
            <p
              id="agree-error"
              className="flex items-center gap-1.5 text-[13px] text-p-sale"
            >
              <Icon icon={Alert02Icon} className="size-4 shrink-0" />
              {errors.agree}
            </p>
          ) : null}
        </div>

        {state?.error ? (
          <p
            role="alert"
            className="flex gap-2.5 rounded-[var(--p-r-media)] border border-p-sale/40 px-3.5 py-3 text-[14px] text-p-sale"
          >
            <Icon icon={Alert02Icon} className="mt-px size-[18px] shrink-0" />
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending || removing}
          className="p-btn p-press flex h-13 w-full items-center justify-center gap-2 bg-p-accent px-6 text-base font-semibold text-p-accent-fg disabled:opacity-60"
        >
          {pending ? "Membuat pesanan..." : `Bayar ${formatRupiah(total)}`}
        </button>
        <p className="text-center text-[12px] leading-relaxed text-p-muted">
          Data di atas hanya dipakai untuk memproses pesanan ini (
          <Link href="/privasi" className="underline underline-offset-2">
            Privasi
          </Link>
          ).
        </p>
      </aside>
    </form>
  );
}
