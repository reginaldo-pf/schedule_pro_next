import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPublicAvailabilityRequestToken } from "@/lib/auth";
import { verifyAltchaPayload } from "@/lib/altcha";
import { ACTIVE_RUN_STATUSES } from "@/lib/schedule/collision-engine";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project");
  const groupId = searchParams.get("group");

  if (projectId) {
    const groups = await prisma.groups_group.findMany({
      where: { project_id: BigInt(projectId) },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({
      ok: true,
      groups: groups.map((g) => ({ id: Number(g.id), name: g.name })),
    });
  }

  if (groupId) {
    const classes = await prisma.classes_schoolclass.findMany({
      where: { group_id: BigInt(groupId), active: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({
      ok: true,
      classes: classes.map((c) => ({ id: Number(c.id), name: c.name })),
    });
  }

  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const body = await request.json();
  const isCaptchaValid = await verifyAltchaPayload(body?.altcha);
  if (!isCaptchaValid) {
    return NextResponse.json(
      {
        ok: false,
        message: "Complete a verificação de segurança (Não sou um robô) antes de buscar.",
      },
      { status: 400 }
    );
  }

  const email = (body.email || "").trim();
  if (!email) {
    return NextResponse.json({ ok: true, results: [] });
  }

  const teachers = await prisma.teachers_teacher.findMany({
    where: {
      email: { equals: email, mode: "insensitive" },
      active: true,
      project_id: { not: null },
    },
    include: {
      schedules_project: true,
    },
  });

  const results = [];
  for (const t of teachers) {
    if (!t.schedules_project) continue;
    const latestRun = await prisma.solver_schedulegenerationrun.findFirst({
      where: {
        project_id: t.schedules_project.id,
        status: { in: [...ACTIVE_RUN_STATUSES] },
      },
      orderBy: [{ finished_at: "desc" }, { started_at: "desc" }],
    });

    let hasSchedule = false;
    if (latestRun) {
      const count = await prisma.solver_generatedscheduleentry.count({
        where: {
          run_id: latestRun.id,
          OR: [
            { teacher_id: t.id },
            {
              lessons_lesson: {
                lessons_lesson_teachers: {
                  some: { teacher_id: t.id },
                },
              },
            },
          ],
        },
      });
      hasSchedule = count > 0;
    }

    const availabilityRequestToken = await createPublicAvailabilityRequestToken(
      Number(t.id),
      Number(t.schedules_project.id)
    );

    results.push({
      teacher: {
        id: Number(t.id),
        name: t.name,
        email: t.email,
      },
      project: {
        id: Number(t.schedules_project.id),
        name: t.schedules_project.name,
        institution_name: t.schedules_project.institution_name,
        academic_period: t.schedules_project.academic_period,
      },
      hasSchedule,
      availabilityRequestToken,
    });
  }

  return NextResponse.json({ ok: true, results });
}
