import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getActiveProject } from "@/lib/auth";
import { AccessControlService } from "@/lib/services/access-control";

export async function POST(
  request: Request,
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
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "");

    const targetGroup = await prisma.groups_group.findFirst({
      where: {
        id: targetGroupId,
        project_id: activeProject.id,
      },
      include: {
        accounts_user: {
          select: { id: true, first_name: true, last_name: true, username: true },
        },
      },
    });

    if (!targetGroup) {
      return NextResponse.json(
        { ok: false, message: "Curso/Período não encontrado." },
        { status: 404 }
      );
    }

    const isAdmin = AccessControlService.isProjectAdmin(user, activeProject);
    const isCourseOwner =
      targetGroup.owner_id !== null && targetGroup.owner_id === user.id;

    if (action === "revoke") {
      if (!isAdmin) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Apenas o administrador ou proprietário do projeto pode revogar a posse de um coordenador.",
          },
          { status: 403 }
        );
      }

      if (targetGroup.owner_id === null) {
        return NextResponse.json(
          {
            ok: false,
            message: "Este curso já está sem coordenador com posse atribuída.",
          },
          { status: 400 }
        );
      }

      const previousOwnerName = targetGroup.accounts_user
        ? `${targetGroup.accounts_user.first_name || ""} ${targetGroup.accounts_user.last_name || ""}`.trim() ||
          targetGroup.accounts_user.username
        : "Coordenador";

      const now = new Date();
      await prisma.$transaction([
        prisma.groups_group.update({
          where: { id: targetGroup.id },
          data: {
            owner_id: null,
            updated_at: now,
          },
        }),
        prisma.classes_schoolclass.updateMany({
          where: { group_id: targetGroup.id },
          data: {
            responsible_id: null,
            updated_at: now,
          },
        }),
      ]);

      return NextResponse.json({
        ok: true,
        message: `Posse de "${previousOwnerName}" sobre o curso "${targetGroup.name}" foi revogada.`,
      });
    }

    if (action === "transfer") {
      if (!isAdmin && !isCourseOwner) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Apenas o responsável atual pelo curso, o dono do projeto ou o administrador pode entregar a posse.",
          },
          { status: 403 }
        );
      }

      const rawTargetUserId = Number(body.target_user_id);
      if (!Number.isFinite(rawTargetUserId) || rawTargetUserId <= 0) {
        return NextResponse.json(
          { ok: false, message: "Selecione um coordenador válido para receber a posse." },
          { status: 400 }
        );
      }

      const targetUserId = BigInt(rawTargetUserId);
      const targetUser = await prisma.accounts_user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          username: true,
          is_active: true,
          is_superuser: true,
        },
      });

      if (!targetUser || !targetUser.is_active) {
        return NextResponse.json(
          { ok: false, message: "Coordenador de destino não encontrado ou inativo." },
          { status: 404 }
        );
      }

      const isProjectOwner = targetUser.id === activeProject.owner_id;
      const isProjectCoordinator =
        isProjectOwner ||
        targetUser.is_superuser ||
        Boolean(
          await prisma.schedules_projectparticipant.findFirst({
            where: {
              project_id: activeProject.id,
              user_id: targetUser.id,
              role: "coordinator",
              active: true,
            },
            select: { id: true },
          })
        );

      if (!isProjectCoordinator) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "O usuário selecionado não é um coordenador ativo deste projeto.",
          },
          { status: 400 }
        );
      }

      const now = new Date();
      await prisma.$transaction([
        prisma.groups_group.update({
          where: { id: targetGroup.id },
          data: {
            owner_id: targetUser.id,
            updated_at: now,
          },
        }),
        prisma.classes_schoolclass.updateMany({
          where: { group_id: targetGroup.id },
          data: {
            responsible_id: targetUser.id,
            updated_at: now,
          },
        }),
      ]);

      const targetDisplayName =
        `${targetUser.first_name || ""} ${targetUser.last_name || ""}`.trim() ||
        targetUser.username;

      return NextResponse.json({
        ok: true,
        message: `Posse do curso "${targetGroup.name}" entregue para ${targetDisplayName}.`,
      });
    }

    return NextResponse.json(
      { ok: false, message: "Ação inválida." },
      { status: 400 }
    );
  } catch (err) {
    console.error("Group ownership error:", err);
    return NextResponse.json(
      { ok: false, message: "Erro ao atualizar posse do curso." },
      { status: 500 }
    );
  }
}
