import { Resend } from "resend";
import nodemailer from "nodemailer";

export interface SendEmailResult {
  sent: boolean;
  provider: "resend" | "smtp" | "console";
  id?: string;
  error?: string;
}

const PUBLIC_UNVERIFIABLE_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.com.br",
  "icloud.com",
  "uol.com.br",
  "bol.com.br",
  "terra.com.br",
];

function resolveResendFromAddress(): string {
  const DEFAULT_RESEND_SENDER = "Schedule Pro <onboarding@resend.dev>";
  const rawFrom = (
    process.env.RESEND_FROM_EMAIL ||
    process.env.DEFAULT_FROM_EMAIL ||
    ""
  ).trim();

  if (!rawFrom) {
    return DEFAULT_RESEND_SENDER;
  }

  // Extract email part if formatted as "Name <email@domain.com>"
  const match = rawFrom.match(/<([^>]+)>/);
  const emailPart = (match ? match[1] : rawFrom).trim().toLowerCase();
  const domain = emailPart.split("@")[1] || "";

  if (!domain || PUBLIC_UNVERIFIABLE_DOMAINS.includes(domain)) {
    return DEFAULT_RESEND_SENDER;
  }

  if (rawFrom.includes("<") && rawFrom.includes(">")) {
    return rawFrom;
  }

  return `Schedule Pro <${emailPart}>`;
}

export async function sendEmail({
  to,
  subject,
  text,
  html,
  replyTo,
}: {
  to: string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
}): Promise<SendEmailResult> {
  const resendKey = (
    process.env.RESEND_API_KEY ||
    (process.env.EMAIL_HOST_PASSWORD?.startsWith("re_")
      ? process.env.EMAIL_HOST_PASSWORD
      : "") ||
    ""
  ).trim();

  // 1. Primary Provider: Official Resend SDK
  if (resendKey) {
    const resend = new Resend(resendKey);
    const primaryFrom = resolveResendFromAddress();
    const fallbackFrom = "Schedule Pro <onboarding@resend.dev>";

    try {
      const { data, error } = await resend.emails.send({
        from: primaryFrom,
        to,
        subject,
        html: html || (text ? `<pre style="font-family:sans-serif">${text}</pre>` : ""),
        text: text || undefined,
        ...(replyTo ? { replyTo } : {}),
      });

      if (!error && data?.id) {
        return {
          sent: true,
          provider: "resend",
          id: data.id,
        };
      }

      // If custom domain isn't verified yet in Resend, retry with onboarding@resend.dev
      if (error && primaryFrom !== fallbackFrom) {
        console.warn(
          `[RESEND] Remetente '${primaryFrom}' falhou (${error.message}). Tentando com '${fallbackFrom}'...`
        );
        const retry = await resend.emails.send({
          from: fallbackFrom,
          to,
          subject,
          html: html || (text ? `<pre style="font-family:sans-serif">${text}</pre>` : ""),
          text: text || undefined,
          ...(replyTo ? { replyTo } : {}),
        });

        if (!retry.error && retry.data?.id) {
          return {
            sent: true,
            provider: "resend",
            id: retry.data.id,
          };
        }

        return {
          sent: false,
          provider: "resend",
          error: retry.error?.message || error.message,
        };
      }

      if (error) {
        console.warn(`[RESEND ERROR] ${error.name}: ${error.message}`);
        return {
          sent: false,
          provider: "resend",
          error: error.message,
        };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[RESEND EXCEPTION] ${msg}`);
      return {
        sent: false,
        provider: "resend",
        error: msg,
      };
    }
  }

  // 2. Secondary Provider: SMTP (Nodemailer) if configured
  const smtpHost = process.env.EMAIL_HOST || process.env.SMTP_HOST || "";
  const smtpPort = Number(
    process.env.EMAIL_PORT || process.env.SMTP_PORT || 587
  );
  const smtpUser =
    process.env.EMAIL_HOST_USER ||
    process.env.EMAIL_USER ||
    process.env.SMTP_USER ||
    "";
  const smtpPass =
    process.env.SMTP_PASSWORD ||
    (!process.env.EMAIL_HOST_PASSWORD?.startsWith("re_")
      ? process.env.EMAIL_HOST_PASSWORD
      : "") ||
    process.env.EMAIL_PASS ||
    "";

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      await transporter.sendMail({
        from: process.env.DEFAULT_FROM_EMAIL || smtpUser,
        to: to.join(", "),
        subject,
        text,
        html,
      });

      return { sent: true, provider: "smtp" };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[SMTP WARNING] Falha no envio SMTP: ${msg}`);
    }
  }

  // 3. Console fallback
  console.info(
    `\n==================== [EMAIL CONSOLE FALLBACK] ====================\n` +
      `Para: ${to.join(", ")}\n` +
      `Assunto: ${subject}\n` +
      `------------------------------------------------------------------\n` +
      `${text || html || ""}\n` +
      `==================================================================\n`
  );

  return {
    sent: false,
    provider: "console",
    error: "RESEND_API_KEY não configurada.",
  };
}

// Alias for backwards compatibility
export const sendEmailViaBrevo = sendEmail;
