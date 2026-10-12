"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Crown, Lock, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type * as z from "zod";

import { ProfileView } from "@/components/profile/profile-view";
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
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  THEME_PRESET_CONFIGS,
  parseCustomTheme,
  themeToCssVariables,
} from "@/lib/custom-theme";
import {
  ACCENTS,
  FONTS,
  type Accent,
  type CardShape,
  type CardStyle,
  type ThemePreset,
} from "@/lib/domain";
import type { PublicProfile } from "@/lib/public-types";
import { profileInputSchema } from "@/lib/validation";

import { updateProfileAction } from "../../../_actions/profile";
import { ImageField } from "../../../_components/image-field";

type Values = z.input<typeof profileInputSchema>;

const ACCENT_SWATCH: Record<Accent, { label: string; color: string }> = {
  blue: { label: "Biru", color: "#1d4fd8" },
  emerald: { label: "Hijau", color: "#047857" },
  rose: { label: "Merah muda", color: "#be123c" },
  amber: { label: "Oranye", color: "#9c4508" },
  violet: { label: "Ungu", color: "#6d28d9" },
  slate: { label: "Hitam", color: "#0f172a" },
};

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
      const result = await updateProfileAction(output);
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

  // On free, the preview keeps the standard look, exactly like the public page.
  const currentCustomTheme = !isPremium
    ? null
    : values.customTheme
      ? parseCustomTheme(values.customTheme)
      : values.themePreset &&
          values.themePreset !== "default" &&
          values.themePreset !== "custom"
        ? parseCustomTheme(
            JSON.stringify(
              THEME_PRESET_CONFIGS[
                values.themePreset as keyof typeof THEME_PRESET_CONFIGS
              ]
            )
          )
        : null;
  const liveCustomStyles = currentCustomTheme
    ? themeToCssVariables(currentCustomTheme)
    : undefined;

  const live: PublicProfile = {
    ...preview,
    displayName: values.displayName || "Nama Anda",
    bio: values.bio ?? "",
    avatarUrl: values.avatarUrl || null,
    coverUrl: values.coverUrl || null,
    theme: values.theme ?? preview.theme,
    accent: values.accent ?? preview.accent,
    ...(isPremium
      ? {
          themePreset: values.themePreset ?? preview.themePreset,
          customTheme: values.customTheme ?? preview.customTheme,
          fontFamily: values.fontFamily ?? preview.fontFamily,
          cardShape: values.cardShape ?? preview.cardShape,
          cardStyle: values.cardStyle ?? preview.cardStyle,
          hideWatermark: Boolean(values.hideWatermark),
        }
      : {}),
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
                Pilihan warna terbatas, semuanya sudah dicek kontrasnya untuk
                mode terang dan gelap.
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
                        className="grid grid-cols-3 gap-2"
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
                </FieldSet>
                <FieldSet>
                  <FieldLegend variant="label">Warna aksen</FieldLegend>
                  <Controller
                    control={form.control}
                    name="accent"
                    render={({ field }) => (
                      <div
                        role="radiogroup"
                        aria-label="Warna aksen"
                        className="flex flex-wrap gap-2"
                      >
                        {ACCENTS.map((accent) => {
                          const selected = field.value === accent;
                          return (
                            <button
                              key={accent}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              aria-label={ACCENT_SWATCH[accent].label}
                              title={ACCENT_SWATCH[accent].label}
                              onClick={() => field.onChange(accent)}
                              className="grid size-9 place-items-center rounded-full ring-offset-2 ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:ring-ring aria-checked:ring-2 aria-checked:ring-foreground"
                              style={{
                                backgroundColor: ACCENT_SWATCH[accent].color,
                              }}
                            >
                              {selected ? (
                                <Check
                                  className="size-4 text-white"
                                  aria-hidden
                                />
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  />
                </FieldSet>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" />
                    Kustomisasi Desain (Ultra-Customizer)
                  </CardTitle>
                  <CardDescription>
                    Pilihan tema preset, bentuk kartu, dan tipografi halaman
                    profil.
                  </CardDescription>
                </div>
                {isPremium ? (
                  <Badge className="gap-1 bg-warning/10 text-warning">
                    <Crown />
                    Akses Premium
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="themePreset">Preset Tema</FieldLabel>
                    <Controller
                      control={form.control}
                      name="themePreset"
                      render={({ field }) => (
                        <NativeSelect
                          id="themePreset"
                          disabled={!isPremium}
                          value={field.value ?? "default"}
                          onChange={(e) => {
                            const val = e.target.value as ThemePreset;
                            field.onChange(val);
                            if (val in THEME_PRESET_CONFIGS) {
                              form.setValue(
                                "customTheme",
                                JSON.stringify(
                                  THEME_PRESET_CONFIGS[
                                    val as keyof typeof THEME_PRESET_CONFIGS
                                  ]
                                )
                              );
                            } else if (val === "default") {
                              form.setValue("customTheme", null);
                            }
                          }}
                        >
                          <option value="default">Default (Standar)</option>
                          <option value="minimal">
                            Minimal (Bersih & Outline)
                          </option>
                          <option value="glassmorphism">
                            Glassmorphism (Frosted Glass)
                          </option>
                          <option value="neon">Neon (Dark & Emerald)</option>
                          <option value="brutalist">
                            Neobrutalisme (Tegas & Kontras)
                          </option>
                        </NativeSelect>
                      )}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="fontFamily">
                      Tipografi / Font
                    </FieldLabel>
                    <Controller
                      control={form.control}
                      name="fontFamily"
                      render={({ field }) => (
                        <NativeSelect
                          id="fontFamily"
                          disabled={!isPremium}
                          value={field.value ?? "Plus Jakarta Sans"}
                          onChange={(e) => field.onChange(e.target.value)}
                        >
                          {FONTS.map((font) => (
                            <option key={font} value={font}>
                              {font}
                            </option>
                          ))}
                        </NativeSelect>
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="cardShape">
                      Bentuk Sudut Kartu
                    </FieldLabel>
                    <Controller
                      control={form.control}
                      name="cardShape"
                      render={({ field }) => (
                        <NativeSelect
                          id="cardShape"
                          disabled={!isPremium}
                          value={field.value ?? "smooth"}
                          onChange={(e) =>
                            field.onChange(e.target.value as CardShape)
                          }
                        >
                          <option value="sharp">Sharp (0px / Rata)</option>
                          <option value="rounded">
                            Rounded (8px / Membulat Halus)
                          </option>
                          <option value="smooth">
                            Smooth (16px / Standar)
                          </option>
                          <option value="extra">
                            Extra Curved (24px / Lengkung Lebar)
                          </option>
                          <option value="pill">Pill (Kapsul Penuh)</option>
                        </NativeSelect>
                      )}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <FieldLabel htmlFor="cardStyle">
                      Gaya Tampilan Kartu
                    </FieldLabel>
                    <Controller
                      control={form.control}
                      name="cardStyle"
                      render={({ field }) => (
                        <NativeSelect
                          id="cardStyle"
                          disabled={!isPremium}
                          value={field.value ?? "solid"}
                          onChange={(e) =>
                            field.onChange(e.target.value as CardStyle)
                          }
                        >
                          <option value="solid">Solid (Pekat)</option>
                          <option value="glass">Glass (Kaca Transparan)</option>
                          <option value="outline">
                            Outline (Garis Tepi Saja)
                          </option>
                          <option value="shadow">
                            Shadow (Bayangan Lembut)
                          </option>
                          <option value="neobrutalism">
                            Neobrutalisme (Bayangan Hitam Tegas)
                          </option>
                        </NativeSelect>
                      )}
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
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
                      <FieldLabel
                        htmlFor="hideWatermark"
                        className="font-medium"
                      >
                        Sembunyikan watermark platform
                      </FieldLabel>
                      <FieldDescription className="text-xs">
                        {isPremium
                          ? "Hapus watermark platform di bagian footer profil publik."
                          : "Tersedia khusus untuk Member Premium."}
                      </FieldDescription>
                    </div>
                  </Field>
                </div>
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
          <div
            className="profile-surface max-h-[42rem] min-h-0 overflow-y-auto border-t"
            data-theme={live.theme}
            data-accent={live.accent}
            style={liveCustomStyles}
            aria-label="Pratinjau profil"
          >
            <div className="pointer-events-none" inert>
              <ProfileView profile={live} preview />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
