"use server";

import { cookies } from "next/headers";
import * as z from "zod";

import { isProduction } from "@/lib/env";
import { fail, ok, type Result } from "@/lib/result";
import {
  fieldErrors,
  profileInputSchema,
  publicSettingsSchema,
  reorderSchema,
  socialInputSchema,
} from "@/lib/validation";
import { adminContext, revalidateProfile } from "@/server/admin";
import { IGNORE_COOKIE } from "@/server/analytics/visitor";
import {
  createSocial,
  deleteSocial,
  reorderSocials,
  updateProfile,
  updatePublicSettings,
  updateSocial,
} from "@/server/profile";

const idSchema = z.uuid();

export async function updateProfileAction(input: unknown): Promise<Result> {
  const { db, profileId, owner } = await adminContext();
  const parsed = profileInputSchema.safeParse(input);
  if (!parsed.success)
    return fail("Periksa kembali isian profil.", fieldErrors(parsed.error));
  const result = await updateProfile(db, profileId, parsed.data);
  revalidateProfile(owner.profile.username);
  return result;
}

export async function updatePublicSettingsAction(
  input: unknown
): Promise<Result<{ username: string }>> {
  const { db, profileId, owner } = await adminContext();
  const parsed = publicSettingsSchema.safeParse(input);
  if (!parsed.success)
    return fail("Periksa kembali isian.", fieldErrors(parsed.error));
  const result = await updatePublicSettings(db, profileId, parsed.data);
  if (result.ok) {
    revalidateProfile(owner.profile.username);
    revalidateProfile(result.data.username);
  }
  return result;
}

export async function createSocialAction(
  input: unknown
): Promise<Result<{ id: string }>> {
  const { db, profileId, owner } = await adminContext();
  const parsed = socialInputSchema.safeParse(input);
  if (!parsed.success)
    return fail("Periksa kembali isian.", fieldErrors(parsed.error));
  const result = await createSocial(db, profileId, parsed.data);
  revalidateProfile(owner.profile.username);
  return result;
}

export async function updateSocialAction(
  id: unknown,
  input: unknown
): Promise<Result> {
  const { db, profileId, owner } = await adminContext();
  const socialId = idSchema.safeParse(id);
  const parsed = socialInputSchema.safeParse(input);
  if (!socialId.success) return fail("Media sosial tidak ditemukan.");
  if (!parsed.success)
    return fail("Periksa kembali isian.", fieldErrors(parsed.error));
  const result = await updateSocial(db, profileId, socialId.data, parsed.data);
  revalidateProfile(owner.profile.username);
  return result;
}

export async function deleteSocialAction(id: unknown): Promise<Result> {
  const { db, profileId, owner } = await adminContext();
  const socialId = idSchema.safeParse(id);
  if (!socialId.success) return fail("Media sosial tidak ditemukan.");
  const result = await deleteSocial(db, profileId, socialId.data);
  revalidateProfile(owner.profile.username);
  return result;
}

export async function reorderSocialsAction(ids: unknown): Promise<Result> {
  const { db, profileId, owner } = await adminContext();
  const parsed = reorderSchema.safeParse({ ids });
  if (!parsed.success) return fail("Urutan tidak valid.");
  const result = await reorderSocials(db, profileId, parsed.data.ids);
  revalidateProfile(owner.profile.username);
  return result;
}

/** Stops (or resumes) counting visits from this browser, even after signing out. */
export async function setTrackingExclusionAction(
  exclude: unknown
): Promise<Result> {
  await adminContext();
  if (typeof exclude !== "boolean") return fail("Permintaan tidak valid.");
  const store = await cookies();
  if (exclude) {
    store.set(IGNORE_COOKIE, "1", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
    });
  } else {
    store.delete(IGNORE_COOKIE);
  }
  return ok();
}
