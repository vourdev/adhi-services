"use client";

import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";

import { Icon } from "@/components/profile/icon";
import { SOCIAL_ICONS } from "@/components/profile/social-icon";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  SOCIAL_LABELS,
  SOCIAL_PLATFORMS,
  type SocialPlatform,
} from "@/lib/domain";

import {
  createSocialAction,
  deleteSocialAction,
  reorderSocialsAction,
  updateSocialAction,
} from "../../../_actions/profile";

export type ManagedSocial = {
  id: string;
  platform: SocialPlatform;
  url: string;
  isActive: boolean;
};

const PLACEHOLDER: Partial<Record<SocialPlatform, string>> = {
  email: "nama@email.com",
  whatsapp: "0812xxxxxxx atau https://wa.me/...",
};

function displayUrl(url: string): string {
  return url
    .replace(/^mailto:/, "")
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/\/$/, "");
}

export function SocialsManager({
  socials,
}: {
  socials: ManagedSocial[];
}): ReactNode {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [platform, setPlatform] = useState<SocialPlatform>("instagram");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [toDelete, setToDelete] = useState<ManagedSocial | null>(null);

  function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
    after?: () => void
  ) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "Gagal menyimpan.");
        return;
      }
      toast.success(success);
      after?.();
      router.refresh();
    });
  }

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createSocialAction({
        platform,
        url,
        isActive: true,
      });
      if (!result.ok) {
        setError(result.fieldErrors?.url ?? result.error);
        return;
      }
      setError(null);
      setUrl("");
      toast.success(`${SOCIAL_LABELS[platform]} ditambahkan`);
      router.refresh();
    });
  }

  function reorder(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= socials.length) return;
    const ids = socials.map((social) => social.id);
    const [moved] = ids.splice(index, 1);
    if (moved) ids.splice(target, 0, moved);
    run(() => reorderSocialsAction(ids), "Urutan disimpan");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Media sosial</CardTitle>
        <CardDescription>
          Ditampilkan sebagai ikon di bawah bio. Hanya yang aktif yang tampil.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {socials.length > 0 ? (
          <ul className="flex flex-col divide-y rounded-lg border">
            {socials.map((social, index) => {
              return (
                <li key={social.id} className="flex items-center gap-2 p-2.5">
                  <div className="flex flex-col">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Naikkan ${SOCIAL_LABELS[social.platform]}`}
                      disabled={index === 0 || busy}
                      onClick={() => reorder(index, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Turunkan ${SOCIAL_LABELS[social.platform]}`}
                      disabled={index === socials.length - 1 || busy}
                      onClick={() => reorder(index, 1)}
                    >
                      <ArrowDown />
                    </Button>
                  </div>
                  <Icon
                    icon={SOCIAL_ICONS[social.platform]}
                    className="size-5 shrink-0"
                  />
                  {editing === social.id ? (
                    <form
                      className="flex min-w-0 flex-1 gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        run(
                          () =>
                            updateSocialAction(social.id, {
                              platform: social.platform,
                              url: editUrl,
                              isActive: social.isActive,
                            }),
                          "Disimpan",
                          () => setEditing(null)
                        );
                      }}
                    >
                      <Input
                        value={editUrl}
                        onChange={(event) => setEditUrl(event.target.value)}
                        placeholder={
                          PLACEHOLDER[social.platform] ?? "https://..."
                        }
                        aria-label={`URL ${SOCIAL_LABELS[social.platform]}`}
                        autoFocus
                      />
                      <Button type="submit" size="sm" disabled={busy}>
                        Simpan
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditing(null)}
                      >
                        Batal
                      </Button>
                    </form>
                  ) : (
                    <div
                      className={`min-w-0 flex-1 ${social.isActive ? "" : "opacity-60"}`}
                    >
                      <p className="text-sm font-medium">
                        {SOCIAL_LABELS[social.platform]}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {displayUrl(social.url)}
                      </p>
                    </div>
                  )}
                  {editing !== social.id ? (
                    <>
                      <Switch
                        checked={social.isActive}
                        aria-label={`Tampilkan ${SOCIAL_LABELS[social.platform]}`}
                        onCheckedChange={(checked) =>
                          run(
                            () =>
                              updateSocialAction(social.id, {
                                platform: social.platform,
                                url: social.url,
                                isActive: checked,
                              }),
                            checked ? "Ditampilkan" : "Disembunyikan"
                          )
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit ${SOCIAL_LABELS[social.platform]}`}
                        onClick={() => {
                          setEditing(social.id);
                          setEditUrl(social.url.replace(/^mailto:/, ""));
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Hapus ${SOCIAL_LABELS[social.platform]}`}
                        onClick={() => setToDelete(social)}
                      >
                        <Trash2 />
                      </Button>
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
            Belum ada media sosial.
          </p>
        )}

        <form
          onSubmit={add}
          className="flex flex-col gap-2 sm:flex-row sm:items-start"
          noValidate
        >
          <Field className="sm:w-40">
            <FieldLabel htmlFor="social-platform" className="sr-only">
              Platform
            </FieldLabel>
            <NativeSelect
              id="social-platform"
              value={platform}
              onChange={(event) =>
                setPlatform(event.target.value as SocialPlatform)
              }
            >
              {SOCIAL_PLATFORMS.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {SOCIAL_LABELS[value]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field className="flex-1" data-invalid={Boolean(error) || undefined}>
            <FieldLabel htmlFor="social-url" className="sr-only">
              URL
            </FieldLabel>
            <Input
              id="social-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder={PLACEHOLDER[platform] ?? "https://..."}
              aria-invalid={Boolean(error)}
            />
            <FieldError>{error}</FieldError>
          </Field>
          <Button
            type="submit"
            variant="outline"
            disabled={busy || !url.trim()}
          >
            {busy ? <Spinner /> : <Plus />}
            Tambah
          </Button>
        </form>
      </CardContent>

      <AlertDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Hapus {toDelete ? SOCIAL_LABELS[toDelete.platform] : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ikon ini langsung hilang dari profil publik.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const target = toDelete;
                setToDelete(null);
                if (target) run(() => deleteSocialAction(target.id), "Dihapus");
              }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
