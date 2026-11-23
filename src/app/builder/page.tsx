import { requireShellContext } from "@/lib/shell-context";
import { prisma, formatTime } from "@/lib/prisma";
import { AccessControlService } from "@/lib/services/access-control";
import { ACTIVE_RUN_STATUSES } from "@/lib/schedule/collision-engine";
import { getActiveProjectDaysList } from "@/lib/schedule/report-builder";
import { formatGroupSelectLabel, toIsoDateStr } from "@/lib/schedule/group-helpers";
import { AppShell } from "@/components/layout/AppShell";
import { ScheduleBuilderClient } from "@/components/builder/ScheduleBuilderClient";

export default async function ScheduleBuilderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const {
    user,
    activeProject,
    shellUser,
    shellProject,
    shellProjects,
    shellSubscription,
  } = await requireShellContext({ requireProject: true });

  const sp = await searchParams;
  const initialGroupId = sp.group ? Number(sp.group) : null;
  const initialClassId = sp.class ? Number(sp.class) : null;

  const project = activeProject!;
  const days = getActiveProjectDaysList(project);

  const [
    periodsRaw,
    groups,
    classes,
    teachers,
    rooms,
    lessons,
    teacherAvs,
    roomAvs,
    classAvs,
    latestRun,
  ] = await Promise.all([
    prisma.periods_period.findMany({
      where: { project_id: project.id, period_type: "CLASS" },
      orderBy: [{ start_time: "asc" }, { order: "asc" }],
    }),
    prisma.groups_group.findMany({
      where: { project_id: project.id, status: { not: "INACTIVE" } },
      orderBy: [{ name: "asc" }, { academic_period: "desc" }],
    }),
    prisma.classes_schoolclass.findMany({
      where: {
        project_id: project.id,
        active: true,
        groups_group: { status: { not: "INACTIVE" } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.teachers_teacher.findMany({
      where: { project_id: project.id, active: true },
      orderBy: { name: "asc" },
    }),
    prisma.rooms_room.findMany({
      where: { project_id: project.id, active: true },
      orderBy: { name: "asc" },
    }),
    prisma.lessons_lesson.findMany({
      where: {
        project_id: project.id,
        active: true,
        subjects_subject: {
          groups_group: { status: { not: "INACTIVE" } },
        },
      },
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
      orderBy: { id: "asc" },
    }),
    prisma.availability_teacheravailability.findMany({
      where: { teachers_teacher: { project_id: project.id } },
    }),
    prisma.availability_roomavailability.findMany({
      where: { rooms_room: { project_id: project.id } },
    }),
    prisma.availability_schoolclassavailability.findMany({
      where: { classes_schoolclass: { project_id: project.id } },
    }),
    // Include PARTIAL runs so collisions and partial allocations are never lost!
    prisma.solver_schedulegenerationrun.findFirst({
      where: {
        project_id: project.id,
        status: { in: [...ACTIVE_RUN_STATUSES] },
      },
      orderBy: [{ finished_at: "desc" }, { started_at: "desc" }],
      include: {
        solver_generatedscheduleentry: {
          include: {
            classes_schoolclass: true,
            lessons_lesson: {
              include: {
                subjects_subject: true,
                lessons_lesson_teachers: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const serializedPeriods = periodsRaw.map((p) => ({
    id: Number(p.id),
    name: p.name,
    order: p.order,
    start_time: formatTime(p.start_time),
    end_time: formatTime(p.end_time),
    shift: p.shift,
  }));

  const serializedClasses = classes.map((c) => ({
    id: Number(c.id),
    group_id: Number(c.group_id),
    name: c.name,
    level: c.level,
    shifts: c.shifts || [],
  }));

  const serializedTeachers = teachers.map((t) => ({
    id: Number(t.id),
    name: t.name,
    max_lessons_day: t.max_lessons_day,
    min_lessons_day: t.min_lessons_day,
    max_lessons_level: t.max_lessons_level,
    max_lessons_group: t.max_lessons_group,
    reduce_days: t.reduce_days,
    reduce_windows: t.reduce_windows,
  }));

  const serializedRooms = rooms.map((r) => ({
    id: Number(r.id),
    name: r.name,
    simultaneous_lessons: r.simultaneous_lessons,
  }));

  const serializedLessons = lessons.map((l) => {
    const classObjs = l.lessons_lesson_classes.map(
      (lc) => lc.classes_schoolclass
    );
    const teacherObjs = l.lessons_lesson_teachers.map(
      (lt) => lt.teachers_teacher
    );
    const effectiveRoomId = l.room_id
      ? Number(l.room_id)
      : l.subjects_subject?.room_id
      ? Number(l.subjects_subject.room_id)
      : null;

    return {
      id: Number(l.id),
      number_of_lessons: l.number_of_lessons,
      subject_id: Number(l.subject_id),
      subject_name: l.subjects_subject.name,
      subject_color: l.subjects_subject.color || "#1e293b",
      room_id: effectiveRoomId,
      class_ids: classObjs.map((c) => Number(c.id)),
      class_names: classObjs.map((c) => c.name).join(", "),
      class_groups: Array.from(
        new Set(classObjs.map((c) => Number(c.group_id)))
      ),
      class_levels: Array.from(new Set(classObjs.map((c) => c.level))),
      teacher_ids: teacherObjs.map((t) => Number(t.id)),
      teacher_names: teacherObjs.map((t) => t.short_name || t.name).join(", "),
      max_lessons_per_day: l.max_lessons_per_day,
      max_days_of_lessons: l.max_days_of_lessons,
      allow_consecutive_days: l.allow_consecutive_days,
      grouping_type: l.grouping_type,
    };
  });

  const savedEntries = latestRun
    ? latestRun.solver_generatedscheduleentry.map((e) => ({
        lesson_id: Number(e.lesson_id),
        lesson_index: e.lesson_index,
        school_class_id: Number(e.school_class_id),
        school_class_name: e.classes_schoolclass.name,
        period_id: Number(e.period_id),
        day_of_week: e.day_of_week,
        is_locked: e.is_locked,
        room_id: e.room_id
          ? Number(e.room_id)
          : e.lessons_lesson.subjects_subject?.room_id
          ? Number(e.lessons_lesson.subjects_subject.room_id)
          : null,
        teacher_ids: e.lessons_lesson.lessons_lesson_teachers.map((lt) =>
          Number(lt.teacher_id)
        ),
      }))
    : [];

  return (
    <AppShell
      user={shellUser}
      activeProject={shellProject}
      projects={shellProjects}
      subscription={shellSubscription}
      breadcrumbs={[
        { label: shellProject?.name || "Projeto", url: "/projects" },
        { label: "Grade Horária" },
      ]}
    >
      <ScheduleBuilderClient
        project={{
          id: Number(project.id),
          name: project.name,
          institution_name: project.institution_name,
        }}
        days={days}
        periods={serializedPeriods}
        groups={groups.map((g) => ({
          id: Number(g.id),
          name: formatGroupSelectLabel(g),
          academic_period: g.academic_period || "",
          status: g.status || "PUBLISHED",
          start_date: toIsoDateStr(g.start_date),
          end_date: toIsoDateStr(g.end_date),
          can_edit:
            AccessControlService.isProjectAdmin(user, project) ||
            (g.owner_id !== null && g.owner_id === user.id),
        }))}
        classes={serializedClasses}
        teachers={serializedTeachers}
        rooms={serializedRooms}
        lessons={serializedLessons}
        initialSavedEntries={savedEntries}
        baseTeacherAvailabilities={teacherAvs.map((a) => ({
          teacher_id: Number(a.teacher_id),
          period_id: Number(a.period_id),
          day_of_week: a.day_of_week,
          status: a.status,
          valid_from: toIsoDateStr(a.valid_from),
          valid_until: toIsoDateStr(a.valid_until),
        }))}
        baseRoomAvailabilities={roomAvs.map((a) => ({
          room_id: Number(a.room_id),
          period_id: Number(a.period_id),
          day_of_week: a.day_of_week,
          status: a.status,
        }))}
        baseClassAvailabilities={classAvs.map((a) => ({
          school_class_id: Number(a.school_class_id),
          period_id: Number(a.period_id),
          day_of_week: a.day_of_week,
          status: a.status,
        }))}
        initialGroupId={initialGroupId}
        initialClassId={initialClassId}
        subscriptionValid={shellSubscription ? shellSubscription.isValid : false}
      />
    </AppShell>
  );
}
