import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashDjangoPassword } from "@/lib/auth";
import { PlanService } from "@/lib/services/access-control";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = (body.username || "").trim();
    const email = (body.email || "").trim().toLowerCase();
    const firstName = (body.first_name || "").trim();
    const lastName = (body.last_name || "").trim();
    const password = body.password || "";
    const confirmPassword = body.confirm_password || "";

    if (!username || !email || !password) {
      return NextResponse.json(
        { ok: false, message: "Preencha todos os campos obrigatórios." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { ok: false, message: "A senha deve ter pelo menos 6 caracteres." },
        { status: 400 }
      );
    }

    if (confirmPassword && password !== confirmPassword) {
      return NextResponse.json(
        { ok: false, message: "As senhas informadas não coincidem." },
        { status: 400 }
      );
    }

    const existing = await prisma.accounts_user.findFirst({
      where: {
        OR: [
          { username: { equals: username, mode: "insensitive" } },
          { email: { equals: email, mode: "insensitive" } },
        ],
      },
    });

    if (existing) {
      return NextResponse.json(
        { ok: false, message: "Nome de usuário ou e-mail já está em uso." },
        { status: 400 }
      );
    }

    const now = new Date();
    const user = await prisma.accounts_user.create({
      data: {
        username,
        email,
        first_name: firstName,
        last_name: lastName,
        password: hashDjangoPassword(password),
        is_superuser: false,
        is_staff: false,
        is_active: true,
        profile: "coordinator",
        date_joined: now,
        created_at: now,
        updated_at: now,
      },
    });

    await PlanService.createTrialSubscription(user.id);

    return NextResponse.json({
      ok: true,
      message: "Conta criada com sucesso! Faça login para continuar.",
    });
  } catch (err) {
    console.error("[REGISTER ERROR]", err);
    return NextResponse.json(
      { ok: false, message: "Erro ao criar conta." },
      { status: 500 }
    );
  }
}
