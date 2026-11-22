import { requireShellContext } from "@/lib/shell-context";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { SubjectsClient } from "@/components/crud/SubjectsClient";

export default async function SubjectsPage() {
  const {
    activeProject,
    shellUser,
    shellProject,
    shellProjects,
    shellSubscription,
  } = await requireShellContext({ requireProject: true });

  const [subjects, groups, rooms] = await Promise.all([
    prisma.subjects_subject.findMany({
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

  const serializedSubjects = subjects.map((s) => ({
    id: Number(s.id),
    name: s.name,
    abbreviated_name: s.abbreviated_name,
    color: s.color,
    group_id: Number(s.group_id),
    group_name: s.groups_group.name,
    room_id: s.room_id ? Number(s.room_id) : null,
    room_name: s.rooms_room?.name || "",
    active: s.active,
  }));

  return (
    <AppShell
      user={shellUser}
      activeProject={shellProject}
      projects={shellProjects}
      subscription={shellSubscription}
      breadcrumbs={[
        { label: shellProject?.name || "Projeto", url: "/projects" },
        { label: "Disciplinas" },
      ]}
    >
      <SubjectsClient
        projectName={shellProject?.name || ""}
        subjects={serializedSubjects}
        groups={groups.map((g) => ({
          id: Number(g.id),
          name: g.academic_period ? `${g.name} (${g.academic_period})` : g.name,
        }))}
        rooms={rooms.map((r) => ({ id: Number(r.id), name: r.name }))}
      />
    </AppShell>
  );
}
