import { requireShellContext } from "@/lib/shell-context";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { GroupsClient } from "@/components/crud/GroupsClient";

export default async function GroupsPage() {
  const {
    user,
    activeProject,
    shellUser,
    shellProject,
    shellProjects,
    shellSubscription,
  } = await requireShellContext({ requireProject: true });

  const groups = await prisma.groups_group.findMany({
    where: { project_id: activeProject!.id },
    include: {
      _count: {
        select: {
          classes_schoolclass: true,
          subjects_subject: true,
        },
      },
    },
    orderBy: [{ name: "asc" }, { academic_period: "desc" }],
  });

  const serialized = groups.map((g) => ({
    id: Number(g.id),
    name: g.name,
    academic_period: g.academic_period || "",
    start_date: g.start_date ? g.start_date.toISOString().slice(0, 10) : "",
    end_date: g.end_date ? g.end_date.toISOString().slice(0, 10) : "",
    status: g.status || "PUBLISHED",
    can_delete_inactive:
      user.is_superuser ||
      activeProject!.owner_id === user.id ||
      g.owner_id === user.id,
    classes_count: g._count.classes_schoolclass,
    subjects_count: g._count.subjects_subject,
  }));

  return (
    <AppShell
      user={shellUser}
      activeProject={shellProject}
      projects={shellProjects}
      subscription={shellSubscription}
      breadcrumbs={[
        { label: shellProject?.name || "Projeto", url: "/projects" },
        { label: "Grupos / Cursos" },
      ]}
    >
      <GroupsClient
        projectName={shellProject?.name || ""}
        groups={serialized}
      />
    </AppShell>
  );
}
