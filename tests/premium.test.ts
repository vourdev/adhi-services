import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import { eq } from "drizzle-orm";

import { activeNavItem, getNavGroups } from "@/app/admin/_components/nav-items";
import type { Database } from "@/db/client";
import { orders, profiles, users } from "@/db/schema";
import { parseCustomTheme } from "@/lib/custom-theme";
import {
  effectivePlan,
  FREE_PROFILE_LOOK,
  isPlanExpired,
  premiumEndDate,
  withoutPremiumFields,
} from "@/lib/plan";
import { openSecret, sealSecret } from "@/lib/secret-box";
import {
  linkInputSchema,
  productInputSchema,
  profileInputSchema,
  publicSettingsSchema,
} from "@/lib/validation";
import {
  findTrackableLink,
  findTrackableProduct,
} from "@/server/analytics/ingest";
import { handleMidtransNotification, startCheckout } from "@/server/checkout";
import {
  loadPaymentProfile,
  openServerKey,
  orderAccountConfig,
  type PaymentEnvironment,
  resolveCheckoutAccount,
  sealServerKey,
} from "@/server/payments/accounts";
import type {
  CreateTransactionInput,
  GatewayStatus,
  PaymentGateway,
} from "@/server/payments/gateway";
import { midtransSignature } from "@/server/payments/midtrans";
import { createProduct } from "@/server/products";
import {
  createLink,
  getPublicProfile,
  updateProfile,
  updatePublicSettings,
} from "@/server/profile";
import { createOwner } from "@/server/setup";
import {
  getPlatformOverview,
  listMembers,
  setMemberPlan,
  setMemberStatus,
} from "@/server/super-admin";

import { createTestDb } from "./helpers/db";

const DAY = 86_400_000;
const SECRET = "test-encryption-secret-0123456789abcdef";
const MEMBER_KEY = "SB-Mid-server-MEMBERKEY123";
const PLATFORM_KEY = "SB-Mid-server-PLATFORMKEY1";

let db: Database;
let cleanup: () => void;

before(async () => {
  ({ db, cleanup } = await createTestDb());
});

after(() => cleanup());

async function makeOwner(
  username: string,
  plan: "free" | "premium",
  role: "member" | "super_admin" = "member"
) {
  const created = await createOwner(db, {
    email: `${username}@example.id`,
    password: "rahasia-1234",
    name: username,
    username,
    role,
    plan,
  });
  return {
    userId: created.user.id,
    profileId: created.profile.id,
    username,
  };
}

/** Page colours for the "custom" preset, as the profile form receives them. */
const CUSTOM_THEME = {
  preset: "custom",
  backgroundType: "gradient",
  gradientFrom: "#0f172a",
  gradientTo: "#1e1b4b",
  gradientAngle: 135,
  backgroundColor: "#0f172a",
  textColor: "#f8fafc",
  textMutedColor: "#94a3b8",
  cardColor: "rgba(255, 255, 255, 0.08)",
  cardBorderColor: "rgba(255, 255, 255, 0.18)",
  accentColor: "#6366f1",
  accentTextColor: "#ffffff",
  fontFamily: "Outfit",
  cardShape: "smooth",
  cardStyle: "glass",
};

const glassTheme = JSON.stringify(CUSTOM_THEME);

function profileInput(extra: Record<string, unknown> = {}) {
  return profileInputSchema.parse({
    displayName: "Nama",
    bio: "",
    theme: "system",
    accent: "blue",
    themePreset: "glassmorphism",
    customTheme: glassTheme,
    fontFamily: "Outfit",
    cardShape: "pill",
    cardStyle: "glass",
    hideWatermark: true,
    ...extra,
  });
}

// ------------------------------------------------------------------- rules

describe("plan rules", () => {
  const now = Date.UTC(2026, 9, 12);
  const member = (plan: "free" | "premium", planExpiresAt: Date | null) => ({
    role: "member" as const,
    plan,
    planExpiresAt,
  });

  test("premium counts only until its end date; the super admin always has it", () => {
    assert.equal(effectivePlan(member("free", null), now), "free");
    assert.equal(effectivePlan(member("premium", null), now), "premium");
    assert.equal(
      effectivePlan(member("premium", new Date(now + DAY)), now),
      "premium"
    );
    assert.equal(
      effectivePlan(member("premium", new Date(now - 1)), now),
      "free"
    );
    assert.equal(
      effectivePlan(
        { role: "super_admin", plan: "free", planExpiresAt: null },
        now
      ),
      "premium"
    );
    assert.equal(
      isPlanExpired(member("premium", new Date(now - 1)), now),
      true
    );
    assert.equal(isPlanExpired(member("premium", null), now), false);
  });

  test("adding time extends an active premium from its end date, never shortening it", () => {
    const end = new Date(now + 200 * DAY);
    assert.equal(
      premiumEndDate(member("premium", end), 30, now)?.getTime(),
      end.getTime() + 30 * DAY
    );
    assert.equal(
      premiumEndDate(
        member("premium", new Date(now - DAY)),
        30,
        now
      )?.getTime(),
      now + 30 * DAY
    );
    assert.equal(
      premiumEndDate(member("free", null), 30, now)?.getTime(),
      now + 30 * DAY
    );
    assert.equal(premiumEndDate(member("premium", end), null, now), null);
  });

  test("premium-only fields are dropped from an update", () => {
    const stripped = withoutPremiumFields(profileInput());
    assert.equal(stripped.displayName, "Nama");
    for (const field of Object.keys(FREE_PROFILE_LOOK))
      assert.equal(field in stripped, false, field);
  });
});

describe("custom theme validation", () => {
  test("a full theme passes and a partial one is completed with the defaults", () => {
    assert.ok(parseCustomTheme(glassTheme));
    const partial = parseCustomTheme(
      JSON.stringify({ backgroundColor: "#000000" })
    );
    assert.equal(partial?.backgroundColor, "#000000");
    assert.equal(partial?.textColor, "#09090b");
  });

  test("anything that is not a plain color, font or image URL is refused", () => {
    const base = CUSTOM_THEME;
    for (const bad of [
      { textColor: "red; background: url(https://evil.example)" },
      { accentColor: "expression(alert(1))" },
      { fontFamily: "Comic Sans" },
      { backgroundType: "image", backgroundImageUrl: 'x"); color: red; ("' },
      { backgroundType: "image", backgroundImageUrl: "javascript:alert(1)" },
    ])
      assert.equal(
        parseCustomTheme(JSON.stringify({ ...base, ...bad })),
        null,
        JSON.stringify(bad)
      );
    assert.equal(parseCustomTheme("not json"), null);
    assert.equal(parseCustomTheme("[]"), null);
  });

  test("the profile form stores the theme normalized and rejects bad values", () => {
    const saved = profileInput();
    assert.equal(parseCustomTheme(saved.customTheme)?.preset, "custom");
    const bad = profileInputSchema.safeParse({
      displayName: "Nama",
      theme: "system",
      accent: "blue",
      customTheme: JSON.stringify({ textColor: "url(x)" }),
    });
    assert.equal(bad.success, false);
  });
});

describe("secret box", () => {
  test("a sealed value opens only with the same secret and context", () => {
    const sealed = sealSecret("SB-Mid-server-abc", "profile-1", SECRET);
    assert.ok(!sealed.includes("SB-Mid-server-abc"));
    assert.equal(openSecret(sealed, "profile-1", SECRET), "SB-Mid-server-abc");
    assert.equal(openSecret(sealed, "profile-2", SECRET), null);
    assert.equal(openSecret(sealed, "profile-1", `${SECRET}x`), null);
    const [version, iv, body, tag] = sealed.split(".");
    const flipped = `${body?.startsWith("A") ? "B" : "A"}${body?.slice(1)}`;
    assert.equal(
      openSecret([version, iv, flipped, tag].join("."), "profile-1", SECRET),
      null
    );
    assert.equal(
      openSecret(
        [version, iv, body, tag?.slice(0, 8)].join("."),
        "profile-1",
        SECRET
      ),
      null,
      "a shortened tag is refused"
    );
    assert.equal(openSecret("plain-text-key", "profile-1", SECRET), null);
  });
});

// ------------------------------------------------------------ public pages

describe("premium on the public profile", () => {
  test("premium styling shows while the plan is active and returns after renewal", async () => {
    const owner = await makeOwner("styled", "premium");
    await updateProfile(db, owner.profileId, profileInput(), { premium: true });

    let profile = await getPublicProfile(db, "styled");
    assert.equal(profile?.themePreset, "glassmorphism");
    assert.equal(profile?.hideWatermark, true);
    assert.equal(profile?.cardShape, "pill");

    // Downgraded: visitors see the standard look and the watermark.
    await setMemberPlan(db, { userId: owner.userId, plan: "free" });
    profile = await getPublicProfile(db, "styled");
    assert.equal(profile?.themePreset, FREE_PROFILE_LOOK.themePreset);
    assert.equal(profile?.customTheme, null);
    assert.equal(profile?.hideWatermark, false);
    assert.equal(profile?.fontFamily, FREE_PROFILE_LOOK.fontFamily);

    // The stored look is kept, so renewing brings it back.
    const stored = await db.query.profiles.findFirst({
      where: eq(profiles.id, owner.profileId),
    });
    assert.equal(stored?.themePreset, "glassmorphism");
    await setMemberPlan(db, { userId: owner.userId, plan: "premium" });
    assert.equal(
      (await getPublicProfile(db, "styled"))?.themePreset,
      "glassmorphism"
    );
  });

  test("an expired premium renders as free", async () => {
    const owner = await makeOwner("expired", "premium");
    await updateProfile(db, owner.profileId, profileInput(), { premium: true });
    await db
      .update(users)
      .set({ planExpiresAt: new Date(Date.now() - DAY) })
      .where(eq(users.id, owner.userId));
    const profile = await getPublicProfile(db, "expired");
    assert.equal(profile?.hideWatermark, false);
    assert.equal(profile?.themePreset, "default");
  });

  test("the super admin keeps premium styling even with a free plan stored", async () => {
    const admin = await makeOwner("boss", "free", "super_admin");
    await updateProfile(db, admin.profileId, profileInput(), { premium: true });
    assert.equal((await getPublicProfile(db, "boss"))?.hideWatermark, true);
  });

  test("a suspended member's pages and links go offline, and come back on reactivation", async () => {
    const owner = await makeOwner("paused", "free");
    const link = await createLink(
      db,
      owner.profileId,
      linkInputSchema.parse({
        kind: "link",
        title: "Situs",
        url: "https://example.id",
      })
    );
    assert.ok(link.ok);
    const product = await createProduct(
      db,
      owner.profileId,
      productInputSchema.parse({
        name: "Ebook",
        slug: "ebook",
        priceAmount: 10000,
        productType: "template",
        status: "published",
        checkoutMethod: "whatsapp",
        whatsappNumber: "081234567890",
      }),
      { profileWhatsapp: null, paymentsReady: false }
    );
    assert.ok(product.ok);

    await setMemberStatus(db, owner.userId, "suspended");
    assert.equal(await getPublicProfile(db, "paused"), null);
    assert.equal(
      await getPublicProfile(db, "paused", { includeUnpublished: true }),
      null
    );
    assert.equal(
      (await findTrackableLink(db, link.ok ? link.data.id : ""))?.isPublished,
      false
    );
    assert.equal(
      (await findTrackableProduct(db, product.ok ? product.data.id : ""))
        ?.isPublished,
      false
    );

    await setMemberStatus(db, owner.userId, "active");
    assert.ok(await getPublicProfile(db, "paused"));
    assert.equal(
      (await findTrackableLink(db, link.ok ? link.data.id : ""))?.isPublished,
      true
    );
  });
});

// ------------------------------------------------------------------ saving

describe("saving premium settings", () => {
  test("a free owner's premium fields are ignored while the rest is saved", async () => {
    const owner = await makeOwner("plain", "free");
    await updateProfile(
      db,
      owner.profileId,
      profileInput({ displayName: "Nama Baru", accent: "#FF6600" }),
      { premium: false }
    );
    const stored = await db.query.profiles.findFirst({
      where: eq(profiles.id, owner.profileId),
    });
    assert.equal(stored?.displayName, "Nama Baru");
    // The accent colour is not a premium setting; a picked colour is stored normalized.
    assert.equal(stored?.accent, "#ff6600");
    assert.equal(stored?.themePreset, "default");
    assert.equal(stored?.customTheme, null);
    assert.equal(stored?.hideWatermark, false);
    assert.equal(stored?.cardShape, "smooth");
  });

  const settings = (extra: Record<string, unknown>) =>
    publicSettingsSchema.parse({
      username: "seller",
      whatsappNumber: "",
      isPublished: true,
      ...extra,
    });

  test("only premium can use its own Midtrans account; the key is stored encrypted", async () => {
    const owner = await makeOwner("seller", "free");

    // Free: the switch to a custom account is ignored.
    const free = await updatePublicSettings(
      db,
      owner.profileId,
      settings({ midtransMode: "custom", customMidtransServerKey: MEMBER_KEY }),
      { premium: false, encryptionSecret: SECRET }
    );
    assert.ok(free.ok);
    let stored = await db.query.profiles.findFirst({
      where: eq(profiles.id, owner.profileId),
    });
    assert.equal(stored?.midtransMode, "platform");
    assert.equal(stored?.customMidtransServerKey, null);

    // Premium, but no key: refused.
    const noKey = await updatePublicSettings(
      db,
      owner.profileId,
      settings({ midtransMode: "custom" }),
      { premium: true, encryptionSecret: SECRET }
    );
    assert.equal(noKey.ok, false);

    // Premium without ENCRYPTION_KEY on the server: refused, nothing stored in plain text.
    const noSecret = await updatePublicSettings(
      db,
      owner.profileId,
      settings({ midtransMode: "custom", customMidtransServerKey: MEMBER_KEY }),
      { premium: true, encryptionSecret: null }
    );
    assert.equal(noSecret.ok, false);

    const saved = await updatePublicSettings(
      db,
      owner.profileId,
      settings({ midtransMode: "custom", customMidtransServerKey: MEMBER_KEY }),
      { premium: true, encryptionSecret: SECRET }
    );
    assert.ok(saved.ok);
    stored = await db.query.profiles.findFirst({
      where: eq(profiles.id, owner.profileId),
    });
    assert.equal(stored?.midtransMode, "custom");
    assert.ok(stored?.customMidtransServerKey);
    assert.ok(!stored.customMidtransServerKey.includes(MEMBER_KEY));
    assert.equal(
      stored.customMidtransIsProduction,
      false,
      "SB- key is sandbox"
    );
    assert.equal(openServerKey(stored, SECRET), MEMBER_KEY);

    // Saving again without a key keeps the stored one.
    assert.ok(
      (
        await updatePublicSettings(
          db,
          owner.profileId,
          settings({ midtransMode: "custom" }),
          { premium: true, encryptionSecret: SECRET }
        )
      ).ok
    );
    stored = await db.query.profiles.findFirst({
      where: eq(profiles.id, owner.profileId),
    });
    assert.equal(openServerKey(stored!, SECRET), MEMBER_KEY);

    // Removing the key while still on the custom account is refused.
    const removeWhileCustom = await updatePublicSettings(
      db,
      owner.profileId,
      settings({ midtransMode: "custom", removeCustomMidtransServerKey: true }),
      { premium: true, encryptionSecret: SECRET }
    );
    assert.equal(removeWhileCustom.ok, false);

    // After the plan lapses, the owner can still switch back to the platform.
    const back = await updatePublicSettings(
      db,
      owner.profileId,
      settings({ midtransMode: "platform" }),
      { premium: false, encryptionSecret: SECRET }
    );
    assert.ok(back.ok);
    stored = await db.query.profiles.findFirst({
      where: eq(profiles.id, owner.profileId),
    });
    assert.equal(stored?.midtransMode, "platform");
  });

  test("a client key or malformed key is refused with a clear message", () => {
    const client = publicSettingsSchema.safeParse({
      username: "seller",
      isPublished: true,
      customMidtransServerKey: "SB-Mid-client-abcdefgh",
    });
    assert.equal(client.success, false);
    assert.match(
      client.success ? "" : (client.error.issues[0]?.message ?? ""),
      /Client Key/
    );
    assert.equal(
      publicSettingsSchema.safeParse({
        username: "seller",
        isPublished: true,
        customMidtransServerKey: "not a key",
      }).success,
      false
    );
  });
});

// ---------------------------------------------------------------- payments

describe("which Midtrans account takes the payment", () => {
  const platform = { serverKey: PLATFORM_KEY, isProduction: false };
  const env = (
    extra: Partial<PaymentEnvironment> = {}
  ): PaymentEnvironment => ({
    platform,
    siteUrlMissing: false,
    encryptionSecret: SECRET,
    ...extra,
  });
  const customSettings = (sealed: string | null) => ({
    id: "profile-x",
    midtransMode: "custom" as const,
    customMidtransServerKey: sealed,
  });
  const sealed = sealServerKey("profile-x", MEMBER_KEY, SECRET);

  test("the platform account is used when the profile chose it", () => {
    const result = resolveCheckoutAccount(
      { id: "p", midtransMode: "platform", customMidtransServerKey: null },
      false,
      env()
    );
    assert.deepEqual(result.status, {
      ready: true,
      account: "platform",
      mode: "sandbox",
    });
    assert.equal(result.config?.serverKey, PLATFORM_KEY);
    const missing = resolveCheckoutAccount(
      { id: "p", midtransMode: "platform", customMidtransServerKey: null },
      false,
      env({ platform: null, siteUrlMissing: true })
    );
    assert.deepEqual(missing.status, {
      ready: false,
      account: "platform",
      missing: ["MIDTRANS_SERVER_KEY", "SITE_URL"],
    });
  });

  test("a custom account never falls back to the platform's", () => {
    const lapsed = resolveCheckoutAccount(customSettings(sealed), false, env());
    assert.equal(lapsed.status.ready, false);
    assert.equal(lapsed.config, null, "no platform fallback");
    assert.deepEqual(lapsed.status.ready ? [] : lapsed.status.missing, [
      "PREMIUM",
    ]);

    const noKey = resolveCheckoutAccount(customSettings(null), true, env());
    assert.deepEqual(noKey.status.ready ? [] : noKey.status.missing, [
      "CUSTOM_SERVER_KEY",
    ]);
    assert.equal(noKey.config, null);

    const ready = resolveCheckoutAccount(customSettings(sealed), true, env());
    assert.deepEqual(ready.status, {
      ready: true,
      account: "custom",
      mode: "sandbox",
    });
    assert.equal(ready.config?.serverKey, MEMBER_KEY);
  });

  test("an existing order is checked on the account it was paid into", () => {
    const nowPlatform = {
      id: "profile-x",
      midtransMode: "platform" as const,
      customMidtransServerKey: sealed,
    };
    assert.equal(
      orderAccountConfig({ paymentAccount: "custom" }, nowPlatform, env())
        ?.serverKey,
      MEMBER_KEY
    );
    assert.equal(
      orderAccountConfig(
        { paymentAccount: "platform" },
        customSettings(sealed),
        env()
      )?.serverKey,
      PLATFORM_KEY
    );
  });
});

function recordingGateway(serverKey: string) {
  const statuses = new Map<string, GatewayStatus>();
  const requests: CreateTransactionInput[] = [];
  const gateway: PaymentGateway = {
    provider: "midtrans",
    async createTransaction(input) {
      await new Promise((resolve) => setImmediate(resolve));
      requests.push(input);
      return {
        token: `tok-${input.orderCode}`,
        redirectUrl: `https://app.sandbox.midtrans.com/snap/v2/vtweb/tok-${input.orderCode}`,
      };
    },
    async getStatus(orderCode) {
      return statuses.get(orderCode) ?? null;
    },
    verifyNotification(payload) {
      return midtransSignature(payload, serverKey) === payload.signature_key;
    },
  };
  return { gateway, statuses, requests };
}

describe("orders on a member's own Midtrans account", () => {
  const member = recordingGateway(MEMBER_KEY);
  const platform = recordingGateway(PLATFORM_KEY);
  let owner: Awaited<ReturnType<typeof makeOwner>>;
  let productId: string;
  let orderCode: string;

  before(async () => {
    owner = await makeOwner("ownshop", "premium");
    const created = await createProduct(
      db,
      owner.profileId,
      productInputSchema.parse({
        name: "Template",
        slug: "template",
        priceAmount: 50000,
        productType: "template",
        status: "published",
        checkoutMethod: "direct",
        deliveryType: "link",
        deliveryUrl: "https://drive.example/file",
      }),
      { profileWhatsapp: null, paymentsReady: true }
    );
    assert.ok(created.ok);
    productId = created.ok ? created.data.id : "";
  });

  const checkoutInput = () => ({
    productId,
    idempotencyKey: crypto.randomUUID(),
    expectedAmount: 50000,
    discountCode: null,
    buyerName: "Budi",
    buyerEmail: "budi@example.id",
    buyerPhone: null,
  });

  test("the order records the account and routes its webhooks here", async () => {
    const result = await startCheckout(db, member.gateway, checkoutInput(), {
      siteUrl: "https://example.id",
      visitor: {
        visitorId: null,
        sessionId: null,
        sessionSource: null,
        userAgent: null,
        siteHost: null,
      },
      paymentAccount: "custom",
      notificationUrl: "https://example.id/api/payments/midtrans",
    });
    assert.ok(result.ok);
    orderCode = result.ok ? result.data.orderCode : "";
    const order = await db.query.orders.findFirst({
      where: eq(orders.code, orderCode),
    });
    assert.equal(order?.paymentAccount, "custom");
    assert.equal(
      member.requests.at(-1)?.notificationUrl,
      "https://example.id/api/payments/midtrans"
    );
  });

  test("its webhook is verified with the member's key, not the platform's", async () => {
    const gatewayFor = (order: { paymentAccount: string } | null) =>
      order?.paymentAccount === "custom" ? member.gateway : platform.gateway;
    const payload = {
      order_id: orderCode,
      status_code: "200",
      gross_amount: "50000.00",
      transaction_status: "settlement",
    };
    member.statuses.set(orderCode, {
      orderId: orderCode,
      transactionStatus: "settlement",
      fraudStatus: null,
      statusCode: "200",
      grossAmount: 50000,
      transactionId: "t-member",
      paymentType: "qris",
    });

    const forged = await handleMidtransNotification(
      db,
      gatewayFor,
      JSON.stringify({
        ...payload,
        signature_key: midtransSignature(payload, PLATFORM_KEY),
      })
    );
    assert.equal(forged.httpStatus, 403, "platform signature refused");

    const paid = await handleMidtransNotification(
      db,
      gatewayFor,
      JSON.stringify({
        ...payload,
        signature_key: midtransSignature(payload, MEMBER_KEY),
      })
    );
    assert.equal(paid.httpStatus, 200);
    assert.equal(paid.result, "applied:paid");
    // The route sends the order emails for this id.
    assert.match(paid.paidOrderId ?? "", /^[0-9a-f-]{36}$/);
  });

  test("no gateway for the order means Midtrans should retry later", async () => {
    const result = await handleMidtransNotification(
      db,
      () => null,
      JSON.stringify({
        order_id: orderCode,
        status_code: "200",
        gross_amount: "50000.00",
        transaction_status: "settlement",
        signature_key: "x",
      })
    );
    assert.equal(result.httpStatus, 503);
  });

  test("a suspended seller cannot take new orders", async () => {
    await setMemberStatus(db, owner.userId, "suspended");
    const result = await startCheckout(db, member.gateway, checkoutInput(), {
      siteUrl: "https://example.id",
      visitor: {
        visitorId: null,
        sessionId: null,
        sessionSource: null,
        userAgent: null,
        siteHost: null,
      },
      paymentAccount: "custom",
    });
    assert.equal(result.ok, false);
    const loaded = await loadPaymentProfile(db, owner.profileId);
    assert.equal(loaded?.ownerActive, false);
    await setMemberStatus(db, owner.userId, "active");
  });
});

// ------------------------------------------------------------- super admin

describe("super admin views", () => {
  test("expired premium is listed and counted as free", async () => {
    const lapsed = await makeOwner("lapsed", "premium");
    await db
      .update(users)
      .set({ planExpiresAt: new Date(Date.now() - DAY) })
      .where(eq(users.id, lapsed.userId));
    const active = await makeOwner("active", "premium");

    const members = await listMembers(db);
    const lapsedRow = members.find((m) => m.id === lapsed.userId);
    assert.equal(lapsedRow?.plan, "premium");
    assert.equal(lapsedRow?.effectivePlan, "free");
    assert.equal(lapsedRow?.planExpired, true);
    assert.equal(
      members.find((m) => m.id === active.userId)?.effectivePlan,
      "premium"
    );
    assert.ok(members.every((m) => !("passwordHash" in m)));

    const premiumMembers = (
      await db.select().from(users).where(eq(users.role, "member"))
    ).filter(
      (u) =>
        u.plan === "premium" &&
        (u.planExpiresAt === null || u.planExpiresAt.getTime() > Date.now())
    ).length;
    assert.equal(
      (await getPlatformOverview(db)).totalPremiumUsers,
      premiumMembers
    );
  });

  test("adding a month to an active premium extends it from its end date", async () => {
    const owner = await makeOwner("extend", "premium");
    const end = new Date(Date.now() + 100 * DAY);
    await db
      .update(users)
      .set({ planExpiresAt: end })
      .where(eq(users.id, owner.userId));
    await setMemberPlan(db, {
      userId: owner.userId,
      plan: "premium",
      durationDays: 30,
    });
    const updated = await db.query.users.findFirst({
      where: eq(users.id, owner.userId),
    });
    assert.equal(updated?.planExpiresAt?.getTime(), end.getTime() + 30 * DAY);
  });
});

describe("dashboard navigation", () => {
  const items = getNavGroups("super_admin").flatMap((group) => group.items);

  test("only the most specific item is active", () => {
    assert.equal(
      activeNavItem("/admin/super/members", items)?.title,
      "Kelola Member"
    );
    assert.equal(
      activeNavItem("/admin/super/settings", items)?.title,
      "Brand Platform"
    );
    assert.equal(activeNavItem("/admin/super", items)?.title, "Master Control");
    assert.equal(activeNavItem("/admin", items)?.title, "Overview");
    assert.equal(
      activeNavItem("/admin/products/abc", items)?.title,
      "Products"
    );
    assert.equal(activeNavItem("/admin/superx", items), undefined);
  });
});
