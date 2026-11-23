import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getActiveProject } from "@/lib/auth";
import { AccessControlService } from "@/lib/services/access-control";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const activeProject = await getActiveProject(user);
    if (!user || !activeProject) {
      return NextResponse.json(
        { ok: false, message: "Não autenticado ou sem projeto ativo." },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const targetGroupId = BigInt(id);

    const targetGroup = await prisma.groups_group.findFirst({
      where: {
        id: targetGroupId,
        project_id: activeProject.id,
      },
    });

    if (!targetGroup) {
      return NextResponse.json(
        { ok: false, message: "Curso/Período não encontrado." },
        { status: 404 }
      );
    }

    if (!AccessControlService.canManageGroup(user, activeProject, targetGroup)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Você só pode manipular o curso ao qual está atribuído (publicação bloqueada).",
        },
        { status: 403 }
      );
    }

    if (targetGroup.status === "PUBLISHED") {
      return NextResponse.json({
        ok: true,
        message: "Este período já está publicado.",
      });
    }

    const now = new Date();

    const deactivatedCount = await prisma.$transaction(async (tx) => {
      // Find all previous PUBLISHED versions of this course (copied_from_id or same course name)
      const previousPublished = await tx.groups_group.findMany({
        where: {
          project_id: activeProject.id,
          id: { not: targetGroup.id },
          status: "PUBLISHED",
          OR: [
            ...(targetGroup.copied_from_id
              ? [{ id: targetGroup.copied_from_id }]
              : []),
            { name: { equals: targetGroup.name, mode: "insensitive" } },
          ],
        },
        select: { id: true },
      });

      const prevIds = previousPublished.map((g) => g.id);

      if (prevIds.length > 0) {
        await tx.groups_group.updateMany({
          where: { id: { in: prevIds } },
          data: { status: "INACTIVE", updated_at: now },
        });
        await tx.classes_schoolclass.updateMany({
          where: { group_id: { in: prevIds } },
          data: { active: false, updated_at: now },
        });
        await tx.subjects_subject.updateMany({
          where: { group_id: { in: prevIds } },
          data: { active: false, updated_at: now },
        });
        await tx.lessons_lesson.updateMany({
          where: { subjects_subject: { group_id: { in: prevIds } } },
          data: { active: false, updated_at: now },
        });
      }

      // Publish target group and ensure its items are active
      await tx.groups_group.update({
        where: { id: targetGroup.id },
        data: {
          status: "PUBLISHED",
          published_at: now,
          updated_at: now,
        },
      });
      await tx.classes_schoolclass.updateMany({
        where: { group_id: targetGroup.id },
        data: { active: true, updated_at: now },
      });
      await tx.subjects_subject.updateMany({
        where: { group_id: targetGroup.id },
        data: { active: true, updated_at: now },
      });
      await tx.lessons_lesson.updateMany({
        where: { subjects_subject: { group_id: targetGroup.id } },
        data: { active: true, updated_at: now },
      });

      return prevIds.length;
    }, { maxWait: 10000, timeout: 30000 });

    const periodLabel = targetGroup.academic_period
      ? ` (${targetGroup.academic_period})`
      : "";

    return NextResponse.json({
      ok: true,
      message:
        deactivatedCount > 0
          ? `Período ${targetGroup.name}${periodLabel} publicado! O período anterior e suas aulas foram marcados como Inativos.`
          : `Período ${targetGroup.name}${periodLabel} publicado com sucesso!`,
    });
  } catch (err) {
    console.error("Group publish error:", err);
    return NextResponse.json(
      { ok: false, message: "Erro ao publicar período do curso." },
      { status: 500 }
    );
  }
}
