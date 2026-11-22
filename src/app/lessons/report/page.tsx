import Link from "next/link";
import { requireShellContext } from "@/lib/shell-context";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { ModuleHeader } from "@/components/crud/ModuleHeader";
import { LessonsReportFilterBar } from "@/components/reports/LessonsReportFilterBar";
import {
  buildGroupCheckboxOptions,
  resolveGroupIdsParam,
} from "@/lib/schedule/group-helpers";

export default async function LessonsMatrixReportPage({
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
  const projectNumId = Number(project.id);
  const rawGroups = (sp.groups || "").trim();
  const rawGroup = (sp.group || "").trim();
  const rawQuery = (sp.q || "").trim();
  const classId = sp.class ? Number(sp.class) : null;
  const teacherId = sp.teacher ? Number(sp.teacher) : null;
  const roomId = sp.room ? Number(sp.room) : null;

  const groups = await prisma.groups_group.findMany({
    where: { project_id: project.id, status: { not: "INACTIVE" } },
    orderBy: [{ name: "asc" }, { academic_period: "desc" }],
  });

  const matchingGroupIds = resolveGroupIdsParam(groups, rawGroups, rawGroup);
  const selectedGroupIds = matchingGroupIds.map((id) => Number(id));
  const hasCourseOrPeriodFilter = selectedGroupIds.length > 0;
  const hasFilterApplied = Boolean(
    hasCourseOrPeriodFilter || classId || teacherId || roomId || rawQuery
  );

  const groupOptions = buildGroupCheckboxOptions(groups);

  const [classes, teachersList, rooms, lessons] = await Promise.all([
    prisma.classes_schoolclass.findMany({
      where: {
        project_id: project.id,
        active: true,
        groups_group: { status: { not: "INACTIVE" } },
      },
      include: { groups_group: true },
      orderBy: { name: "asc" },
    }),
    hasCourseOrPeriodFilter && matchingGroupIds.length > 0
      ? prisma.teachers_teacher.findMany({
          where: {
            project_id: project.id,
            active: true,
            lessons_lesson_teachers: {
              some: {
                lessons_lesson: {
                  project_id: project.id,
                  active: true,
                  subjects_subject: {
                    group_id: { in: matchingGroupIds },
                  },
                },
              },
            },
          },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    prisma.rooms_room.findMany({
      where: { project_id: project.id, active: true },
      orderBy: { name: "asc" },
    }),
    hasFilterApplied && (!hasCourseOrPeriodFilter || matchingGroupIds.length > 0)
      ? prisma.lessons_lesson.findMany({
          where: {
            project_id: project.id,
            active: true,
            subjects_subject: {
              ...(hasCourseOrPeriodFilter
                ? { group_id: { in: matchingGroupIds } }
                : { groups_group: { status: { not: "INACTIVE" } } }),
            },
            ...(classId
              ? {
                  lessons_lesson_classes: {
                    some: { schoolclass_id: BigInt(classId) },
                  },
                }
              : {}),
            ...(teacherId
              ? {
                  lessons_lesson_teachers: {
                    some: { teacher_id: BigInt(teacherId) },
                  },
                }
              : {}),
            ...(roomId ? { room_id: BigInt(roomId) } : {}),
            ...(rawQuery
              ? {
                  OR: [
                    {
                      subjects_subject: {
                        name: { contains: rawQuery, mode: "insensitive" },
                      },
                    },
                    {
                      lessons_lesson_teachers: {
                        some: {
                          teachers_teacher: {
                            name: { contains: rawQuery, mode: "insensitive" },
                          },
                        },
                      },
                    },
                  ],
                }
              : {}),
          },
          include: {
            subjects_subject: {
              include: { rooms_room: true, groups_group: true },
            },
            rooms_room: true,
            lessons_lesson_classes: { include: { classes_schoolclass: true } },
            lessons_lesson_teachers: { include: { teachers_teacher: true } },
          },
          orderBy: { subjects_subject: { name: "asc" } },
        })
      : Promise.resolve([]),
  ]);

  const reportGroups = new Map<
    number,
    {
      teacherId: number;
      teacherName: string;
      rows: {
        subject: string;
        classes: string;
        room: string;
        number_of_lessons: number;
      }[];
    }
  >();

  for (const lesson of lessons) {
    let teachers = lesson.lessons_lesson_teachers.map(
      (lt) => lt.teachers_teacher
    );
    if (teacherId) {
      teachers = teachers.filter((t) => Number(t.id) === teacherId);
    }
    const classNames = lesson.lessons_lesson_classes
      .map((lc) => lc.classes_schoolclass.name)
      .join(", ");
    const roomName =
      lesson.rooms_room?.name ||
      lesson.subjects_subject.rooms_room?.name ||
      "-";

    for (const t of teachers) {
      const tId = Number(t.id);
      const entry = reportGroups.get(tId) || {
        teacherId: tId,
        teacherName: t.name,
        rows: [],
      };
      const groupPeriod = lesson.subjects_subject.groups_group?.academic_period;
      const subjectDisplay = groupPeriod
        ? `${lesson.subjects_subject.name} (${lesson.subjects_subject.groups_group.name} • ${groupPeriod})`
        : `${lesson.subjects_subject.name} (${lesson.subjects_subject.groups_group.name})`;
      entry.rows.push({
        subject: subjectDisplay,
        classes: classNames || "-",
        room: roomName,
        number_of_lessons: lesson.number_of_lessons,
      });
      reportGroups.set(tId, entry);
    }
  }

  const sortedTeachers = Array.from(reportGroups.values()).sort((a, b) =>
    a.teacherName.localeCompare(b.teacherName)
  );

  const grandTotalLessons = sortedTeachers.reduce(
    (acc, t) =>
      acc + t.rows.reduce((sum, r) => sum + r.number_of_lessons, 0),
    0
  );

  const buildPdfUrl = () => {
    const params = new URLSearchParams();
    params.set("type", "lessons");
    params.set("projectId", String(projectNumId));
    if (selectedGroupIds.length > 0) {
      params.set("groups", selectedGroupIds.join(","));
    }
    if (classId) params.set("class", String(classId));
    if (teacherId) params.set("teacher", String(teacherId));
    if (roomId) params.set("room", String(roomId));
    if (rawQuery) params.set("q", rawQuery);
    return `/api/reports/pdf?${params.toString()}`;
  };

  return (
    <AppShell
      user={shellUser}
      activeProject={shellProject}
      projects={shellProjects}
      subscription={shellSubscription}
      breadcrumbs={[
        { label: "Relatórios", url: "/reports" },
        { label: "Carga Horária e Matriz Docente" },
      ]}
    >
      <div className="no-print">
        <ModuleHeader
          icon="bi-journal-text"
          title="Relatório de Carga Horária e Matriz Docente"
          description="Visualize a lista de aulas e o quantitativo total de tempos semanais de cada professor"
          projectName={project.name}
          statLabel="Docentes Listados"
          statValue={sortedTeachers.length}
        />

        <LessonsReportFilterBar
          groupOptions={groupOptions}
          selectedGroupIds={selectedGroupIds}
          classes={classes.map((c) => ({
            id: Number(c.id),
            group_id: Number(c.group_id),
            name: c.groups_group.academic_period
              ? `${c.name} (${c.groups_group.name} • ${c.groups_group.academic_period})`
              : `${c.name} (${c.groups_group.name})`,
          }))}
          teachers={teachersList.map((t) => ({
            id: Number(t.id),
            name: t.name,
          }))}
          rooms={rooms.map((r) => ({ id: Number(r.id), name: r.name }))}
          selectedClass={classId}
          selectedTeacher={teacherId}
          selectedRoom={roomId}
          initialQuery={rawQuery}
        />

        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div className="d-flex gap-2">
            <Link href="/lessons" className="btn btn-outline-secondary btn-sm">
              <i className="bi bi-arrow-left me-1" />
              Voltar para Matriz de Aulas
            </Link>
            <Link href="/reports" className="btn btn-outline-secondary btn-sm">
              <i className="bi bi-grid me-1" />
              Central de Relatórios
            </Link>
          </div>

          {sortedTeachers.length > 0 && (
            <a
              href={buildPdfUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-sm d-flex align-items-center gap-2 px-3 py-2 fw-bold shadow-sm"
            >
              <i className="bi bi-file-earmark-pdf-fill" />
              <span>Imprimir / Gerar PDF (A4)</span>
            </a>
          )}
        </div>
      </div>

      {/* Lista Normal de Aulas e Quantitativo por Professor */}
      <div className="card border-0 shadow-sm p-4">
        <div className="border-bottom pb-3 mb-4 d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <div className="text-uppercase small fw-bold text-primary">
              {project.institution_name} • {project.name}
            </div>
            <h5 className="fw-bold mb-0">
              Quantitativo de Aulas e Distribuição por Professor
            </h5>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-light text-dark border px-3 py-2">
              Docentes: <strong>{sortedTeachers.length}</strong>
            </span>
            <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-2">
              Total Geral: <strong>{grandTotalLessons} aulas/semana</strong>
            </span>
          </div>
        </div>

        {sortedTeachers.length === 0 ? (
          <div className="text-center py-5 text-muted">
            {hasFilterApplied
              ? "Nenhuma aula encontrada para os filtros selecionados."
              : "Selecione um filtro acima para carregar o relatório de carga horária."}
          </div>
        ) : (
          sortedTeachers.map((tGroup) => {
            const totalLessons = tGroup.rows.reduce(
              (acc, r) => acc + r.number_of_lessons,
              0
            );
            return (
              <div
                key={tGroup.teacherId}
                className="mb-4"
                style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
              >
                <div className="bg-light p-2 px-3 rounded-top border border-bottom-0 d-flex justify-content-between align-items-center">
                  <strong className="text-dark">
                    <i className="bi bi-person-badge me-2 text-primary" />
                    {tGroup.teacherName}
                  </strong>
                  <span className="badge bg-primary">
                    Total: {totalLessons} aulas/semana
                  </span>
                </div>
                <table
                  className="table table-bordered table-sm align-middle mb-0"
                  style={{ tableLayout: "fixed", width: "100%" }}
                >
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: "42%" }}>Disciplina</th>
                      <th style={{ width: "26%" }}>Turma(s)</th>
                      <th style={{ width: "20%" }}>Sala</th>
                      <th className="text-center" style={{ width: "12%" }}>
                        Aulas
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tGroup.rows.map((row, i) => (
                      <tr key={i}>
                        <td className="fw-medium text-break">{row.subject}</td>
                        <td className="text-break">{row.classes}</td>
                        <td className="text-break">{row.room}</td>
                        <td className="text-center fw-bold">
                          {row.number_of_lessons}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })
        )}
      </div>
    </AppShell>
  );
}
