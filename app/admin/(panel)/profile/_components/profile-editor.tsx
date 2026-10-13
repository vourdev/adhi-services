"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Crown, Lock, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type * as z from "zod";

import { ProfileSurface, ProfileView } from "@/components/profile/profile-view";
import { Badge } from "@/components/ui/badge";
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
  FieldSeparator,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { type NamedPreset, PRESETS, visitorLook } from "@/lib/profile-look";
import type { PublicProfile } from "@/lib/public-types";
import { profileInputSchema } from "@/lib/validation";

import { updateProfileAction } from "../../../_actions/profile";
import { ImageField } from "../../../_components/image-field";
import {
  AccentPicker,
  FontPicker,
  PresetPicker,
  ShapePicker,
  StylePicker,
} from "./look-pickers";

type Values = z.input<typeof profileInputSchema>;

export function ProfileEditor({
  initial,
  preview,
  isPremium = false,
  children,
}: {
  initial: Values;
  preview: PublicProfile;
  isPremium?: boolean;
  /** Rendered under the form in the left column (the socials manager). */
  children?: ReactNode;
}): ReactNode {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<Values, unknown, z.output<typeof profileInputSchema>>({
    resolver: zodResolver(profileInputSchema),
    defaultValues: initial,
  });
  const values = useWatch({ control: form.control });
  const errors = form.formState.errors;

  function submit(output: z.output<typeof profileInputSchema>) {
    startTransition(async () => {
      // Named presets come from the stylesheet; theme JSON is only kept for "custom".
      const result = await updateProfileAction(
        output.themePreset === "custom" ? output : { ...output, customTheme: null }
      );
      if (!result.ok) {
        for (const [field, message] of Object.entries(result.fieldErrors ?? {}))
          form.setError(field as keyof Values, { message });
        toast.error(result.error);
        return;
      }
      toast.success("Profil disimpan");
      form.reset(form.getValues());
      router.refresh();
    });
  }

  // The preview renders exactly what visitors get: on free, the standard look.
  const look = visitorLook(
    {
      theme: values.theme,
      accent: values.accent,
      themePreset: values.themePreset,
      customTheme: values.customTheme,
      fontFamily: values.fontFamily,
      cardShape: values.cardShape,
      cardStyle: values.cardStyle,
    },
    isPremium
  );
  const fixedMode =
    look.preset === "custom" || PRESETS[look.preset].mode === "follow"
      ? null
      : PRESETS[look.preset];

  /** A preset is a starting point: it sets the font, card shape, card style and accent too. */
  function choosePreset(preset: NamedPreset) {
    const definition = PRESETS[preset];
    const options = { shouldDirty: true } as const;
    form.setValue("themePreset", preset, options);
    form.setValue("customTheme", null, options);
    form.setValue("fontFamily", definition.font, options);
    form.setValue("cardShape", definition.cardShape, options);
    form.setValue("cardStyle", definition.cardStyle, options);
    form.setValue("accent", definition.accent, options);
  }

  const live: PublicProfile = {
    ...preview,
    displayName: values.displayName || "Nama Anda",
    bio: values.bio ?? "",
    avatarUrl: values.avatarUrl || null,
    coverUrl: values.coverUrl || null,
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <form
          onSubmit={form.handleSubmit(submit)}
          noValidate
          className="flex min-w-0 flex-col gap-4"
        >
          <Card>
            <CardHeader>
              <CardTitle>Identitas</CardTitle>
              <CardDescription>
                Nama, foto, dan bio di bagian atas profil publik.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field data-invalid={Boolean(errors.displayName) || undefined}>
                  <FieldLabel htmlFor="displayName">Nama tampilan</FieldLabel>
                  <Input
                    id="displayName"
                    maxLength={60}
                    aria-invalid={Boolean(errors.displayName)}
                    {...form.register("displayName")}
                  />
                  <FieldError>{errors.displayName?.message}</FieldError>
                </Field>
                <Field data-invalid={Boolean(errors.bio) || undefined}>
                  <FieldLabel htmlFor="bio">Bio</FieldLabel>
                  <Textarea
                    id="bio"
                    rows={3}
                    maxLength={280}
                    {...form.register("bio")}
                  />
                  <FieldDescription>
                    {(values.bio ?? "").length}/280 karakter.
                  </FieldDescription>
                  <FieldError>{errors.bio?.message}</FieldError>
                </Field>
                <Field data-invalid={Boolean(errors.avatarUrl) || undefined}>
                  <FieldLabel>Foto profil</FieldLabel>
                  <Controller
                    control={form.control}
                    name="avatarUrl"
                    render={({ field }) => (
                      <ImageField
                        kind="avatar"
                        shape="circle"
                        label="Foto profil"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        invalid={Boolean(errors.avatarUrl)}
                      />
                    )}
                  />
                  <FieldError>{errors.avatarUrl?.message}</FieldError>
                </Field>
                <Field data-invalid={Boolean(errors.coverUrl) || undefined}>
                  <FieldLabel>Gambar sampul (opsional)</FieldLabel>
                  <Controller
                    control={form.control}
                    name="coverUrl"
                    render={({ field }) => (
                      <ImageField
                        kind="cover"
                        shape="wide"
                        label="Gambar sampul"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        invalid={Boolean(errors.coverUrl)}
                      />
                    )}
                  />
                  <FieldDescription>
                    Banner rasio 16:9, ukuran ideal 1600 x 900 px. Pojok kiri
                    bawah tertutup foto profil, jadi jangan taruh teks di sana.
                  </FieldDescription>
                  <FieldError>{errors.coverUrl?.message}</FieldError>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tampilan</CardTitle>
              <CardDescription>
                Mode terang atau gelap, dan warna aksen untuk tombol, harga,
                serta link.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <FieldSet>
                  <FieldLegend variant="label">Tema</FieldLegend>
                  <Controller
                    control={form.control}
                    name="theme"
                    render={({ field }) => (
                      <RadioGroup
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={Boolean(fixedMode)}
                        className={`grid grid-cols-3 gap-2 ${fixedMode ? "opacity-60" : ""}`}
                      >
                        {[
                          { value: "system", label: "Ikuti perangkat" },
                          { value: "light", label: "Terang" },
                          { value: "dark", label: "Gelap" },
                        ].map((option) => (
                          <FieldLabel
                            key={option.value}
                            htmlFor={`theme-${option.value}`}
                          >
                            <Field orientation="horizontal">
                              <RadioGroupItem
                                value={option.value}
                                id={`theme-${option.value}`}
                              />
                              <span className="text-sm">{option.label}</span>
                            </Field>
                          </FieldLabel>
                        ))}
                      </RadioGroup>
                    )}
                  />
                  {fixedMode ? (
                    <FieldDescription>
                      Preset {fixedMode.label} selalu memakai mode{" "}
                      {fixedMode.mode === "dark" ? "gelap" : "terang"}.
                    </FieldDescription>
                  ) : null}
                </FieldSet>
                <FieldSet data-invalid={Boolean(errors.accent) || undefined}>
                  <FieldLegend variant="label">Warna aksen</FieldLegend>
                  <Controller
                    control={form.control}
                    name="accent"
                    render={({ field }) => (
                      <AccentPicker
                        value={field.value}
                        onChange={field.onChange}
                        invalid={Boolean(errors.accent)}
                      />
                    )}
                  />
                  <FieldDescription>
                    Pilih warna siap pakai, warna bebas dari pemilih warna, atau
                    ketik kode hex. Untuk teks dan mode gelap, warnanya otomatis
                    digelapkan atau dicerahkan sedikit supaya tetap terbaca.
                  </FieldDescription>
                  <FieldError>{errors.accent?.message}</FieldError>
                </FieldSet>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" />
                    Kustomisasi Desain (Ultra-Customizer)
                  </CardTitle>
                  <CardDescription>
                    Preset tema, font, bentuk, dan gaya kartu halaman profil.
                  </CardDescription>
                </div>
                {isPremium ? (
                  <Badge className="shrink-0 gap-1 bg-warning/10 text-warning">
                    <Crown />
                    Akses Premium
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="shrink-0 gap-1">
                    <Lock />
                    Premium
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!isPremium ? (
                <p className="mb-4 rounded-lg border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  Fitur ini khusus paket Premium. Selama paket Anda Free, profil
                  publik memakai tampilan standar. Hubungi admin platform untuk
                  upgrade.
                </p>
              ) : null}
              <FieldGroup>
                <FieldSet>
                  <FieldLegend variant="label">Preset tema</FieldLegend>
                  <FieldDescription>
                    Memilih preset juga mengatur font, bentuk kartu, gaya kartu,
                    dan warna aksen. Setelah itu semuanya tetap bisa diubah.
                  </FieldDescription>
                  <Controller
                    control={form.control}
                    name="themePreset"
                    render={({ field }) => (
                      <PresetPicker
                        value={field.value ?? "default"}
                        theme={look.theme}
                        onChange={choosePreset}
                        disabled={!isPremium}
                      />
                    )}
                  />
                </FieldSet>

                <FieldSet>
                  <FieldLegend variant="label">Font</FieldLegend>
                  <Controller
                    control={form.control}
                    name="fontFamily"
                    render={({ field }) => (
                      <FontPicker
                        value={field.value ?? "Plus Jakarta Sans"}
                        onChange={field.onChange}
                        disabled={!isPremium}
                      />
                    )}
                  />
                </FieldSet>

                <FieldSet>
                  <FieldLegend variant="label">Bentuk sudut kartu</FieldLegend>
                  <Controller
                    control={form.control}
                    name="cardShape"
                    render={({ field }) => (
                      <ShapePicker
                        value={field.value ?? "smooth"}
                        onChange={field.onChange}
                        disabled={!isPremium}
                      />
                    )}
                  />
                </FieldSet>

                <FieldSet>
                  <FieldLegend variant="label">Gaya kartu</FieldLegend>
                  <Controller
                    control={form.control}
                    name="cardStyle"
                    render={({ field }) => (
                      <StylePicker
                        value={field.value ?? "solid"}
                        look={look}
                        onChange={field.onChange}
                        disabled={!isPremium}
                      />
                    )}
                  />
                </FieldSet>

                <FieldSeparator />

                <Field orientation="horizontal">
                  <Controller
                    control={form.control}
                    name="hideWatermark"
                    render={({ field }) => (
                      <Switch
                        id="hideWatermark"
                        // On free the watermark always shows, whatever was saved before.
                        checked={isPremium && Boolean(field.value)}
                        disabled={!isPremium}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                  <div>
                    <FieldLabel htmlFor="hideWatermark" className="font-medium">
                      Sembunyikan watermark platform
                    </FieldLabel>
                    <FieldDescription className="text-xs">
                      {isPremium
                        ? "Hapus watermark platform di bagian footer profil publik."
                        : "Tersedia khusus untuk Member Premium."}
                    </FieldDescription>
                  </div>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={pending || !form.formState.isDirty}>
              {pending ? <Spinner /> : null}
              Simpan profil
            </Button>
          </div>
        </form>
        {children}
      </div>

      <div className="xl:sticky xl:top-16 xl:self-start">
        <Card className="gap-2 overflow-hidden pb-0">
          <CardHeader>
            <CardTitle>Pratinjau langsung</CardTitle>
            <CardDescription>
              Belum tersimpan sampai Anda menekan Simpan.
            </CardDescription>
          </CardHeader>
          <ProfileSurface
            look={look}
            page={false}
            className="max-h-[42rem] min-h-0 overflow-y-auto border-t"
          >
            <div className="pointer-events-none" inert>
              <ProfileView profile={live} preview />
            </div>
          </ProfileSurface>
        </Card>
      </div>
    </div>
  );
}
