import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getActiveProject } from "@/lib/auth";
import { ACTIVE_RUN_STATUSES } from "@/lib/schedule/collision-engine";
import {
  ScheduleValidationService,
  type GeneratedEntryOutput,
} from "@/lib/schedule/solver";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const project = await getActiveProject(user);
    if (!user || !project) {
      return NextResponse.json(
        { ok: false, message: "Nenhum projeto ativo selecionado." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const lessonsData = Array.isArray(body.lessons) ? body.lessons : [];
    const classId = body.class_id ? Number(body.class_id) : null;

    // Fetch lessons of the project to resolve rooms, classes, teachers accurately
    const projectLessons = await prisma.lessons_lesson.findMany({
      where: { project_id: project.id, active: true },
      include: {
        subjects_subject: true,
        lessons_lesson_classes: true,
        lessons_lesson_teachers: true,
      },
    });
    const lessonMap = new Map(projectLessons.map((l) => [Number(l.id), l]));

    const entriesToCreate: GeneratedEntryOutput[] = [];
    const seenKey = new Set<string>();

    for (const item of lessonsData) {
      const lessonId = Number(item.lesson_id);
      const lessonIndex = Number(item.lesson_index);
      const periodId = Number(item.period_id);
      const dayOfWeek = String(item.day_of_week || "");
      const isLocked = Boolean(item.is_locked);

      const lesson = lessonMap.get(lessonId);
      if (!lesson || !periodId || !dayOfWeek) continue;

      const teacherIds = lesson.lessons_lesson_teachers.map((lt) =>
        Number(lt.teacher_id)
      );
      const primaryTeacherId = teacherIds.length > 0 ? teacherIds[0] : null;
      const roomId = lesson.room_id
        ? Number(lesson.room_id)
        : lesson.subjects_subject?.room_id
        ? Number(lesson.subjects_subject.room_id)
        : null;

      const classIds = lesson.lessons_lesson_classes.map((lc) =>
        Number(lc.schoolclass_id)
      );

      for (const scId of classIds) {
        const k = `${lessonId}_${scId}_${lessonIndex}`;
        if (seenKey.has(k)) continue;
        seenKey.add(k);

        entriesToCreate.push({
          lesson_id: lessonId,
          lesson_index: lessonIndex,
          school_class_id: scId,
          teacher_id: primaryTeacherId,
          teacher_ids: teacherIds,
          room_id: roomId,
          period_id: periodId,
          day_of_week: dayOfWeek,
          is_locked: isLocked,
        });
      }
    }

    // Validate all entries against teacher/room/class availability and cross-class collisions
    await ScheduleValidationService.validateEntries(
      project.id,
      entriesToCreate,
      classId
    );

    // Fetch latest run including PARTIAL!
    const latestRun = await prisma.solver_schedulegenerationrun.findFirst({
      where: {
        project_id: project.id,
        status: { in: [...ACTIVE_RUN_STATUSES] },
      },
      orderBy: [{ finished_at: "desc" }, { started_at: "desc" }],
      include: {
        solver_generatedscheduleentry: true,
      },
    });

    const affectedClassIds = new Set<number>(
      entriesToCreate.map((e) => e.school_class_id)
    );
    if (classId) {
      affectedClassIds.add(classId);
    }
    const lessonIdsBeingSaved = new Set<number>(
      entriesToCreate.map((e) => e.lesson_id)
    );

    const now = new Date();
    const run = await prisma.solver_schedulegenerationrun.create({
      data: {
        project_id: project.id,
        created_by_id: user.id,
        status: "MANUAL",
        objective_value: 0,
        diagnostics: {},
        started_at: now,
        finished_at: now,
      },
    });

    const preservedEntries: {
      run_id: bigint;
      lesson_id: bigint;
      lesson_index: number;
      school_class_id: bigint;
      teacher_id: bigint | null;
      room_id: bigint | null;
      period_id: bigint;
      day_of_week: string;
      is_locked: boolean;
      created_at: Date;
    }[] = [];

    if (latestRun) {
      for (const oldEntry of latestRun.solver_generatedscheduleentry) {
        const scId = Number(oldEntry.school_class_id);
        const lId = Number(oldEntry.lesson_id);
        if (affectedClassIds.has(scId) || lessonIdsBeingSaved.has(lId)) {
          continue;
        }
        preservedEntries.push({
          run_id: run.id,
          lesson_id: oldEntry.lesson_id,
          lesson_index: oldEntry.lesson_index,
          school_class_id: oldEntry.school_class_id,
          teacher_id: oldEntry.teacher_id,
          room_id: oldEntry.room_id,
          period_id: oldEntry.period_id,
          day_of_week: oldEntry.day_of_week,
          is_locked: oldEntry.is_locked, // Preserves locked state!
          created_at: now,
        });
      }
    }

    const newEntriesData = entriesToCreate.map((e) => ({
      run_id: run.id,
      lesson_id: BigInt(e.lesson_id),
      lesson_index: e.lesson_index,
      school_class_id: BigInt(e.school_class_id),
      teacher_id: e.teacher_id ? BigInt(e.teacher_id) : null,
      room_id: e.room_id ? BigInt(e.room_id) : null,
      period_id: BigInt(e.period_id),
      day_of_week: e.day_of_week,
      is_locked: e.is_locked,
      created_at: now,
    }));

    const combined = [...newEntriesData, ...preservedEntries];
    if (combined.length > 0) {
      await prisma.solver_generatedscheduleentry.createMany({
        data: combined,
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Grade salva com sucesso!",
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Erro ao validar e salvar a grade.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
