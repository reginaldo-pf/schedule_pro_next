import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import {
  getEmailSettings,
  getRecentEmailLogs,
  saveEmailSettings,
} from "@/lib/email-settings";

async function requireSuperuser() {
  const user = await getCurrentUser();
  if (!user || !user.is_superuser) return null;
  return user;
}

function getEnvProviderStatus() {
  return {
    smtp: Boolean(
      (process.env.EMAIL_HOST || process.env.SMTP_HOST) &&
        (process.env.EMAIL_HOST_USER ||
          process.env.EMAIL_USER ||
          process.env.SMTP_USER) &&
        (process.env.SMTP_PASSWORD ||
          process.env.EMAIL_HOST_PASSWORD ||
          process.env.EMAIL_PASS)
    ),
    postmark: Boolean(
      process.env.POSTMARK_API_KEY || process.env.POSTMARK_SERVER_TOKEN
    ),
    resend: Boolean(process.env.RESEND_API_KEY?.startsWith("re_")),
  };
}

export async function GET() {
  const user = await requireSuperuser();
  if (!user) {
    return NextResponse.json(
      { ok: false, message: "Acesso restrito a administradores." },
      { status: 403 }
    );
  }

  const [settings, logs] = await Promise.all([
    getEmailSettings(),
    getRecentEmailLogs(50),
  ]);

  return NextResponse.json({
    ok: true,
    settings: {
      ...settings,
      smtp_pass: settings.smtp_pass ? "__KEEP__" : "",
      postmark_token: settings.postmark_token ? "__KEEP__" : "",
      resend_api_key: settings.resend_api_key ? "__KEEP__" : "",
      has_smtp_pass: Boolean(settings.smtp_pass),
      has_postmark_token: Boolean(settings.postmark_token),
      has_resend_api_key: Boolean(settings.resend_api_key),
    },
    envStatus: getEnvProviderStatus(),
    logs,
  });
}

export async function PUT(request: Request) {
  const user = await requireSuperuser();
  if (!user) {
    return NextResponse.json(
      { ok: false, message: "Acesso restrito a administradores." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const saved = await saveEmailSettings({
    from_email: body.from_email,
    from_name: body.from_name,
    reply_to: body.reply_to,
    provider_mode: body.provider_mode,
    smtp_host: body.smtp_host,
    smtp_port: Number(body.smtp_port) || 587,
    smtp_user: body.smtp_user,
    smtp_pass: body.smtp_pass,
    postmark_token: body.postmark_token,
    resend_api_key: body.resend_api_key,
  });

  return NextResponse.json({
    ok: true,
    message: "Configurações de envio de e-mail salvas com sucesso!",
    settings: {
      ...saved,
      smtp_pass: saved.smtp_pass ? "__KEEP__" : "",
      postmark_token: saved.postmark_token ? "__KEEP__" : "",
      resend_api_key: saved.resend_api_key ? "__KEEP__" : "",
      has_smtp_pass: Boolean(saved.smtp_pass),
      has_postmark_token: Boolean(saved.postmark_token),
      has_resend_api_key: Boolean(saved.resend_api_key),
    },
  });
}

export async function POST(request: Request) {
  const user = await requireSuperuser();
  if (!user) {
    return NextResponse.json(
      { ok: false, message: "Acesso restrito a administradores." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const testEmail = (body.test_email || "").trim();
  if (!testEmail) {
    return NextResponse.json(
      { ok: false, message: "Informe um e-mail de destino para o teste." },
      { status: 400 }
    );
  }

  const result = await sendEmail({
    to: [testEmail],
    subject: "[Schedule Pro] Teste de Envio de E-mail",
    text:
      `Olá,\n\nEste é um e-mail de teste enviado pelo módulo de Gestão de E-mails do Schedule Pro.\n\n` +
      `Data/Hora: ${new Date().toLocaleString("pt-BR")}\n\n` +
      `AVISO: Este é um e-mail automático enviado pelo sistema. Por favor, não responda.`,
    html: `
      <div style="font-family:Arial,sans-serif;padding:24px;background:#f8fafc;">
        <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #cbd5e1;border-radius:8px;padding:24px;">
          <h3 style="margin-top:0;color:#1e3a8a;">Schedule Pro • Teste de Envio</h3>
          <p>Este é um e-mail de teste disparado pelo módulo de <strong>Gestão de E-mails</strong> da administração.</p>
          <p style="font-size:13px;color:#64748b;">Data/Hora: ${new Date().toLocaleString("pt-BR")}</p>
          <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:6px;padding:10px 12px;font-size:12px;color:#92400e;">
            <strong>Aviso:</strong> Este é um e-mail automático enviado pelo sistema. Por favor, <strong>não responda</strong>.
          </div>
        </div>
      </div>
    `,
  });

  const logs = await getRecentEmailLogs(50);

  return NextResponse.json({
    ok: result.sent,
    provider: result.provider,
    error: result.error,
    logs,
    message: result.sent
      ? `E-mail de teste enviado com sucesso via ${result.provider.toUpperCase()} para ${testEmail}!`
      : `Falha ao enviar e-mail de teste (${result.provider}): ${result.error || "Verifique as configurações."}`,
  });
}
