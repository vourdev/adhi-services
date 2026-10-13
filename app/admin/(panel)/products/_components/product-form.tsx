"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ExternalLink,
  FileUp,
  MessageCircle,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useRef, useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type * as z from "zod";

import { ProductBlock } from "@/components/profile/blocks";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Textarea } from "@/components/ui/textarea";
import { type ProfileLook, surfaceAttributes } from "@/lib/profile-look";
import { PRODUCT_TYPE_LABELS, PRODUCT_TYPES } from "@/lib/domain";
import { formatBytes, formatRupiah } from "@/lib/format";
import {
  DEFAULT_WHATSAPP_TEMPLATE,
  productInputSchema,
  slugify,
} from "@/lib/validation";
import { renderWhatsAppTemplate } from "@/lib/whatsapp";

import {
  createProductAction,
  deleteProductAction,
  updateProductAction,
} from "../../../_actions/products";
import {
  ImageField,
  uploadProductFile,
} from "../../../_components/image-field";

export type ProductFormValues = z.input<typeof productInputSchema>;
type ProductOutput = z.output<typeof productInputSchema>;

type Props = {
  productId: string | null;
  initialValues: ProductFormValues;
  username: string;
  siteUrl: string;
  /** The profile's look, so the card preview matches the public page. */
  profileLook: ProfileLook;
  profileWhatsappSet: boolean;
  paymentsReady: boolean;
  /** Why direct checkout is off, already worded for this owner. */
  paymentsProblem: string | null;
  /** Product files go straight to Vercel Blob instead of through the server. */
  directFileUpload: boolean;
};

function digitsOnly(value: string): number | null {
  const digits = value.replace(/\D/g, "");
  return digits === "" ? null : Number(digits);
}

export function ProductForm({
  productId,
  initialValues,
  username,
  siteUrl,
  profileLook,
  profileWhatsappSet,
  paymentsReady,
  paymentsProblem,
  directFileUpload,
}: Props): ReactNode {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [slugTouched, setSlugTouched] = useState(Boolean(productId));
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const form = useForm<ProductFormValues, unknown, ProductOutput>({
    resolver: zodResolver(productInputSchema),
    defaultValues: initialValues,
    mode: "onTouched",
  });
  const values = useWatch({ control: form.control });
  const errors = form.formState.errors;
  const method = values.checkoutMethod ?? "whatsapp";
  const deliveryType = values.deliveryType ?? "none";
  const productUrl = `${siteUrl}/${username}/${values.slug || "slug-produk"}`;

  const price = typeof values.priceAmount === "number" ? values.priceAmount : 0;

  const messagePreview = renderWhatsAppTemplate(
    values.whatsappTemplate || DEFAULT_WHATSAPP_TEMPLATE,
    {
      produk: values.name || "Nama produk",
      harga: formatRupiah(price),
      link: productUrl,
    }
  );

  async function onDeliveryFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const data = await uploadProductFile(file, directFileUpload);
      form.setValue("deliveryFileKey", data.key, {
        shouldDirty: true,
        shouldValidate: true,
      });
      form.setValue("deliveryFileName", data.name, {
        shouldDirty: true,
      });
      form.setValue("deliveryFileSize", data.size, {
        shouldDirty: true,
      });
      toast.success("File produk diunggah ke penyimpanan privat");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload gagal.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function submit(output: ProductOutput) {
    startTransition(async () => {
      const result = productId
        ? await updateProductAction(productId, output)
        : await createProductAction(output);
      if (!result.ok) {
        for (const [field, message] of Object.entries(
          result.fieldErrors ?? {}
        )) {
          form.setError(field as keyof ProductFormValues, { message });
        }
        toast.error(result.error);
        return;
      }
      toast.success(
        output.status === "published"
          ? "Produk disimpan dan dipublikasikan"
          : "Produk disimpan sebagai draf"
      );
      if (
        !productId &&
        result.data &&
        typeof result.data === "object" &&
        "id" in result.data
      ) {
        router.replace(`/admin/products/${String(result.data.id)}`);
      } else {
        form.reset(form.getValues());
        router.refresh();
      }
    });
  }

  function remove() {
    if (!productId) return;
    startTransition(async () => {
      const result = await deleteProductAction(productId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Produk dihapus");
      router.replace("/admin/products");
    });
  }

  return (
    <form
      onSubmit={form.handleSubmit(submit)}
      noValidate
      className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]"
    >
      <div className="flex min-w-0 flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Informasi produk</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field data-invalid={Boolean(errors.name) || undefined}>
                <FieldLabel htmlFor="name">Nama produk</FieldLabel>
                <Input
                  id="name"
                  maxLength={120}
                  aria-invalid={Boolean(errors.name)}
                  {...form.register("name", {
                    onChange: (event: { target: { value: string } }) => {
                      if (!slugTouched)
                        form.setValue("slug", slugify(event.target.value), {
                          shouldValidate: true,
                        });
                    },
                  })}
                />
                <FieldError>{errors.name?.message}</FieldError>
              </Field>
              <Field data-invalid={Boolean(errors.slug) || undefined}>
                <FieldLabel htmlFor="slug">Slug URL</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <InputGroupText className="max-w-[12rem] truncate">
                      /{username}/
                    </InputGroupText>
                  </InputGroupAddon>
                  <InputGroupInput
                    id="slug"
                    aria-invalid={Boolean(errors.slug)}
                    {...form.register("slug", {
                      onChange: () => setSlugTouched(true),
                    })}
                  />
                </InputGroup>
                <FieldError>{errors.slug?.message}</FieldError>
              </Field>
              <Field data-invalid={Boolean(errors.description) || undefined}>
                <FieldLabel htmlFor="description">Deskripsi</FieldLabel>
                <Textarea
                  id="description"
                  rows={6}
                  maxLength={5000}
                  {...form.register("description")}
                />
                <FieldDescription>
                  Baris baru dipertahankan di halaman produk.
                </FieldDescription>
                <FieldError>{errors.description?.message}</FieldError>
              </Field>
              <Field data-invalid={Boolean(errors.coverUrl) || undefined}>
                <FieldLabel>Gambar sampul</FieldLabel>
                <Controller
                  control={form.control}
                  name="coverUrl"
                  render={({ field }) => (
                    <ImageField
                      kind="product"
                      label="Gambar sampul"
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      invalid={Boolean(errors.coverUrl)}
                    />
                  )}
                />
                <FieldError>{errors.coverUrl?.message}</FieldError>
              </Field>
              <Field data-invalid={Boolean(errors.priceAmount) || undefined}>
                <FieldLabel htmlFor="price">Harga</FieldLabel>
                <Controller
                  control={form.control}
                  name="priceAmount"
                  render={({ field }) => (
                    <InputGroup>
                      <InputGroupAddon>
                        <InputGroupText>Rp</InputGroupText>
                      </InputGroupAddon>
                      <InputGroupInput
                        id="price"
                        inputMode="numeric"
                        aria-invalid={Boolean(errors.priceAmount)}
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
                    </InputGroup>
                  )}
                />
                <FieldDescription>
                  Untuk potongan harga, buat kode diskon di menu{" "}
                  <Link href="/admin/discounts" className="underline">
                    Discounts
                  </Link>
                  .
                </FieldDescription>
                <FieldError>{errors.priceAmount?.message}</FieldError>
              </Field>

              <Field>
                <FieldLabel htmlFor="productType">Jenis produk</FieldLabel>
                <NativeSelect
                  id="productType"
                  {...form.register("productType")}
                >
                  {PRODUCT_TYPES.map((type) => (
                    <NativeSelectOption key={type} value={type}>
                      {PRODUCT_TYPE_LABELS[type]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cara pemesanan</CardTitle>
            <CardDescription>
              Menentukan apa yang terjadi saat pengunjung menekan tombol beli di
              halaman produk.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <FieldSet>
                <FieldLegend variant="label" className="sr-only">
                  Metode checkout
                </FieldLegend>
                <Controller
                  control={form.control}
                  name="checkoutMethod"
                  render={({ field }) => (
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="grid gap-3 sm:grid-cols-2"
                    >
                      <FieldLabel htmlFor="method-whatsapp">
                        <Field orientation="horizontal">
                          <RadioGroupItem
                            value="whatsapp"
                            id="method-whatsapp"
                          />
                          <div className="flex flex-col gap-0.5">
                            <span className="flex items-center gap-1.5 text-sm font-medium">
                              <MessageCircle className="size-4" /> WhatsApp
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Pengunjung membuka chat berisi nama produk, harga,
                              dan link.
                            </span>
                          </div>
                        </Field>
                      </FieldLabel>
                      <FieldLabel htmlFor="method-direct">
                        <Field orientation="horizontal">
                          <RadioGroupItem value="direct" id="method-direct" />
                          <div className="flex flex-col gap-0.5">
                            <span className="flex items-center gap-1.5 text-sm font-medium">
                              <ShoppingCart className="size-4" /> Checkout
                              langsung
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Bayar di situs lewat Midtrans, file dikirim
                              otomatis setelah lunas.
                            </span>
                          </div>
                        </Field>
                      </FieldLabel>
                    </RadioGroup>
                  )}
                />
                <FieldError>{errors.checkoutMethod?.message}</FieldError>
              </FieldSet>

              {method === "direct" && !paymentsReady ? (
                <Alert>
                  <AlertDescription>
                    Checkout langsung belum aktif. {paymentsProblem} Produk bisa
                    disimpan sebagai draf, tapi belum bisa dipublikasikan.
                  </AlertDescription>
                </Alert>
              ) : null}

              {method === "whatsapp" ? (
                <>
                  <Field
                    data-invalid={Boolean(errors.whatsappNumber) || undefined}
                  >
                    <FieldLabel htmlFor="whatsappNumber">
                      Nomor WhatsApp tujuan
                    </FieldLabel>
                    <Input
                      id="whatsappNumber"
                      inputMode="tel"
                      placeholder={
                        profileWhatsappSet
                          ? "Kosongkan untuk memakai nomor di Settings"
                          : "0812xxxxxxxx"
                      }
                      aria-invalid={Boolean(errors.whatsappNumber)}
                      {...form.register("whatsappNumber")}
                    />
                    <FieldDescription>
                      {profileWhatsappSet
                        ? "Kosong = nomor default dari Settings."
                        : "Belum ada nomor default di Settings, jadi isi di sini."}
                    </FieldDescription>
                    <FieldError>{errors.whatsappNumber?.message}</FieldError>
                  </Field>
                  <Field
                    data-invalid={Boolean(errors.whatsappTemplate) || undefined}
                  >
                    <FieldLabel htmlFor="whatsappTemplate">
                      Template pesan
                    </FieldLabel>
                    <Textarea
                      id="whatsappTemplate"
                      rows={4}
                      placeholder={DEFAULT_WHATSAPP_TEMPLATE}
                      {...form.register("whatsappTemplate")}
                    />
                    <FieldDescription>
                      Wajib memuat {"{produk}"}, {"{harga}"}, dan {"{link}"}.
                      Kosong = template bawaan.
                    </FieldDescription>
                    <FieldError>{errors.whatsappTemplate?.message}</FieldError>
                  </Field>
                  <div className="rounded-lg bg-muted p-3 text-sm">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      Pratinjau pesan
                    </p>
                    <p className="whitespace-pre-line">{messagePreview}</p>
                  </div>
                </>
              ) : (
                <FieldSet>
                  <FieldLegend variant="label">
                    Pengiriman setelah lunas
                  </FieldLegend>
                  <Controller
                    control={form.control}
                    name="deliveryType"
                    render={({ field }) => (
                      <RadioGroup
                        value={field.value ?? "none"}
                        onValueChange={field.onChange}
                        className="grid gap-2 sm:grid-cols-3"
                      >
                        {[
                          {
                            value: "file",
                            label: "File",
                            text: "Diunggah ke penyimpanan privat",
                          },
                          {
                            value: "link",
                            label: "Link rahasia",
                            text: "Misalnya folder Google Drive",
                          },
                          {
                            value: "none",
                            label: "Tidak ada",
                            text: "Untuk jasa, dihubungi manual",
                          },
                        ].map((option) => (
                          <FieldLabel
                            key={option.value}
                            htmlFor={`delivery-${option.value}`}
                          >
                            <Field orientation="horizontal">
                              <RadioGroupItem
                                value={option.value}
                                id={`delivery-${option.value}`}
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
                  <FieldError>{errors.deliveryType?.message}</FieldError>

                  {deliveryType === "file" ? (
                    <Field
                      data-invalid={
                        Boolean(errors.deliveryFileKey) || undefined
                      }
                    >
                      <input
                        ref={fileRef}
                        type="file"
                        className="sr-only"
                        id="delivery-file"
                        onChange={(event) =>
                          onDeliveryFile(event.target.files?.[0])
                        }
                      />
                      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={uploading}
                          onClick={() => fileRef.current?.click()}
                        >
                          {uploading ? <Spinner /> : <FileUp />}
                          {values.deliveryFileKey
                            ? "Ganti file"
                            : "Unggah file"}
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          {values.deliveryFileName
                            ? `${values.deliveryFileName}${values.deliveryFileSize ? ` · ${formatBytes(values.deliveryFileSize)}` : ""}`
                            : "ZIP, PDF, EPUB, dll. Maksimal 50 MB."}
                        </span>
                      </div>
                      <FieldDescription>
                        File tidak punya URL publik. Pembeli mengunduh lewat
                        link bertanda tangan yang berlaku 15 menit, maksimal 10
                        kali per pesanan.
                      </FieldDescription>
                      <FieldError>{errors.deliveryFileKey?.message}</FieldError>
                    </Field>
                  ) : null}

                  {deliveryType === "link" ? (
                    <Field
                      data-invalid={Boolean(errors.deliveryUrl) || undefined}
                    >
                      <FieldLabel htmlFor="deliveryUrl">Link produk</FieldLabel>
                      <Input
                        id="deliveryUrl"
                        inputMode="url"
                        placeholder="https://..."
                        aria-invalid={Boolean(errors.deliveryUrl)}
                        {...form.register("deliveryUrl")}
                      />
                      <FieldDescription>
                        Hanya ditampilkan ke pembeli setelah pembayaran
                        terverifikasi.
                      </FieldDescription>
                      <FieldError>{errors.deliveryUrl?.message}</FieldError>
                    </Field>
                  ) : null}
                </FieldSet>
              )}

              <Field data-invalid={Boolean(errors.ctaLabel) || undefined}>
                <FieldLabel htmlFor="ctaLabel">
                  Label tombol (opsional)
                </FieldLabel>
                <Input
                  id="ctaLabel"
                  maxLength={32}
                  placeholder={
                    method === "whatsapp"
                      ? "Pesan via WhatsApp"
                      : "Beli Sekarang"
                  }
                  {...form.register("ctaLabel")}
                />
                <FieldError>{errors.ctaLabel?.message}</FieldError>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SEO (opsional)</CardTitle>
            <CardDescription>
              Judul dan deskripsi untuk mesin pencari dan pratinjau saat link
              dibagikan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field data-invalid={Boolean(errors.seoTitle) || undefined}>
                <FieldLabel htmlFor="seoTitle">Judul SEO</FieldLabel>
                <Input
                  id="seoTitle"
                  maxLength={70}
                  placeholder={values.name ?? ""}
                  {...form.register("seoTitle")}
                />
                <FieldError>{errors.seoTitle?.message}</FieldError>
              </Field>
              <Field data-invalid={Boolean(errors.seoDescription) || undefined}>
                <FieldLabel htmlFor="seoDescription">Deskripsi SEO</FieldLabel>
                <Textarea
                  id="seoDescription"
                  rows={2}
                  maxLength={160}
                  {...form.register("seoDescription")}
                />
                <FieldError>{errors.seoDescription?.message}</FieldError>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4 lg:sticky lg:top-16 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle>Publikasi</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="status">Status</FieldLabel>
                <NativeSelect id="status" {...form.register("status")}>
                  <NativeSelectOption value="draft">
                    Draf (tidak tampil)
                  </NativeSelectOption>
                  <NativeSelectOption value="published">
                    Dipublikasikan
                  </NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field orientation="horizontal">
                <Controller
                  control={form.control}
                  name="showOnProfile"
                  render={({ field }) => (
                    <Switch
                      id="showOnProfile"
                      checked={field.value ?? true}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <FieldLabel htmlFor="showOnProfile" className="font-normal">
                  Tampilkan kartu di profil
                </FieldLabel>
              </Field>
              <Field orientation="horizontal">
                <Controller
                  control={form.control}
                  name="isFeatured"
                  render={({ field }) => (
                    <Switch
                      id="isFeatured"
                      checked={field.value ?? false}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <FieldLabel htmlFor="isFeatured" className="font-normal">
                  Tandai unggulan
                </FieldLabel>
              </Field>
              <Button type="submit" disabled={pending}>
                {pending ? <Spinner /> : null}
                Simpan
              </Button>
              {productId ? (
                <Button variant="outline" asChild>
                  <Link
                    href={`/${username}/${values.slug ?? ""}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink />
                    {values.status === "published"
                      ? "Lihat halaman"
                      : "Pratinjau draf"}
                  </Link>
                </Button>
              ) : null}
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pratinjau kartu</CardTitle>
            <CardDescription>Tampilan di profil publik.</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="profile-surface min-h-0 rounded-xl p-3"
              {...surfaceAttributes(profileLook)}
            >
              <div className="pointer-events-none" aria-hidden>
                <ProductBlock
                  href="#"
                  product={{
                    id: productId ?? "preview",
                    slug: values.slug ?? "",
                    name: values.name || "Nama produk",
                    priceAmount: price,
                    coverUrl: values.coverUrl || null,
                    isFeatured: values.isFeatured ?? false,
                    productType: values.productType ?? "digital",
                    checkoutMethod: method,
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {productId ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive">
                <Trash2 />
                Hapus produk
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Hapus produk ini?</AlertDialogTitle>
                <AlertDialogDescription>
                  Kartu produk juga hilang dari profil. Produk yang sudah punya
                  pesanan tidak bisa dihapus, ubah ke draf saja.
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
