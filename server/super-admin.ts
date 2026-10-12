import { and, count, desc, eq, gt, isNull, or } from "drizzle-orm";
import * as z from "zod";

import { type Database, writeTransaction } from "@/db/client";
import {
  membershipLogs,
  orders,
  platformSettings,
  type PlatformSettings,
  products,
  profiles,
  sessions,
  users,
} from "@/db/schema";
import type { UserPlan, UserStatus } from "@/lib/domain";
import { effectivePlan, isPlanExpired, premiumEndDate } from "@/lib/plan";
import { hashPassword } from "@/lib/security";
import { passwordSchema, usernameSchema } from "@/lib/validation";

const DAY_MS = 86_400_000;

/** First broken password rule as a message, or null when the password is fine. */
function passwordProblem(password: string): string | null {
  const result = passwordSchema.safeParse(password);
  return result.success
    ? null
    : `Password: ${result.error.issues[0]?.message ?? "tidak valid."}`;
}

export type MemberSummary = {
  id: string;
  name: string;
  email: string;
  role: "super_admin" | "member";
  status: "active" | "suspended";
  /** Stored plan. Use effectivePlan for what applies today. */
  plan: "free" | "premium";
  /** Premium only while it has not expired; the super admin always has it. */
  effectivePlan: UserPlan;
  /** Stored as premium, but the end date has passed. */
  planExpired: boolean;
  planExpiresAt: Date | null;
  planNotes: string | null;
  createdAt: Date;
  profile: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isPublished: boolean;
  } | null;
  productCount: number;
  orderCount: number;
};

/** Every account with its profile and counts, in four queries whatever the number of members. */
export async function listMembers(
  db: Database,
  nowMs = Date.now()
): Promise<MemberSummary[]> {
  const [allUsers, allProfiles, productCounts, orderCounts] = await Promise.all(
    [
      db.query.users.findMany({
        columns: { passwordHash: false },
        orderBy: [desc(users.createdAt)],
      }),
      db
        .select({
          id: profiles.id,
          ownerId: profiles.ownerId,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarUrl: profiles.avatarUrl,
          isPublished: profiles.isPublished,
        })
        .from(profiles),
      db
        .select({ profileId: products.profileId, value: count() })
        .from(products)
        .groupBy(products.profileId),
      db
        .select({ profileId: orders.profileId, value: count() })
        .from(orders)
        .groupBy(orders.profileId),
    ]
  );

  const profileByOwner = new Map(allProfiles.map((row) => [row.ownerId, row]));
  const productsByProfile = new Map(
    productCounts.map((row) => [row.profileId, row.value])
  );
  const ordersByProfile = new Map(
    orderCounts.map((row) => [row.profileId, row.value])
  );

  return allUsers.map((u) => {
    const found = profileByOwner.get(u.id);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      plan: u.plan,
      effectivePlan: effectivePlan(u, nowMs),
      planExpired: isPlanExpired(u, nowMs),
      planExpiresAt: u.planExpiresAt,
      planNotes: u.planNotes,
      createdAt: u.createdAt,
      profile: found
        ? {
            id: found.id,
            username: found.username,
            displayName: found.displayName,
            avatarUrl: found.avatarUrl,
            isPublished: found.isPublished,
          }
        : null,
      productCount: found ? (productsByProfile.get(found.id) ?? 0) : 0,
      orderCount: found ? (ordersByProfile.get(found.id) ?? 0) : 0,
    };
  });
}

export type CreateMemberInput = {
  name: string;
  email: string;
  username: string;
  password: string;
  plan: UserPlan;
  durationDays?: number | null;
  notes?: string | undefined;
};

export async function createMember(
  db: Database,
  input: CreateMemberInput,
  grantedBy: string | null = null
): Promise<
  | {
      ok: true;
      user: typeof users.$inferSelect;
      profile: typeof profiles.$inferSelect;
    }
  | { ok: false; error: string }
> {
  const cleanEmail = input.email.trim().toLowerCase();
  const cleanName = input.name.trim();

  if (!cleanName || cleanName.length < 2) {
    return { ok: false, error: "Nama minimal 2 karakter." };
  }
  if (!z.email().safeParse(cleanEmail).success) {
    return { ok: false, error: "Email tidak valid." };
  }
  const weakPassword = passwordProblem(input.password);
  if (weakPassword) return { ok: false, error: weakPassword };

  const usernameCheck = usernameSchema.safeParse(input.username);
  if (!usernameCheck.success) {
    return {
      ok: false,
      error: usernameCheck.error.issues[0]?.message ?? "Username tidak valid.",
    };
  }
  const cleanUsername = usernameCheck.data;

  // Check unique email and username
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, cleanEmail),
  });
  if (existingUser) {
    return { ok: false, error: "Email sudah terdaftar." };
  }

  const existingProfile = await db.query.profiles.findFirst({
    where: eq(profiles.username, cleanUsername),
  });
  if (existingProfile) {
    return { ok: false, error: "Username sudah digunakan, pilih yang lain." };
  }

  const passwordHash = await hashPassword(input.password);
  const now = new Date();
  const planExpiresAt =
    input.plan === "premium" && input.durationDays
      ? new Date(now.getTime() + input.durationDays * DAY_MS)
      : null;

  return writeTransaction(db, async (tx) => {
    const [createdUser] = await tx
      .insert(users)
      .values({
        email: cleanEmail,
        name: cleanName,
        passwordHash,
        role: "member",
        status: "active",
        plan: input.plan,
        planExpiresAt,
        planNotes: input.notes?.trim() || null,
        planGrantedBy: grantedBy,
      })
      .returning();

    if (!createdUser) {
      throw new Error("Gagal membuat user.");
    }

    const [createdProfile] = await tx
      .insert(profiles)
      .values({
        ownerId: createdUser.id,
        username: cleanUsername,
        displayName: cleanName,
        bio: "",
        themePreset: "default",
        theme: "system",
        accent: "blue",
        isPublished: true,
      })
      .returning();

    if (!createdProfile) {
      throw new Error("Gagal membuat profil.");
    }

    if (input.plan === "premium") {
      await tx.insert(membershipLogs).values({
        userId: createdUser.id,
        grantedBy,
        plan: "premium",
        durationDays: input.durationDays ?? null,
        expiresAt: planExpiresAt,
        notes: input.notes?.trim() || "Aktivasi member premium awal",
      });
    }

    return { ok: true, user: createdUser, profile: createdProfile };
  });
}

export async function setMemberPlan(
  db: Database,
  input: {
    userId: string;
    plan: UserPlan;
    durationDays?: number | null;
    notes?: string | undefined;
  },
  grantedBy: string | null = null,
  nowMs = Date.now()
): Promise<{ ok: boolean; error?: string }> {
  const targetUser = await db.query.users.findFirst({
    where: eq(users.id, input.userId),
  });
  if (!targetUser) return { ok: false, error: "Member tidak ditemukan." };

  const now = new Date(nowMs);
  const planExpiresAt =
    input.plan === "premium"
      ? premiumEndDate(targetUser, input.durationDays, nowMs)
      : null;

  await writeTransaction(db, async (tx) => {
    await tx
      .update(users)
      .set({
        plan: input.plan,
        planExpiresAt,
        planNotes: input.notes?.trim() || targetUser.planNotes,
        planGrantedBy: grantedBy ?? targetUser.planGrantedBy,
        updatedAt: now,
      })
      .where(eq(users.id, input.userId));

    await tx.insert(membershipLogs).values({
      userId: input.userId,
      grantedBy: grantedBy ?? null,
      plan: input.plan,
      durationDays: input.durationDays ?? null,
      expiresAt: planExpiresAt,
      notes:
        input.notes?.trim() || `Diubah menjadi ${input.plan} oleh Super Admin`,
    });
  });

  return { ok: true };
}

export async function resetMemberPassword(
  db: Database,
  userId: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  const weakPassword = passwordProblem(newPassword);
  if (weakPassword) return { ok: false, error: weakPassword };
  const passwordHash = await hashPassword(newPassword);

  await writeTransaction(db, async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));
    // Clear sessions
    await tx.delete(sessions).where(eq(sessions.userId, userId));
  });

  return { ok: true };
}

export async function setMemberStatus(
  db: Database,
  userId: string,
  status: UserStatus
): Promise<{ ok: boolean; error?: string }> {
  const targetUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!targetUser) return { ok: false, error: "Member tidak ditemukan." };
  if (targetUser.role === "super_admin" && status === "suspended") {
    return { ok: false, error: "Super Admin tidak dapat disuspend." };
  }

  await writeTransaction(db, async (tx) => {
    await tx
      .update(users)
      .set({ status, updatedAt: new Date() })
      .where(eq(users.id, userId));

    if (status === "suspended") {
      await tx.delete(sessions).where(eq(sessions.userId, userId));
    }
  });

  return { ok: true };
}

export type PlatformOverviewStats = {
  totalUsers: number;
  totalPremiumUsers: number;
  totalProfiles: number;
  totalProducts: number;
  totalOrders: number;
};

export async function getPlatformOverview(
  db: Database,
  nowMs = Date.now()
): Promise<PlatformOverviewStats> {
  const [userRow] = await db.select({ total: count() }).from(users);
  // Members whose premium is in force today; expired grants do not count.
  const [premiumRow] = await db
    .select({ total: count() })
    .from(users)
    .where(
      and(
        eq(users.role, "member"),
        eq(users.plan, "premium"),
        or(
          isNull(users.planExpiresAt),
          gt(users.planExpiresAt, new Date(nowMs))
        )
      )
    );
  const [profileRow] = await db.select({ total: count() }).from(profiles);
  const [productRow] = await db.select({ total: count() }).from(products);
  const [orderRow] = await db.select({ total: count() }).from(orders);

  return {
    totalUsers: userRow?.total ?? 0,
    totalPremiumUsers: premiumRow?.total ?? 0,
    totalProfiles: profileRow?.total ?? 0,
    totalProducts: productRow?.total ?? 0,
    totalOrders: orderRow?.total ?? 0,
  };
}

export async function getPlatformSettings(
  db: Database
): Promise<PlatformSettings> {
  const existing = await db.query.platformSettings.findFirst({
    where: eq(platformSettings.id, "default"),
  });
  if (existing) {
    return existing;
  }
  const [created] = await db
    .insert(platformSettings)
    .values({
      id: "default",
      brandName: "Adhi Web Services",
      brandTagline: "Satu link untuk segala profil dan produk Anda",
    })
    .onConflictDoNothing()
    .returning();
  if (created) {
    return created;
  }
  return {
    id: "default",
    brandName: "Adhi Web Services",
    brandTagline: "Satu link untuk segala profil dan produk Anda",
    brandLogoUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function updatePlatformSettings(
  db: Database,
  input: {
    brandName: string;
    brandTagline?: string;
    brandLogoUrl?: string;
  }
) {
  const brandName = input.brandName.trim();
  if (!brandName) {
    return { ok: false, error: "Nama brand wajib diisi." };
  }

  await db
    .insert(platformSettings)
    .values({
      id: "default",
      brandName,
      brandTagline: input.brandTagline?.trim() || null,
      brandLogoUrl: input.brandLogoUrl?.trim() || null,
    })
    .onConflictDoUpdate({
      target: platformSettings.id,
      set: {
        brandName,
        brandTagline: input.brandTagline?.trim() || null,
        brandLogoUrl: input.brandLogoUrl?.trim() || null,
        updatedAt: new Date(),
      },
    });

  return { ok: true };
}
