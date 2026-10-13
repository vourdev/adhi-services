import type { EmailConfig } from "@/lib/env";

/**
 * Resend over plain fetch: POST https://api.resend.com/emails.
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
};

export type SendEmail = (message: EmailMessage) => Promise<void>;

export class EmailError extends Error {}

export function createResendSender(
  config: EmailConfig,
  fetchImpl: typeof fetch = fetch
): SendEmail {
  return async (message) => {
    let response: Response;
    try {
      response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": message.idempotencyKey,
        },
        body: JSON.stringify({
          from: message.from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      throw new EmailError("Resend tidak bisa dihubungi.", { cause: error });
    }
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as {
        message?: unknown;
      } | null;
      throw new EmailError(
        `Resend menolak email (HTTP ${response.status}): ${typeof data?.message === "string" ? data.message : "tanpa pesan"}`
      );
    }
  };
}
