import { zodResolver } from "@hookform/resolvers/zod";
import { type ReactNode, useEffect, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { linkInputSchema } from "@/lib/validation";

import { createLinkAction, updateLinkAction } from "../../../_actions/links";
import { ImageField } from "../../../_components/image-field";

export type LinkFormValues = z.input<typeof linkInputSchema>;
export type EditableLink = { id: string } & LinkFormValues;

const EMPTY: LinkFormValues = {
  kind: "link",
  title: "",
  url: "",
  message: "",
  description: "",
  thumbnailUrl: "",
  category: "",
  layout: "classic",
  isActive: true,
};

export function LinkFormDialog({
  open,
  onOpenChange,
  link,
  kind,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  link: EditableLink | null;
  kind: "link" | "heading" | "whatsapp";
  onSaved: () => void;
}): ReactNode {
  const [pending, startTransition] = useTransition();
  const form = useForm<
    LinkFormValues,
    unknown,
    z.output<typeof linkInputSchema>
  >({
    resolver: zodResolver(linkInputSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (open) form.reset(link ? { ...EMPTY, ...link } : { ...EMPTY, kind });
  }, [open, link, kind, form]);

  const currentKind = useWatch({ control: form.control, name: "kind" });
  const isHeading = currentKind === "heading";
  const isWhatsapp = currentKind === "whatsapp";
  const noun = isHeading
    ? "judul bagian"
    : isWhatsapp
      ? "link WhatsApp"
      : "link";

  function onSubmit(values: z.output<typeof linkInputSchema>) {
    startTransition(async () => {
      const result = link
        ? await updateLinkAction(link.id, values)
        : await createLinkAction(values);
      if (!result.ok) {
        for (const [field, message] of Object.entries(
          result.fieldErrors ?? {}
        )) {
          form.setError(field as keyof LinkFormValues, { message });
        }
        toast.error(result.error);
        return;
      }
      toast.success(
        link
          ? "Perubahan disimpan"
          : isHeading
            ? "Judul bagian ditambahkan"
            : isWhatsapp
              ? "Link WhatsApp ditambahkan"
              : "Link ditambahkan"
      );
      onOpenChange(false);
      onSaved();
    });
  }

  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {link ? "Edit" : "Tambah"} {noun}
          </DialogTitle>
          <DialogDescription>
            {isHeading
              ? 'Judul untuk mengelompokkan link di profil, misalnya "Produk" atau "Kontak".'
              : isWhatsapp
                ? "Kartu yang langsung membuka chat WhatsApp ke nomor di Settings, dengan pesan awal di bawah. Setiap kliknya tercatat."
                : "Link tampil di profil publik dan setiap kliknya tercatat."}
          </DialogDescription>
        </DialogHeader>

        <form id="link-form" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.title) || undefined}>
              <FieldLabel htmlFor="link-title">Judul</FieldLabel>
              <Input
                id="link-title"
                autoFocus
                maxLength={100}
                aria-invalid={Boolean(errors.title)}
                {...form.register("title")}
              />
              <FieldError>{errors.title?.message}</FieldError>
            </Field>

            {!isHeading ? (
              <>
                {isWhatsapp ? (
                  <Field data-invalid={Boolean(errors.message) || undefined}>
                    <FieldLabel htmlFor="link-message">Pesan awal</FieldLabel>
                    <Textarea
                      id="link-message"
                      rows={3}
                      maxLength={1000}
                      placeholder="Halo, saya tertarik dengan jasa pembuatan website. Boleh konsultasi dulu?"
                      aria-invalid={Boolean(errors.message)}
                      {...form.register("message")}
                    />
                    <FieldDescription>
                      Muncul di kolom chat pengunjung dan masih bisa mereka ubah
                      sebelum dikirim.
                    </FieldDescription>
                    <FieldError>{errors.message?.message}</FieldError>
                  </Field>
                ) : (
                  <Field data-invalid={Boolean(errors.url) || undefined}>
                    <FieldLabel htmlFor="link-url">URL tujuan</FieldLabel>
                    <Input
                      id="link-url"
                      inputMode="url"
                      placeholder="https://..."
                      aria-invalid={Boolean(errors.url)}
                      {...form.register("url")}
                    />
                    <FieldDescription>
                      https://, mailto:, tel:, atau halaman di situs ini seperti
                      /privasi.
                    </FieldDescription>
                    <FieldError>{errors.url?.message}</FieldError>
                  </Field>
                )}

                <Field data-invalid={Boolean(errors.description) || undefined}>
                  <FieldLabel htmlFor="link-description">
                    Deskripsi (opsional)
                  </FieldLabel>
                  <Textarea
                    id="link-description"
                    rows={2}
                    maxLength={160}
                    {...form.register("description")}
                  />
                  <FieldError>{errors.description?.message}</FieldError>
                </Field>

                <Field data-invalid={Boolean(errors.thumbnailUrl) || undefined}>
                  <FieldLabel>Gambar (opsional)</FieldLabel>
                  <Controller
                    control={form.control}
                    name="thumbnailUrl"
                    render={({ field }) => (
                      <ImageField
                        kind="thumbnail"
                        label="Gambar link"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        invalid={Boolean(errors.thumbnailUrl)}
                      />
                    )}
                  />
                  <FieldDescription>
                    Untuk tampilan Unggulan pakai gambar landscape 16:10,
                    misalnya 1600 x 1000 px.
                  </FieldDescription>
                  <FieldError>{errors.thumbnailUrl?.message}</FieldError>
                </Field>

                <Field>
                  <FieldLabel>Tampilan</FieldLabel>
                  <Controller
                    control={form.control}
                    name="layout"
                    render={({ field }) => (
                      <RadioGroup
                        value={field.value ?? "classic"}
                        onValueChange={field.onChange}
                        className="grid grid-cols-2 gap-2"
                      >
                        {[
                          {
                            value: "classic",
                            title: "Biasa",
                            text: "Satu baris",
                          },
                          {
                            value: "featured",
                            title: "Unggulan",
                            text: "Lebih besar, dengan gambar",
                          },
                        ].map((option) => (
                          <FieldLabel
                            key={option.value}
                            htmlFor={`layout-${option.value}`}
                          >
                            <Field orientation="horizontal">
                              <RadioGroupItem
                                value={option.value}
                                id={`layout-${option.value}`}
                              />
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">
                                  {option.title}
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
                </Field>

                <Field data-invalid={Boolean(errors.category) || undefined}>
                  <FieldLabel htmlFor="link-category">
                    Kategori (opsional)
                  </FieldLabel>
                  <Input
                    id="link-category"
                    maxLength={40}
                    placeholder="Contoh: Portfolio"
                    {...form.register("category")}
                  />
                  <FieldDescription>
                    Tampil kecil di atas judul pada tampilan Unggulan.
                  </FieldDescription>
                </Field>
              </>
            ) : null}

            <Field orientation="horizontal">
              <Controller
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <Switch
                    id="link-active"
                    checked={field.value ?? true}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <FieldLabel htmlFor="link-active" className="font-normal">
                Tampilkan di profil
              </FieldLabel>
            </Field>
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Batal
          </Button>
          <Button type="submit" form="link-form" disabled={pending}>
            {pending ? <Spinner /> : null}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
