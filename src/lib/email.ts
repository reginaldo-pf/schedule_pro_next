import nodemailer from "nodemailer";

export interface SendEmailResult {
  sent: boolean;
  provider: "smtp" | "resend" | "brevo" | "console";
  error?: string;
}

export async function sendEmailViaBrevo({
  to,
  subject,
  text,
  html,
}: {
  to: string[];
  subject: string;
  text?: string;
  html?: string;
}): Promise<SendEmailResult> {
  const fromEmail =
    process.env.DEFAULT_FROM_EMAIL || "noreply@schedulepro.com";
  const resendKey =
    process.env.RESEND_API_KEY ||
    (process.env.EMAIL_HOST_PASSWORD?.startsWith("re_")
      ? process.env.EMAIL_HOST_PASSWORD
      : "");
  const brevoKey =
    process.env.BREVO_API_KEY ||
    (process.env.EMAIL_HOST_PASSWORD?.startsWith("xkeysib-")
      ? process.env.EMAIL_HOST_PASSWORD
      : "");
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
    (!process.env.EMAIL_HOST_PASSWORD?.startsWith("xkeysib-") &&
    !process.env.EMAIL_HOST_PASSWORD?.startsWith("re_")
      ? process.env.EMAIL_HOST_PASSWORD
      : "") ||
    process.env.EMAIL_PASS ||
    "";

  // 1. Try SMTP (Nodemailer) if EMAIL_HOST + EMAIL_HOST_USER + password are set
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
        from: fromEmail,
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

  // 2. Try Resend HTTP API if RESEND_API_KEY is set
  if (resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to,
          subject,
          text,
          html,
        }),
      });

      if (res.ok) {
        return { sent: true, provider: "resend" };
      }
      const errBody = await res.text();
      console.warn(`[RESEND WARNING] Status ${res.status}: ${errBody}`);
    } catch (err: unknown) {
      console.warn("[RESEND WARNING]", err);
    }
  }

  // 3. Try Brevo HTTP API if BREVO_API_KEY / xkeysib-* is set
  if (brevoKey) {
    const payload: Record<string, unknown> = {
      sender: { email: fromEmail },
      to: to.map((email) => ({ email })),
      subject,
    };

    if (html) {
      payload.htmlContent = html;
    } else if (text) {
      payload.textContent = text;
    }

    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          accept: "application/json",
          "api-key": brevoKey,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        return { sent: true, provider: "brevo" };
      }

      const errText = await response.text();
      console.warn(
        `[BREVO API WARNING] A chave da API Brevo retornou Status ${response.status} (${errText}). Usando fallback de console/tela.`
      );
      return {
        sent: false,
        provider: "brevo",
        error: `Brevo Status ${response.status}: ${errText}`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[BREVO API WARNING]", msg);
      return { sent: false, provider: "brevo", error: msg };
    }
  }

  // 4. Console fallback when no active provider is configured
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
