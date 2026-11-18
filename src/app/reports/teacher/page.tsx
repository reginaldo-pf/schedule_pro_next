import { requireShellContext } from "@/lib/shell-context";
import { prisma } from "@/lib/prisma";
import {
  buildTeacherReportPages,
  getActiveProjectDaysList,
} from "@/lib/schedule/report-builder";
import { AppShell } from "@/components/layout/AppShell";
import { ModuleHeader } from "@/components/crud/ModuleHeader";
import { ScheduleMatrixView } from "@/components/reports/ScheduleMatrixView";
import { TeacherReportFilterBar } from "@/components/reports/TeacherReportFilterBar";

export default async function TeacherReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const {
    activeProject,
    shellUser,
    shellProject,
    shellProjects,
    shellSubscription,
  } = await requireShellContext({ requireProject: true });

  const sp = await searchParams;
  const project = activeProject!;

  const [groups, teachers] = await Promise.all([
    prisma.groups_group.findMany({
      where: { project_id: project.id },
      orderBy: { name: "asc" },
    }),
    prisma.teachers_teacher.findMany({
      where: { project_id: project.id, active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const teacherId = sp.teacher ? Number(sp.teacher) : null;
  const groupId = sp.group ? Number(sp.group) : null;

  const days = getActiveProjectDaysList(project);
  const { pages, generatedAt } = await buildTeacherReportPages({
    projectId: project.id,
    teacherId,
    groupId,
  });

  return (
    <AppShell
      user={shellUser}
      activeProject={shellProject}
      projects={shellProjects}
      subscription={shellSubscription}
      breadcrumbs={[
        { label: "Relatórios", url: "/reports" },
        { label: "Horários por Professor" },
      ]}
    >
      <div className="no-print">
        <ModuleHeader
          icon="bi-person-badge"
          title="Relatório de Horários por Professor"
          description="Filtre por docente ou curso para visualizar e imprimir os horários individuais"
          projectName={project.name}
          statLabel="Docentes Exibidos"
          statValue={pages.length}
        />

        <TeacherReportFilterBar
          groups={groups.map((g) => ({ id: Number(g.id), name: g.name }))}
          teachers={teachers.map((t) => ({ id: Number(t.id), name: t.name }))}
          selectedGroup={groupId}
          selectedTeacher={teacherId}
        />
      </div>

      <ScheduleMatrixView
        mode="teacher"
        projectHeader={{
          name: project.name,
          institution_name: project.institution_name,
          academic_period: project.academic_period,
          report_header: project.report_header,
        }}
        days={days}
        teacherPages={pages}
        generatedAt={generatedAt}
        projectId={Number(project.id)}
        selectedGroup={groupId}
        selectedTeacher={teacherId}
      />
    </AppShell>
  );
}
