"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { getDb } from "@/db/client";
import { fail, ok, type Result } from "@/lib/result";
import {
  changePasswordSchema,
  fieldErrors,
  loginSchema,
} from "@/lib/validation";
import {
  changePassword,
  deleteOtherSessions,
  deleteSession,
  signIn,
} from "@/server/auth";
import {
  clearSessionCookie,
  clientKey,
  requireOwner,
  SESSION_COOKIE,
  setSessionCookie,
} from "@/server/session";

export type LoginState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  email?: string;
} | null;

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/admin") &&
    !next.startsWith("//") &&
    !next.includes("\\")
    ? next
    : "/admin";
}

export async function loginAction(
  _previous: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const parsed = loginSchema.safeParse({
    email,
    password: formData.get("password"),
  });
  if (!parsed.success)
    return {
      error: "Periksa email dan password.",
      fieldErrors: fieldErrors(parsed.error),
      email,
    };

  const result = await signIn(getDb(), {
    ...parsed.data,
    clientKey: await clientKey(),
    userAgent: (await headers()).get("user-agent"),
  });
  if (!result.ok) {
    return {
      error:
        result.reason === "rate_limited"
          ? "Terlalu banyak percobaan gagal. Coba lagi dalam 15 menit."
          : "Email atau password salah.",
      email,
    };
  }
  await setSessionCookie(result.token, result.expiresAt);
  redirect(safeNext(formData.get("next")));
}

export async function logoutAction(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(getDb(), token);
  await clearSessionCookie();
  redirect("/admin/login");
}

export async function logoutEverywhereAction(): Promise<void> {
  const owner = await requireOwner();
  await deleteOtherSessions(getDb(), owner.user.id, null);
  await clearSessionCookie();
  redirect("/admin/login");
}

export async function changePasswordAction(input: unknown): Promise<Result> {
  const owner = await requireOwner();
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success)
    return fail("Periksa kembali isian.", fieldErrors(parsed.error));
  const result = await changePassword(getDb(), {
    userId: owner.user.id,
    currentPassword: parsed.data.currentPassword,
    newPassword: parsed.data.newPassword,
    keepSessionId: owner.sessionId,
  });
  if (!result.ok)
    return fail("Password saat ini salah.", {
      currentPassword: "Password saat ini salah.",
    });
  return ok();
}
