export const ACTIVE_RUN_STATUSES = ["SATISFIABLE", "PARTIAL", "MANUAL"] as const;

export const DAY_LABELS: Record<string, string> = {
  MONDAY: "Segunda-feira",
  TUESDAY: "Terça-feira",
  WEDNESDAY: "Quarta-feira",
  THURSDAY: "Quinta-feira",
  FRIDAY: "Sexta-feira",
  SATURDAY: "Sábado",
  SUNDAY: "Domingo",
};

export const DAY_SHORT_LABELS: Record<string, string> = {
  MONDAY: "Segunda",
  TUESDAY: "Terça",
  WEDNESDAY: "Quarta",
  THURSDAY: "Quinta",
  FRIDAY: "Sexta",
  SATURDAY: "Sábado",
  SUNDAY: "Domingo",
};

export const DAY_WEIGHTS: Record<string, number> = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
  SUNDAY: 7,
};

export interface BuilderLessonUnit {
  id: number; // lesson_id
  index: number; // lesson_index (1..number_of_lessons)
  total_index: number;
  subject_id: number;
  subject_name: string;
  subject_color: string;
  subject_text_color: string;
  room_id: number | null;
  class_ids: number[];
  class_names: string;
  class_groups: number[];
  class_levels: string[];
  teacher_ids: number[];
  teacher_names: string;
  assigned: boolean;
  day: string | null;
  period_id: number | null;
  is_locked: boolean;
  max_lessons_per_day: number;
  max_days_of_lessons: number;
  allow_consecutive_days: boolean;
  grouping_type: string; // INDIFERENTE | DUPLAS | SEPARADAS | SEQUENCIA
}

export interface BuilderPeriod {
  id: number;
  name: string;
  order: number;
  start_time: string;
  end_time: string;
  shift: string;
  period_type?: string;
}

export interface BuilderTeacher {
  id: number;
  name: string;
  max_lessons_day: number;
  min_lessons_day: number;
  max_lessons_level: number;
  max_lessons_group: number;
  reduce_days: boolean;
  reduce_windows: boolean;
}

export interface BuilderRoom {
  id: number;
  name: string;
  simultaneous_lessons: number;
}

export interface BuilderClass {
  id: number;
  group_id: number;
  name: string;
  level: string;
  shifts: string[];
}

export interface TeacherAvailabilityEntry {
  teacher_id: number;
  period_id: number;
  day_of_week: string;
  status: string; // UNAVAILABLE | UNDESIRED
  reason?: string;
  occupied_lesson_id?: number;
  occupied_class_name?: string;
  valid_from?: string | null;
  valid_until?: string | null;
}

export interface RoomAvailabilityEntry {
  room_id: number;
  period_id: number;
  day_of_week: string;
  status: string; // UNAVAILABLE | OCCUPIED
  reason?: string;
  occupied_lesson_id?: number;
  occupied_class_name?: string;
}

export interface ClassAvailabilityEntry {
  school_class_id: number;
  period_id: number;
  day_of_week: string;
  status: string; // UNAVAILABLE | OCCUPIED
  reason?: string;
  occupied_lesson_id?: number;
}

export interface SlotStatus {
  type: "blocked" | "undesired";
  reason: string;
}

export interface PedagogicalWarning {
  type: string;
  message: string;
}

/**
 * Evaluates whether a specific (day, periodId) slot is compatible, undesired, or blocked
 * for a given lesson unit, taking into account:
 * - Locked lessons already in the target slot
 * - Class allowed shifts & class unavailability/collisions (including shared classes)
 * - Multi-teacher availability & collisions across all classes in the project
 * - Room availability & simultaneous_lessons capacity across distinct lesson_ids
 * - Teacher undesired preferences
 */
export function evaluateSlotCompatibility({
  day,
  periodId,
  lesson,
  allUnitsInView,
  periods,
  classes,
  rooms,
  teacherAvailabilities,
  roomAvailabilities,
  classAvailabilities,
}: {
  day: string;
  periodId: number;
  lesson: BuilderLessonUnit;
  allUnitsInView: BuilderLessonUnit[];
  periods: BuilderPeriod[];
  classes: BuilderClass[];
  rooms: BuilderRoom[];
  teacherAvailabilities: TeacherAvailabilityEntry[];
  roomAvailabilities: RoomAvailabilityEntry[];
  classAvailabilities: ClassAvailabilityEntry[];
}): SlotStatus | null {
  if (!lesson || !day || !periodId) return null;

  // Lessons currently occupying this slot in the current class view
  const existingInSlot = allUnitsInView.filter(
    (l) =>
      l.assigned &&
      l.day === day &&
      l.period_id === periodId &&
      (l.id !== lesson.id || l.index !== lesson.index)
  );

  // 0. Check if target slot has a locked lesson that cannot be swapped out
  if (existingInSlot.some((l) => l.is_locked)) {
    return {
      type: "blocked",
      reason: "Horário travado com cadeado",
    };
  }

  const isSwappable = (l: BuilderLessonUnit) =>
    existingInSlot.some((sl) => sl.id === l.id && sl.index === l.index);

  const periodObj = periods.find((p) => p.id === periodId);

  // 1. Check class shift compatibility, class availability, and collisions across all classes of this lesson
  for (const cId of lesson.class_ids) {
    const cls = classes.find((c) => c.id === cId);
    if (
      cls &&
      cls.shifts &&
      cls.shifts.length > 0 &&
      periodObj &&
      !cls.shifts.includes(periodObj.shift)
    ) {
      return {
        type: "blocked",
        reason: `Fora do turno da turma ${cls.name}`,
      };
    }

    const cAv = classAvailabilities.find(
      (a) =>
        a.school_class_id === cId &&
        a.period_id === periodId &&
        a.day_of_week === day &&
        (a.status === "UNAVAILABLE" || a.status === "OCCUPIED") &&
        a.occupied_lesson_id !== lesson.id
    );
    if (cAv) {
      return {
        type: "blocked",
        reason: cAv.reason || `Turma ${cls?.name || ""} indisponível`,
      };
    }

    if (
      allUnitsInView.some(
        (l) =>
          l.assigned &&
          l.day === day &&
          l.period_id === periodId &&
          l.class_ids.includes(cId) &&
          (l.id !== lesson.id || l.index !== lesson.index) &&
          !isSwappable(l)
      )
    ) {
      return {
        type: "blocked",
        reason: "Turma já possui aula neste horário",
      };
    }
  }

  // 2. Check all teachers of this lesson (co-teaching aware) for unavailability and cross-class collisions
  for (const tId of lesson.teacher_ids) {
    const tAv = teacherAvailabilities.find(
      (a) =>
        a.teacher_id === tId &&
        a.period_id === periodId &&
        a.day_of_week === day &&
        a.status === "UNAVAILABLE" &&
        a.occupied_lesson_id !== lesson.id
    );
    if (tAv) {
      return {
        type: "blocked",
        reason: tAv.reason || "Professor indisponível",
      };
    }

    if (
      allUnitsInView.some(
        (l) =>
          l.assigned &&
          l.day === day &&
          l.period_id === periodId &&
          l.teacher_ids.includes(tId) &&
          (l.id !== lesson.id || l.index !== lesson.index) &&
          !isSwappable(l)
      )
    ) {
      return {
        type: "blocked",
        reason: "Professor já alocado neste horário",
      };
    }
  }

  // 3. Check room availability and simultaneous_lessons capacity across distinct lesson_ids
  if (lesson.room_id) {
    const adminUnavail = roomAvailabilities.find(
      (a) =>
        a.room_id === lesson.room_id &&
        a.period_id === periodId &&
        a.day_of_week === day &&
        a.status === "UNAVAILABLE"
    );
    if (adminUnavail) {
      return {
        type: "blocked",
        reason: adminUnavail.reason || "Sala indisponível",
      };
    }

    const room = rooms.find((r) => r.id === lesson.room_id);
    const limit = room ? room.simultaneous_lessons : 1;

    // Distinct lesson_ids occupying this room in other classes
    const occupiedLessonIds = new Set<number>();
    for (const rAv of roomAvailabilities) {
      if (
        rAv.room_id === lesson.room_id &&
        rAv.period_id === periodId &&
        rAv.day_of_week === day &&
        rAv.status === "OCCUPIED" &&
        rAv.occupied_lesson_id &&
        rAv.occupied_lesson_id !== lesson.id
      ) {
        occupiedLessonIds.add(rAv.occupied_lesson_id);
      }
    }

    // Also include non-swappable lessons in current view occupying this room
    for (const l of allUnitsInView) {
      if (
        l.assigned &&
        l.day === day &&
        l.period_id === periodId &&
        l.room_id === lesson.room_id &&
        l.id !== lesson.id &&
        !isSwappable(l)
      ) {
        occupiedLessonIds.add(l.id);
      }
    }

    if (occupiedLessonIds.size >= limit) {
      return {
        type: "blocked",
        reason: `Sala ${room?.name || ""} lotada (${limit}/${limit})`,
      };
    }
  }

  // 4. Check teacher UNDESIRED preference
  for (const tId of lesson.teacher_ids) {
    const undesired = teacherAvailabilities.find(
      (a) =>
        a.teacher_id === tId &&
        a.period_id === periodId &&
        a.day_of_week === day &&
        a.status === "UNDESIRED"
    );
    if (undesired) {
      return {
        type: "undesired",
        reason: "Horário indesejado pelo professor",
      };
    }
  }

  return null;
}

/**
 * Computes pedagogical warnings for the currently assigned lessons in the builder
 */
export function computePedagogicalWarnings({
  allUnitsInView,
  periods,
  teachers,
  teacherAvailabilities,
}: {
  allUnitsInView: BuilderLessonUnit[];
  periods: BuilderPeriod[];
  teachers: BuilderTeacher[];
  teacherAvailabilities: TeacherAvailabilityEntry[];
}): PedagogicalWarning[] {
  const warnings: PedagogicalWarning[] = [];
  const assignedLessons = allUnitsInView.filter((l) => l.assigned && l.day && l.period_id);

  // Group by lesson_id
  const lessonsGrouped = new Map<number, BuilderLessonUnit[]>();
  for (const unit of assignedLessons) {
    const arr = lessonsGrouped.get(unit.id) || [];
    arr.push(unit);
    lessonsGrouped.set(unit.id, arr);
  }

  for (const [, units] of lessonsGrouped.entries()) {
    const first = units[0];
    const name = first.subject_name;

    const dayCounts: Record<string, number> = {};
    for (const u of units) {
      if (u.day) {
        dayCounts[u.day] = (dayCounts[u.day] || 0) + 1;
      }
    }

    for (const [day, count] of Object.entries(dayCounts)) {
      let limit = first.max_lessons_per_day;
      if (first.grouping_type === "SEPARADAS") limit = 1;
      else if (first.grouping_type === "DUPLAS") limit = Math.max(limit, 2);

      if (count > limit) {
        warnings.push({
          type: "lesson_day_limit",
          message: `A disciplina ${name} tem ${count} aulas na ${DAY_LABELS[day] || day}, mas o limite diário é ${limit}.`,
        });
      }
    }

    if (first.grouping_type === "DUPLAS" || first.grouping_type === "SEQUENCIA") {
      for (const [day, count] of Object.entries(dayCounts)) {
        if (count > 1) {
          const dayUnits = units.filter((u) => u.day === day);
          const orderList = dayUnits
            .map((u) => {
              const pObj = periods.find((p) => p.id === u.period_id);
              return pObj ? pObj.order : 999;
            })
            .sort((a, b) => a - b);

          for (let idx = 0; idx < orderList.length - 1; idx++) {
            if (orderList[idx + 1] - orderList[idx] !== 1) {
              warnings.push({
                type: "double_lesson_split",
                message: `As aulas de ${name} na ${DAY_LABELS[day] || day} não estão em horários consecutivos (aulas ${first.grouping_type === "DUPLAS" ? "duplas" : "em sequência"} divididas).`,
              });
              break;
            }
          }
        }
      }
    }

    const activeDays = Object.keys(dayCounts);
    if (activeDays.length > first.max_days_of_lessons) {
      warnings.push({
        type: "lesson_days_limit",
        message: `A disciplina ${name} está alocada em ${activeDays.length} dias, mas o limite é ${first.max_days_of_lessons} dias na semana.`,
      });
    }

    if (!first.allow_consecutive_days) {
      const sortedWeights = activeDays
        .map((d) => DAY_WEIGHTS[d] || 0)
        .sort((a, b) => a - b);
      for (let idx = 0; idx < sortedWeights.length - 1; idx++) {
        if (sortedWeights[idx + 1] - sortedWeights[idx] === 1) {
          warnings.push({
            type: "consecutive_days_not_allowed",
            message: `A disciplina ${name} está alocada em dias consecutivos, o que não é permitido pelas configurações da aula.`,
          });
          break;
        }
      }
    } else if (activeDays.length > 1) {
      const sortedWeights = activeDays
        .map((d) => DAY_WEIGHTS[d] || 0)
        .sort((a, b) => a - b);
      const isContiguous =
        sortedWeights[sortedWeights.length - 1] - sortedWeights[0] ===
        sortedWeights.length - 1;
      if (!isContiguous) {
        warnings.push({
          type: "non_contiguous_days",
          message: `As aulas de ${name} estão configuradas para dias consecutivos (contíguos), mas possuem dias intercalados.`,
        });
      }
    }
  }

  // Teacher pedagogical checks
  for (const teacher of teachers) {
    const tId = teacher.id;
    const currentAssigned = assignedLessons.filter((l) =>
      l.teacher_ids.includes(tId)
    );
    const daysGrouped: Record<string, number> = {};
    for (const l of currentAssigned) {
      if (l.day) {
        daysGrouped[l.day] = (daysGrouped[l.day] || 0) + 1;
      }
    }

    const otherBusy = teacherAvailabilities.filter(
      (a) =>
        a.teacher_id === tId &&
        a.status === "UNAVAILABLE" &&
        a.occupied_lesson_id !== undefined
    );
    for (const a of otherBusy) {
      // Avoid double counting if it's the same shared lesson already in currentAssigned
      const alreadyCounted = currentAssigned.some(
        (l) =>
          l.id === a.occupied_lesson_id &&
          l.day === a.day_of_week &&
          l.period_id === a.period_id
      );
      if (!alreadyCounted) {
        daysGrouped[a.day_of_week] = (daysGrouped[a.day_of_week] || 0) + 1;
      }
    }

    const activeDays = Object.keys(daysGrouped);
    if (activeDays.length === 0) continue;

    for (const [day, count] of Object.entries(daysGrouped)) {
      if (count > teacher.max_lessons_day) {
        warnings.push({
          type: "teacher_max_lessons",
          message: `O professor ${teacher.name} tem ${count} aulas na ${DAY_LABELS[day] || day}, excedendo seu limite diário de ${teacher.max_lessons_day}.`,
        });
      }
    }

    let totalWeekly = 0;
    for (const day of activeDays) {
      totalWeekly += daysGrouped[day];
    }
    const remainder =
      teacher.min_lessons_day > 1 ? totalWeekly % teacher.min_lessons_day : 0;
    let remainderDayUsed = false;

    for (const day of activeDays) {
      const dayCount = daysGrouped[day];
      if (teacher.min_lessons_day > 1) {
        if (remainder > 0 && dayCount === remainder && !remainderDayUsed) {
          remainderDayUsed = true;
        } else if (dayCount < teacher.min_lessons_day) {
          warnings.push({
            type: "teacher_min_lessons",
            message: `O professor ${teacher.name} tem apenas ${dayCount} aula(s) na ${DAY_LABELS[day] || day}, abaixo do mínimo diário de ${teacher.min_lessons_day}.`,
          });
        }
      }
    }

    if (teacher.reduce_windows) {
      for (const day of activeDays) {
        const occupiedOrders: number[] = [];

        for (const l of currentAssigned) {
          if (l.day === day) {
            const pObj = periods.find((p) => p.id === l.period_id);
            if (pObj && !occupiedOrders.includes(pObj.order)) {
              occupiedOrders.push(pObj.order);
            }
          }
        }

        for (const a of otherBusy) {
          if (a.day_of_week === day) {
            const pObj = periods.find((p) => p.id === a.period_id);
            if (pObj && !occupiedOrders.includes(pObj.order)) {
              occupiedOrders.push(pObj.order);
            }
          }
        }

        if (occupiedOrders.length > 1) {
          occupiedOrders.sort((a, b) => a - b);
          const minOrder = occupiedOrders[0];
          const maxOrder = occupiedOrders[occupiedOrders.length - 1];

          for (let orderVal = minOrder + 1; orderVal < maxOrder; orderVal++) {
            if (!occupiedOrders.includes(orderVal)) {
              warnings.push({
                type: "teacher_window",
                message: `O professor ${teacher.name} possui uma janela na ${DAY_LABELS[day] || day} no ${orderVal}º horário.`,
              });
            }
          }
        }
      }
    }
  }

  return warnings;
}
