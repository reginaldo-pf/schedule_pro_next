import { NextResponse } from "next/server";
import { prisma, parseTimeToDate } from "@/lib/prisma";
import { getCurrentUser, getSession, setSessionCookie } from "@/lib/auth";
import { PlanService, AccessControlService } from "@/lib/services/access-control";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json();

  // Check if it's a participant invitation or leave action
  if (body.action === "invite_participant") {
    const projectId = BigInt(body.projectId);
    const project = await prisma.schedules_project.findUnique({ where: { id: projectId } });
    if (!project || !AccessControlService.isProjectAdmin(user, project)) {
      return NextResponse.json(
        { ok: false, message: "Apenas o proprietário pode convidar participantes." },
        { status: 403 }
      );
    }

    if (!(await PlanService.canInviteToProject(user))) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Seu plano atual não permite convidar participantes. Faça upgrade para um plano pago.",
        },
        { status: 403 }
      );
    }

    const email = (body.email || "").trim().toLowerCase();
    const role = body.role === "viewer" ? "viewer" : "coordinator";
    const requestedLicense =
      body.license_source === "PROJECT_SPONSORED" ||
      body.license_source === "INDIVIDUAL"
        ? body.license_source
        : "AUTO";

    const targetUser = await prisma.accounts_user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      include: {
        plans_subscription: {
          include: { plans_plan: true },
        },
      },
    });
    if (!targetUser) {
      return NextResponse.json(
        { ok: false, message: `Usuário com e-mail ${email} não encontrado.` },
        { status: 404 }
      );
    }

    const targetSub = await PlanService.getSubscription(targetUser);
    const hasIndividualLicense = Boolean(
      targetUser.is_superuser || (targetSub && targetSub.isValid && !targetSub.plan.isTrial)
    );

    let resolvedLicenseSource: "INDIVIDUAL" | "PROJECT_SPONSORED" = "INDIVIDUAL";
    if (role === "coordinator") {
      if (requestedLicense === "INDIVIDUAL") {
        if (!hasIndividualLicense) {
          return NextResponse.json(
            {
              ok: false,
              message:
                "Este usuário não possui licença individual paga ativa. Selecione 'Licença Patrocinada pelo Projeto' para utilizar uma cota do seu plano.",
            },
            { status: 400 }
          );
        }
        resolvedLicenseSource = "INDIVIDUAL";
      } else if (
        requestedLicense === "PROJECT_SPONSORED" ||
        (requestedLicense === "AUTO" && !hasIndividualLicense)
      ) {
        const seats = await PlanService.getSponsoredSeatsInfo(project.id, project.owner_id);
        if (seats.availableSponsoredSeats <= 0) {
          return NextResponse.json(
            {
              ok: false,
              message: `Limite de vagas patrocinadas atingido (${seats.usedSponsoredSeats}/${seats.maxSponsoredSeats}). Aumente as cotas do plano ou convide um coordenador com licença individual ativa.`,
            },
            { status: 403 }
          );
        }
        resolvedLicenseSource = "PROJECT_SPONSORED";
      } else {
        resolvedLicenseSource = "INDIVIDUAL";
      }
    }

    const existing = await prisma.schedules_projectparticipant.findUnique({
      where: {
        project_id_user_id: {
          project_id: project.id,
          user_id: targetUser.id,
        },
      },
    });

    if (existing) {
      await prisma.schedules_projectparticipant.update({
        where: { id: existing.id },
        data: { role, active: true, license_source: resolvedLicenseSource },
      });
    } else {
      await prisma.schedules_projectparticipant.create({
        data: {
          project_id: project.id,
          user_id: targetUser.id,
          role,
          license_source: resolvedLicenseSource,
          invited_at: new Date(),
          accepted_at: new Date(),
          active: true,
        },
      });
    }

    const licenseDesc =
      role === "viewer"
        ? ""
        : resolvedLicenseSource === "PROJECT_SPONSORED"
        ? " (Licença patrocinada pelo projeto)"
        : " (Licença individual própria)";

    return NextResponse.json({
      ok: true,
      message: `Usuário ${email} adicionado como ${
        role === "coordinator" ? "Coordenador" : "Visualizador"
      }${licenseDesc}.`,
    });
  }

  if (body.action === "change_participant_license") {
    const projectId = BigInt(body.projectId);
    const targetUserId = BigInt(body.userId);
    const newSource =
      body.license_source === "PROJECT_SPONSORED" ? "PROJECT_SPONSORED" : "INDIVIDUAL";

    const project = await prisma.schedules_project.findUnique({ where: { id: projectId } });
    if (!project || !AccessControlService.isProjectAdmin(user, project)) {
      return NextResponse.json(
        { ok: false, message: "Apenas o proprietário ou direção pode alterar a licença de participantes." },
        { status: 403 }
      );
    }

    const participant = await prisma.schedules_projectparticipant.findUnique({
      where: {
        project_id_user_id: {
          project_id: project.id,
          user_id: targetUserId,
        },
      },
      include: {
        accounts_user: {
          include: {
            plans_subscription: { include: { plans_plan: true } },
          },
        },
      },
    });

    if (!participant || !participant.active) {
      return NextResponse.json(
        { ok: false, message: "Participante não encontrado no projeto." },
        { status: 404 }
      );
    }

    if (newSource === "PROJECT_SPONSORED" && participant.license_source !== "PROJECT_SPONSORED") {
      const seats = await PlanService.getSponsoredSeatsInfo(project.id, project.owner_id);
      if (seats.availableSponsoredSeats <= 0) {
        return NextResponse.json(
          {
            ok: false,
            message: `Limite de vagas patrocinadas atingido (${seats.usedSponsoredSeats}/${seats.maxSponsoredSeats}).`,
          },
          { status: 403 }
        );
      }
    } else if (newSource === "INDIVIDUAL") {
      const targetSub = await PlanService.getSubscription(participant.accounts_user);
      if (!participant.accounts_user.is_superuser && (!targetSub || !targetSub.isValid || targetSub.plan.isTrial)) {
        return NextResponse.json(
          {
            ok: false,
            message: "Este coordenador não possui assinatura individual paga ativa.",
          },
          { status: 400 }
        );
      }
    }

    await prisma.schedules_projectparticipant.update({
      where: { id: participant.id },
      data: { license_source: newSource },
    });

    return NextResponse.json({
      ok: true,
      message:
        newSource === "PROJECT_SPONSORED"
          ? "Licença alterada para Patrocinada pelo Projeto."
          : "Licença alterada para Individual do Coordenador (vaga do projeto liberada).",
    });
  }

  if (body.action === "remove_participant" || body.action === "leave_project") {
    const projectId = BigInt(body.projectId);
    const project = await prisma.schedules_project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ ok: false, message: "Projeto não encontrado." }, { status: 404 });
    }

    const targetUserId =
      body.action === "leave_project" ? user.id : BigInt(body.userId);

    if (targetUserId === project.owner_id) {
      return NextResponse.json(
        { ok: false, message: "O proprietário não pode sair ou ser removido do próprio projeto." },
        { status: 400 }
      );
    }

    if (
      body.action === "remove_participant" &&
      !AccessControlService.isProjectAdmin(user, project)
    ) {
      return NextResponse.json(
        { ok: false, message: "Apenas o proprietário ou direção pode remover participantes." },
        { status: 403 }
      );
    }

    const now = new Date();
    await prisma.$transaction([
      prisma.schedules_projectparticipant.deleteMany({
        where: {
          project_id: project.id,
          user_id: targetUserId,
        },
      }),
      prisma.groups_group.updateMany({
        where: {
          project_id: project.id,
          owner_id: targetUserId,
        },
        data: {
          owner_id: null,
          updated_at: now,
        },
      }),
      prisma.classes_schoolclass.updateMany({
        where: {
          project_id: project.id,
          responsible_id: targetUserId,
        },
        data: {
          responsible_id: null,
          updated_at: now,
        },
      }),
      prisma.subjects_subject.updateMany({
        where: {
          project_id: project.id,
          owner_id: targetUserId,
        },
        data: {
          owner_id: null,
          updated_at: now,
        },
      }),
      prisma.teachers_teacher.updateMany({
        where: {
          project_id: project.id,
          owner_id: targetUserId,
        },
        data: {
          owner_id: null,
          updated_at: now,
        },
      }),
      prisma.rooms_room.updateMany({
        where: {
          project_id: project.id,
          owner_id: targetUserId,
        },
        data: {
          owner_id: null,
          updated_at: now,
        },
      }),
    ]);

    if (body.action === "leave_project") {
      const session = await getSession();
      if (session && session.activeProjectId === Number(project.id)) {
        const nextProject = await prisma.schedules_project.findFirst({
          where: {
            id: { not: project.id },
            OR: [
              { owner_id: user.id },
              {
                schedules_projectparticipant: {
                  some: { user_id: user.id, active: true },
                },
              },
            ],
          },
          orderBy: [{ name: "asc" }],
          select: { id: true },
        });
        await setSessionCookie({
          ...session,
          activeProjectId: nextProject ? Number(nextProject.id) : null,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      message:
        body.action === "leave_project"
          ? `Você saiu do projeto ${project.name}. Todos os cursos e registros vinculados permanecem no projeto sem coordenador atribuído.`
          : "Participante removido com sucesso. Seus cursos e turmas permaneceram no projeto sem coordenador atribuído.",
    });
  }

  // Create Project
  if (!(await PlanService.canCreateProject(user))) {
    return NextResponse.json(
      { ok: false, message: "Seu plano atingiu o limite máximo de projetos." },
      { status: 403 }
    );
  }

  const name = (body.name || "").trim();
  const institutionName = (body.institution_name || "").trim();

  if (!name || !institutionName) {
    return NextResponse.json(
      {
        ok: false,
        message: "Nome do projeto e instituição são obrigatórios.",
      },
      { status: 400 }
    );
  }

  const now = new Date();
  const created = await prisma.schedules_project.create({
    data: {
      owner_id: user.id,
      name,
      institution_name: institutionName,
      timezone: body.timezone || "America/Fortaleza",
      report_header: body.report_header || "",
      monday: body.monday !== false,
      tuesday: body.tuesday !== false,
      wednesday: body.wednesday !== false,
      thursday: body.thursday !== false,
      friday: body.friday !== false,
      saturday: !!body.saturday,
      sunday: !!body.sunday,
      lunch_break_enabled: !!body.lunch_break_enabled,
      lunch_start: parseTimeToDate(body.lunch_start),
      lunch_end: parseTimeToDate(body.lunch_end),
      dinner_break_enabled: !!body.dinner_break_enabled,
      dinner_start: parseTimeToDate(body.dinner_start),
      dinner_end: parseTimeToDate(body.dinner_end),
      interclass_break_enabled: body.interclass_break_enabled !== false,
      created_at: now,
      updated_at: now,
    },
  });

  // Set as active project if none selected
  const session = await getSession();
  if (session && !session.activeProjectId) {
    await setSessionCookie({
      ...session,
      activeProjectId: Number(created.id),
    });
  }

  return NextResponse.json({
    ok: true,
    id: Number(created.id),
    message: "Projeto criado com sucesso.",
  });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json();
  const id = BigInt(body.id);

  const project = await prisma.schedules_project.findUnique({ where: { id } });
  if (!project || !AccessControlService.canEditProjectSettings(user, project)) {
    return NextResponse.json(
      { ok: false, message: "Apenas o proprietário pode editar o projeto." },
      { status: 403 }
    );
  }

  const updated = await prisma.schedules_project.update({
    where: { id },
    data: {
      name: (body.name || project.name).trim(),
      institution_name: (body.institution_name || project.institution_name).trim(),
      timezone: body.timezone || project.timezone,
      report_header: body.report_header ?? project.report_header,
      monday: Boolean(body.monday),
      tuesday: Boolean(body.tuesday),
      wednesday: Boolean(body.wednesday),
      thursday: Boolean(body.thursday),
      friday: Boolean(body.friday),
      saturday: Boolean(body.saturday),
      sunday: Boolean(body.sunday),
      lunch_break_enabled: Boolean(body.lunch_break_enabled),
      lunch_start: parseTimeToDate(body.lunch_start),
      lunch_end: parseTimeToDate(body.lunch_end),
      dinner_break_enabled: Boolean(body.dinner_break_enabled),
      dinner_start: parseTimeToDate(body.dinner_start),
      dinner_end: parseTimeToDate(body.dinner_end),
      interclass_break_enabled: Boolean(body.interclass_break_enabled),
      updated_at: new Date(),
    },
  });

  return NextResponse.json({
    ok: true,
    id: Number(updated.id),
    message: "Projeto atualizado com sucesso.",
  });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Não autenticado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get("id");
  if (!idParam) {
    return NextResponse.json({ ok: false, message: "ID obrigatório." }, { status: 400 });
  }

  const id = BigInt(idParam);
  const project = await prisma.schedules_project.findUnique({ where: { id } });
  if (!project || !AccessControlService.canEditProjectSettings(user, project)) {
    return NextResponse.json(
      { ok: false, message: "Apenas o proprietário pode excluir o projeto." },
      { status: 403 }
    );
  }

  // Delete all dependent project records in a transaction
  await prisma.$transaction([
    prisma.solver_generatedscheduleentry.deleteMany({
      where: { solver_schedulegenerationrun: { project_id: id } },
    }),
    prisma.solver_schedulegenerationrun.deleteMany({ where: { project_id: id } }),
    prisma.solver_scheduleconstraint.deleteMany({ where: { project_id: id } }),
    prisma.availability_teacheravailability.deleteMany({
      where: { teachers_teacher: { project_id: id } },
    }),
    prisma.availability_roomavailability.deleteMany({
      where: { rooms_room: { project_id: id } },
    }),
    prisma.availability_schoolclassavailability.deleteMany({
      where: { classes_schoolclass: { project_id: id } },
    }),
    prisma.lessons_lesson_classes.deleteMany({
      where: { lessons_lesson: { project_id: id } },
    }),
    prisma.lessons_lesson_teachers.deleteMany({
      where: { lessons_lesson: { project_id: id } },
    }),
    prisma.lessons_lesson.deleteMany({ where: { project_id: id } }),
    prisma.classes_schoolclass.deleteMany({ where: { project_id: id } }),
    prisma.subjects_subject.deleteMany({ where: { project_id: id } }),
    prisma.teachers_teacher.deleteMany({ where: { project_id: id } }),
    prisma.rooms_room.deleteMany({ where: { project_id: id } }),
    prisma.periods_period.deleteMany({ where: { project_id: id } }),
    prisma.groups_group.deleteMany({ where: { project_id: id } }),
    prisma.schedules_projectparticipant.deleteMany({ where: { project_id: id } }),
    prisma.schedules_project.delete({ where: { id } }),
  ]);

  return NextResponse.json({
    ok: true,
    message: "Projeto removido com sucesso.",
  });
}
