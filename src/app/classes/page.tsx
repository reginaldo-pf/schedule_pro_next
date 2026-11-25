import { requireShellContext } from "@/lib/shell-context";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { ClassesClient } from "@/components/crud/ClassesClient";
import { formatGroupSelectLabel } from "@/lib/schedule/group-helpers";
import { ACTIVE_RUN_STATUSES } from "@/lib/schedule/collision-engine";

export default async function ClassesPage() {
  const {
    activeProject,
    shellUser,
    shellProject,
    shellProjects,
    shellSubscription,
  } = await requireShellContext({ requireProject: true });

  const [classes, groups, rooms, latestRun, activeLessons] = await Promise.all([
    prisma.classes_schoolclass.findMany({
      where: { project_id: activeProject!.id },
      include: {
        groups_group: true,
        rooms_room: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.groups_group.findMany({
      where: { project_id: activeProject!.id },
      orderBy: { name: "asc" },
    }),
    prisma.rooms_room.findMany({
      where: { project_id: activeProject!.id, active: true },
      orderBy: { name: "asc" },
    }),
    prisma.solver_schedulegenerationrun.findFirst({
      where: {
        project_id: activeProject!.id,
        status: { in: [...ACTIVE_RUN_STATUSES] },
      },
      orderBy: [{ finished_at: "desc" }, { started_at: "desc" }],
      select: { id: true },
    }),
    prisma.lessons_lesson.findMany({
      where: {
        project_id: activeProject!.id,
        active: true,
      },
      select: {
        number_of_lessons: true,
        lessons_lesson_classes: {
          select: { schoolclass_id: true },
        },
      },
    }),
  ]);

  const allocatedByClass = new Map<number, number>();
  if (latestRun) {
    const grouped = await prisma.solver_generatedscheduleentry.groupBy({
      by: ["school_class_id"],
      where: { run_id: latestRun.id },
      _count: { _all: true },
    });
    for (const row of grouped) {
      allocatedByClass.set(Number(row.school_class_id), row._count._all);
    }
  }

  const totalByClass = new Map<number, number>();
  for (const l of activeLessons) {
    for (const lc of l.lessons_lesson_classes) {
      const cId = Number(lc.schoolclass_id);
      totalByClass.set(cId, (totalByClass.get(cId) || 0) + l.number_of_lessons);
    }
  }

  const serializedClasses = classes.map((c) => {
    const classId = Number(c.id);
    return {
      id: classId,
      name: c.name,
      color: c.color,
      level: c.level,
      group_id: Number(c.group_id),
      group_name: c.groups_group.name,
      group_period: c.groups_group.academic_period || "",
      group_status: c.groups_group.status || "PUBLISHED",
      room_id: c.room_id ? Number(c.room_id) : null,
      room_name: c.rooms_room?.name || "",
      shifts: c.shifts || [],
      active: c.active,
      allocated_lessons: allocatedByClass.get(classId) || 0,
      total_lessons: totalByClass.get(classId) || 0,
    };
  });

  return (
    <AppShell
      user={shellUser}
      activeProject={shellProject}
      projects={shellProjects}
      subscription={shellSubscription}
      breadcrumbs={[
        { label: shellProject?.name || "Projeto", url: "/projects" },
        { label: "Turmas" },
      ]}
    >
      <ClassesClient
        projectName={shellProject?.name || ""}
        classes={serializedClasses}
        groups={groups.map((g) => ({
          id: Number(g.id),
          name: formatGroupSelectLabel(g),
          status: g.status || "PUBLISHED",
        }))}
        rooms={rooms.map((r) => ({ id: Number(r.id), name: r.name }))}
      />
    </AppShell>
  );
}
