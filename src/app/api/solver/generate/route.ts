import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getActiveProject } from "@/lib/auth";
import { ScheduleGenerationService } from "@/lib/schedule/solver";
import { AccessControlService } from "@/lib/services/access-control";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const project = await getActiveProject(user);
    if (!user || !project) {
      return NextResponse.json(
        { ok: false, message: "Selecione um projeto ativo." },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    let classIds: number[] | null = null;
    if (body.class_ids) {
      classIds = (Array.isArray(body.class_ids) ? body.class_ids : [body.class_ids])
        .map(Number)
        .filter(Boolean);
    }

    if (!AccessControlService.isProjectAdmin(user, project)) {
      if (classIds && classIds.length > 0) {
        const selectedClasses = await prisma.classes_schoolclass.findMany({
          where: {
            id: { in: classIds.map((cId) => BigInt(cId)) },
            project_id: project.id,
          },
          select: { id: true, group_id: true },
        });
        const groupIds = selectedClasses.map((c) => c.group_id);
        if (
          selectedClasses.length !== classIds.length ||
          !(await AccessControlService.canManageGroupIds(user, project, groupIds))
        ) {
          return NextResponse.json(
            {
              ok: false,
              message:
                "Você só pode manipular o curso ao qual está atribuído (geração de horários bloqueada para este curso).",
            },
            { status: 403 }
          );
        }
      } else {
        const ownedClasses = await prisma.classes_schoolclass.findMany({
          where: {
            project_id: project.id,
            active: true,
            groups_group: {
              owner_id: user.id,
              status: { not: "INACTIVE" },
            },
          },
          select: { id: true },
        });
        if (ownedClasses.length === 0) {
          return NextResponse.json(
            {
              ok: false,
              message:
                "Você só pode manipular o curso ao qual está atribuído, e nenhum curso está atribuído a você neste projeto.",
            },
            { status: 403 }
          );
        }
        classIds = ownedClasses.map((c) => Number(c.id));
      }
    }

    const result = await ScheduleGenerationService.run({
      projectId: project.id,
      user,
      persist: true,
      classIds,
    });

    const isOk =
      result.run.status === "SATISFIABLE" || result.run.status === "PARTIAL";
    const statusCode =
      result.run.status === "INVALID"
        ? 422
        : !isOk
        ? 409
        : 200;

    return NextResponse.json(
      {
        ok: isOk,
        persisted: true,
        run: result.run,
        entries: result.entries,
      },
      { status: statusCode }
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Erro ao executar geração de horários.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
