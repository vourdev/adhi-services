"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import type { MidtransMode } from "@/lib/domain";

import { updatePublicSettingsAction } from "../../../_actions/profile";
import { CopyButton } from "../../../_components/copy-button";

export function PublicSettingsForm({
  siteUrl,
  username: initialUsername,
  whatsappNumber: initialWhatsapp,
  isPublished: initialPublished,
  midtransMode: initialMidtransMode,
  premium,
  savedKey,
}: {
  siteUrl: string;
  username: string;
  whatsappNumber: string;
  isPublished: boolean;
  midtransMode: MidtransMode;
  premium: boolean;
  /** The saved server key's last characters; the key itself never reaches the browser. */
  savedKey: { hint: string | null; production: boolean } | null;
}): ReactNode {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [username, setUsername] = useState(initialUsername);
  const [whatsappNumber, setWhatsappNumber] = useState(initialWhatsapp);
  const [isPublished, setIsPublished] = useState(initialPublished);
  const [midtransMode, setMidtransMode] =
    useState<MidtransMode>(initialMidtransMode);
  const [newKey, setNewKey] = useState("");
  const [removeKey, setRemoveKey] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const host = siteUrl.replace(/^https?:\/\//, "");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updatePublicSettingsAction({
        username,
        whatsappNumber,
        isPublished,
        midtransMode,
        customMidtransServerKey: removeKey ? null : newKey.trim() || null,
        removeCustomMidtransServerKey: removeKey,
      });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      setErrors({});
      setUsername(result.data.username);
      setNewKey("");
      setRemoveKey(false);
      toast.success("Pengaturan disimpan");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.username) || undefined}>
          <FieldLabel htmlFor="username">Username / URL publik</FieldLabel>
          <div className="flex flex-col gap-2 sm:flex-row">
            <InputGroup className="flex-1">
              <InputGroupAddon>
                <InputGroupText>{host}/</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                aria-invalid={Boolean(errors.username)}
              />
            </InputGroup>
            <CopyButton
              value={`${siteUrl}/${initialUsername}`}
              label="Salin URL"
            />
          </div>
          <FieldDescription>
            Mengganti username membuat link lama tidak berlaku. Perbarui link di
            bio media sosial Anda.
          </FieldDescription>
          <FieldError>{errors.username}</FieldError>
        </Field>
        <Field data-invalid={Boolean(errors.whatsappNumber) || undefined}>
          <FieldLabel htmlFor="whatsappNumber">
            Nomor WhatsApp default
          </FieldLabel>
          <Input
            id="whatsappNumber"
            inputMode="tel"
            placeholder="0812xxxxxxxx"
            value={whatsappNumber}
            onChange={(event) => setWhatsappNumber(event.target.value)}
            aria-invalid={Boolean(errors.whatsappNumber)}
          />
          <FieldDescription>
            Dipakai produk dengan checkout WhatsApp. Tidak ditampilkan di
            profil.
          </FieldDescription>
          <FieldError>{errors.whatsappNumber}</FieldError>
        </Field>
        <Field orientation="horizontal">
          <Switch
            id="isPublished"
            checked={isPublished}
            onCheckedChange={setIsPublished}
          />
          <FieldLabel htmlFor="isPublished" className="font-normal">
            Profil publik aktif
          </FieldLabel>
        </Field>
        <FieldDescription className="-mt-3">
          Jika dimatikan, profil dan produk mengembalikan 404 untuk pengunjung.
          Anda tetap bisa melihatnya saat masuk.
        </FieldDescription>

        <Field data-invalid={Boolean(errors.midtransMode) || undefined}>
          <FieldLabel htmlFor="midtransMode">Akun Midtrans</FieldLabel>
          <NativeSelect
            id="midtransMode"
            value={midtransMode}
            onChange={(event) =>
              setMidtransMode(event.target.value as MidtransMode)
            }
          >
            <option value="platform">Midtrans platform</option>
            <option value="custom" disabled={!premium}>
              {premium
                ? "Akun Midtrans sendiri"
                : "Akun Midtrans sendiri (Premium)"}
            </option>
          </NativeSelect>
          <FieldDescription>
            {midtransMode === "custom"
              ? premium
                ? "Pembayaran pembeli langsung masuk ke akun Midtrans Anda. Tidak perlu mengatur Notification URL di dashboard Midtrans."
                : "Paket Premium Anda sudah berakhir, jadi checkout lewat akun Midtrans sendiri nonaktif. Pilih Midtrans platform agar pembeli bisa membayar lagi."
              : premium
                ? "Pembayaran pembeli masuk ke akun Midtrans platform."
                : "Pembayaran pembeli masuk ke akun Midtrans platform. Akun Midtrans sendiri tersedia untuk paket Premium."}
          </FieldDescription>
          <FieldError>{errors.midtransMode}</FieldError>
        </Field>

        {premium && midtransMode === "custom" ? (
          <Field
            data-invalid={Boolean(errors.customMidtransServerKey) || undefined}
          >
            <FieldLabel htmlFor="customMidtransServerKey">
              Server Key Midtrans
            </FieldLabel>
            {removeKey ? (
              <p className="text-sm text-muted-foreground">
                Kunci tersimpan akan dihapus saat Anda menekan Simpan.{" "}
                <button
                  type="button"
                  className="font-medium text-foreground underline underline-offset-4"
                  onClick={() => setRemoveKey(false)}
                >
                  Batal
                </button>
              </p>
            ) : (
              <Input
                id="customMidtransServerKey"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder={
                  savedKey
                    ? "Kosongkan untuk tetap memakai kunci tersimpan"
                    : "SB-Mid-server-... atau Mid-server-..."
                }
                value={newKey}
                onChange={(event) => setNewKey(event.target.value)}
                aria-invalid={Boolean(errors.customMidtransServerKey)}
              />
            )}
            <FieldDescription>
              {savedKey
                ? savedKey.hint
                  ? `Tersimpan: ${savedKey.hint} (${savedKey.production ? "produksi" : "sandbox"}). `
                  : "Kunci tersimpan tidak bisa dibaca server. Tempel ulang Server Key Anda. "
                : "Ambil di dashboard Midtrans, menu Settings lalu Access Keys. Mode sandbox atau produksi mengikuti kuncinya. "}
              Kunci disimpan terenkripsi dan tidak pernah ditampilkan lagi.
            </FieldDescription>
            <FieldError>{errors.customMidtransServerKey}</FieldError>
            {savedKey && !removeKey ? (
              <div>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto px-0 text-muted-foreground"
                  onClick={() => {
                    setNewKey("");
                    setRemoveKey(true);
                  }}
                >
                  Hapus kunci tersimpan
                </Button>
              </div>
            ) : null}
          </Field>
        ) : null}

        <div>
          <Button type="submit" disabled={pending}>
            {pending ? <Spinner /> : null}
            Simpan
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
