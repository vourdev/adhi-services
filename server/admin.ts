import "server-only";

import { revalidatePath } from "next/cache";

import { getDb } from "@/db/client";
import {
  describePaymentsProblem,
  type PaymentsStatus,
  paymentsStatus,
} from "@/server/payments";

import type { SessionOwner } from "./auth";
import type { PublishContext } from "./products";
import { requireOwner } from "./session";

/** Every admin Server Action starts here: a database handle and the verified owner. */
export async function adminContext() {
  const owner = await requireOwner();
  return { owner, db: getDb(), profileId: owner.profile.id };
}

/** Whether checkout works, and if not, why. */
export function ownerPayments(): {
  status: PaymentsStatus;
  problem: string | null;
} {
  const status = paymentsStatus();
  return { status, problem: describePaymentsProblem(status) };
}

export function publishContext(owner: SessionOwner): PublishContext {
  return {
    profileWhatsapp: owner.profile.whatsappNumber,
    paymentsReady: ownerPayments().status.ready,
  };
}

/** Public pages render per request; this clears cached router payloads after an edit. */
export function revalidateProfile(username: string): void {
  revalidatePath(`/${username}`);
  revalidatePath(`/${username}/[slug]`, "page");
  revalidatePath("/admin", "layout");
}
