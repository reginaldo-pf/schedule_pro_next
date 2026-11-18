import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, setSessionCookie, getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await getSession();
  const user = await getCurrentUser();
  if (!session || !user) {
    return NextResponse.json({ ok: false, message: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json();
  const projectId = Number(body.projectId);
  if (!projectId) {
    return NextResponse.json({ ok: false, message: "ID do projeto inválido." }, { status: 400 });
  }

  const project = await prisma.schedules_project.findFirst({
    where: {
      id: BigInt(projectId),
      ...(user.is_superuser
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
          }),
    },
  });

  if (!project) {
    return NextResponse.json(
      { ok: false, message: "Projeto não encontrado ou sem permissão." },
      { status: 404 }
    );
  }

  await setSessionCookie({
    ...session,
    activeProjectId: Number(project.id),
  });

  return NextResponse.json({
    ok: true,
    projectId: Number(project.id),
    projectName: project.name,
  });
}
