import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyDjangoPassword,
  setSessionCookie,
  getActiveProject,
} from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const identifier = (body.username || body.email || "").trim();
    const password = body.password || "";

    if (!identifier || !password) {
      return NextResponse.json(
        { ok: false, message: "Informe o usuário/e-mail e a senha." },
        { status: 400 }
      );
    }

    const user = await prisma.accounts_user.findFirst({
      where: {
        OR: [
          { username: { equals: identifier, mode: "insensitive" } },
          { email: { equals: identifier, mode: "insensitive" } },
        ],
      },
    });

    if (!user || !user.is_active) {
      return NextResponse.json(
        { ok: false, message: "Credenciais inválidas ou conta inativa." },
        { status: 401 }
      );
    }

    const valid = verifyDjangoPassword(password, user.password);
    if (!valid) {
      return NextResponse.json(
        { ok: false, message: "Usuário ou senha incorretos." },
        { status: 401 }
      );
    }

    // Update last_login
    await prisma.accounts_user.update({
      where: { id: user.id },
      data: { last_login: new Date() },
    });

    // Find default active project
    const defaultProject = await prisma.schedules_project.findFirst({
      where: user.is_superuser
        ? {}
        : {
            OR: [
              { owner_id: user.id },
              {
                schedules_projectparticipant: {
                  some: { user_id: user.id, active: true },
                },
              },
            ],
          },
      orderBy: { id: "asc" },
    });

    await setSessionCookie({
      userId: Number(user.id),
      username: user.username,
      email: user.email,
      isSuperuser: user.is_superuser,
      isStaff: user.is_staff,
      profile: user.profile,
      activeProjectId: defaultProject ? Number(defaultProject.id) : null,
    });

    return NextResponse.json({
      ok: true,
      message: "Login realizado com sucesso!",
    });
  } catch (err) {
    console.error("[LOGIN ERROR]", err);
    return NextResponse.json(
      { ok: false, message: "Erro interno ao realizar login." },
      { status: 500 }
    );
  }
}
