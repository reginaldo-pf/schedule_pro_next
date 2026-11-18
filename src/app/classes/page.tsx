import { requireShellContext } from "@/lib/shell-context";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { ClassesClient } from "@/components/crud/ClassesClient";

export default async function ClassesPage() {
  const {
    activeProject,
    shellUser,
    shellProject,
    shellProjects,
    shellSubscription,
  } = await requireShellContext({ requireProject: true });

  const [classes, groups, rooms] = await Promise.all([
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
  ]);

  const serializedClasses = classes.map((c) => ({
    id: Number(c.id),
    name: c.name,
    color: c.color,
    level: c.level,
    group_id: Number(c.group_id),
    group_name: c.groups_group.name,
    room_id: c.room_id ? Number(c.room_id) : null,
    room_name: c.rooms_room?.name || "",
    shifts: c.shifts || [],
    active: c.active,
  }));

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
        groups={groups.map((g) => ({ id: Number(g.id), name: g.name }))}
        rooms={rooms.map((r) => ({ id: Number(r.id), name: r.name }))}
      />
    </AppShell>
  );
}
