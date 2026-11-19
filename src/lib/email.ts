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

function resolvePostmarkFromAddress(recipientEmail?: string): string {
  const raw = (
    process.env.POSTMARK_FROM_EMAIL ||
    process.env.DEFAULT_FROM_EMAIL ||
    process.env.RESEND_FROM_EMAIL ||
    ""
  ).trim();

  // Support comma-separated list of verified Sender Signatures (e.g. "user@gmail.com,user@ifce.edu.br")
  const senders = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && !s.includes("onboarding@resend.dev"));

  if (senders.length === 0) {
    return "noreply@schedulepro.com";
  }

  if (recipientEmail && senders.length > 1) {
    const recipientDomain = recipientEmail.split("@")[1]?.toLowerCase();
    if (recipientDomain) {
      const matched = senders.find((s) =>
        s.toLowerCase().endsWith(`@${recipientDomain}`) ||
        s.toLowerCase().includes(`@${recipientDomain}>`)
      );
      if (matched) return matched;
    }
  }

  return senders[0];
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

  const firstSender = rawFrom.split(",")[0].trim();
  const match = firstSender.match(/<([^>]+)>/);
  const emailPart = (match ? match[1] : firstSender).trim().toLowerCase();
  const domain = emailPart.split("@")[1] || "";

  if (!domain || PUBLIC_UNVERIFIABLE_DOMAINS.includes(domain)) {
    return DEFAULT_RESEND_SENDER;
  }

  if (firstSender.includes("<") && firstSender.includes(">")) {
    return firstSender;
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
  let lastError = "";
  let lastProvider: SendEmailResult["provider"] = "console";

  // 1. Primary Provider: SMTP (Nodemailer - e.g. Gmail App Password has NO domain restrictions)
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

      const fromAddr =
        (process.env.DEFAULT_FROM_EMAIL || "").split(",")[0].trim() || smtpUser;

      await transporter.sendMail({
        from: fromAddr,
        to: to.join(", "),
        subject,
        text,
        html,
        ...(replyTo ? { replyTo } : {}),
      });

      return { sent: true, provider: "smtp" };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[SMTP WARNING] Falha no envio SMTP: ${msg}`);
      lastError = `SMTP: ${msg}`;
      lastProvider = "smtp";
    }
  }

  // 2. Postmark HTTP API (X-Postmark-Server-Token)
  const postmarkToken = resolvePostmarkToken();
  if (postmarkToken) {
    const fromEmail = resolvePostmarkFromAddress(to[0]);
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
      lastError = `Postmark (${data.ErrorCode}): ${data.Message}`;
      lastProvider = "postmark";
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[POSTMARK EXCEPTION] ${msg}`);
      lastError = msg;
      lastProvider = "postmark";
    }
  }

  // 3. Official Resend SDK (re_*)
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

        if (!lastError) {
          lastError = retry.error?.message || error.message;
          lastProvider = "resend";
        }
      } else if (error && !lastError) {
        lastError = error.message;
        lastProvider = "resend";
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!lastError) {
        lastError = msg;
        lastProvider = "resend";
      }
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
    provider: lastProvider,
    error: lastError || "Nenhum provedor de e-mail ativo configurado.",
  };
}

export const sendEmailViaBrevo = sendEmail;
