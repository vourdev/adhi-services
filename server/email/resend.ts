import type { EmailConfig } from "@/lib/env";

/**
 * Resend over plain fetch.
 * - Send:   POST https://api.resend.com/emails (scheduled_at sends later)
 * - Cancel: POST https://api.resend.com/emails/{id}/cancel (scheduled only)
 * Docs: https://resend.com/docs/api-reference/emails/send-email
 */

export type EmailMessage = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Resend drops a repeated send with the same key (24 hours). */
  idempotencyKey: string;
  /** Send at this time instead of now; can be cancelled until then. */
  scheduledAt?: Date;
};

/** Sends (or schedules) a message; resolves to Resend's email id, or null when it already went out. */
export type SendEmail = (message: EmailMessage) => Promise<string | null>;

/** Cancels a scheduled email; rejects when it can no longer be cancelled. */
export type CancelEmail = (emailId: string) => Promise<void>;

export class EmailError extends Error {}

async function errorText(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as {
    message?: unknown;
  } | null;
  return `HTTP ${response.status}: ${typeof data?.message === "string" ? data.message : "tanpa pesan"}`;
}

export function createResendClient(
  config: EmailConfig,
  fetchImpl: typeof fetch = fetch
): { send: SendEmail; cancel: CancelEmail } {
  const headers = {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
  };

  async function call(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetchImpl(url, {
        ...init,
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      throw new EmailError("Resend tidak bisa dihubungi.", { cause: error });
    }
  }

  return {
    async send(message) {
      const response = await call("https://api.resend.com/emails", {
        method: "POST",
        headers: { ...headers, "Idempotency-Key": message.idempotencyKey },
        body: JSON.stringify({
          from: message.from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
          ...(message.scheduledAt
            ? { scheduled_at: message.scheduledAt.toISOString() }
            : {}),
        }),
      });
      // 409: this idempotency key was already used for this email, so it went
      // out before; retrying would only repeat the conflict.
      if (response.status === 409) {
        console.warn(`[email] ${message.idempotencyKey} already sent`);
        return null;
      }
      if (!response.ok)
        throw new EmailError(
          `Resend menolak email (${await errorText(response)})`
        );
      const data = (await response.json().catch(() => null)) as {
        id?: unknown;
      } | null;
      return typeof data?.id === "string" ? data.id : null;
    },

    async cancel(emailId) {
      const response = await call(
        `https://api.resend.com/emails/${encodeURIComponent(emailId)}/cancel`,
        { method: "POST", headers }
      );
      if (!response.ok)
        throw new EmailError(
          `Email tidak bisa dibatalkan (${await errorText(response)})`
        );
    },
  };
}
