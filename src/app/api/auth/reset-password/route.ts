import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPasswordResetToken, hashDjangoPassword } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = body.token || "";
    const password = body.password || "";
    const confirmPassword = body.confirm_password || "";

    if (!token || !password) {
      return NextResponse.json(
        { ok: false, message: "Informe a nova senha." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { ok: false, message: "A nova senha deve ter no mínimo 6 caracteres." },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { ok: false, message: "As senhas digitadas não coincidem." },
        { status: 400 }
      );
    }

    const verified = await verifyPasswordResetToken(token);
    if (!verified.valid || !verified.userId) {
      return NextResponse.json(
        {
          ok: false,
          expired: true,
          message:
            "Este link de redefinição de senha expirou ou é inválido. Solicite um novo link.",
        },
        { status: 400 }
      );
    }

    const user = await prisma.accounts_user.findUnique({
      where: { id: BigInt(verified.userId) },
    });

    if (!user || !user.is_active) {
      return NextResponse.json(
        { ok: false, message: "Conta não encontrada ou inativa." },
        { status: 404 }
      );
    }

    // Check single-use fingerprint
    if (user.password.slice(-16) !== verified.pwdFp) {
      return NextResponse.json(
        {
          ok: false,
          expired: true,
          message:
            "Este link já foi utilizado anteriormente. Caso precise, solicite um novo link de redefinição.",
        },
        { status: 400 }
      );
    }

    await prisma.accounts_user.update({
      where: { id: user.id },
      data: {
        password: hashDjangoPassword(password),
        updated_at: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Senha redefinida com sucesso! Você já pode fazer login.",
    });
  } catch (err) {
    console.error("[RESET PASSWORD ERROR]", err);
    return NextResponse.json(
      { ok: false, message: "Erro interno ao redefinir a senha." },
      { status: 500 }
    );
  }
}
