import { requireShellContext } from "@/lib/shell-context";
import { prisma } from "@/lib/prisma";
import { AccessControlService, PlanService } from "@/lib/services/access-control";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export default async function DashboardPage() {
  const {
    user,
    activeProject,
    shellUser,
    shellProject,
    shellProjects,
    shellSubscription,
  } = await requireShellContext();

  const [totalProjects, ownedProjectsCount, sub] = await Promise.all([
    Promise.resolve(shellProjects.length),
    prisma.schedules_project.count({
      where: { owner_id: user.id },
    }),
    PlanService.getSubscription(user),
  ]);

  const participatingProjectsCount = Math.max(0, totalProjects - ownedProjectsCount);
  const isProjectAdmin = activeProject
    ? AccessControlService.isProjectAdmin(user, activeProject)
    : false;

  let totals = {
    total_groups: 0,
    total_periods: 0,
    total_classes: 0,
    total_teachers: 0,
    total_subjects: 0,
    total_lessons: 0,
    total_lesson_slots: 0,
    total_rooms: 0,
  };

  const groupsData: {
    id: number;
    name: string;
    status: string;
    classes_count: number;
    subjects_count: number;
    weekly_lessons: number;
    semester_lessons: number;
    semester_hours: number;
  }[] = [];

  if (activeProject) {
    const groupScopeWhere = isProjectAdmin
      ? { project_id: activeProject.id, status: { not: "INACTIVE" } }
      : {
          project_id: activeProject.id,
          owner_id: user.id,
          status: { not: "INACTIVE" },
        };

    const classScopeWhere = isProjectAdmin
      ? {
          project_id: activeProject.id,
          active: true,
          groups_group: { status: { not: "INACTIVE" } },
        }
      : {
          project_id: activeProject.id,
          active: true,
          OR: [
            {
              groups_group: {
                owner_id: user.id,
                status: { not: "INACTIVE" },
              },
            },
            {
              responsible_id: user.id,
              groups_group: {
                owner_id: null,
                status: { not: "INACTIVE" },
              },
            },
          ],
        };

    const subjectScopeWhere = isProjectAdmin
      ? {
          project_id: activeProject.id,
          active: true,
          groups_group: { status: { not: "INACTIVE" } },
        }
      : {
          project_id: activeProject.id,
          active: true,
          groups_group: {
            owner_id: user.id,
            status: { not: "INACTIVE" },
          },
        };

    const lessonScopeWhere = isProjectAdmin
      ? {
          project_id: activeProject.id,
          active: true,
          subjects_subject: {
            active: true,
            groups_group: { status: { not: "INACTIVE" } },
          },
        }
      : {
          project_id: activeProject.id,
          active: true,
          subjects_subject: {
            active: true,
            groups_group: {
              owner_id: user.id,
              status: { not: "INACTIVE" },
            },
          },
        };

    const [
      groups,
      periods,
      totalClasses,
      totalTeachers,
      totalSubjects,
      lessons,
      totalRooms,
    ] = await Promise.all([
      prisma.groups_group.findMany({
        where: groupScopeWhere,
        include: {
          _count: {
            select: {
              classes_schoolclass: { where: { active: true } },
              subjects_subject: { where: { active: true } },
            },
          },
        },
        orderBy: [{ name: "asc" }, { academic_period: "desc" }],
      }),
      prisma.periods_period.findMany({
        where: { project_id: activeProject.id },
      }),
      prisma.classes_schoolclass.count({
        where: classScopeWhere,
      }),
      prisma.teachers_teacher.count({
        where: { project_id: activeProject.id, active: true },
      }),
      prisma.subjects_subject.count({
        where: subjectScopeWhere,
      }),
      prisma.lessons_lesson.findMany({
        where: lessonScopeWhere,
        include: { subjects_subject: true },
      }),
      prisma.rooms_room.count({
        where: { project_id: activeProject.id, active: true },
      }),
    ]);

    const totalLessonSlots = lessons.reduce(
      (acc, l) => acc + l.number_of_lessons,
      0
    );

    totals = {
      total_groups: groups.length,
      total_periods: periods.length,
      total_classes: totalClasses,
      total_teachers: totalTeachers,
      total_subjects: totalSubjects,
      total_lessons: lessons.length,
      total_lesson_slots: totalLessonSlots,
      total_rooms: totalRooms,
    };

    const classPeriods = periods.filter((p) => p.period_type === "CLASS");
    let avgDuration = 50.0;
    if (classPeriods.length > 0) {
      let totalMinutes = 0;
      for (const p of classPeriods) {
        const diffMs = p.end_time.getTime() - p.start_time.getTime();
        totalMinutes += Math.max(0, diffMs / 60000);
      }
      if (totalMinutes > 0) {
        avgDuration = totalMinutes / classPeriods.length;
      }
    }

    for (const g of groups) {
      const groupLessonsSum = lessons
        .filter((l) => l.subjects_subject.group_id === g.id)
        .reduce((acc, l) => acc + l.number_of_lessons, 0);

      const weeksPerSemester = 20;
      const semesterLessons = groupLessonsSum * weeksPerSemester;
      const semesterHours =
        Math.round(((semesterLessons * avgDuration) / 60.0) * 10) / 10;

      groupsData.push({
        id: Number(g.id),
        name: g.academic_period ? `${g.name} (${g.academic_period})` : g.name,
        status: g.status || "PUBLISHED",
        classes_count: g._count.classes_schoolclass,
        subjects_count: g._count.subjects_subject,
        weekly_lessons: groupLessonsSum,
        semester_lessons: semesterLessons,
        semester_hours: semesterHours,
      });
    }
  }

  const maxProjectsDisplay = user.is_superuser
    ? "∞"
    : sub
    ? String(sub.plan.maxProjects)
    : "0";

  const maxGroupsDisplay = user.is_superuser
    ? "∞"
    : sub
    ? String(sub.plan.maxGroups)
    : "0";

  const maxClassesDisplay = user.is_superuser
    ? "∞"
    : sub
    ? String(sub.plan.maxClasses)
    : "0";

  const projectsDisplay = user.is_superuser
    ? String(totalProjects)
    : `${ownedProjectsCount} / ${maxProjectsDisplay}`;

  const projectsDescription = user.is_superuser
    ? "Projetos do sistema"
    : participatingProjectsCount > 0
    ? `Próprios (limite) • Participando em ${participatingProjectsCount}`
    : "Projetos próprios (limite do plano)";

  const groupsDisplay = `${totals.total_groups} / ${maxGroupsDisplay}`;
  const groupsDescription = user.is_superuser
    ? "Cursos no projeto (Ilimitado)"
    : isProjectAdmin
    ? "Cursos no projeto (limite do plano)"
    : "Seus cursos no projeto (limite do plano)";

  const activeClassesDisplay = `${totals.total_classes} / ${maxClassesDisplay}`;
  const usageDescription = user.is_superuser
    ? "Turmas no projeto (Ilimitado)"
    : !sub
    ? "Sem plano ativo"
    : isProjectAdmin
    ? "Turmas no projeto (limite do plano)"
    : "Suas turmas no projeto (limite do plano)";

  const roleLabel = user.is_superuser
    ? "Administrador"
    : activeProject && activeProject.owner_id === user.id
    ? "Proprietário"
    : PlanService.hasActiveDirecaoPlan(user)
    ? "Direção"
    : "Coordenador";

  return (
    <AppShell
      user={shellUser}
      activeProject={shellProject}
      projects={shellProjects}
      subscription={shellSubscription}
      breadcrumbs={[{ label: "Dashboard" }]}
    >
      <DashboardClient
        activeProject={
          shellProject
            ? {
                ...shellProject,
                timezone: activeProject?.timezone || "America/Fortaleza",
              }
            : null
        }
        totals={totals}
        projectsDisplay={projectsDisplay}
        projectsDescription={projectsDescription}
        groupsDisplay={groupsDisplay}
        groupsDescription={groupsDescription}
        activeClassesDisplay={activeClassesDisplay}
        usageDescription={usageDescription}
        planName={sub?.plan.name || "Sem plano"}
        roleLabel={roleLabel}
        groupsData={groupsData}
        subscriptionValid={sub ? sub.isValid : false}
      />
    </AppShell>
  );
}
