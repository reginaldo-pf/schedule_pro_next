import { requireShellContext } from "@/lib/shell-context";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { GroupsClient } from "@/components/crud/GroupsClient";

function formatUserLabel(u: {
  first_name: string;
  last_name: string;
  username: string;
}): string {
  const full = `${u.first_name || ""} ${u.last_name || ""}`.trim();
  return full ? `${full} (@${u.username})` : u.username;
}

export default async function GroupsPage() {
  const {
    user,
    activeProject,
    shellUser,
    shellProject,
    shellProjects,
    shellSubscription,
  } = await requireShellContext({ requireProject: true });

  const [groups, projectOwner, coordinatorParticipants] = await Promise.all([
    prisma.groups_group.findMany({
      where: { project_id: activeProject!.id },
      include: {
        accounts_user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            username: true,
            email: true,
          },
        },
        _count: {
          select: {
            classes_schoolclass: true,
            subjects_subject: true,
          },
        },
      },
      orderBy: [{ name: "asc" }, { academic_period: "desc" }],
    }),
    prisma.accounts_user.findUnique({
      where: { id: activeProject!.owner_id },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        username: true,
        email: true,
      },
    }),
    prisma.schedules_projectparticipant.findMany({
      where: {
        project_id: activeProject!.id,
        role: "coordinator",
        active: true,
      },
      include: {
        accounts_user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            username: true,
            email: true,
          },
        },
      },
    }),
  ]);

  const coordinatorMap = new Map<
    number,
    { id: number; name: string; email: string; is_project_owner: boolean }
  >();
  if (projectOwner) {
    coordinatorMap.set(Number(projectOwner.id), {
      id: Number(projectOwner.id),
      name: formatUserLabel(projectOwner),
      email: projectOwner.email,
      is_project_owner: true,
    });
  }
  for (const pp of coordinatorParticipants) {
    const u = pp.accounts_user;
    if (!coordinatorMap.has(Number(u.id))) {
      coordinatorMap.set(Number(u.id), {
        id: Number(u.id),
        name: formatUserLabel(u),
        email: u.email,
        is_project_owner: false,
      });
    }
  }
  if (user.is_superuser && !coordinatorMap.has(Number(user.id))) {
    coordinatorMap.set(Number(user.id), {
      id: Number(user.id),
      name: formatUserLabel(user),
      email: user.email,
      is_project_owner: false,
    });
  }

  const isAdmin = user.is_superuser || activeProject!.owner_id === user.id;

  const serialized = groups.map((g) => ({
    id: Number(g.id),
    name: g.name,
    academic_period: g.academic_period || "",
    start_date: g.start_date ? g.start_date.toISOString().slice(0, 10) : "",
    end_date: g.end_date ? g.end_date.toISOString().slice(0, 10) : "",
    status: g.status || "PUBLISHED",
    owner_id: g.owner_id ? Number(g.owner_id) : null,
    owner_name: g.accounts_user ? formatUserLabel(g.accounts_user) : "",
    can_transfer_ownership: isAdmin || g.owner_id === user.id,
    can_revoke_ownership: isAdmin && g.owner_id !== null,
    can_edit: isAdmin || g.owner_id === user.id,
    can_delete_inactive: isAdmin || g.owner_id === user.id,
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
        coordinators={Array.from(coordinatorMap.values())}
        currentUserId={Number(user.id)}
      />
    </AppShell>
  );
}
