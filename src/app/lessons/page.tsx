import { requireShellContext } from "@/lib/shell-context";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { LessonsClient } from "@/components/crud/LessonsClient";

export default async function LessonsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const {
    activeProject,
    shellUser,
    shellProject,
    shellProjects,
    shellSubscription,
  } = await requireShellContext({ requireProject: true });

  const sp = await searchParams;
  const rawGroup = (sp.group || "").trim();
  const rawQuery = (sp.q || "").trim();
  const selectedGroupValue =
    rawGroup === "ALL" ? "ALL" : rawGroup && Number(rawGroup) ? rawGroup : "";
  const selectedGroupId =
    selectedGroupValue && selectedGroupValue !== "ALL"
      ? Number(selectedGroupValue)
      : null;
  const shouldLoadLessons = Boolean(selectedGroupValue || rawQuery);

  const [lessons, groups, classes, subjects, teachers, rooms] =
    await Promise.all([
      shouldLoadLessons
        ? prisma.lessons_lesson.findMany({
            where: {
              project_id: activeProject!.id,
              ...(selectedGroupId
                ? { subjects_subject: { group_id: BigInt(selectedGroupId) } }
                : {}),
              ...(rawQuery
                ? {
                    OR: [
                      {
                        subjects_subject: {
                          name: { contains: rawQuery, mode: "insensitive" },
                        },
                      },
                      {
                        lessons_lesson_teachers: {
                          some: {
                            teachers_teacher: {
                              name: { contains: rawQuery, mode: "insensitive" },
                            },
                          },
                        },
                      },
                    ],
                  }
                : {}),
            },
            include: {
              subjects_subject: {
                include: { groups_group: true, rooms_room: true },
              },
              rooms_room: true,
              lessons_lesson_classes: {
                include: { classes_schoolclass: true },
              },
              lessons_lesson_teachers: {
                include: { teachers_teacher: true },
              },
            },
            orderBy: [{ subjects_subject: { name: "asc" } }, { id: "asc" }],
          })
        : Promise.resolve([]),
      prisma.groups_group.findMany({
        where: { project_id: activeProject!.id },
        orderBy: { name: "asc" },
      }),
      prisma.classes_schoolclass.findMany({
        where: { project_id: activeProject!.id, active: true },
        orderBy: { name: "asc" },
      }),
      prisma.subjects_subject.findMany({
        where: { project_id: activeProject!.id, active: true },
        orderBy: { name: "asc" },
      }),
      prisma.teachers_teacher.findMany({
        where: { project_id: activeProject!.id, active: true },
        orderBy: { name: "asc" },
      }),
      prisma.rooms_room.findMany({
        where: { project_id: activeProject!.id, active: true },
        orderBy: { name: "asc" },
      }),
    ]);

  const serializedLessons = lessons.map((l) => ({
    id: Number(l.id),
    subject_id: Number(l.subject_id),
    subject_name: l.subjects_subject.name,
    subject_color: l.subjects_subject.color,
    group_id: Number(l.subjects_subject.group_id),
    group_name: l.subjects_subject.groups_group.name,
    room_id: l.room_id ? Number(l.room_id) : null,
    room_name:
      l.rooms_room?.name || l.subjects_subject.rooms_room?.name || "Não definida",
    class_ids: l.lessons_lesson_classes.map((lc) => Number(lc.schoolclass_id)),
    class_names: l.lessons_lesson_classes
      .map((lc) => lc.classes_schoolclass.name)
      .join(", "),
    teacher_ids: l.lessons_lesson_teachers.map((lt) => Number(lt.teacher_id)),
    teacher_names: l.lessons_lesson_teachers
      .map((lt) => lt.teachers_teacher.name)
      .join(", "),
    number_of_lessons: l.number_of_lessons,
    max_lessons_per_day: l.max_lessons_per_day,
    max_days_of_lessons: l.max_days_of_lessons,
    grouping_type: l.grouping_type,
    allow_consecutive_days: l.allow_consecutive_days,
    active: l.active,
  }));

  return (
    <AppShell
      user={shellUser}
      activeProject={shellProject}
      projects={shellProjects}
      subscription={shellSubscription}
      breadcrumbs={[
        { label: shellProject?.name || "Projeto", url: "/projects" },
        { label: "Matriz de Aulas" },
      ]}
    >
      <LessonsClient
        projectName={shellProject?.name || ""}
        lessons={serializedLessons}
        groups={groups.map((g) => ({
          id: Number(g.id),
          name: g.academic_period ? `${g.name} (${g.academic_period})` : g.name,
        }))}
        classes={classes.map((c) => ({
          id: Number(c.id),
          group_id: Number(c.group_id),
          name: c.name,
        }))}
        subjects={subjects.map((s) => ({
          id: Number(s.id),
          group_id: Number(s.group_id),
          room_id: s.room_id ? Number(s.room_id) : null,
          name: s.name,
        }))}
        teachers={teachers.map((t) => ({ id: Number(t.id), name: t.name }))}
        rooms={rooms.map((r) => ({ id: Number(r.id), name: r.name }))}
        selectedGroup={selectedGroupValue}
        initialQuery={rawQuery}
      />
    </AppShell>
  );
}
