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
}): Promise<boolean> {
  const apiKey = process.env.EMAIL_HOST_PASSWORD || "";
  const fromEmail = process.env.DEFAULT_FROM_EMAIL || "noreply@schedulepro.com";

  if (!apiKey) {
    console.warn("[EMAIL] EMAIL_HOST_PASSWORD (Brevo API Key) not configured.");
    return false;
  }

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
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[BREVO API ERROR] Status ${response.status}: ${errText}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[BREVO API ERROR]", err);
    return false;
  }
}
