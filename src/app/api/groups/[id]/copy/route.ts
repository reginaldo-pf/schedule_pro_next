import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getActiveProject } from "@/lib/auth";
import { ACTIVE_RUN_STATUSES } from "@/lib/schedule/collision-engine";
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
    const sourceGroupId = BigInt(id);
    const body = await request.json();

    const academicPeriod = String(body.academic_period || "").trim();
    const startDateStr = String(body.start_date || "").trim();
    const endDateStr = String(body.end_date || "").trim();
    const copySchedule = body.copy_schedule !== false;

    if (!academicPeriod) {
      return NextResponse.json(
        { ok: false, message: "Informe o novo período / semestre." },
        { status: 400 }
      );
    }

    const startDate = startDateStr
      ? new Date(`${startDateStr}T00:00:00.000Z`)
      : null;
    const endDate = endDateStr
      ? new Date(`${endDateStr}T00:00:00.000Z`)
      : null;

    if (startDate && endDate && endDate < startDate) {
      return NextResponse.json(
        {
          ok: false,
          message: "A data de término não pode ser anterior à data de início.",
        },
        { status: 400 }
      );
    }

    const sourceGroup = await prisma.groups_group.findFirst({
      where: {
        id: sourceGroupId,
        project_id: activeProject.id,
      },
    });

    if (!sourceGroup) {
      return NextResponse.json(
        { ok: false, message: "Curso/Grupo de origem não encontrado." },
        { status: 404 }
      );
    }

    if (!AccessControlService.canManageGroup(user, activeProject, sourceGroup)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Você só pode manipular o curso ao qual está atribuído (cópia bloqueada).",
        },
        { status: 403 }
      );
    }

    const duplicate = await prisma.groups_group.findFirst({
      where: {
        project_id: activeProject.id,
        name: { equals: sourceGroup.name, mode: "insensitive" },
        academic_period: { equals: academicPeriod, mode: "insensitive" },
      },
    });

    if (duplicate) {
      return NextResponse.json(
        {
          ok: false,
          message: `Já existe o curso "${sourceGroup.name}" para o período ${academicPeriod}.`,
        },
        { status: 400 }
      );
    }

    // Fetch all source data BEFORE opening the transaction to minimize lock/transaction time
    const [sourceSubjects, sourceClasses, sourceLessons, latestRun] =
      await Promise.all([
        prisma.subjects_subject.findMany({
          where: { group_id: sourceGroup.id, project_id: activeProject.id },
          orderBy: { id: "asc" },
        }),
        prisma.classes_schoolclass.findMany({
          where: { group_id: sourceGroup.id, project_id: activeProject.id },
          include: { availability_schoolclassavailability: true },
          orderBy: { id: "asc" },
        }),
        prisma.lessons_lesson.findMany({
          where: {
            project_id: activeProject.id,
            subjects_subject: { group_id: sourceGroup.id },
          },
          include: {
            lessons_lesson_classes: true,
            lessons_lesson_teachers: true,
          },
          orderBy: { id: "asc" },
        }),
        copySchedule
          ? prisma.solver_schedulegenerationrun.findFirst({
              where: {
                project_id: activeProject.id,
                status: { in: [...ACTIVE_RUN_STATUSES] },
              },
              orderBy: [{ finished_at: "desc" }, { started_at: "desc" }],
            })
          : Promise.resolve(null),
      ]);

    const sourceEntries =
      copySchedule && latestRun && sourceClasses.length > 0 && sourceLessons.length > 0
        ? await prisma.solver_generatedscheduleentry.findMany({
            where: {
              run_id: latestRun.id,
              school_class_id: { in: sourceClasses.map((c) => c.id) },
              lesson_id: { in: sourceLessons.map((l) => l.id) },
            },
          })
        : [];

    const now = new Date();

    const result = await prisma.$transaction(
      async (tx) => {
        // 1. Create new group in PREVIEW status
        const newGroup = await tx.groups_group.create({
          data: {
            project_id: activeProject.id,
            owner_id: user.id,
            name: sourceGroup.name,
            academic_period: academicPeriod,
            start_date: startDate,
            end_date: endDate,
            status: "PREVIEW",
            copied_from_id: sourceGroup.id,
            published_at: null,
            created_at: now,
            updated_at: now,
          },
        });

        // 2. Batch-copy subjects
        const subjectIdMap = new Map<bigint, bigint>();
        if (sourceSubjects.length > 0) {
          const createdSubjects = await tx.subjects_subject.createManyAndReturn({
            data: sourceSubjects.map((s) => ({
              project_id: activeProject.id,
              group_id: newGroup.id,
              owner_id: user.id,
              name: s.name,
              abbreviated_name: s.abbreviated_name,
              color: s.color,
              room_id: s.room_id,
              active: s.active,
              created_at: now,
              updated_at: now,
            })),
            select: { id: true },
          });
          sourceSubjects.forEach((s, idx) => {
            if (createdSubjects[idx]) {
              subjectIdMap.set(s.id, createdSubjects[idx].id);
            }
          });
        }

        // 3. Batch-copy school classes and their availabilities
        const classIdMap = new Map<bigint, bigint>();
        if (sourceClasses.length > 0) {
          const createdClasses =
            await tx.classes_schoolclass.createManyAndReturn({
              data: sourceClasses.map((c) => ({
                project_id: activeProject.id,
                group_id: newGroup.id,
                responsible_id: c.responsible_id,
                name: c.name,
                color: c.color,
                level: c.level,
                room_id: c.room_id,
                shifts: c.shifts,
                active: true,
                created_at: now,
                updated_at: now,
              })),
              select: { id: true },
            });

          const availData: {
            school_class_id: bigint;
            period_id: bigint;
            day_of_week: string;
            status: string;
          }[] = [];

          sourceClasses.forEach((c, idx) => {
            const created = createdClasses[idx];
            if (!created) return;
            classIdMap.set(c.id, created.id);
            for (const av of c.availability_schoolclassavailability) {
              availData.push({
                school_class_id: created.id,
                period_id: av.period_id,
                day_of_week: av.day_of_week,
                status: av.status,
              });
            }
          });

          if (availData.length > 0) {
            await tx.availability_schoolclassavailability.createMany({
              data: availData,
            });
          }
        }

        // 4. Batch-copy lessons (matrix) and their class/teacher links
        const lessonIdMap = new Map<bigint, bigint>();
        const validSourceLessons = sourceLessons.filter((l) =>
          subjectIdMap.has(l.subject_id)
        );

        if (validSourceLessons.length > 0) {
          const createdLessons = await tx.lessons_lesson.createManyAndReturn({
            data: validSourceLessons.map((l) => ({
              project_id: activeProject.id,
              subject_id: subjectIdMap.get(l.subject_id)!,
              room_id: l.room_id,
              number_of_lessons: l.number_of_lessons,
              max_lessons_per_day: l.max_lessons_per_day,
              max_days_of_lessons: l.max_days_of_lessons,
              grouping_type: l.grouping_type,
              allow_consecutive_days: l.allow_consecutive_days,
              active: true,
              created_at: now,
              updated_at: now,
            })),
            select: { id: true },
          });

          const classLinksData: { lesson_id: bigint; schoolclass_id: bigint }[] =
            [];
          const teacherLinksData: { lesson_id: bigint; teacher_id: bigint }[] =
            [];

          validSourceLessons.forEach((l, idx) => {
            const created = createdLessons[idx];
            if (!created) return;
            lessonIdMap.set(l.id, created.id);

            for (const lc of l.lessons_lesson_classes) {
              const newClassId = classIdMap.get(lc.schoolclass_id);
              if (newClassId) {
                classLinksData.push({
                  lesson_id: created.id,
                  schoolclass_id: newClassId,
                });
              }
            }
            for (const lt of l.lessons_lesson_teachers) {
              teacherLinksData.push({
                lesson_id: created.id,
                teacher_id: lt.teacher_id,
              });
            }
          });

          if (classLinksData.length > 0) {
            await tx.lessons_lesson_classes.createMany({
              data: classLinksData,
            });
          }
          if (teacherLinksData.length > 0) {
            await tx.lessons_lesson_teachers.createMany({
              data: teacherLinksData,
            });
          }
        }

        // 5. Batch-copy schedule entries from latest active run
        let copiedEntriesCount = 0;
        if (latestRun && sourceEntries.length > 0) {
          const newEntries = sourceEntries
            .map((e) => {
              const newClassId = classIdMap.get(e.school_class_id);
              const newLessonId = lessonIdMap.get(e.lesson_id);
              if (!newClassId || !newLessonId) return null;
              return {
                run_id: latestRun.id,
                lesson_id: newLessonId,
                school_class_id: newClassId,
                teacher_id: e.teacher_id,
                room_id: e.room_id,
                period_id: e.period_id,
                day_of_week: e.day_of_week,
                lesson_index: e.lesson_index,
                is_locked: e.is_locked,
                created_at: now,
              };
            })
            .filter((x): x is NonNullable<typeof x> => x !== null);

          if (newEntries.length > 0) {
            await tx.solver_generatedscheduleentry.createMany({
              data: newEntries,
            });
            copiedEntriesCount = newEntries.length;
          }
        }

        return {
          newGroupId: Number(newGroup.id),
          subjectsCount: subjectIdMap.size,
          classesCount: classIdMap.size,
          lessonsCount: lessonIdMap.size,
          copiedEntriesCount,
        };
      },
      { maxWait: 10000, timeout: 60000 }
    );

    return NextResponse.json({
      ok: true,
      id: result.newGroupId,
      message: `Período ${academicPeriod} copiado em modo Prévia (${result.classesCount} turmas, ${result.subjectsCount} disciplinas, ${result.lessonsCount} aulas${
        result.copiedEntriesCount > 0
          ? `, ${result.copiedEntriesCount} alocações`
          : ""
      }).`,
    });
  } catch (err) {
    console.error("Group copy error:", err);
    return NextResponse.json(
      { ok: false, message: "Erro ao copiar período do curso." },
      { status: 500 }
    );
  }
}
