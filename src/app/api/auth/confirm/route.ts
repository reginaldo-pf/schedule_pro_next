import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  generateUserConfirmationToken,
  verifyUserConfirmationToken,
  hashDjangoPassword,
} from "@/lib/auth";
import { sendUserConfirmationEmail } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Action 1: Admin resending confirmation email to a user
    if (body.action === "resend") {
      const admin = await getCurrentUser();
      if (!admin || !admin.is_superuser) {
        return NextResponse.json(
          { ok: false, message: "Sem permissão." },
          { status: 403 }
        );
      }

      const targetId = BigInt(body.userId);
      const targetUser = await prisma.accounts_user.findUnique({
        where: { id: targetId },
      });

      if (!targetUser) {
        return NextResponse.json(
          { ok: false, message: "Usuário não encontrado." },
          { status: 404 }
        );
      }

      const token = await generateUserConfirmationToken(
        Number(targetUser.id),
        targetUser.email
      );
      const origin = new URL(request.url).origin;
      const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || origin).replace(
        /\/$/,
        ""
      );
      const confirmUrl = `${siteUrl}/accounts/confirm/${token}`;

      const emailRes = await sendUserConfirmationEmail({
        toEmail: targetUser.email,
        username: targetUser.username,
        firstName: targetUser.first_name || undefined,
        confirmUrl,
        replyTo: admin.email || undefined,
      });

      return NextResponse.json({
        ok: true,
        confirmUrl,
        sent: emailRes.sent,
        provider: emailRes.provider,
        message: emailRes.sent
          ? `E-mail de confirmação enviado para ${targetUser.username} (${targetUser.email})!`
          : `Link de confirmação gerado para ${targetUser.username}! (${
              emailRes.error || "Copie o link diretamente"
            })`,
      });
    }

    // Action 2: User confirming their account via token
    const token = (body.token || "").trim();
    if (!token) {
      return NextResponse.json(
        { ok: false, message: "Token de confirmação inválido." },
        { status: 400 }
      );
    }

    const verified = await verifyUserConfirmationToken(token);
    if (!verified) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "O link de confirmação é inválido ou expirou. Solicite um novo link ao administrador.",
        },
        { status: 400 }
      );
    }

    const user = await prisma.accounts_user.findUnique({
      where: { id: BigInt(verified.userId) },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Conta de usuário não encontrada." },
        { status: 404 }
      );
    }

    const needsPassword = !user.password.startsWith("pbkdf2_sha256$");
    const rawPassword = (body.password || "").trim();
    const confirmPassword = (body.confirm_password || "").trim();

    if (needsPassword && !rawPassword) {
      return NextResponse.json(
        {
          ok: false,
          message: "Defina uma senha para ativar sua conta.",
        },
        { status: 400 }
      );
    }

    if (rawPassword) {
      if (rawPassword.length < 6) {
        return NextResponse.json(
          {
            ok: false,
            message: "A senha deve ter pelo menos 6 caracteres.",
          },
          { status: 400 }
        );
      }
      if (rawPassword !== confirmPassword) {
        return NextResponse.json(
          {
            ok: false,
            message: "As senhas informadas não coincidem.",
          },
          { status: 400 }
        );
      }
    }

    await prisma.accounts_user.update({
      where: { id: user.id },
      data: {
        is_active: true,
        ...(rawPassword ? { password: hashDjangoPassword(rawPassword) } : {}),
        updated_at: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      message:
        "Conta confirmada e ativada com sucesso! Faça login para acessar o sistema.",
    });
  } catch (err) {
    console.error("[CONFIRM ACCOUNT ERROR]", err);
    return NextResponse.json(
      { ok: false, message: "Erro ao confirmar conta de usuário." },
      { status: 500 }
    );
  }
}
