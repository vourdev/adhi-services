import "server-only";

import { revalidatePath } from "next/cache";

import { redirect } from "next/navigation";

import { getDb } from "@/db/client";
import {
  describePaymentsProblem,
  type PaymentsStatus,
  paymentsStatusForProfile,
} from "@/server/payments";

import type { SessionOwner } from "./auth";
import type { PublishContext } from "./products";
import { requireOwner } from "./session";

/** Every admin Server Action starts here: a database handle and the verified owner. */
export async function adminContext() {
  const owner = await requireOwner();
  return { owner, db: getDb(), profileId: owner.profile.id };
}

/** Protects super-admin actions: must be logged in as super_admin. */
export async function requireSuperAdmin() {
  const owner = await requireOwner();
  if (owner.user.role !== "super_admin") {
    redirect("/admin");
  }
  return owner;
}

export async function superAdminContext() {
  const owner = await requireSuperAdmin();
  return { owner, db: getDb() };
}

/** Whether the signed-in owner's checkout works, and if not, why, in words fit for their role. */
export function ownerPayments(owner: SessionOwner): {
  status: PaymentsStatus;
  problem: string | null;
} {
  const status = paymentsStatusForProfile(
    owner.profile,
    owner.user.plan === "premium"
  );
  return { status, problem: describePaymentsProblem(status, owner.user.role) };
}

export function publishContext(owner: SessionOwner): PublishContext {
  return {
    profileWhatsapp: owner.profile.whatsappNumber,
    paymentsReady: ownerPayments(owner).status.ready,
  };
}

/** Public pages render per request; this clears cached router payloads after an edit. */
export function revalidateProfile(username: string): void {
  revalidatePath(`/${username}`);
  revalidatePath(`/${username}/[slug]`, "page");
  revalidatePath("/admin", "layout");
}
