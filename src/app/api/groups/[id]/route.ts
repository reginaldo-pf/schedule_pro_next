import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getActiveProject } from "@/lib/auth";

export async function DELETE(
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

    const isOwner =
      user.is_superuser ||
      activeProject.owner_id === user.id ||
      targetGroup.owner_id === user.id;

    if (!isOwner) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Apenas o proprietário do curso ou do projeto pode excluir um período inativo.",
        },
        { status: 403 }
      );
    }

    if (targetGroup.status !== "INACTIVE") {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Apenas períodos no estado Inativo podem ser excluídos por esta ação.",
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      const classIds = (
        await tx.classes_schoolclass.findMany({
          where: { group_id: targetGroup.id },
          select: { id: true },
        })
      ).map((c) => c.id);

      const lessonIds = (
        await tx.lessons_lesson.findMany({
          where: { subjects_subject: { group_id: targetGroup.id } },
          select: { id: true },
        })
      ).map((l) => l.id);

      if (classIds.length > 0 || lessonIds.length > 0) {
        await tx.solver_generatedscheduleentry.deleteMany({
          where: {
            OR: [
              ...(classIds.length > 0
                ? [{ school_class_id: { in: classIds } }]
                : []),
              ...(lessonIds.length > 0
                ? [{ lesson_id: { in: lessonIds } }]
                : []),
            ],
          },
        });
      }

      if (lessonIds.length > 0) {
        await tx.lessons_lesson_classes.deleteMany({
          where: { lesson_id: { in: lessonIds } },
        });
        await tx.lessons_lesson_teachers.deleteMany({
          where: { lesson_id: { in: lessonIds } },
        });
        await tx.lessons_lesson.deleteMany({
          where: { id: { in: lessonIds } },
        });
      }

      if (classIds.length > 0) {
        await tx.availability_schoolclassavailability.deleteMany({
          where: { school_class_id: { in: classIds } },
        });
        await tx.classes_schoolclass.deleteMany({
          where: { id: { in: classIds } },
        });
      }

      await tx.subjects_subject.deleteMany({
        where: { group_id: targetGroup.id },
      });

      await tx.groups_group.updateMany({
        where: { copied_from_id: targetGroup.id },
        data: { copied_from_id: null },
      });

      await tx.groups_group.delete({
        where: { id: targetGroup.id },
      });
    }, { maxWait: 10000, timeout: 30000 });

    return NextResponse.json({
      ok: true,
      message: `Período inativo ${targetGroup.name}${
        targetGroup.academic_period ? ` (${targetGroup.academic_period})` : ""
      } e todos os seus horários/aulas foram excluídos.`,
    });
  } catch (err) {
    console.error("Delete inactive group error:", err);
    return NextResponse.json(
      { ok: false, message: "Erro ao excluir período inativo." },
      { status: 500 }
    );
  }
}
