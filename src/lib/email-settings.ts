import { prisma } from "@/lib/prisma";

export const DEFAULT_SENDER_EMAIL = "reginaldo.fernandes@ifce.edu.br";
export const DEFAULT_SENDER_NAME = "Schedule Pro";

export type EmailProviderMode = "auto" | "smtp" | "postmark" | "resend";

export interface EmailSettingsData {
  from_email: string;
  from_name: string;
  reply_to: string;
  provider_mode: EmailProviderMode;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
  postmark_token: string;
  resend_api_key: string;
  updated_at?: string | null;
}

export interface EmailLogItem {
  id: number;
  to_email: string;
  from_email: string;
  subject: string;
  provider: string;
  sent: boolean;
  error_message: string;
  created_at: string;
}

let tablesEnsured = false;

export async function ensureEmailTables(): Promise<void> {
  if (tablesEnsured) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS system_email_settings (
        id INTEGER PRIMARY KEY,
        from_email VARCHAR(255) NOT NULL DEFAULT '${DEFAULT_SENDER_EMAIL}',
        from_name VARCHAR(255) NOT NULL DEFAULT '${DEFAULT_SENDER_NAME}',
        reply_to VARCHAR(255) NOT NULL DEFAULT '',
        provider_mode VARCHAR(32) NOT NULL DEFAULT 'auto',
        smtp_host VARCHAR(255) NOT NULL DEFAULT '',
        smtp_port INTEGER NOT NULL DEFAULT 587,
        smtp_user VARCHAR(255) NOT NULL DEFAULT '',
        smtp_pass VARCHAR(255) NOT NULL DEFAULT '',
        postmark_token VARCHAR(255) NOT NULL DEFAULT '',
        resend_api_key VARCHAR(255) NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS system_email_log (
        id SERIAL PRIMARY KEY,
        to_email VARCHAR(500) NOT NULL,
        from_email VARCHAR(255) NOT NULL,
        subject VARCHAR(500) NOT NULL,
        provider VARCHAR(50) NOT NULL,
        sent BOOLEAN NOT NULL DEFAULT FALSE,
        error_message TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    tablesEnsured = true;
  } catch (err) {
    console.warn("[EMAIL SETTINGS] Erro ao garantir tabelas:", err);
  }
}

export async function getEmailSettings(): Promise<EmailSettingsData> {
  const defaults: EmailSettingsData = {
    from_email: DEFAULT_SENDER_EMAIL,
    from_name: DEFAULT_SENDER_NAME,
    reply_to: "",
    provider_mode: "auto",
    smtp_host: "",
    smtp_port: 587,
    smtp_user: "",
    smtp_pass: "",
    postmark_token: "",
    resend_api_key: "",
    updated_at: null,
  };

  try {
    await ensureEmailTables();
    const rows = await prisma.$queryRaw<
      Array<{
        from_email: string;
        from_name: string;
        reply_to: string;
        provider_mode: string;
        smtp_host: string;
        smtp_port: number;
        smtp_user: string;
        smtp_pass: string;
        postmark_token: string;
        resend_api_key: string;
        updated_at: Date;
      }>
    >`SELECT from_email, from_name, reply_to, provider_mode, smtp_host, smtp_port, smtp_user, smtp_pass, postmark_token, resend_api_key, updated_at FROM system_email_settings WHERE id = 1 LIMIT 1`;

    if (rows.length === 0) return defaults;
    const row = rows[0];
    return {
      from_email: row.from_email || DEFAULT_SENDER_EMAIL,
      from_name: row.from_name || DEFAULT_SENDER_NAME,
      reply_to: row.reply_to || "",
      provider_mode: (["auto", "smtp", "postmark", "resend"].includes(
        row.provider_mode
      )
        ? row.provider_mode
        : "auto") as EmailProviderMode,
      smtp_host: row.smtp_host || "",
      smtp_port: Number(row.smtp_port) || 587,
      smtp_user: row.smtp_user || "",
      smtp_pass: row.smtp_pass || "",
      postmark_token: row.postmark_token || "",
      resend_api_key: row.resend_api_key || "",
      updated_at: row.updated_at
        ? new Date(row.updated_at).toLocaleString("pt-BR")
        : null,
    };
  } catch {
    return defaults;
  }
}

export async function saveEmailSettings(
  input: Partial<EmailSettingsData>
): Promise<EmailSettingsData> {
  await ensureEmailTables();
  const current = await getEmailSettings();

  const from_email = (input.from_email ?? current.from_email).trim() || DEFAULT_SENDER_EMAIL;
  const from_name = (input.from_name ?? current.from_name).trim() || DEFAULT_SENDER_NAME;
  const reply_to = (input.reply_to ?? current.reply_to).trim();
  const provider_mode = (["auto", "smtp", "postmark", "resend"].includes(
    input.provider_mode || ""
  )
    ? input.provider_mode
    : current.provider_mode) as EmailProviderMode;
  const smtp_host = (input.smtp_host ?? current.smtp_host).trim();
  const smtp_port = Number(input.smtp_port ?? current.smtp_port) || 587;
  const smtp_user = (input.smtp_user ?? current.smtp_user).trim();
  const smtp_pass =
    input.smtp_pass === "__KEEP__"
      ? current.smtp_pass
      : (input.smtp_pass ?? current.smtp_pass).trim();
  const postmark_token =
    input.postmark_token === "__KEEP__"
      ? current.postmark_token
      : (input.postmark_token ?? current.postmark_token).trim();
  const resend_api_key =
    input.resend_api_key === "__KEEP__"
      ? current.resend_api_key
      : (input.resend_api_key ?? current.resend_api_key).trim();

  await prisma.$executeRaw`
    INSERT INTO system_email_settings (
      id, from_email, from_name, reply_to, provider_mode,
      smtp_host, smtp_port, smtp_user, smtp_pass,
      postmark_token, resend_api_key, updated_at
    ) VALUES (
      1, ${from_email}, ${from_name}, ${reply_to}, ${provider_mode},
      ${smtp_host}, ${smtp_port}, ${smtp_user}, ${smtp_pass},
      ${postmark_token}, ${resend_api_key}, NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      from_email = EXCLUDED.from_email,
      from_name = EXCLUDED.from_name,
      reply_to = EXCLUDED.reply_to,
      provider_mode = EXCLUDED.provider_mode,
      smtp_host = EXCLUDED.smtp_host,
      smtp_port = EXCLUDED.smtp_port,
      smtp_user = EXCLUDED.smtp_user,
      smtp_pass = EXCLUDED.smtp_pass,
      postmark_token = EXCLUDED.postmark_token,
      resend_api_key = EXCLUDED.resend_api_key,
      updated_at = NOW()
  `;

  return await getEmailSettings();
}

export async function recordEmailLog(entry: {
  to_email: string;
  from_email: string;
  subject: string;
  provider: string;
  sent: boolean;
  error_message?: string;
}): Promise<void> {
  try {
    await ensureEmailTables();
    await prisma.$executeRaw`
      INSERT INTO system_email_log (
        to_email, from_email, subject, provider, sent, error_message
      ) VALUES (
        ${entry.to_email.slice(0, 500)},
        ${entry.from_email.slice(0, 255)},
        ${entry.subject.slice(0, 500)},
        ${entry.provider.slice(0, 50)},
        ${entry.sent},
        ${entry.error_message || ""}
      )
    `;
  } catch (err) {
    console.warn("[EMAIL LOG] Falha ao registrar log de e-mail:", err);
  }
}

export async function getRecentEmailLogs(limit = 50): Promise<EmailLogItem[]> {
  try {
    await ensureEmailTables();
    const rows = await prisma.$queryRaw<
      Array<{
        id: number;
        to_email: string;
        from_email: string;
        subject: string;
        provider: string;
        sent: boolean;
        error_message: string;
        created_at: Date;
      }>
    >`SELECT id, to_email, from_email, subject, provider, sent, error_message, created_at FROM system_email_log ORDER BY id DESC LIMIT ${limit}`;

    return rows.map((r) => ({
      id: Number(r.id),
      to_email: r.to_email,
      from_email: r.from_email,
      subject: r.subject,
      provider: r.provider,
      sent: Boolean(r.sent),
      error_message: r.error_message || "",
      created_at: new Date(r.created_at).toLocaleString("pt-BR"),
    }));
  } catch {
    return [];
  }
}
