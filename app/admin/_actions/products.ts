"use server";

import * as z from "zod";

import { fail, type Result } from "@/lib/result";
import { fieldErrors, productInputSchema } from "@/lib/validation";
import {
  adminContext,
  publishContext,
  revalidateProfile,
} from "@/server/admin";
import { createProduct, deleteProduct, updateProduct } from "@/server/products";

const idSchema = z.uuid();

export async function createProductAction(
  input: unknown
): Promise<Result<{ id: string }>> {
  const { db, profileId, owner } = await adminContext();
  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success)
    return fail("Periksa kembali isian produk.", fieldErrors(parsed.error));
  const result = await createProduct(
    db,
    profileId,
    parsed.data,
    publishContext(owner)
  );
  if (result.ok) revalidateProfile(owner.profile.username);
  return result;
}

export async function updateProductAction(
  id: unknown,
  input: unknown
): Promise<Result> {
  const { db, profileId, owner } = await adminContext();
  const productId = idSchema.safeParse(id);
  if (!productId.success) return fail("Produk tidak ditemukan.");
  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success)
    return fail("Periksa kembali isian produk.", fieldErrors(parsed.error));
  const result = await updateProduct(
    db,
    profileId,
    productId.data,
    parsed.data,
    publishContext(owner)
  );
  if (result.ok) revalidateProfile(owner.profile.username);
  return result;
}

export async function deleteProductAction(id: unknown): Promise<Result> {
  const { db, profileId, owner } = await adminContext();
  const productId = idSchema.safeParse(id);
  if (!productId.success) return fail("Produk tidak ditemukan.");
  const result = await deleteProduct(db, profileId, productId.data);
  if (result.ok) revalidateProfile(owner.profile.username);
  return result;
}
