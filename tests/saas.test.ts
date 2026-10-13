import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import { eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { membershipLogs, users } from "@/db/schema";
import { parseCustomTheme, themeToCssVariables } from "@/lib/custom-theme";
import { resolveSession, signIn } from "@/server/auth";
import {
  createMember,
  getPlatformOverview,
  getPlatformSettings,
  listMembers,
  resetMemberPassword,
  setMemberPlan,
  setMemberStatus,
  updatePlatformSettings,
} from "@/server/super-admin";

import { createTestDb } from "./helpers/db";

let db: Database;
let cleanup: () => void;

before(async () => {
  ({ db, cleanup } = await createTestDb());
});

after(() => {
  cleanup();
});

const sign = (email: string, pass: string) =>
  signIn(db, { email, password: pass, clientKey: null, userAgent: null });

describe("SaaS Multi-Tenant Management", () => {
  test("createMember creates a user with profile and assigns role and plan", async () => {
    const res = await createMember(db, {
      name: "Budi Santoso",
      email: "budi@example.com",
      username: "budisantoso",
      password: "password123",
      plan: "free",
    });

    assert.equal(res.ok, true);
    if (!res.ok) throw new Error("Expected ok");

    assert.equal(res.user.role, "member");
    assert.equal(res.user.plan, "free");
    assert.equal(res.user.status, "active");

    // Profile created
    assert.equal(res.profile.username, "budisantoso");
    assert.equal(res.profile.displayName, "Budi Santoso");

    // Can sign in
    const signInRes = await sign("budi@example.com", "password123");
    assert.equal(signInRes.ok, true);
    if (signInRes.ok) {
      const owner = await resolveSession(db, signInRes.token);
      assert.ok(owner);
      assert.equal(owner?.user.role, "member");
      assert.equal(owner?.user.plan, "free");
    }
  });

  test("createMember prevents duplicate email and username", async () => {
    const dupEmail = await createMember(db, {
      name: "Budi Clone",
      email: "budi@example.com",
      username: "budiclone",
      password: "password123",
      plan: "free",
    });
    assert.equal(dupEmail.ok, false);
    assert.match(dupEmail.error ?? "", /Email sudah terdaftar/);

    const dupUsername = await createMember(db, {
      name: "Budi Clone 2",
      email: "budi2@example.com",
      username: "budisantoso",
      password: "password123",
      plan: "free",
    });
    assert.equal(dupUsername.ok, false);
    assert.match(dupUsername.error ?? "", /Username sudah digunakan/);
  });

  test("setMemberPlan upgrades to premium and logs membership audit", async () => {
    const memberRes = await createMember(db, {
      name: "Citra Lestari",
      email: "citra@example.com",
      username: "citralestari",
      password: "password123",
      plan: "free",
    });
    assert.equal(memberRes.ok, true);
    if (!memberRes.ok) throw new Error("Expected ok");
    const userId = memberRes.user.id;

    // Grant 30 days premium
    const upgradeRes = await setMemberPlan(db, {
      userId,
      plan: "premium",
      durationDays: 30,
      notes: "Early adopter promo",
    });
    assert.equal(upgradeRes.ok, true);

    const updatedUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    assert.equal(updatedUser?.plan, "premium");
    assert.ok(updatedUser?.planExpiresAt);
    assert.equal(updatedUser?.planNotes, "Early adopter promo");

    // Verify audit log
    const logs = await db.query.membershipLogs.findMany({
      where: eq(membershipLogs.userId, userId),
    });
    assert.equal(logs.length, 1);
    assert.equal(logs[0]?.plan, "premium");

    // Grant Lifetime premium (durationDays: null)
    const lifetimeRes = await setMemberPlan(db, {
      userId,
      plan: "premium",
      durationDays: null,
      notes: "Lifetime VIP",
    });
    assert.equal(lifetimeRes.ok, true);

    const lifetimeUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    assert.equal(lifetimeUser?.plan, "premium");
    assert.equal(lifetimeUser?.planExpiresAt, null);

    // Downgrade to free
    const downgradeRes = await setMemberPlan(db, {
      userId,
      plan: "free",
      notes: "Revert to free",
    });
    assert.equal(downgradeRes.ok, true);

    const freeUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    assert.equal(freeUser?.plan, "free");
    assert.equal(freeUser?.planExpiresAt, null);
  });

  test("setMemberStatus suspends member, revokes sessions, and blocks sign in", async () => {
    const memberRes = await createMember(db, {
      name: "Doni Firmansyah",
      email: "doni@example.com",
      username: "donifirman",
      password: "password123",
      plan: "free",
    });
    assert.equal(memberRes.ok, true);
    if (!memberRes.ok) throw new Error("Expected ok");
    const userId = memberRes.user.id;

    // Sign in to create a session
    const signInRes = await sign("doni@example.com", "password123");
    assert.equal(signInRes.ok, true);
    if (!signInRes.ok) return;

    // Suspend user
    const suspendRes = await setMemberStatus(db, userId, "suspended");
    assert.equal(suspendRes.ok, true);

    // Existing session revoked
    const resolved = await resolveSession(db, signInRes.token);
    assert.equal(resolved, null);

    // Cannot sign in while suspended
    const signInSuspended = await sign("doni@example.com", "password123");
    assert.equal(signInSuspended.ok, false);

    // Reactivate
    const activateRes = await setMemberStatus(db, userId, "active");
    assert.equal(activateRes.ok, true);

    // Can sign in again
    const signInActive = await sign("doni@example.com", "password123");
    assert.equal(signInActive.ok, true);
  });

  test("resetMemberPassword changes password and invalidates previous sessions", async () => {
    const memberRes = await createMember(db, {
      name: "Eka Putri",
      email: "eka@example.com",
      username: "ekaputri",
      password: "oldpassword1",
      plan: "free",
    });
    assert.equal(memberRes.ok, true);
    if (!memberRes.ok) throw new Error("Expected ok");
    const userId = memberRes.user.id;

    const oldSessionRes = await sign("eka@example.com", "oldpassword1");
    assert.equal(oldSessionRes.ok, true);
    if (!oldSessionRes.ok) return;

    const resetRes = await resetMemberPassword(db, userId, "newpassword123");
    assert.equal(resetRes.ok, true);

    // Old session revoked
    const resolvedOld = await resolveSession(db, oldSessionRes.token);
    assert.equal(resolvedOld, null);

    // Old password fails
    const oldLogin = await sign("eka@example.com", "oldpassword1");
    assert.equal(oldLogin.ok, false);

    // New password succeeds
    const newLogin = await sign("eka@example.com", "newpassword123");
    assert.equal(newLogin.ok, true);
  });

  test("platform settings and overview statistics", async () => {
    const defaultSettings = await getPlatformSettings(db);
    assert.equal(defaultSettings.brandName, "Adhi Web Services");

    const updateRes = await updatePlatformSettings(db, {
      brandName: "Adhi Bio Platform",
      brandTagline: "Platform Link Bio & Toko Digital",
    });
    assert.equal(updateRes.ok, true);

    const updated = await getPlatformSettings(db);
    assert.equal(updated.brandName, "Adhi Bio Platform");
    assert.equal(updated.brandTagline, "Platform Link Bio & Toko Digital");

    const overview = await getPlatformOverview(db);
    assert.ok(overview.totalUsers >= 4);
    assert.ok(overview.totalProfiles >= 4);

    const members = await listMembers(db);
    assert.ok(members.length >= 4);
  });

  test("ultra-customizer theme parser and CSS variables generator", () => {
    const jsonStr = JSON.stringify({
      preset: "custom",
      backgroundType: "gradient",
      gradientFrom: "#0f172a",
      gradientTo: "#1e1b4b",
      backgroundColor: "#0f172a",
      textColor: "#f8fafc",
      textMutedColor: "#94a3b8",
      cardColor: "rgba(255, 255, 255, 0.08)",
      cardBorderColor: "rgba(255, 255, 255, 0.18)",
    });
    const parsed = parseCustomTheme(jsonStr);
    assert.ok(parsed);
    assert.equal(parsed.backgroundType, "gradient");

    const cssVars = themeToCssVariables(parsed);
    assert.ok(cssVars);
    const record = cssVars as Record<string, string>;
    assert.ok(typeof record["--p-bg"] === "string");
    assert.ok(typeof record["--p-fg"] === "string");
    assert.ok(typeof record["--p-card"] === "string");
  });
});
