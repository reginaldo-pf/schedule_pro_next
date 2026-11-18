import { prisma, formatTime } from "../prisma";
import { ACTIVE_RUN_STATUSES, DAY_SHORT_LABELS } from "./collision-engine";

export interface ReportEntryCell {
  lesson_id: number;
  subject_name: string;
  subject_abbreviated: string;
  subject_color: string;
  teacher_names: string;
  class_name: string;
  group_name: string;
  room_name: string;
}

export interface ReportTimelineRow {
  type: "period" | "interval";
  period_type: string;
  period: {
    id: number;
    name: string;
    start_time: string;
    end_time: string;
    shift: string;
    period_type: string;
    order: number;
  };
}

export interface CourseReportPage {
  group: { id: number; name: string };
  school_class: { id: number; name: string; color: string; level: string };
  room_name: string;
  matrix: Record<string, Record<number, ReportEntryCell>>;
  timeline_rows: ReportTimelineRow[];
  lesson_count: number;
  header_info: {
    class_name: string;
    group_name: string;
    room_name: string;
  };
}

export interface TeacherReportPage {
  teacher: { id: number; name: string; short_name: string; color: string; email: string | null };
  group_names: string;
  matrix: Record<string, Record<number, ReportEntryCell>>;
  timeline_rows: ReportTimelineRow[];
  lesson_count: number;
  header_info: {
    teacher_name: string;
    group_names: string;
  };
}

export function getActiveProjectDaysList(project: {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
}): { code: string; label: string }[] {
  const days: [string, boolean][] = [
    ["MONDAY", project.monday],
    ["TUESDAY", project.tuesday],
    ["WEDNESDAY", project.wednesday],
    ["THURSDAY", project.thursday],
    ["FRIDAY", project.friday],
    ["SATURDAY", project.saturday],
    ["SUNDAY", project.sunday],
  ];
  return days
    .filter(([, enabled]) => enabled)
    .map(([code]) => ({ code, label: DAY_SHORT_LABELS[code] || code }));
}

export async function buildCourseReportPages({
  projectId,
  groupId,
  classId,
}: {
  projectId: bigint;
  groupId?: number | null;
  classId?: number | null;
}): Promise<{ pages: CourseReportPage[]; generatedAt: string }> {
  const latestRun = await prisma.solver_schedulegenerationrun.findFirst({
    where: {
      project_id: projectId,
      status: { in: [...ACTIVE_RUN_STATUSES] },
    },
    orderBy: [{ finished_at: "desc" }, { started_at: "desc" }],
  });

  if (!latestRun) {
    return { pages: [], generatedAt: "" };
  }

  const [entries, periods, groups] = await Promise.all([
    prisma.solver_generatedscheduleentry.findMany({
      where: {
        run_id: latestRun.id,
        ...(classId ? { school_class_id: BigInt(classId) } : {}),
        ...(groupId ? { classes_schoolclass: { group_id: BigInt(groupId) } } : {}),
      },
      include: {
        classes_schoolclass: {
          include: {
            groups_group: true,
            rooms_room: true,
          },
        },
        teachers_teacher: true,
        rooms_room: true,
        periods_period: true,
        lessons_lesson: {
          include: {
            subjects_subject: {
              include: { rooms_room: true },
            },
            lessons_lesson_teachers: {
              include: { teachers_teacher: true },
            },
          },
        },
      },
    }),
    prisma.periods_period.findMany({
      where: { project_id: projectId },
      orderBy: [{ start_time: "asc" }, { order: "asc" }],
    }),
    prisma.groups_group.findMany({
      where: {
        project_id: projectId,
        ...(groupId ? { id: BigInt(groupId) } : {}),
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const pages: CourseReportPage[] = [];

  for (const group of groups) {
    const groupEntries = entries.filter(
      (e) => e.classes_schoolclass.group_id === group.id
    );

    const uniqueClassesMap = new Map<
      number,
      (typeof groupEntries)[number]["classes_schoolclass"]
    >();
    for (const e of groupEntries) {
      uniqueClassesMap.set(Number(e.school_class_id), e.classes_schoolclass);
    }
    const sortedClasses = Array.from(uniqueClassesMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    for (const sc of sortedClasses) {
      const classEntries = groupEntries.filter((e) => e.school_class_id === sc.id);
      const matrix: Record<string, Record<number, ReportEntryCell>> = {};
      const roomNamesSet = new Set<string>();

      for (const entry of classEntries) {
        if (!matrix[entry.day_of_week]) {
          matrix[entry.day_of_week] = {};
        }
        const teachersList = entry.lessons_lesson.lessons_lesson_teachers.map(
          (lt) => lt.teachers_teacher.short_name || lt.teachers_teacher.name
        );
        const teacherNames =
          teachersList.length > 0
            ? teachersList.join(", ")
            : entry.teachers_teacher?.short_name || entry.teachers_teacher?.name || "";

        const resolvedRoomName =
          entry.rooms_room?.name ||
          entry.lessons_lesson.subjects_subject?.rooms_room?.name ||
          sc.rooms_room?.name ||
          "";
        if (resolvedRoomName) {
          roomNamesSet.add(resolvedRoomName);
        }

        matrix[entry.day_of_week][Number(entry.period_id)] = {
          lesson_id: Number(entry.lesson_id),
          subject_name: entry.lessons_lesson.subjects_subject.name,
          subject_abbreviated: entry.lessons_lesson.subjects_subject.abbreviated_name,
          subject_color: entry.lessons_lesson.subjects_subject.color,
          teacher_names: teacherNames,
          class_name: sc.name,
          group_name: group.name,
          room_name: resolvedRoomName,
        };
      }

      const activeClassPeriodIds = new Set(
        classEntries.map((e) => Number(e.period_id))
      );
      const activeClassShifts = new Set<string>();
      for (const p of periods) {
        if (activeClassPeriodIds.has(Number(p.id))) {
          activeClassShifts.add(p.shift);
        }
      }

      const timelineRows: ReportTimelineRow[] = [];
      for (const p of periods) {
        if (activeClassShifts.size > 0) {
          if (!activeClassShifts.has(p.shift)) continue;
        } else if (sc.shifts && sc.shifts.length > 0 && !sc.shifts.includes(p.shift)) {
          continue;
        }
        timelineRows.push({
          type: p.period_type === "CLASS" ? "period" : "interval",
          period_type: p.period_type,
          period: {
            id: Number(p.id),
            name: p.name,
            start_time: formatTime(p.start_time),
            end_time: formatTime(p.end_time),
            shift: p.shift,
            period_type: p.period_type,
            order: p.order,
          },
        });
      }

      while (timelineRows.length > 0 && timelineRows[0].type === "interval") {
        timelineRows.shift();
      }
      while (
        timelineRows.length > 0 &&
        timelineRows[timelineRows.length - 1].type === "interval"
      ) {
        timelineRows.pop();
      }

      const roomName =
        roomNamesSet.size > 0
          ? Array.from(roomNamesSet).sort().join(", ")
          : sc.rooms_room?.name || "";

      pages.push({
        group: { id: Number(group.id), name: group.name },
        school_class: {
          id: Number(sc.id),
          name: sc.name,
          color: sc.color,
          level: sc.level,
        },
        room_name: roomName,
        matrix,
        timeline_rows: timelineRows,
        lesson_count: classEntries.length,
        header_info: {
          class_name: sc.name,
          group_name: group.name,
          room_name: roomName,
        },
      });
    }
  }

  const generatedAt = latestRun.started_at.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return { pages, generatedAt };
}

export async function buildTeacherReportPages({
  projectId,
  teacherId,
  groupId,
}: {
  projectId: bigint;
  teacherId?: number | null;
  groupId?: number | null;
}): Promise<{ pages: TeacherReportPage[]; generatedAt: string }> {
  const latestRun = await prisma.solver_schedulegenerationrun.findFirst({
    where: {
      project_id: projectId,
      status: { in: [...ACTIVE_RUN_STATUSES] },
    },
    orderBy: [{ finished_at: "desc" }, { started_at: "desc" }],
  });

  if (!latestRun) {
    return { pages: [], generatedAt: "" };
  }

  const [entries, periods, teachers] = await Promise.all([
    prisma.solver_generatedscheduleentry.findMany({
      where: {
        run_id: latestRun.id,
      },
      include: {
        classes_schoolclass: {
          include: { groups_group: true, rooms_room: true },
        },
        teachers_teacher: true,
        rooms_room: true,
        periods_period: true,
        lessons_lesson: {
          include: {
            subjects_subject: { include: { rooms_room: true } },
            lessons_lesson_teachers: { include: { teachers_teacher: true } },
          },
        },
      },
    }),
    prisma.periods_period.findMany({
      where: { project_id: projectId },
      orderBy: [{ start_time: "asc" }, { order: "asc" }],
    }),
    prisma.teachers_teacher.findMany({
      where: {
        project_id: projectId,
        active: true,
        ...(teacherId ? { id: BigInt(teacherId) } : {}),
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const pages: TeacherReportPage[] = [];

  for (const teacher of teachers) {
    // Match both direct teacher_id and co-teaching lessons_lesson_teachers
    const teacherEntries = entries.filter((e) => {
      if (groupId && Number(e.classes_schoolclass.group_id) !== Number(groupId)) {
        return false;
      }
      if (e.teacher_id === teacher.id) return true;
      return e.lessons_lesson.lessons_lesson_teachers.some(
        (lt) => lt.teacher_id === teacher.id
      );
    });

    if (teacherEntries.length === 0) continue;

    const matrix: Record<string, Record<number, ReportEntryCell>> = {};
    const activePeriodIds = new Set<number>();
    const groupNamesSet = new Set<string>();

    for (const entry of teacherEntries) {
      if (!matrix[entry.day_of_week]) {
        matrix[entry.day_of_week] = {};
      }
      const pId = Number(entry.period_id);
      activePeriodIds.add(pId);
      if (entry.classes_schoolclass.groups_group?.name) {
        groupNamesSet.add(entry.classes_schoolclass.groups_group.name);
      }

      const resolvedRoomName =
        entry.rooms_room?.name ||
        entry.lessons_lesson.subjects_subject?.rooms_room?.name ||
        entry.classes_schoolclass.rooms_room?.name ||
        "";

      matrix[entry.day_of_week][pId] = {
        lesson_id: Number(entry.lesson_id),
        subject_name: entry.lessons_lesson.subjects_subject.name,
        subject_abbreviated: entry.lessons_lesson.subjects_subject.abbreviated_name,
        subject_color: entry.lessons_lesson.subjects_subject.color,
        teacher_names: teacher.short_name || teacher.name,
        class_name: entry.classes_schoolclass.name,
        group_name: entry.classes_schoolclass.groups_group.name,
        room_name: resolvedRoomName,
      };
    }

    const activeShifts = new Set<string>();
    for (const p of periods) {
      if (activePeriodIds.has(Number(p.id))) {
        activeShifts.add(p.shift);
      }
    }

    const timelineRows: ReportTimelineRow[] = [];
    for (const p of periods) {
      if (activeShifts.has(p.shift)) {
        timelineRows.push({
          type: p.period_type === "CLASS" ? "period" : "interval",
          period_type: p.period_type,
          period: {
            id: Number(p.id),
            name: p.name,
            start_time: formatTime(p.start_time),
            end_time: formatTime(p.end_time),
            shift: p.shift,
            period_type: p.period_type,
            order: p.order,
          },
        });
      }
    }

    while (timelineRows.length > 0 && timelineRows[0].type === "interval") {
      timelineRows.shift();
    }
    while (
      timelineRows.length > 0 &&
      timelineRows[timelineRows.length - 1].type === "interval"
    ) {
      timelineRows.pop();
    }

    const groupNames = Array.from(groupNamesSet).sort().join(", ");

    pages.push({
      teacher: {
        id: Number(teacher.id),
        name: teacher.name,
        short_name: teacher.short_name,
        color: teacher.color,
        email: teacher.email,
      },
      group_names: groupNames,
      matrix,
      timeline_rows: timelineRows,
      lesson_count: teacherEntries.length,
      header_info: {
        teacher_name: teacher.name,
        group_names: groupNames,
      },
    });
  }

  const generatedAt = latestRun.started_at.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return { pages, generatedAt };
}
