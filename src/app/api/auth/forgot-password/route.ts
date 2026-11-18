import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generatePasswordResetToken } from "@/lib/auth";
import { sendEmailViaBrevo } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = (body.email || "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json(
        { ok: false, message: "Informe o seu endereço de e-mail." },
        { status: 400 }
      );
    }

    const user = await prisma.accounts_user.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        is_active: true,
      },
    });

    // Always return a safe message, and if user exists, send the reset email
    if (!user) {
      return NextResponse.json({
        ok: true,
        message:
          "Se houver uma conta ativa associada a este e-mail, você receberá um link para redefinir sua senha em instantes.",
      });
    }

    const token = await generatePasswordResetToken(
      Number(user.id),
      user.email,
      user.password
    );

    const origin = new URL(request.url).origin;
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || origin).replace(
      /\/$/,
      ""
    );
    const resetUrl = `${siteUrl}/accounts/reset-password/${token}`;

    const subject = "[Schedule Pro] Redefinição de Senha";
    const text =
      `Olá, ${user.first_name || user.username}.\n\n` +
      `Recebemos uma solicitação para redefinir a senha da sua conta no Schedule Pro.\n\n` +
      `Para criar uma nova senha, acesse o link abaixo (válido por 1 hora):\n\n` +
      `${resetUrl}\n\n` +
      `Se você não solicitou esta alteração, ignore este e-mail com segurança.\n\n` +
      `Atenciosamente,\nEquipe Schedule Pro`;

    const html = `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; color: #1e293b;">
        <div style="margin-bottom: 16px;">
          <span style="background: #0d6efd; color: #fff; font-weight: 700; padding: 6px 10px; border-radius: 6px; display: inline-block;">SP</span>
          <strong style="font-size: 18px; margin-left: 8px;">Schedule Pro</strong>
        </div>
        <h2 style="font-size: 20px; margin-bottom: 12px;">Redefinição de Senha</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #475569;">
          Olá, <strong>${user.first_name || user.username}</strong>.<br/>
          Recebemos uma solicitação para redefinir a senha da sua conta no Schedule Pro.
        </p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}" style="background: #0d6efd; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; display: inline-block;">
            Redefinir Minha Senha
          </a>
        </p>
        <p style="font-size: 12px; color: #64748b;">
          Este link é de uso único e expira em <strong>1 hora</strong>.<br/>
          Caso o botão não funcione, copie e cole este endereço no navegador:<br/>
          <a href="${resetUrl}" style="color: #0d6efd; word-break: break-all;">${resetUrl}</a>
        </p>
      </div>
    `;

    await sendEmailViaBrevo({
      to: [user.email],
      subject,
      text,
      html,
    });

    return NextResponse.json({
      ok: true,
      message:
        "Se houver uma conta ativa associada a este e-mail, você receberá um link para redefinir sua senha em instantes.",
    });
  } catch (err) {
    console.error("[FORGOT PASSWORD ERROR]", err);
    return NextResponse.json(
      { ok: false, message: "Erro ao processar solicitação de recuperação." },
      { status: 500 }
    );
  }
}
