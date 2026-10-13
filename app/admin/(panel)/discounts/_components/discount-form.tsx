"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type * as z from "zod";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { formatRupiah } from "@/lib/format";
import { applyDiscount } from "@/lib/pricing";
import {
  discountCodeInputSchema,
  type DiscountCodeFormValues,
} from "@/lib/validation";

import {
  createDiscountCodeAction,
  deleteDiscountCodeAction,
  updateDiscountCodeAction,
} from "../../../_actions/discounts";

type Output = z.output<typeof discountCodeInputSchema>;

export type ProductOption = { id: string; name: string; priceAmount: number };

function digitsOnly(value: string): number | null {
  const digits = value.replace(/\D/g, "");
  return digits === "" ? null : Number(digits);
}

/** Example shown under the amount, using the chosen product's price when there is one. */
function example(
  values: Partial<DiscountCodeFormValues>,
  products: ProductOption[]
): string | null {
  const value = values.discountValue;
  if (typeof value !== "number" || value < 1 || !values.discountType)
    return null;
  const product = products.find((item) => item.id === values.productId);
  const base = product?.priceAmount ?? 100_000;
  const price = applyDiscount(base, {
    discountType: values.discountType,
    discountValue: value,
  });
  if (price.finalPrice < 1)
    return product
      ? `Potongan ini menghabiskan seluruh harga ${product.name}, jadi kode tidak akan berlaku.`
      : null;
  return `${product ? product.name : "Contoh: produk"} ${formatRupiah(base)} jadi ${formatRupiah(price.finalPrice)} (hemat ${formatRupiah(price.discountAmount)}).`;
}

export function DiscountForm({
  codeId,
  initialValues,
  products,
}: {
  codeId: string | null;
  initialValues: DiscountCodeFormValues;
  products: ProductOption[];
}): ReactNode {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<DiscountCodeFormValues, unknown, Output>({
    resolver: zodResolver(discountCodeInputSchema),
    defaultValues: initialValues,
    mode: "onTouched",
  });
  const values = useWatch({ control: form.control });
  const errors = form.formState.errors;
  const type = values.discountType ?? "percent";
  const preview = example(values, products);

  function submit(output: Output) {
    startTransition(async () => {
      const result = codeId
        ? await updateDiscountCodeAction(codeId, output)
        : await createDiscountCodeAction(output);
      if (!result.ok) {
        for (const [field, message] of Object.entries(
          result.fieldErrors ?? {}
        )) {
          form.setError(field as keyof DiscountCodeFormValues, { message });
        }
        toast.error(result.error);
        return;
      }
      toast.success(`Kode ${output.code} disimpan`);
      router.push("/admin/discounts");
      router.refresh();
    });
  }

  function remove() {
    if (!codeId) return;
    startTransition(async () => {
      const result = await deleteDiscountCodeAction(codeId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Kode diskon dihapus");
      router.replace("/admin/discounts");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={form.handleSubmit(submit)}
      noValidate
      className="flex max-w-2xl flex-col gap-4"
    >
      <Card>
        <CardHeader>
          <CardTitle>Kode dan potongan</CardTitle>
          <CardDescription>
            Pembeli mengetik kode ini saat checkout atau sebelum pesan lewat
            WhatsApp. Huruf besar dan kecil dianggap sama.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.code) || undefined}>
              <FieldLabel htmlFor="code">Kode</FieldLabel>
              <Controller
                control={form.control}
                name="code"
                render={({ field }) => (
                  <Input
                    id="code"
                    maxLength={32}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Contoh: 1010 atau HEMAT10"
                    aria-invalid={Boolean(errors.code)}
                    className="font-mono uppercase placeholder:font-sans placeholder:normal-case"
                    value={field.value ?? ""}
                    onChange={(event) =>
                      field.onChange(event.target.value.toUpperCase())
                    }
                    onBlur={field.onBlur}
                  />
                )}
              />
              <FieldDescription>
                3 sampai 32 karakter: huruf, angka, - atau _.
              </FieldDescription>
              <FieldError>{errors.code?.message}</FieldError>
            </Field>

            <FieldSet>
              <FieldLegend variant="label">Jenis potongan</FieldLegend>
              <Controller
                control={form.control}
                name="discountType"
                render={({ field }) => (
                  <RadioGroup
                    value={field.value}
                    onValueChange={(next) => {
                      field.onChange(next);
                      form.setValue(
                        "discountValue",
                        next === "percent" ? 10 : 10_000,
                        {
                          shouldValidate: true,
                        }
                      );
                    }}
                    className="grid gap-2 sm:grid-cols-2"
                  >
                    {[
                      {
                        value: "percent",
                        label: "Persen",
                        text: "Misalnya 10%",
                      },
                      {
                        value: "fixed",
                        label: "Nominal rupiah",
                        text: "Misalnya Rp10.000",
                      },
                    ].map((option) => (
                      <FieldLabel
                        key={option.value}
                        htmlFor={`type-${option.value}`}
                      >
                        <Field orientation="horizontal">
                          <RadioGroupItem
                            value={option.value}
                            id={`type-${option.value}`}
                          />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {option.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {option.text}
                            </span>
                          </div>
                        </Field>
                      </FieldLabel>
                    ))}
                  </RadioGroup>
                )}
              />
            </FieldSet>

            <Field data-invalid={Boolean(errors.discountValue) || undefined}>
              <FieldLabel htmlFor="discountValue">Besar potongan</FieldLabel>
              <Controller
                control={form.control}
                name="discountValue"
                render={({ field }) => (
                  <InputGroup className="max-w-xs">
                    {type === "fixed" ? (
                      <InputGroupAddon>
                        <InputGroupText>Rp</InputGroupText>
                      </InputGroupAddon>
                    ) : null}
                    <InputGroupInput
                      id="discountValue"
                      inputMode="numeric"
                      placeholder={type === "fixed" ? "10.000" : "10"}
                      aria-invalid={Boolean(errors.discountValue)}
                      value={
                        typeof field.value === "number"
                          ? field.value.toLocaleString("id-ID")
                          : ""
                      }
                      onChange={(event) =>
                        // null, not undefined: react-hook-form would show the default value again.
                        field.onChange(digitsOnly(event.target.value))
                      }
                      onBlur={field.onBlur}
                    />
                    {type === "percent" ? (
                      <InputGroupAddon align="inline-end">
                        <InputGroupText>%</InputGroupText>
                      </InputGroupAddon>
                    ) : null}
                  </InputGroup>
                )}
              />
              {preview ? <FieldDescription>{preview}</FieldDescription> : null}
              <FieldError>{errors.discountValue?.message}</FieldError>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Batasan</CardTitle>
          <CardDescription>Semua opsional.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.productId) || undefined}>
              <FieldLabel htmlFor="productId">Berlaku untuk</FieldLabel>
              <NativeSelect id="productId" {...form.register("productId")}>
                <NativeSelectOption value="">Semua produk</NativeSelectOption>
                {products.map((product) => (
                  <NativeSelectOption key={product.id} value={product.id}>
                    {product.name} ({formatRupiah(product.priceAmount)})
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldError>{errors.productId?.message}</FieldError>
            </Field>

            <Field data-invalid={Boolean(errors.maxUses) || undefined}>
              <FieldLabel htmlFor="maxUses">Batas pemakaian</FieldLabel>
              <Controller
                control={form.control}
                name="maxUses"
                render={({ field }) => (
                  <InputGroup className="max-w-xs">
                    <InputGroupInput
                      id="maxUses"
                      inputMode="numeric"
                      placeholder="Tanpa batas"
                      aria-invalid={Boolean(errors.maxUses)}
                      value={
                        typeof field.value === "number"
                          ? field.value.toLocaleString("id-ID")
                          : ""
                      }
                      onChange={(event) =>
                        field.onChange(digitsOnly(event.target.value))
                      }
                      onBlur={field.onBlur}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>pesanan</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                )}
              />
              <FieldDescription>
                Dihitung dari pesanan checkout langsung. Pesanan yang belum
                dibayar menahan satu kuota selama 24 jam. Pesanan lewat WhatsApp
                tidak ikut dihitung karena dibayar di luar sistem.
              </FieldDescription>
              <FieldError>{errors.maxUses?.message}</FieldError>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.startsAt) || undefined}>
                <FieldLabel htmlFor="startsAt">Mulai</FieldLabel>
                <Input
                  id="startsAt"
                  type="datetime-local"
                  {...form.register("startsAt")}
                />
                <FieldError>{errors.startsAt?.message}</FieldError>
              </Field>
              <Field data-invalid={Boolean(errors.endsAt) || undefined}>
                <FieldLabel htmlFor="endsAt">Berakhir</FieldLabel>
                <Input
                  id="endsAt"
                  type="datetime-local"
                  {...form.register("endsAt")}
                />
                <FieldError>{errors.endsAt?.message}</FieldError>
              </Field>
            </div>
            <FieldDescription className="-mt-3">
              Waktu dalam WIB. Kosongkan untuk kode tanpa batas waktu.
            </FieldDescription>

            <Field orientation="horizontal">
              <Controller
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <Switch
                    id="isActive"
                    checked={field.value ?? true}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <FieldLabel htmlFor="isActive" className="font-normal">
                Aktif, bisa dipakai pembeli
              </FieldLabel>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner /> : null}
          Simpan kode
        </Button>
        {codeId ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
              >
                <Trash2 />
                Hapus
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Hapus kode ini?</AlertDialogTitle>
                <AlertDialogDescription>
                  Pembeli tidak bisa memakainya lagi. Pesanan yang sudah memakai
                  kode ini tetap tercatat beserta potongannya. Untuk berhenti
                  sementara, matikan saja tombol Aktif.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={remove}>
                  Hapus
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>
    </form>
  );
}
