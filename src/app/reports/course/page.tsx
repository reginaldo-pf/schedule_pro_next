import { requireShellContext } from "@/lib/shell-context";
import { prisma } from "@/lib/prisma";
import {
  buildCourseReportPages,
  getActiveProjectDaysList,
} from "@/lib/schedule/report-builder";
import { AppShell } from "@/components/layout/AppShell";
import { ModuleHeader } from "@/components/crud/ModuleHeader";
import { ScheduleMatrixView } from "@/components/reports/ScheduleMatrixView";
import { CourseReportFilterBar } from "@/components/reports/CourseReportFilterBar";

export default async function CourseReportPage({
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

  const [groups, classes] = await Promise.all([
    prisma.groups_group.findMany({
      where: { project_id: project.id },
      orderBy: { name: "asc" },
    }),
    prisma.classes_schoolclass.findMany({
      where: { project_id: project.id },
      orderBy: { name: "asc" },
    }),
  ]);

  const groupId = sp.group ? Number(sp.group) : null;
  const classId = sp.class ? Number(sp.class) : null;
  const hasFilterApplied = Boolean(groupId || classId);

  const days = getActiveProjectDaysList(project);
  const { pages, generatedAt } = hasFilterApplied
    ? await buildCourseReportPages({
        projectId: project.id,
        groupId,
        classId,
      })
    : { pages: [], generatedAt: "" };

  return (
    <AppShell
      user={shellUser}
      activeProject={shellProject}
      projects={shellProjects}
      subscription={shellSubscription}
      breadcrumbs={[
        { label: "Relatórios", url: "/reports" },
        { label: "Horários por Curso e Turma" },
      ]}
    >
      <div className="no-print">
        <ModuleHeader
          icon="bi-mortarboard"
          title="Relatório de Horários por Curso e Turma"
          description="Filtre por curso ou turma para visualizar e imprimir as grades horárias"
          projectName={project.name}
          statLabel="Grades Exibidas"
          statValue={pages.length}
        />

        <CourseReportFilterBar
          groups={groups.map((g) => ({
            id: Number(g.id),
            name: g.academic_period ? `${g.name} (${g.academic_period})` : g.name,
          }))}
          classes={classes.map((c) => ({
            id: Number(c.id),
            group_id: Number(c.group_id),
            name: c.name,
          }))}
          selectedGroup={groupId}
          selectedClass={classId}
        />
      </div>

      <ScheduleMatrixView
        mode="course"
        projectHeader={{
          name: project.name,
          institution_name: project.institution_name,
          report_header: project.report_header,
        }}
        days={days}
        coursePages={pages}
        generatedAt={generatedAt}
        projectId={Number(project.id)}
        selectedGroup={groupId}
        selectedClass={classId}
        hasFilterApplied={hasFilterApplied}
      />
    </AppShell>
  );
}
