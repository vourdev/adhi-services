"use server";

import { revalidatePath } from "next/cache";

import { getDb } from "@/db/client";
import { platformSettingsSchema } from "@/lib/validation";
import { updatePlatformSettings } from "@/server/platform-settings";
import { requireOwner } from "@/server/session";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function updatePlatformSettingsAction(
  formData: FormData
): Promise<ActionResult> {
  await requireOwner();
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries())
    if (typeof value === "string") values[key] = value;
  const parsed = platformSettingsSchema.safeParse(values);
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Periksa kembali isian.",
    };

  const result = await updatePlatformSettings(getDb(), {
    brandName: parsed.data.brandName,
    brandTagline: parsed.data.brandTagline ?? "",
    brandLogoUrl: parsed.data.brandLogoUrl ?? "",
    businessName: parsed.data.businessName ?? "",
    contactEmail: parsed.data.contactEmail ?? "",
    contactPhone: parsed.data.contactPhone ?? "",
    businessAddress: parsed.data.businessAddress ?? "",
  });
  if (!result.ok)
    return { ok: false, error: result.error ?? "Gagal menyimpan." };

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}
