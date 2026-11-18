import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  verifyDjangoPassword,
  hashDjangoPassword,
} from "@/lib/auth";

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json();
  const firstName = (body.first_name ?? user.first_name).trim();
  const lastName = (body.last_name ?? user.last_name).trim();
  const email = (body.email ?? user.email).trim().toLowerCase();

  if (!email) {
    return NextResponse.json(
      { ok: false, message: "O e-mail é obrigatório." },
      { status: 400 }
    );
  }

  const emailTaken = await prisma.accounts_user.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      id: { not: user.id },
    },
  });

  if (emailTaken) {
    return NextResponse.json(
      { ok: false, message: "Este e-mail já está em uso por outro usuário." },
      { status: 400 }
    );
  }

  await prisma.accounts_user.update({
    where: { id: user.id },
    data: {
      first_name: firstName,
      last_name: lastName,
      email,
      updated_at: new Date(),
    },
  });

  return NextResponse.json({
    ok: true,
    message: "Dados pessoais atualizados com sucesso.",
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json();
  const oldPassword = body.old_password || "";
  const newPassword = body.new_password || "";
  const confirmPassword = body.confirm_password || "";

  if (!verifyDjangoPassword(oldPassword, user.password)) {
    return NextResponse.json(
      { ok: false, message: "A senha atual informada está incorreta." },
      { status: 400 }
    );
  }

  if (newPassword.length < 6) {
    return NextResponse.json(
      { ok: false, message: "A nova senha deve ter no mínimo 6 caracteres." },
      { status: 400 }
    );
  }

  if (newPassword !== confirmPassword) {
    return NextResponse.json(
      { ok: false, message: "A confirmação da nova senha não confere." },
      { status: 400 }
    );
  }

  await prisma.accounts_user.update({
    where: { id: user.id },
    data: {
      password: hashDjangoPassword(newPassword),
      updated_at: new Date(),
    },
  });

  return NextResponse.json({
    ok: true,
    message: "Sua senha foi alterada com sucesso!",
  });
}
