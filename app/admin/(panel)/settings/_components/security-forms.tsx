"use client";

import { type FormEvent, type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";

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
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";

import {
  changePasswordAction,
  logoutEverywhereAction,
} from "../../../_actions/auth";
import { setTrackingExclusionAction } from "../../../_actions/profile";

export function ChangePasswordForm(): ReactNode {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const data = new FormData(formElement);
    startTransition(async () => {
      const result = await changePasswordAction({
        currentPassword: data.get("currentPassword"),
        newPassword: data.get("newPassword"),
        confirmPassword: data.get("confirmPassword"),
      });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      setErrors({});
      formElement.reset();
      toast.success("Password diganti. Perangkat lain sudah dikeluarkan.");
    });
  }

  return (
    <form onSubmit={submit} noValidate>
      <FieldGroup>
        {(
          [
            [
              "currentPassword",
              "Password saat ini",
              "current-password",
              "Password yang dipakai sekarang",
            ],
            [
              "newPassword",
              "Password baru",
              "new-password",
              "Minimal 10 karakter, huruf dan angka",
            ],
            [
              "confirmPassword",
              "Ulangi password baru",
              "new-password",
              "Ketik ulang password baru",
            ],
          ] as const
        ).map(([name, label, autoComplete, placeholder]) => (
          <Field key={name} data-invalid={Boolean(errors[name]) || undefined}>
            <FieldLabel htmlFor={name}>{label}</FieldLabel>
            <PasswordInput
              id={name}
              name={name}
              autoComplete={autoComplete}
              placeholder={placeholder}
              aria-invalid={Boolean(errors[name])}
            />
            {name === "newPassword" ? (
              <FieldDescription>
                Minimal 10 karakter, berisi huruf dan angka.
              </FieldDescription>
            ) : null}
            <FieldError>{errors[name]}</FieldError>
          </Field>
        ))}
        <div>
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? <Spinner /> : null}
            Ganti password
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}

export function LogoutEverywhere({
  sessions,
}: {
  sessions: number;
}): ReactNode {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {sessions} sesi login aktif (termasuk perangkat ini).
      </p>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline">Keluar dari semua perangkat</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Keluar dari semua perangkat?</AlertDialogTitle>
            <AlertDialogDescription>
              Semua sesi dihapus, termasuk yang ini. Anda perlu masuk lagi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <form action={logoutEverywhereAction}>
              <AlertDialogAction type="submit">Keluar semua</AlertDialogAction>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function TrackingExclusion({
  excluded: initial,
}: {
  excluded: boolean;
}): ReactNode {
  const [excluded, setExcluded] = useState(initial);
  const [pending, startTransition] = useTransition();
  return (
    <Field orientation="horizontal">
      <Switch
        id="exclude-browser"
        checked={excluded}
        disabled={pending}
        onCheckedChange={(checked) =>
          startTransition(async () => {
            const result = await setTrackingExclusionAction(checked);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            setExcluded(checked);
            toast.success(
              checked
                ? "Browser ini tidak lagi dihitung"
                : "Browser ini dihitung lagi"
            );
          })
        }
      />
      <div className="flex flex-col gap-1">
        <FieldLabel htmlFor="exclude-browser" className="font-normal">
          Jangan hitung kunjungan dari browser ini, juga setelah keluar
        </FieldLabel>
        <FieldDescription>
          Selama Anda masuk, kunjungan sudah otomatis tidak dihitung. Aktifkan
          ini di ponsel atau laptop yang sering Anda pakai untuk mengecek
          profil.
        </FieldDescription>
      </div>
    </Field>
  );
}
