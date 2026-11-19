import { Resend } from "resend";
import nodemailer from "nodemailer";

export interface SendEmailResult {
  sent: boolean;
  provider: "postmark" | "resend" | "smtp" | "console";
  id?: string;
  error?: string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function resolvePostmarkToken(): string {
  const candidates = [
    process.env.POSTMARK_API_KEY,
    process.env.POSTMARK_SERVER_TOKEN,
    process.env.EMAIL_HOST_PASSWORD,
    process.env.RESEND_API_KEY,
  ];
  for (const c of candidates) {
    const trimmed = (c || "").trim();
    if (UUID_REGEX.test(trimmed)) {
      return trimmed;
    }
  }
  return "";
}

function resolvePostmarkFromAddress(): string {
  const raw = (
    process.env.POSTMARK_FROM_EMAIL ||
    process.env.DEFAULT_FROM_EMAIL ||
    process.env.RESEND_FROM_EMAIL ||
    ""
  ).trim();

  // Ignore onboarding@resend.dev for Postmark if DEFAULT_FROM_EMAIL has a real address
  if (!raw || raw.includes("onboarding@resend.dev")) {
    const def = (process.env.DEFAULT_FROM_EMAIL || "").trim();
    if (def && !def.includes("onboarding@resend.dev")) {
      return def;
    }
  }

  return raw || "noreply@schedulepro.com";
}

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
  // 1. Primary Provider: Postmark HTTP API (X-Postmark-Server-Token)
  const postmarkToken = resolvePostmarkToken();
  if (postmarkToken) {
    const fromEmail = resolvePostmarkFromAddress();
    try {
      const response = await fetch("https://api.postmarkapp.com/email", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Postmark-Server-Token": postmarkToken,
        },
        body: JSON.stringify({
          From: fromEmail,
          To: to.join(", "),
          Subject: subject,
          HtmlBody:
            html ||
            (text ? `<pre style="font-family:sans-serif">${text}</pre>` : ""),
          TextBody: text || undefined,
          ...(replyTo ? { ReplyTo: replyTo } : {}),
          MessageStream: "outbound",
        }),
      });

      const data = await response.json();

      if (response.ok && data.ErrorCode === 0) {
        return {
          sent: true,
          provider: "postmark",
          id: data.MessageID,
        };
      }

      console.warn(
        `[POSTMARK WARNING] ErrorCode ${data.ErrorCode}: ${data.Message}`
      );
      return {
        sent: false,
        provider: "postmark",
        error: `Postmark (${data.ErrorCode}): ${data.Message}`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[POSTMARK EXCEPTION] ${msg}`);
      return {
        sent: false,
        provider: "postmark",
        error: msg,
      };
    }
  }

  // 2. Secondary Provider: Official Resend SDK (re_*)
  const resendKey = (
    (process.env.RESEND_API_KEY?.startsWith("re_")
      ? process.env.RESEND_API_KEY
      : "") ||
    (process.env.EMAIL_HOST_PASSWORD?.startsWith("re_")
      ? process.env.EMAIL_HOST_PASSWORD
      : "") ||
    ""
  ).trim();

  if (resendKey) {
    const resend = new Resend(resendKey);
    const primaryFrom = resolveResendFromAddress();
    const fallbackFrom = "Schedule Pro <onboarding@resend.dev>";

    try {
      const { data, error } = await resend.emails.send({
        from: primaryFrom,
        to,
        subject,
        html:
          html ||
          (text ? `<pre style="font-family:sans-serif">${text}</pre>` : ""),
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

      if (error && primaryFrom !== fallbackFrom) {
        const retry = await resend.emails.send({
          from: fallbackFrom,
          to,
          subject,
          html:
            html ||
            (text ? `<pre style="font-family:sans-serif">${text}</pre>` : ""),
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
        return {
          sent: false,
          provider: "resend",
          error: error.message,
        };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        sent: false,
        provider: "resend",
        error: msg,
      };
    }
  }

  // 3. Tertiary Provider: SMTP (Nodemailer)
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
    (!process.env.EMAIL_HOST_PASSWORD?.startsWith("re_") &&
    !UUID_REGEX.test(process.env.EMAIL_HOST_PASSWORD || "")
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

  // 4. Console fallback
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
    error: "Nenhum provedor de e-mail ativo configurado.",
  };
}

export const sendEmailViaBrevo = sendEmail;
