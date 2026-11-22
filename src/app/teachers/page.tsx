import { requireShellContext } from "@/lib/shell-context";
import { prisma, formatDateISO, formatTime } from "@/lib/prisma";
import { generatePortalToken, isPortalTokenActive } from "@/lib/auth";
import { AppShell } from "@/components/layout/AppShell";
import { TeachersClient } from "@/components/crud/TeachersClient";

export default async function TeachersPage() {
  const {
    activeProject,
    shellUser,
    shellProject,
    shellProjects,
    shellSubscription,
  } = await requireShellContext({ requireProject: true });

  const teachers = await prisma.teachers_teacher.findMany({
    where: { project_id: activeProject!.id },
    include: {
      lessons_lesson_teachers: {
        include: {
          lessons_lesson: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const nowMs = Date.now();
  const serialized = await Promise.all(
    teachers.map(async (t) => {
      const weeklyLoad = t.lessons_lesson_teachers
        .filter((lt) => lt.lessons_lesson.active)
        .reduce((acc, lt) => acc + lt.lessons_lesson.number_of_lessons, 0);

      const hasActiveToken = isPortalTokenActive(t.last_invited_at, nowMs);
      const portal_token =
        hasActiveToken && t.last_invited_at
          ? await generatePortalToken(
              Number(t.id),
              Number(activeProject!.id),
              t.last_invited_at
            )
          : null;

      return {
        id: Number(t.id),
        name: t.name,
        short_name: t.short_name,
        email: t.email || "",
        admission_date: formatDateISO(t.admission_date),
        color: t.color,
        min_lessons_day: t.min_lessons_day,
        max_lessons_day: t.max_lessons_day,
        max_lessons_level: t.max_lessons_level,
        max_lessons_group: t.max_lessons_group,
        displacement: t.displacement,
        activity_hours: formatTime(t.activity_hours),
        external_code: t.external_code || "",
        reduce_days: t.reduce_days,
        reduce_windows: t.reduce_windows,
        active: t.active,
        weekly_load: weeklyLoad,
        last_invited_at: t.last_invited_at
          ? t.last_invited_at.toLocaleString("pt-BR")
          : null,
        availability_updated_at: t.availability_updated_at
          ? t.availability_updated_at.toLocaleString("pt-BR")
          : null,
        portal_token,
      };
    })
  );

  return (
    <AppShell
      user={shellUser}
      activeProject={shellProject}
      projects={shellProjects}
      subscription={shellSubscription}
      breadcrumbs={[
        { label: shellProject?.name || "Projeto", url: "/projects" },
        { label: "Professores" },
      ]}
    >
      <TeachersClient
        projectName={shellProject?.name || ""}
        teachers={serialized}
      />
    </AppShell>
  );
}
