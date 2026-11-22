import { requireShellContext } from "@/lib/shell-context";
import { prisma } from "@/lib/prisma";
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

  const totalProjects = shellProjects.length;

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
    classes_count: number;
    subjects_count: number;
    weekly_lessons: number;
    semester_lessons: number;
    semester_hours: number;
  }[] = [];

  if (activeProject) {
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
        where: { project_id: activeProject.id, status: "PUBLISHED" },
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
        where: {
          project_id: activeProject.id,
          active: true,
          groups_group: { status: "PUBLISHED" },
        },
      }),
      prisma.teachers_teacher.count({
        where: { project_id: activeProject.id, active: true },
      }),
      prisma.subjects_subject.count({
        where: {
          project_id: activeProject.id,
          active: true,
          groups_group: { status: "PUBLISHED" },
        },
      }),
      prisma.lessons_lesson.findMany({
        where: {
          project_id: activeProject.id,
          active: true,
          subjects_subject: {
            active: true,
            groups_group: { status: "PUBLISHED" },
          },
        },
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
        classes_count: g._count.classes_schoolclass,
        subjects_count: g._count.subjects_subject,
        weekly_lessons: groupLessonsSum,
        semester_lessons: semesterLessons,
        semester_hours: semesterHours,
      });
    }
  }

  const maxClassesDisplay = user.is_superuser
    ? "∞"
    : shellSubscription
    ? String(shellSubscription.plan.maxClasses)
    : "0";

  const activeClassesCount = shellSubscription
    ? shellSubscription.activeClassesCount
    : 0;

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
        totalProjects={totalProjects}
        totals={totals}
        activeClassesDisplay={`${activeClassesCount} / ${maxClassesDisplay}`}
        usageDescription={
          user.is_superuser
            ? "Uso do administrador (Ilimitado)"
            : shellSubscription
            ? "Uso da sua assinatura"
            : "Sem plano ativo"
        }
        groupsData={groupsData}
        subscriptionValid={shellSubscription ? shellSubscription.isValid : false}
      />
    </AppShell>
  );
}
