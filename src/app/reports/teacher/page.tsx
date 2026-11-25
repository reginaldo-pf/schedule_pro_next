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
import {
  buildGroupCheckboxOptions,
  resolveGroupIdsParam,
} from "@/lib/schedule/group-helpers";

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

  const rawGroups = (sp.groups || "").trim();
  const rawGroup = (sp.group || "").trim();
  const groupId = rawGroup && Number(rawGroup) ? Number(rawGroup) : null;
  const teacherId = sp.teacher ? Number(sp.teacher) : null;

  const groups = await prisma.groups_group.findMany({
    where: { project_id: project.id, status: "PUBLISHED" },
    orderBy: [{ name: "asc" }, { academic_period: "desc" }],
  });

  const matchingGroupIds = resolveGroupIdsParam(groups, rawGroups, rawGroup);
  const selectedGroupIds = matchingGroupIds.map((id) => Number(id));
  const hasCourseOrPeriodFilter = selectedGroupIds.length > 0;
  const hasFilterApplied = Boolean(hasCourseOrPeriodFilter || teacherId);

  const teachers = await prisma.teachers_teacher.findMany({
    where: {
      project_id: project.id,
      active: true,
      ...(hasCourseOrPeriodFilter && matchingGroupIds.length > 0
        ? {
            lessons_lesson_teachers: {
              some: {
                lessons_lesson: {
                  project_id: project.id,
                  active: true,
                  subjects_subject: {
                    group_id: { in: matchingGroupIds },
                    groups_group: { status: "PUBLISHED" },
                  },
                },
              },
            },
          }
        : {}),
    },
    orderBy: { name: "asc" },
  });

  const groupOptions = buildGroupCheckboxOptions(groups);

  const days = getActiveProjectDaysList(project);
  const { pages, generatedAt } = hasFilterApplied
    ? await buildTeacherReportPages({
        projectId: project.id,
        teacherId,
        groupIds: hasCourseOrPeriodFilter ? matchingGroupIds : null,
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
          groupOptions={groupOptions}
          selectedGroupIds={selectedGroupIds}
          teachers={teachers.map((t) => ({ id: Number(t.id), name: t.name }))}
          selectedTeacher={teacherId}
        />
      </div>

      <ScheduleMatrixView
        mode="teacher"
        projectHeader={{
          name: project.name,
          institution_name: project.institution_name,
          report_header: project.report_header,
        }}
        days={days}
        teacherPages={pages}
        generatedAt={generatedAt}
        projectId={Number(project.id)}
        selectedGroup={groupId}
        selectedGroups={selectedGroupIds}
        selectedTeacher={teacherId}
        hasFilterApplied={hasFilterApplied}
      />
    </AppShell>
  );
}
