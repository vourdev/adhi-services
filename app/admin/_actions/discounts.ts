"use server";

import * as z from "zod";

import { fail, type Result } from "@/lib/result";
import { discountCodeInputSchema, fieldErrors } from "@/lib/validation";
import { adminContext } from "@/server/admin";
import {
  createDiscountCode,
  deleteDiscountCode,
  updateDiscountCode,
} from "@/server/discount-codes";

const idSchema = z.uuid();

export async function createDiscountCodeAction(
  input: unknown
): Promise<Result<{ id: string }>> {
  const { db, profileId } = await adminContext();
  const parsed = discountCodeInputSchema.safeParse(input);
  if (!parsed.success)
    return fail("Periksa kembali isian kode.", fieldErrors(parsed.error));
  return createDiscountCode(db, profileId, parsed.data);
}

export async function updateDiscountCodeAction(
  id: unknown,
  input: unknown
): Promise<Result> {
  const { db, profileId } = await adminContext();
  const codeId = idSchema.safeParse(id);
  if (!codeId.success) return fail("Kode diskon tidak ditemukan.");
  const parsed = discountCodeInputSchema.safeParse(input);
  if (!parsed.success)
    return fail("Periksa kembali isian kode.", fieldErrors(parsed.error));
  return updateDiscountCode(db, profileId, codeId.data, parsed.data);
}

export async function deleteDiscountCodeAction(id: unknown): Promise<Result> {
  const { db, profileId } = await adminContext();
  const codeId = idSchema.safeParse(id);
  if (!codeId.success) return fail("Kode diskon tidak ditemukan.");
  return deleteDiscountCode(db, profileId, codeId.data);
}
