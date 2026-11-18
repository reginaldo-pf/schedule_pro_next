import { requireShellContext } from "@/lib/shell-context";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { RoomsClient } from "@/components/crud/RoomsClient";

export default async function RoomsPage() {
  const {
    activeProject,
    shellUser,
    shellProject,
    shellProjects,
    shellSubscription,
  } = await requireShellContext({ requireProject: true });

  const rooms = await prisma.rooms_room.findMany({
    where: { project_id: activeProject!.id },
    include: {
      _count: {
        select: {
          lessons_lesson: true,
          subjects_subject: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const serialized = rooms.map((r) => ({
    id: Number(r.id),
    name: r.name,
    description: r.description,
    capacity: r.capacity,
    simultaneous_lessons: r.simultaneous_lessons,
    active: r.active,
    lessons_count: r._count.lessons_lesson + r._count.subjects_subject,
  }));

  return (
    <AppShell
      user={shellUser}
      activeProject={shellProject}
      projects={shellProjects}
      subscription={shellSubscription}
      breadcrumbs={[
        { label: shellProject?.name || "Projeto", url: "/projects" },
        { label: "Salas" },
      ]}
    >
      <RoomsClient projectName={shellProject?.name || ""} rooms={serialized} />
    </AppShell>
  );
}
