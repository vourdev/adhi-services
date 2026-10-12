"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as z from "zod";

import { orders } from "@/db/schema";
import { siteUrl } from "@/lib/env";
import { fail, ok, type Result } from "@/lib/result";
import { adminContext } from "@/server/admin";
import { refreshOrderStatus, rotateOrderAccess } from "@/server/checkout";
import { gatewayForOrder } from "@/server/payments";

const idSchema = z.uuid();

/** New buyer link for an order (e.g. the buyer lost theirs). The previous link stops working. */
export async function rotateOrderAccessAction(
  id: unknown
): Promise<Result<{ url: string }>> {
  const { db, profileId } = await adminContext();
  const orderId = idSchema.safeParse(id);
  if (!orderId.success) return fail("Pesanan tidak ditemukan.");
  return rotateOrderAccess(db, profileId, orderId.data, siteUrl());
}

/** Re-checks a pending order against the Midtrans Status API. */
export async function refreshOrderAction(
  id: unknown
): Promise<Result<{ status: string }>> {
  const { db, profileId } = await adminContext();
  const orderId = idSchema.safeParse(id);
  if (!orderId.success) return fail("Pesanan tidak ditemukan.");
  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, orderId.data), eq(orders.profileId, profileId)),
  });
  if (!order) return fail("Pesanan tidak ditemukan.");
  const gateway = await gatewayForOrder(db, order);
  if (!gateway) return fail("Akun Midtrans pesanan ini belum bisa dihubungi.");
  try {
    const status = await refreshOrderStatus(db, gateway, order);
    revalidatePath("/admin/orders");
    return ok({ status });
  } catch {
    return fail("Midtrans tidak bisa dihubungi. Coba lagi nanti.");
  }
}
