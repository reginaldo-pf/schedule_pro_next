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
import {
  buildGroupCheckboxOptions,
  resolveGroupIdsParam,
} from "@/lib/schedule/group-helpers";

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
      where: { project_id: project.id, status: "PUBLISHED" },
      orderBy: [{ name: "asc" }, { academic_period: "desc" }],
    }),
    prisma.classes_schoolclass.findMany({
      where: {
        project_id: project.id,
        active: true,
        groups_group: { status: "PUBLISHED" },
      },
      include: { groups_group: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const rawGroups = (sp.groups || "").trim();
  const rawGroup = (sp.group || "").trim();
  const groupId = rawGroup && Number(rawGroup) ? Number(rawGroup) : null;
  const classId = sp.class ? Number(sp.class) : null;

  const matchingGroupIds = resolveGroupIdsParam(groups, rawGroups, rawGroup);
  const selectedGroupIds = matchingGroupIds.map((id) => Number(id));
  const hasCourseOrPeriodFilter = selectedGroupIds.length > 0;
  const hasFilterApplied = Boolean(hasCourseOrPeriodFilter || classId);

  const groupOptions = buildGroupCheckboxOptions(groups);

  const days = getActiveProjectDaysList(project);
  const { pages, generatedAt } = hasFilterApplied
    ? await buildCourseReportPages({
        projectId: project.id,
        groupIds: hasCourseOrPeriodFilter ? matchingGroupIds : null,
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
          groupOptions={groupOptions}
          selectedGroupIds={selectedGroupIds}
          classes={classes.map((c) => ({
            id: Number(c.id),
            group_id: Number(c.group_id),
            name: c.groups_group.academic_period
              ? `${c.name} (${c.groups_group.name} • ${c.groups_group.academic_period})`
              : `${c.name} (${c.groups_group.name})`,
          }))}
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
        selectedGroups={selectedGroupIds}
        selectedClass={classId}
        hasFilterApplied={hasFilterApplied}
      />
    </AppShell>
  );
}
