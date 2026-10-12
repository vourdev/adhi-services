"use server";

import * as z from "zod";

import { fail, ok, type Result } from "@/lib/result";
import {
  fieldErrors,
  linkInputSchema,
  productBlockSchema,
  reorderSchema,
} from "@/lib/validation";
import { adminContext, revalidateProfile } from "@/server/admin";
import {
  addProductBlock,
  createLink,
  deleteLink,
  reorderLinks,
  setLinkActive,
  updateLink,
} from "@/server/profile";

const idSchema = z.uuid();

export async function createLinkAction(
  input: unknown
): Promise<Result<{ id: string }>> {
  const { db, profileId, owner } = await adminContext();
  const parsed = linkInputSchema.safeParse(input);
  if (!parsed.success)
    return fail("Periksa kembali isian link.", fieldErrors(parsed.error));
  const result = await createLink(db, profileId, parsed.data);
  if (result.ok) revalidateProfile(owner.profile.username);
  return result;
}

export async function updateLinkAction(
  id: unknown,
  input: unknown
): Promise<Result> {
  const { db, profileId, owner } = await adminContext();
  const linkId = idSchema.safeParse(id);
  const parsed = linkInputSchema.safeParse(input);
  if (!linkId.success) return fail("Link tidak ditemukan.");
  if (!parsed.success)
    return fail("Periksa kembali isian link.", fieldErrors(parsed.error));
  const result = await updateLink(db, profileId, linkId.data, parsed.data);
  if (result.ok) revalidateProfile(owner.profile.username);
  return result;
}

export async function deleteLinkAction(id: unknown): Promise<Result> {
  const { db, profileId, owner } = await adminContext();
  const linkId = idSchema.safeParse(id);
  if (!linkId.success) return fail("Link tidak ditemukan.");
  const result = await deleteLink(db, profileId, linkId.data);
  if (result.ok) revalidateProfile(owner.profile.username);
  return result;
}

export async function toggleLinkAction(
  id: unknown,
  isActive: unknown
): Promise<Result> {
  const { db, profileId, owner } = await adminContext();
  const linkId = idSchema.safeParse(id);
  if (!linkId.success || typeof isActive !== "boolean")
    return fail("Permintaan tidak valid.");
  const result = await setLinkActive(db, profileId, linkId.data, isActive);
  if (result.ok) revalidateProfile(owner.profile.username);
  return result;
}

export async function reorderLinksAction(ids: unknown): Promise<Result> {
  const { db, profileId, owner } = await adminContext();
  const parsed = reorderSchema.safeParse({ ids });
  if (!parsed.success) return fail("Urutan tidak valid.");
  const result = await reorderLinks(db, profileId, parsed.data.ids);
  if (result.ok) revalidateProfile(owner.profile.username);
  return result;
}

export async function addProductBlockAction(input: unknown): Promise<Result> {
  const { db, profileId, owner } = await adminContext();
  const parsed = productBlockSchema.safeParse(input);
  if (!parsed.success) return fail("Pilih produk.");
  const result = await addProductBlock(db, profileId, parsed.data.productId);
  if (result.ok) revalidateProfile(owner.profile.username);
  return result.ok ? ok() : result;
}
