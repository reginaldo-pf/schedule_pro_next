import { requireShellContext } from "@/lib/shell-context";
import { prisma, formatTime } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { ProjectsClient } from "@/components/projects/ProjectsClient";

export default async function ProjectsPage() {
  const {
    user,
    activeProject,
    shellUser,
    shellProject,
    shellProjects,
    shellSubscription,
  } = await requireShellContext();

  const projects = await prisma.schedules_project.findMany({
    where: user.is_superuser
      ? {}
      : {
          OR: [
            { owner_id: user.id },
            {
              schedules_projectparticipant: {
                some: { user_id: user.id, active: true },
              },
            },
          ],
        },
    include: {
      accounts_user: true,
      schedules_projectparticipant: {
        include: { accounts_user: true },
      },
      _count: {
        select: {
          classes_schoolclass: true,
          teachers_teacher: true,
          lessons_lesson: true,
        },
      },
    },
    orderBy: [{ id: "desc" }],
  });

  const serialized = projects.map((p) => ({
    id: Number(p.id),
    name: p.name,
    institution_name: p.institution_name,
    academic_period: p.academic_period,
    timezone: p.timezone,
    report_header: p.report_header,
    monday: p.monday,
    tuesday: p.tuesday,
    wednesday: p.wednesday,
    thursday: p.thursday,
    friday: p.friday,
    saturday: p.saturday,
    sunday: p.sunday,
    lunch_break_enabled: p.lunch_break_enabled,
    lunch_start: formatTime(p.lunch_start),
    lunch_end: formatTime(p.lunch_end),
    dinner_break_enabled: p.dinner_break_enabled,
    dinner_start: formatTime(p.dinner_start),
    dinner_end: formatTime(p.dinner_end),
    interclass_break_enabled: p.interclass_break_enabled,
    owner_id: Number(p.owner_id),
    owner_username: p.accounts_user.username,
    is_owner: p.owner_id === user.id || user.is_superuser,
    classes_count: p._count.classes_schoolclass,
    teachers_count: p._count.teachers_teacher,
    lessons_count: p._count.lessons_lesson,
    participants: p.schedules_projectparticipant.map((pp) => ({
      id: Number(pp.id),
      user_id: Number(pp.user_id),
      username: pp.accounts_user.username,
      email: pp.accounts_user.email,
      role: pp.role,
    })),
  }));

  return (
    <AppShell
      user={shellUser}
      activeProject={shellProject}
      projects={shellProjects}
      subscription={shellSubscription}
      breadcrumbs={[{ label: "Projetos" }]}
    >
      <ProjectsClient
        projects={serialized}
        activeProjectId={activeProject ? Number(activeProject.id) : null}
      />
    </AppShell>
  );
}
