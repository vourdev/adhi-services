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
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";

import { updatePublicSettingsAction } from "../../../_actions/profile";
import { CopyButton } from "../../../_components/copy-button";

export function PublicSettingsForm({
  siteUrl,
  username: initialUsername,
  whatsappNumber: initialWhatsapp,
  isPublished: initialPublished,
}: {
  siteUrl: string;
  username: string;
  whatsappNumber: string;
  isPublished: boolean;
}): ReactNode {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [username, setUsername] = useState(initialUsername);
  const [whatsappNumber, setWhatsappNumber] = useState(initialWhatsapp);
  const [isPublished, setIsPublished] = useState(initialPublished);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const host = siteUrl.replace(/^https?:\/\//, "");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updatePublicSettingsAction({
        username,
        whatsappNumber,
        isPublished,
      });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      setErrors({});
      setUsername(result.data.username);
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
                placeholder="namaanda"
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
