"use server";

import { revalidatePath } from "next/cache";
import type * as z from "zod";

import { getDb } from "@/db/client";
import {
  createMemberSchema,
  memberPasswordSchema,
  memberPlanSchema,
  memberStatusSchema,
  platformSettingsSchema,
} from "@/lib/validation";
import { requireSuperAdmin } from "@/server/admin";
import {
  createMember,
  resetMemberPassword,
  setMemberPlan,
  setMemberStatus,
  updatePlatformSettings,
} from "@/server/super-admin";

type ActionResult<T = object> =
  ({ ok: true } & T) | { ok: false; error: string };

/** FormData to a checked object; the first problem becomes the error message. */
function parseForm<S extends z.ZodType>(
  schema: S,
  formData: FormData
): { ok: true; data: z.output<S> } | { ok: false; error: string } {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") values[key] = value;
  }
  const parsed = schema.safeParse(values);
  return parsed.success
    ? { ok: true, data: parsed.data }
    : {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Periksa kembali isian.",
      };
}

export async function createMemberAction(
  formData: FormData
): Promise<ActionResult<{ username: string }>> {
  const superAdmin = await requireSuperAdmin();
  const parsed = parseForm(createMemberSchema, formData);
  if (!parsed.ok) return parsed;

  const result = await createMember(
    getDb(),
    {
      ...parsed.data,
      durationDays:
        parsed.data.plan === "premium" ? parsed.data.durationDays : null,
    },
    superAdmin.user.id
  );
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/admin/super");
  revalidatePath("/admin/super/members");
  return { ok: true, username: result.profile.username };
}

export async function setMemberPlanAction(
  formData: FormData
): Promise<ActionResult> {
  const superAdmin = await requireSuperAdmin();
  const parsed = parseForm(memberPlanSchema, formData);
  if (!parsed.ok) return parsed;

  const result = await setMemberPlan(getDb(), parsed.data, superAdmin.user.id);
  if (!result.ok)
    return { ok: false, error: result.error ?? "Gagal memperbarui paket." };

  revalidatePath("/admin/super");
  revalidatePath("/admin/super/members");
  return { ok: true };
}

export async function resetMemberPasswordAction(
  formData: FormData
): Promise<ActionResult> {
  await requireSuperAdmin();
  const parsed = parseForm(memberPasswordSchema, formData);
  if (!parsed.ok) return parsed;

  const result = await resetMemberPassword(
    getDb(),
    parsed.data.userId,
    parsed.data.newPassword
  );
  if (!result.ok)
    return { ok: false, error: result.error ?? "Gagal mengubah password." };

  revalidatePath("/admin/super/members");
  return { ok: true };
}

export async function setMemberStatusAction(
  formData: FormData
): Promise<ActionResult> {
  await requireSuperAdmin();
  const parsed = parseForm(memberStatusSchema, formData);
  if (!parsed.ok) return parsed;

  const result = await setMemberStatus(
    getDb(),
    parsed.data.userId,
    parsed.data.status
  );
  if (!result.ok)
    return { ok: false, error: result.error ?? "Gagal mengubah status." };

  revalidatePath("/admin/super");
  revalidatePath("/admin/super/members");
  return { ok: true };
}

export async function updatePlatformSettingsAction(
  formData: FormData
): Promise<ActionResult> {
  await requireSuperAdmin();
  const parsed = parseForm(platformSettingsSchema, formData);
  if (!parsed.ok) return parsed;

  const result = await updatePlatformSettings(getDb(), {
    brandName: parsed.data.brandName,
    brandTagline: parsed.data.brandTagline ?? "",
    brandLogoUrl: parsed.data.brandLogoUrl ?? "",
  });
  if (!result.ok)
    return { ok: false, error: result.error ?? "Gagal menyimpan." };

  revalidatePath("/admin/super/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}
