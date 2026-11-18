import { prisma } from "../prisma";
import { ACTIVE_RUN_STATUSES, DAY_SHORT_LABELS, DAY_WEIGHTS } from "./collision-engine";
import { PlanService } from "../services/access-control";

export interface AuditError {
  code: string;
  lesson_id?: number;
  teacher_id?: number;
  class_id?: number;
  unit?: string;
  title?: string;
  message: string;
}

export interface AuditResult {
  ok: boolean;
  errors: AuditError[];
  warnings: AuditError[];
  summary: {
    days: number;
    periods: number;
    lessons: number;
    teachers: number;
    classes: number;
    rooms: number;
  };
}

export interface SolverSlot {
  key: string;
  day: string;
  period_id: number;
  shift: string;
  position: number;
}

export interface SolverLessonUnit {
  key: string;
  lesson_id: number;
  lesson_index: number;
  total_units_for_lesson: number;
  subject_name: string;
  class_ids: number[];
  teacher_ids: number[];
  room_id: number | null;
  max_lessons_per_day: number;
  max_days_of_lessons: number;
  grouping_type: string;
  allow_consecutive_days: boolean;
  class_groups: number[];
  class_levels: string[];
  fixed_slot_key: string | null;
  is_locked: boolean;
}

export interface GeneratedEntryOutput {
  lesson_id: number;
  lesson_index: number;
  school_class_id: number;
  teacher_id: number | null;
  teacher_ids: number[];
  room_id: number | null;
  period_id: number;
  day_of_week: string;
  is_locked: boolean;
}

export class ScheduleAuditService {
  static getProjectDays(project: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  }): string[] {
    const days: [string, boolean][] = [
      ["MONDAY", project.monday],
      ["TUESDAY", project.tuesday],
      ["WEDNESDAY", project.wednesday],
      ["THURSDAY", project.thursday],
      ["FRIDAY", project.friday],
      ["SATURDAY", project.saturday],
      ["SUNDAY", project.sunday],
    ];
    return days.filter(([, enabled]) => enabled).map(([day]) => day);
  }

  static async getClassPeriods(projectId: bigint) {
    return await prisma.periods_period.findMany({
      where: {
        project_id: projectId,
        period_type: "CLASS",
      },
      orderBy: [{ start_time: "asc" }, { order: "asc" }],
    });
  }

  static async audit(projectId: bigint): Promise<AuditResult> {
    const project = await prisma.schedules_project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      return {
        ok: false,
        errors: [{ code: "PROJECT_NOT_FOUND", message: "Projeto não encontrado." }],
        warnings: [],
        summary: { days: 0, periods: 0, lessons: 0, teachers: 0, classes: 0, rooms: 0 },
      };
    }

    const days = this.getProjectDays(project);
    const periods = await this.getClassPeriods(projectId);
    const lessons = await prisma.lessons_lesson.findMany({
      where: { project_id: projectId, active: true },
      include: {
        subjects_subject: true,
        rooms_room: true,
        lessons_lesson_classes: {
          include: { classes_schoolclass: true },
        },
        lessons_lesson_teachers: {
          include: { teachers_teacher: true },
        },
      },
    });

    const [teachersCount, classesCount, roomsCount] = await Promise.all([
      prisma.teachers_teacher.count({ where: { project_id: projectId } }),
      prisma.classes_schoolclass.count({ where: { project_id: projectId } }),
      prisma.rooms_room.count({ where: { project_id: projectId } }),
    ]);

    const errors: AuditError[] = [];
    const warnings: AuditError[] = [];

    if (days.length === 0) {
      errors.push({
        code: "NO_ACTIVE_DAYS",
        message: "Nenhum dia letivo ativo no projeto.",
      });
    }

    if (periods.length === 0) {
      errors.push({
        code: "NO_CLASS_PERIODS",
        message: "Nenhum período do tipo aula cadastrado.",
      });
    }

    if (lessons.length === 0) {
      errors.push({
        code: "NO_LESSONS",
        message: "Nenhuma aula ativa cadastrada.",
      });
    }

    for (const lesson of lessons) {
      const classes = lesson.lessons_lesson_classes;
      const teachers = lesson.lessons_lesson_teachers;
      const roomId = lesson.room_id ?? lesson.subjects_subject?.room_id ?? null;

      if (classes.length === 0) {
        errors.push({
          code: "LESSON_WITHOUT_CLASS",
          lesson_id: Number(lesson.id),
          message: `A aula ${lesson.id} (${lesson.subjects_subject?.name || ""}) não possui turma.`,
        });
      }

      if (teachers.length === 0) {
        errors.push({
          code: "LESSON_WITHOUT_TEACHER",
          lesson_id: Number(lesson.id),
          message: `A aula ${lesson.id} (${lesson.subjects_subject?.name || ""}) não possui professor.`,
        });
      }

      if (!roomId) {
        warnings.push({
          code: "LESSON_WITHOUT_ROOM",
          lesson_id: Number(lesson.id),
          message: `A aula ${lesson.id} (${lesson.subjects_subject?.name || ""}) não possui sala definida.`,
        });
      }

      if (lesson.number_of_lessons < 1) {
        errors.push({
          code: "LESSON_WITHOUT_QUANTITY",
          lesson_id: Number(lesson.id),
          message: `A aula ${lesson.id} precisa de ao menos um tempo.`,
        });
      }
    }

    return {
      ok: errors.length === 0,
      errors,
      warnings,
      summary: {
        days: days.length,
        periods: periods.length,
        lessons: lessons.length,
        teachers: teachersCount,
        classes: classesCount,
        rooms: roomsCount,
      },
    };
  }
}

export class ScheduleValidationService {
  /**
   * Validates manual schedule entries for availability and cross-class collisions
   * Fixes all 4 collision gaps from the original implementation.
   */
  static async validateEntries(
    projectId: bigint,
    entries: GeneratedEntryOutput[],
    editedClassId?: number | null
  ) {
    if (!entries || entries.length === 0) return;

    const [
      teacherUnavailRows,
      roomUnavailRows,
      classUnavailRows,
      teachersList,
      roomsList,
      classesList,
      periodsList,
      latestRun,
    ] = await Promise.all([
      prisma.availability_teacheravailability.findMany({
        where: {
          teachers_teacher: { project_id: projectId },
          status: "UNAVAILABLE",
        },
      }),
      prisma.availability_roomavailability.findMany({
        where: {
          rooms_room: { project_id: projectId },
          status: "UNAVAILABLE",
        },
      }),
      prisma.availability_schoolclassavailability.findMany({
        where: {
          classes_schoolclass: { project_id: projectId },
          status: "UNAVAILABLE",
        },
      }),
      prisma.teachers_teacher.findMany({ where: { project_id: projectId } }),
      prisma.rooms_room.findMany({ where: { project_id: projectId } }),
      prisma.classes_schoolclass.findMany({ where: { project_id: projectId } }),
      prisma.periods_period.findMany({ where: { project_id: projectId } }),
      prisma.solver_schedulegenerationrun.findFirst({
        where: {
          project_id: projectId,
          status: { in: [...ACTIVE_RUN_STATUSES] },
        },
        orderBy: [{ finished_at: "desc" }, { started_at: "desc" }],
        include: {
          solver_generatedscheduleentry: {
            include: {
              lessons_lesson: {
                include: {
                  lessons_lesson_teachers: true,
                  subjects_subject: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const teacherUnavail = new Set(
      teacherUnavailRows.map(
        (r) => `${Number(r.teacher_id)}_${Number(r.period_id)}_${r.day_of_week}`
      )
    );
    const roomUnavail = new Set(
      roomUnavailRows.map(
        (r) => `${Number(r.room_id)}_${Number(r.period_id)}_${r.day_of_week}`
      )
    );
    const classUnavail = new Set(
      classUnavailRows.map(
        (r) => `${Number(r.school_class_id)}_${Number(r.period_id)}_${r.day_of_week}`
      )
    );

    const teachers = new Map(teachersList.map((t) => [Number(t.id), t]));
    const rooms = new Map(roomsList.map((r) => [Number(r.id), r]));
    const schoolClasses = new Map(classesList.map((c) => [Number(c.id), c]));
    const periods = new Map(periodsList.map((p) => [Number(p.id), p]));

    const teacherBusy = new Map<string, number>(); // key -> lesson_id
    const roomBusy = new Map<string, Set<number>>(); // key -> Set<lesson_id>
    const classBusy = new Map<string, number>(); // key -> lesson_id

    const classesInEntries = new Set<number>(
      entries.map((e) => e.school_class_id)
    );
    if (editedClassId) {
      classesInEntries.add(Number(editedClassId));
    }
    const lessonsBeingSaved = new Set<number>(entries.map((e) => e.lesson_id));

    if (latestRun) {
      for (const existing of latestRun.solver_generatedscheduleentry) {
        const scId = Number(existing.school_class_id);
        const lId = Number(existing.lesson_id);
        if (classesInEntries.has(scId) || lessonsBeingSaved.has(lId)) {
          continue;
        }
        const pId = Number(existing.period_id);
        const day = existing.day_of_week;

        for (const lt of existing.lessons_lesson.lessons_lesson_teachers) {
          const tId = Number(lt.teacher_id);
          teacherBusy.set(`${tId}_${pId}_${day}`, lId);
        }

        const effectiveRoomId = existing.room_id
          ? Number(existing.room_id)
          : existing.lessons_lesson.subjects_subject?.room_id
          ? Number(existing.lessons_lesson.subjects_subject.room_id)
          : null;

        if (effectiveRoomId) {
          const rKey = `${effectiveRoomId}_${pId}_${day}`;
          const set = roomBusy.get(rKey) || new Set<number>();
          set.add(lId);
          roomBusy.set(rKey, set);
        }

        classBusy.set(`${scId}_${pId}_${day}`, lId);
      }
    }

    for (const entry of entries) {
      const dayDisplay = DAY_SHORT_LABELS[entry.day_of_week] || entry.day_of_week;
      const period = periods.get(entry.period_id);
      const periodDisplay = period ? period.name : `período ${entry.period_id}`;
      const lessonId = entry.lesson_id;

      // Validate all teachers of this lesson (co-teaching aware)
      const teacherIds =
        entry.teacher_ids && entry.teacher_ids.length > 0
          ? entry.teacher_ids
          : entry.teacher_id
          ? [entry.teacher_id]
          : [];

      for (const tId of teacherIds) {
        const tKey = `${tId}_${entry.period_id}_${entry.day_of_week}`;
        if (teacherUnavail.has(tKey)) {
          const t = teachers.get(tId);
          throw new Error(
            `O professor ${t?.name || "Desconhecido"} está indisponível na ${dayDisplay} (${periodDisplay}).`
          );
        }
        const busyLessonId = teacherBusy.get(tKey);
        if (busyLessonId !== undefined && busyLessonId !== lessonId) {
          const t = teachers.get(tId);
          throw new Error(
            `O professor ${t?.name || "Desconhecido"} já possui outra aula na ${dayDisplay} (${periodDisplay}).`
          );
        }
        teacherBusy.set(tKey, lessonId);
      }

      // Validate room availability & simultaneous_lessons capacity
      if (entry.room_id) {
        const rKey = `${entry.room_id}_${entry.period_id}_${entry.day_of_week}`;
        if (roomUnavail.has(rKey)) {
          const r = rooms.get(entry.room_id);
          throw new Error(
            `A sala ${r?.name || "Desconhecida"} está indisponível na ${dayDisplay} (${periodDisplay}).`
          );
        }
        const room = rooms.get(entry.room_id);
        const simultLimit = room ? room.simultaneous_lessons : 1;
        const allocatedSet = roomBusy.get(rKey) || new Set<number>();
        if (!allocatedSet.has(lessonId) && allocatedSet.size >= simultLimit) {
          throw new Error(
            `A sala ${room?.name || "Desconhecida"} excedeu a capacidade de aulas simultâneas (${simultLimit}) na ${dayDisplay} (${periodDisplay}).`
          );
        }
        allocatedSet.add(lessonId);
        roomBusy.set(rKey, allocatedSet);
      }

      // Validate class availability & collision
      if (entry.school_class_id) {
        const cKey = `${entry.school_class_id}_${entry.period_id}_${entry.day_of_week}`;
        if (classUnavail.has(cKey)) {
          const sc = schoolClasses.get(entry.school_class_id);
          throw new Error(
            `A turma ${sc?.name || "Desconhecida"} está indisponível na ${dayDisplay} (${periodDisplay}).`
          );
        }
        const busyLessonId = classBusy.get(cKey);
        if (busyLessonId !== undefined && busyLessonId !== lessonId) {
          const sc = schoolClasses.get(entry.school_class_id);
          throw new Error(
            `A turma ${sc?.name || "Desconhecida"} já possui outra aula na ${dayDisplay} (${periodDisplay}).`
          );
        }
        classBusy.set(cKey, lessonId);
      }
    }
  }
}

export class ScheduleSolver {
  static async solve(projectId: bigint, targetClassIds?: number[] | null) {
    const audit = await ScheduleAuditService.audit(projectId);
    if (!audit.ok) {
      return {
        status: "INVALID",
        diagnostics: audit,
        entries: [] as GeneratedEntryOutput[],
        unallocated: [] as { lesson_id: number; lesson_index: number; unit_key: string }[],
        objective_value: null as number | null,
      };
    }

    const project = (await prisma.schedules_project.findUnique({
      where: { id: projectId },
    }))!;

    const days = ScheduleAuditService.getProjectDays(project);
    const periods = await ScheduleAuditService.getClassPeriods(projectId);

    const slots: SolverSlot[] = [];
    for (const day of days) {
      periods.forEach((p, idx) => {
        slots.push({
          key: `${day}_${Number(p.id)}`,
          day,
          period_id: Number(p.id),
          shift: p.shift,
          position: idx,
        });
      });
    }
    const slotByKey = new Map(slots.map((s) => [s.key, s]));

    // Fetch latest run including PARTIAL!
    const latestRun = await prisma.solver_schedulegenerationrun.findFirst({
      where: {
        project_id: projectId,
        status: { in: [...ACTIVE_RUN_STATUSES] },
      },
      orderBy: [{ finished_at: "desc" }, { started_at: "desc" }],
      include: {
        solver_generatedscheduleentry: true,
      },
    });

    const fixedEntries = new Map<string, { slot_key: string; is_locked: boolean }>();
    if (latestRun) {
      for (const entry of latestRun.solver_generatedscheduleentry) {
        const key = `lesson_${Number(entry.lesson_id)}_unit_${entry.lesson_index}`;
        fixedEntries.set(key, {
          slot_key: `${entry.day_of_week}_${Number(entry.period_id)}`,
          is_locked: entry.is_locked,
        });
      }
    }

    const lessons = await prisma.lessons_lesson.findMany({
      where: { project_id: projectId, active: true },
      include: {
        subjects_subject: true,
        lessons_lesson_classes: {
          include: { classes_schoolclass: true },
        },
        lessons_lesson_teachers: true,
      },
      orderBy: { id: "asc" },
    });

    const targetSet =
      targetClassIds && targetClassIds.length > 0
        ? new Set(targetClassIds.map((id) => Number(id)))
        : null;

    const units: SolverLessonUnit[] = [];
    for (const lesson of lessons) {
      const classObjs = lesson.lessons_lesson_classes.map((lc) => lc.classes_schoolclass);
      const classIds = classObjs.map((c) => Number(c.id));
      const isTarget = !targetSet || classIds.some((cId) => targetSet.has(cId));

      const teacherIds = lesson.lessons_lesson_teachers.map((lt) => Number(lt.teacher_id));
      const roomId = lesson.room_id
        ? Number(lesson.room_id)
        : lesson.subjects_subject?.room_id
        ? Number(lesson.subjects_subject.room_id)
        : null;

      const classGroups = Array.from(
        new Set(classObjs.map((c) => Number(c.group_id)).filter(Boolean))
      );
      const classLevels = Array.from(
        new Set(classObjs.map((c) => c.level).filter(Boolean))
      );

      for (let i = 1; i <= lesson.number_of_lessons; i++) {
        const unitKey = `lesson_${Number(lesson.id)}_unit_${i}`;
        const fixedInfo = fixedEntries.get(unitKey);
        const fixedSlot = fixedInfo ? fixedInfo.slot_key : null;
        const isLocked = fixedInfo ? fixedInfo.is_locked : false;

        if (!isTarget && !fixedSlot) {
          continue;
        }

        units.push({
          key: unitKey,
          lesson_id: Number(lesson.id),
          lesson_index: i,
          total_units_for_lesson: lesson.number_of_lessons,
          subject_name: lesson.subjects_subject?.name || "Aula",
          class_ids: classIds,
          teacher_ids: teacherIds,
          room_id: roomId,
          max_lessons_per_day: lesson.max_lessons_per_day,
          max_days_of_lessons: lesson.max_days_of_lessons,
          grouping_type: lesson.grouping_type,
          allow_consecutive_days: lesson.allow_consecutive_days,
          class_groups: classGroups,
          class_levels: classLevels,
          fixed_slot_key: !isTarget || isLocked ? fixedSlot : null,
          is_locked: isLocked,
        });
      }
    }

    // Build availability maps
    const [teacherAvs, roomAvs, classAvs, schoolClasses, activeTeachers, rooms] =
      await Promise.all([
        prisma.availability_teacheravailability.findMany({
          where: { teachers_teacher: { project_id: projectId } },
        }),
        prisma.availability_roomavailability.findMany({
          where: { rooms_room: { project_id: projectId }, status: "UNAVAILABLE" },
        }),
        prisma.availability_schoolclassavailability.findMany({
          where: { classes_schoolclass: { project_id: projectId }, status: "UNAVAILABLE" },
        }),
        prisma.classes_schoolclass.findMany({ where: { project_id: projectId } }),
        prisma.teachers_teacher.findMany({ where: { project_id: projectId, active: true } }),
        prisma.rooms_room.findMany({ where: { project_id: projectId } }),
      ]);

    const teacherUnavailable = new Set<string>();
    const teacherUndesired = new Set<string>();
    for (const av of teacherAvs) {
      const k = `${Number(av.teacher_id)}_${Number(av.period_id)}_${av.day_of_week}`;
      if (av.status === "UNAVAILABLE") teacherUnavailable.add(k);
      if (av.status === "UNDESIRED") teacherUndesired.add(k);
    }

    const roomUnavailable = new Set<string>(
      roomAvs.map((av) => `${Number(av.room_id)}_${Number(av.period_id)}_${av.day_of_week}`)
    );
    const classUnavailable = new Set<string>(
      classAvs.map(
        (av) => `${Number(av.school_class_id)}_${Number(av.period_id)}_${av.day_of_week}`
      )
    );
    const classShifts = new Map<number, string[]>(
      schoolClasses.map((c) => [Number(c.id), c.shifts || []])
    );
    const teacherMap = new Map(activeTeachers.map((t) => [Number(t.id), t]));
    const roomCapacity = new Map(rooms.map((r) => [Number(r.id), r.simultaneous_lessons]));

    const isSlotForbidden = (unit: SolverLessonUnit, slot: SolverSlot): boolean => {
      for (const tId of unit.teacher_ids) {
        if (teacherUnavailable.has(`${tId}_${slot.period_id}_${slot.day}`)) {
          return true;
        }
      }
      for (const cId of unit.class_ids) {
        if (classUnavailable.has(`${cId}_${slot.period_id}_${slot.day}`)) {
          return true;
        }
        const allowedShifts = classShifts.get(cId) || [];
        if (allowedShifts.length > 0 && !allowedShifts.includes(slot.shift)) {
          return true;
        }
      }
      if (
        unit.room_id &&
        roomUnavailable.has(`${unit.room_id}_${slot.period_id}_${slot.day}`)
      ) {
        return true;
      }
      return false;
    };

    const getSlotPenalty = (unit: SolverLessonUnit, slot: SolverSlot): number => {
      let pen = 0;
      for (const tId of unit.teacher_ids) {
        if (teacherUndesired.has(`${tId}_${slot.period_id}_${slot.day}`)) {
          pen += 1;
        }
      }
      return pen;
    };

    const unallocatedErrors: AuditError[] = [];
    const validSlotsByUnit = new Map<string, SolverSlot[]>();

    for (const unit of units) {
      if (unit.fixed_slot_key) {
        const fixedSlot = slotByKey.get(unit.fixed_slot_key);
        if (fixedSlot && !isSlotForbidden(unit, fixedSlot)) {
          validSlotsByUnit.set(unit.key, [fixedSlot]);
        } else {
          unallocatedErrors.push({
            code: "FIXED_SLOT_UNAVAILABLE",
            unit: unit.key,
            lesson_id: unit.lesson_id,
            title: `Horário fixo indisponível: ${unit.subject_name}`,
            message: `O horário fixo da aula de ${unit.subject_name} (${unit.fixed_slot_key}) ficou indisponível.`,
          });
          validSlotsByUnit.set(unit.key, []);
        }
        continue;
      }

      const valid = slots.filter((s) => !isSlotForbidden(unit, s));
      validSlotsByUnit.set(unit.key, valid);
      if (valid.length === 0) {
        unallocatedErrors.push({
          code: "UNIT_WITHOUT_VALID_SLOT",
          unit: unit.key,
          lesson_id: unit.lesson_id,
          title: `Sem horários válidos: ${unit.subject_name}`,
          message: `Uma unidade de aula de ${unit.subject_name} não possui nenhum horário compatível disponível.`,
        });
      }
    }

    // Run solver search with hard constraints & soft penalty minimization
    const assignment = this.runConstraintSearch({
      units,
      slots,
      validSlotsByUnit,
      getSlotPenalty,
      teacherMap,
      roomCapacity,
    });

    const entries: GeneratedEntryOutput[] = [];
    for (const unit of units) {
      const assignedSlotKey = assignment.get(unit.key);
      if (!assignedSlotKey) continue;
      const slot = slotByKey.get(assignedSlotKey)!;
      const primaryTeacherId = unit.teacher_ids.length > 0 ? unit.teacher_ids[0] : null;

      for (const classId of unit.class_ids) {
        entries.push({
          lesson_id: unit.lesson_id,
          lesson_index: unit.lesson_index,
          school_class_id: classId,
          teacher_id: primaryTeacherId,
          teacher_ids: unit.teacher_ids,
          room_id: unit.room_id,
          period_id: slot.period_id,
          day_of_week: slot.day,
          is_locked: unit.is_locked,
        });
      }
    }

    const unallocatedUnits = units.filter((u) => !assignment.has(u.key));
    const unallocated = unallocatedUnits.map((u) => ({
      lesson_id: u.lesson_id,
      lesson_index: u.lesson_index,
      unit_key: u.key,
    }));

    const isSat = assignment.size === units.length && unallocatedErrors.length === 0;
    const status = isSat
      ? "SATISFIABLE"
      : assignment.size > 0
      ? "PARTIAL"
      : "UNSATISFIABLE";

    const diagnostics: Record<string, unknown> = {
      audit,
      z3_status: isSat ? "sat" : assignment.size > 0 ? "partial" : "unsat",
      assigned_units: assignment.size,
      total_units: units.length,
    };

    if (!isSat) {
      const constraintErrors = this.diagnoseUnsatConstraints({
        units,
        slots,
        isSlotForbidden,
        teacherUnavailable,
        classUnavailable,
        classShifts,
        teacherMap,
        schoolClasses,
      });
      // Deduplicate errors by code + lesson_id/teacher_id/class_id
      const combined = [...unallocatedErrors, ...constraintErrors];
      const uniqueErrors: AuditError[] = [];
      const seenKeys = new Set<string>();
      for (const err of combined) {
        const k = `${err.code}_${err.lesson_id || ""}_${err.teacher_id || ""}_${err.class_id || ""}`;
        if (!seenKeys.has(k)) {
          seenKeys.add(k);
          uniqueErrors.push(err);
        }
      }
      diagnostics.errors = uniqueErrors;
    }

    return {
      status,
      diagnostics,
      entries,
      unallocated,
      objective_value: 0,
    };
  }

  private static runConstraintSearch({
    units,
    slots,
    validSlotsByUnit,
    getSlotPenalty,
    teacherMap,
    roomCapacity,
  }: {
    units: SolverLessonUnit[];
    slots: SolverSlot[];
    validSlotsByUnit: Map<string, SolverSlot[]>;
    getSlotPenalty: (u: SolverLessonUnit, s: SolverSlot) => number;
    teacherMap: Map<
      number,
      {
        id: bigint;
        max_lessons_day: number;
        min_lessons_day: number;
        max_lessons_level: number;
        max_lessons_group: number;
        reduce_days: boolean;
        reduce_windows: boolean;
      }
    >;
    roomCapacity: Map<number, number>;
  }): Map<string, string> {
    // Group units by lesson so DUPLAS / SEQUENCIA pairs can be scheduled together cleanly
    const assignment = new Map<string, string>();

    const teacherSlotUsed = new Set<string>(); // `${teacher_id}_${slot.key}`
    const classSlotUsed = new Set<string>(); // `${class_id}_${slot.key}`
    const roomSlotLessons = new Map<string, Set<number>>(); // `${room_id}_${slot.key}` -> Set<lesson_id>

    const lessonDayCount = new Map<string, number>(); // `${lesson_id}_${day}` -> count
    const lessonDayPositions = new Map<string, number[]>(); // `${lesson_id}_${day}` -> slot.position[]
    const lessonDaysUsed = new Map<number, Set<string>>(); // lesson_id -> Set<day>

    const teacherDayCount = new Map<string, number>(); // `${teacher_id}_${day}`
    const teacherLevelDayCount = new Map<string, number>(); // `${teacher_id}_${level}_${day}`
    const teacherGroupDayCount = new Map<string, number>(); // `${teacher_id}_${group}_${day}`
    const teacherDayPositions = new Map<string, number[]>(); // `${teacher_id}_${day}` -> positions

    const canAssign = (
      unit: SolverLessonUnit,
      slot: SolverSlot,
      strictGrouping: boolean
    ): boolean => {
      // 1. Resource conflicts
      for (const tId of unit.teacher_ids) {
        if (teacherSlotUsed.has(`${tId}_${slot.key}`)) return false;
      }
      for (const cId of unit.class_ids) {
        if (classSlotUsed.has(`${cId}_${slot.key}`)) return false;
      }
      if (unit.room_id) {
        const rKey = `${unit.room_id}_${slot.key}`;
        const set = roomSlotLessons.get(rKey);
        const cap = roomCapacity.get(unit.room_id) ?? 1;
        if (set && !set.has(unit.lesson_id) && set.size >= cap) {
          return false;
        }
      }

      // 2. Lesson daily limit & max days
      const lDayKey = `${unit.lesson_id}_${slot.day}`;
      const currentDayCount = lessonDayCount.get(lDayKey) || 0;
      let maxPerDay = unit.max_lessons_per_day;
      if (unit.grouping_type === "SEPARADAS") maxPerDay = 1;
      else if (unit.grouping_type === "DUPLAS") maxPerDay = Math.max(maxPerDay, 2);

      if (currentDayCount + 1 > maxPerDay) return false;

      const usedDays = lessonDaysUsed.get(unit.lesson_id) || new Set<string>();
      if (!usedDays.has(slot.day) && usedDays.size + 1 > unit.max_days_of_lessons) {
        return false;
      }

      // 3. Double lesson adjacency on the same day
      if (
        strictGrouping &&
        (unit.grouping_type === "DUPLAS" || unit.grouping_type === "SEQUENCIA")
      ) {
        const existingPos = lessonDayPositions.get(lDayKey) || [];
        if (existingPos.length > 0) {
          // Must be adjacent to at least one existing position on the same day and form a contiguous block
          const allPos = [...existingPos, slot.position].sort((a, b) => a - b);
          for (let i = 0; i < allPos.length - 1; i++) {
            if (allPos[i + 1] - allPos[i] !== 1) return false;
          }
        }
      }

      // 4. Consecutive days rule
      if (!unit.allow_consecutive_days) {
        const w = DAY_WEIGHTS[slot.day] || 0;
        for (const d of usedDays) {
          if (d === slot.day) continue;
          const dw = DAY_WEIGHTS[d] || 0;
          if (Math.abs(w - dw) === 1) return false;
        }
      } else if (strictGrouping && usedDays.size > 0 && !usedDays.has(slot.day)) {
        // If allow_consecutive_days is true, prefer/require contiguous days when possible
        const weights = [...Array.from(usedDays), slot.day]
          .map((d) => DAY_WEIGHTS[d] || 0)
          .sort((a, b) => a - b);
        const span = weights[weights.length - 1] - weights[0] + 1;
        if (span > unit.total_units_for_lesson) {
          return false;
        }
      }

      // 5. Teacher limits (max_lessons_day, max_lessons_level, max_lessons_group)
      for (const tId of unit.teacher_ids) {
        const teacher = teacherMap.get(tId);
        if (!teacher) continue;
        const tdKey = `${tId}_${slot.day}`;
        const tDayLoad = teacherDayCount.get(tdKey) || 0;
        if (tDayLoad + 1 > teacher.max_lessons_day) return false;

        for (const lvl of unit.class_levels) {
          const tlKey = `${tId}_${lvl}_${slot.day}`;
          if ((teacherLevelDayCount.get(tlKey) || 0) + 1 > teacher.max_lessons_level) {
            return false;
          }
        }

        for (const grp of unit.class_groups) {
          const tgKey = `${tId}_${grp}_${slot.day}`;
          if ((teacherGroupDayCount.get(tgKey) || 0) + 1 > teacher.max_lessons_group) {
            return false;
          }
        }
      }

      return true;
    };

    const doAssign = (unit: SolverLessonUnit, slot: SolverSlot) => {
      assignment.set(unit.key, slot.key);
      for (const tId of unit.teacher_ids) {
        teacherSlotUsed.add(`${tId}_${slot.key}`);
        const tdKey = `${tId}_${slot.day}`;
        teacherDayCount.set(tdKey, (teacherDayCount.get(tdKey) || 0) + 1);
        const posArr = teacherDayPositions.get(tdKey) || [];
        posArr.push(slot.position);
        teacherDayPositions.set(tdKey, posArr);

        for (const lvl of unit.class_levels) {
          const tlKey = `${tId}_${lvl}_${slot.day}`;
          teacherLevelDayCount.set(tlKey, (teacherLevelDayCount.get(tlKey) || 0) + 1);
        }
        for (const grp of unit.class_groups) {
          const tgKey = `${tId}_${grp}_${slot.day}`;
          teacherGroupDayCount.set(tgKey, (teacherGroupDayCount.get(tgKey) || 0) + 1);
        }
      }
      for (const cId of unit.class_ids) {
        classSlotUsed.add(`${cId}_${slot.key}`);
      }
      if (unit.room_id) {
        const rKey = `${unit.room_id}_${slot.key}`;
        const set = roomSlotLessons.get(rKey) || new Set<number>();
        set.add(unit.lesson_id);
        roomSlotLessons.set(rKey, set);
      }

      const lDayKey = `${unit.lesson_id}_${slot.day}`;
      lessonDayCount.set(lDayKey, (lessonDayCount.get(lDayKey) || 0) + 1);
      const lPos = lessonDayPositions.get(lDayKey) || [];
      lPos.push(slot.position);
      lessonDayPositions.set(lDayKey, lPos);

      const usedDays = lessonDaysUsed.get(unit.lesson_id) || new Set<string>();
      usedDays.add(slot.day);
      lessonDaysUsed.set(unit.lesson_id, usedDays);
    };

    const scoreSlot = (unit: SolverLessonUnit, slot: SolverSlot): number => {
      let score = getSlotPenalty(unit, slot) * 100;

      // If DUPLAS and another unit of this lesson is already on this day at an adjacent slot, strongly reward!
      const lDayKey = `${unit.lesson_id}_${slot.day}`;
      const existingPos = lessonDayPositions.get(lDayKey) || [];
      if (unit.grouping_type === "DUPLAS" || unit.grouping_type === "SEQUENCIA") {
        if (existingPos.length === 1 && Math.abs(existingPos[0] - slot.position) === 1) {
          score -= 500;
        }
      }

      // Soft constraints for teachers: reduce_days & reduce_windows & min_lessons_day
      for (const tId of unit.teacher_ids) {
        const teacher = teacherMap.get(tId);
        if (!teacher) continue;
        const tdKey = `${tId}_${slot.day}`;
        const currentLoad = teacherDayCount.get(tdKey) || 0;

        if (teacher.reduce_days) {
          if (currentLoad === 0) score += 25; // Penalty for starting a new day
          else score -= 15; // Reward for consolidating on an already active day
        }

        if (teacher.min_lessons_day > 1 && currentLoad > 0 && currentLoad < teacher.min_lessons_day) {
          score -= 40; // Help reach min_lessons_day on active days
        }

        if (teacher.reduce_windows) {
          const posArr = teacherDayPositions.get(tdKey) || [];
          if (posArr.length > 0) {
            const minP = Math.min(...posArr, slot.position);
            const maxP = Math.max(...posArr, slot.position);
            const windows = maxP - minP + 1 - (posArr.length + 1);
            score += windows * 20;
          }
        }
      }

      return score;
    };

    // Step 1: Assign fixed / locked units first
    const fixedUnits = units.filter((u) => u.fixed_slot_key);
    const dynamicUnits = units.filter((u) => !u.fixed_slot_key);

    for (const u of fixedUnits) {
      const valid = validSlotsByUnit.get(u.key) || [];
      if (valid.length === 1 && canAssign(u, valid[0], false)) {
        doAssign(u, valid[0]);
      }
    }

    // Step 2: Sort dynamic units by MRV (Minimum Remaining Values) + DUPLAS priority
    const sortedDynamic = [...dynamicUnits].sort((a, b) => {
      const va = (validSlotsByUnit.get(a.key) || []).length;
      const vb = (validSlotsByUnit.get(b.key) || []).length;
      if (va !== vb) return va - vb;
      const aDouble = a.grouping_type === "DUPLAS" ? 0 : 1;
      const bDouble = b.grouping_type === "DUPLAS" ? 0 : 1;
      if (aDouble !== bDouble) return aDouble - bDouble;
      if (a.lesson_id !== b.lesson_id) return a.lesson_id - b.lesson_id;
      return a.lesson_index - b.lesson_index;
    });

    // Pass 1: Strict grouping & contiguous constraints
    const remainingAfterStrict: SolverLessonUnit[] = [];
    for (const unit of sortedDynamic) {
      const candidates = (validSlotsByUnit.get(unit.key) || []).filter((s) =>
        canAssign(unit, s, true)
      );
      if (candidates.length > 0) {
        candidates.sort((s1, s2) => scoreSlot(unit, s1) - scoreSlot(unit, s2));
        doAssign(unit, candidates[0]);
      } else {
        remainingAfterStrict.push(unit);
      }
    }

    // Pass 2: Fallback without strict contiguity for any remaining units so PARTIAL maximizes allocation
    for (const unit of remainingAfterStrict) {
      const candidates = (validSlotsByUnit.get(unit.key) || []).filter((s) =>
        canAssign(unit, s, false)
      );
      if (candidates.length > 0) {
        candidates.sort((s1, s2) => scoreSlot(unit, s1) - scoreSlot(unit, s2));
        doAssign(unit, candidates[0]);
      }
    }

    return assignment;
  }

  private static diagnoseUnsatConstraints({
    units,
    slots,
    isSlotForbidden,
    teacherUnavailable,
    classUnavailable,
    classShifts,
    teacherMap,
    schoolClasses,
  }: {
    units: SolverLessonUnit[];
    slots: SolverSlot[];
    isSlotForbidden: (u: SolverLessonUnit, s: SolverSlot) => boolean;
    teacherUnavailable: Set<string>;
    classUnavailable: Set<string>;
    classShifts: Map<number, string[]>;
    teacherMap: Map<
      number,
      {
        id: bigint;
        name: string;
        min_lessons_day: number;
        max_lessons_day: number;
      }
    >;
    schoolClasses: { id: bigint; name: string }[];
  }): AuditError[] {
    const errors: AuditError[] = [];
    const days = new Set(slots.map((s) => s.day));
    const unitsByLesson = new Map<number, SolverLessonUnit[]>();
    const unitsByTeacher = new Map<number, SolverLessonUnit[]>();
    const unitsByClass = new Map<number, SolverLessonUnit[]>();

    for (const unit of units) {
      const lArr = unitsByLesson.get(unit.lesson_id) || [];
      lArr.push(unit);
      unitsByLesson.set(unit.lesson_id, lArr);

      for (const tId of unit.teacher_ids) {
        const tArr = unitsByTeacher.get(tId) || [];
        tArr.push(unit);
        unitsByTeacher.set(tId, tArr);
      }

      for (const cId of unit.class_ids) {
        const cArr = unitsByClass.get(cId) || [];
        cArr.push(unit);
        unitsByClass.set(cId, cArr);
      }
    }

    // 1. Lesson daily limit vs total units
    for (const [lessonId, lessonUnits] of unitsByLesson.entries()) {
      const first = lessonUnits[0];
      let maxPerDay = first.max_lessons_per_day;
      if (first.grouping_type === "SEPARADAS") maxPerDay = 1;
      if (first.grouping_type === "DUPLAS") maxPerDay = Math.max(maxPerDay, 2);

      const maxDays = Math.min(first.max_days_of_lessons, days.size);
      const capacity = maxPerDay * maxDays;

      if (lessonUnits.length > capacity) {
        errors.push({
          code: "LESSON_DAILY_LIMIT_TOO_LOW",
          lesson_id: lessonId,
          title: `Configuração de tempos inconsistente (${first.subject_name})`,
          message: `A aula de ${first.subject_name} possui mais tempos (${lessonUnits.length}) do que cabe nos limites de máximo por dia (${maxPerDay}) e máximo de dias (${maxDays}).`,
        });
      }
    }

    // 2. Teacher daily limit and availability
    for (const [teacherId, teacherUnits] of unitsByTeacher.entries()) {
      const teacher = teacherMap.get(teacherId);
      if (!teacher) continue;

      if (teacher.min_lessons_day > teacher.max_lessons_day) {
        errors.push({
          code: "TEACHER_MIN_GREATER_THAN_MAX",
          teacher_id: teacherId,
          title: `Limites inválidos para ${teacher.name}`,
          message: `O professor ${teacher.name} possui mínimo de aulas por dia (${teacher.min_lessons_day}) maior que o máximo (${teacher.max_lessons_day}).`,
        });
      }

      const capacity = teacher.max_lessons_day * days.size;
      if (teacherUnits.length > capacity) {
        errors.push({
          code: "TEACHER_DAILY_LIMIT_TOO_LOW",
          teacher_id: teacherId,
          title: `Carga horária excessiva para ${teacher.name}`,
          message: `O professor ${teacher.name} possui ${teacherUnits.length} aulas na semana, excedendo a capacidade do limite diário (${capacity}).`,
        });
      }

      const unavailableCount = slots.filter((s) =>
        teacherUnavailable.has(`${teacherId}_${s.period_id}_${s.day}`)
      ).length;
      const availableCount = slots.length - unavailableCount;

      if (teacherUnits.length > availableCount) {
        errors.push({
          code: "TEACHER_INSUFFICIENT_AVAILABILITY",
          teacher_id: teacherId,
          title: `Disponibilidade de ${teacher.name} insuficiente`,
          message: `O professor ${teacher.name} precisa lecionar ${teacherUnits.length} tempos na semana, mas possui apenas ${availableCount} horários disponíveis na sua grade.`,
        });
      }
    }

    // 3. Class insufficient slots
    const classNameMap = new Map(schoolClasses.map((c) => [Number(c.id), c.name]));
    for (const [classId, classUnits] of unitsByClass.entries()) {
      const className = classNameMap.get(classId);
      if (!className) continue;

      const allowedShifts = classShifts.get(classId) || [];
      const classSlots = slots.filter(
        (s) =>
          (allowedShifts.length === 0 || allowedShifts.includes(s.shift)) &&
          !classUnavailable.has(`${classId}_${s.period_id}_${s.day}`)
      );

      if (classUnits.length > classSlots.length) {
        errors.push({
          code: "CLASS_INSUFFICIENT_SLOTS",
          class_id: classId,
          title: `Aulas excessivas na turma ${className}`,
          message: `A turma ${className} tem ${classUnits.length} tempos de aula cadastrados, mas possui apenas ${classSlots.length} períodos disponíveis na grade.`,
        });
      }
    }

    // 4. Units with no common compatible slots (teacher + class + room)
    for (const unit of units) {
      const validSlots = slots.filter((s) => !isSlotForbidden(unit, s));
      if (validSlots.length === 0) {
        const tNames = unit.teacher_ids
          .map((id) => teacherMap.get(id)?.name)
          .filter(Boolean)
          .join(", ");
        const cNames = unit.class_ids
          .map((id) => classNameMap.get(id))
          .filter(Boolean)
          .join(", ");

        errors.push({
          code: "LESSON_NO_COMMON_SLOTS",
          lesson_id: unit.lesson_id,
          title: `Conflito de horários: ${unit.subject_name}`,
          message: `A aula de ${unit.subject_name} (${cNames}) não possui nenhum horário compatível onde o professor (${tNames}) e a turma estejam simultaneamente disponíveis.`,
        });
      }
    }

    if (errors.length === 0) {
      errors.push({
        code: "UNSATISFIABLE_CONSTRAINTS",
        title: "Conflito de Regras",
        message:
          "Não foi possível alocar todas as aulas respeitando simultaneamente todas as restrições de professores, salas e turmas.",
      });
    }

    return errors;
  }
}

export class ScheduleGenerationService {
  static async run({
    projectId,
    user,
    persist = true,
    classIds = null,
  }: {
    projectId: bigint;
    user: Parameters<typeof PlanService.isSubscriptionActive>[0];
    persist?: boolean;
    classIds?: number[] | null;
  }) {
    if (user && !(await PlanService.isSubscriptionActive(user))) {
      throw new Error("Você precisa de uma assinatura ativa para gerar horários.");
    }

    const now = new Date();
    const run = await prisma.solver_schedulegenerationrun.create({
      data: {
        project_id: projectId,
        created_by_id: user ? user.id : null,
        status: "RUNNING",
        diagnostics: {},
        started_at: now,
      },
    });

    const result = await ScheduleSolver.solve(projectId, classIds);
    const finishedAt = new Date();

    const updatedRun = await prisma.solver_schedulegenerationrun.update({
      where: { id: run.id },
      data: {
        status: result.status,
        objective_value: result.objective_value,
        diagnostics: result.diagnostics as object,
        finished_at: finishedAt,
      },
    });

    if (
      persist &&
      (result.status === "SATISFIABLE" || result.status === "PARTIAL") &&
      result.entries.length > 0
    ) {
      await prisma.solver_generatedscheduleentry.createMany({
        data: result.entries.map((entry) => ({
          run_id: updatedRun.id,
          lesson_id: BigInt(entry.lesson_id),
          lesson_index: entry.lesson_index,
          school_class_id: BigInt(entry.school_class_id),
          teacher_id: entry.teacher_id ? BigInt(entry.teacher_id) : null,
          room_id: entry.room_id ? BigInt(entry.room_id) : null,
          period_id: BigInt(entry.period_id),
          day_of_week: entry.day_of_week,
          is_locked: entry.is_locked,
          created_at: finishedAt,
        })),
      });
    }

    return {
      run: {
        id: Number(updatedRun.id),
        status: updatedRun.status,
        objective_value: updatedRun.objective_value,
        diagnostics: updatedRun.diagnostics,
        started_at: updatedRun.started_at,
        finished_at: updatedRun.finished_at,
      },
      entries: result.entries,
    };
  }
}
