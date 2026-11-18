import Link from "next/link";
import { requireShellContext } from "@/lib/shell-context";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { ModuleHeader } from "@/components/crud/ModuleHeader";
import { PrintTriggerButton } from "@/components/reports/PrintTriggerButton";
import { LessonsReportFilterBar } from "@/components/reports/LessonsReportFilterBar";
import { makeDocumentSerial } from "@/lib/reports/verify-token";

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
  const groupId = sp.group ? Number(sp.group) : null;
  const classId = sp.class ? Number(sp.class) : null;
  const teacherId = sp.teacher ? Number(sp.teacher) : null;
  const roomId = sp.room ? Number(sp.room) : null;

  const [groups, classes, teachersList, rooms, lessons] = await Promise.all([
    prisma.groups_group.findMany({
      where: { project_id: project.id },
      orderBy: { name: "asc" },
    }),
    prisma.classes_schoolclass.findMany({
      where: { project_id: project.id },
      orderBy: { name: "asc" },
    }),
    prisma.teachers_teacher.findMany({
      where: { project_id: project.id, active: true },
      orderBy: { name: "asc" },
    }),
    prisma.rooms_room.findMany({
      where: { project_id: project.id, active: true },
      orderBy: { name: "asc" },
    }),
    prisma.lessons_lesson.findMany({
      where: {
        project_id: project.id,
        active: true,
        ...(groupId
          ? { subjects_subject: { group_id: BigInt(groupId) } }
          : {}),
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
      },
      include: {
        subjects_subject: { include: { rooms_room: true } },
        rooms_room: true,
        lessons_lesson_classes: { include: { classes_schoolclass: true } },
        lessons_lesson_teachers: { include: { teachers_teacher: true } },
      },
      orderBy: { subjects_subject: { name: "asc" } },
    }),
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
      entry.rows.push({
        subject: lesson.subjects_subject.name,
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

  const activeFilterLabels: string[] = [];
  if (groupId) {
    const g = groups.find((x) => Number(x.id) === groupId);
    if (g) activeFilterLabels.push(`Curso: ${g.name}`);
  }
  if (classId) {
    const c = classes.find((x) => Number(x.id) === classId);
    if (c) activeFilterLabels.push(`Turma: ${c.name}`);
  }
  if (teacherId) {
    const t = teachersList.find((x) => Number(x.id) === teacherId);
    if (t) activeFilterLabels.push(`Professor: ${t.name}`);
  }
  if (roomId) {
    const r = rooms.find((x) => Number(x.id) === roomId);
    if (r) activeFilterLabels.push(`Sala: ${r.name}`);
  }

  const generatedAt = new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const serial = makeDocumentSerial("MATRIZ", projectNumId, teacherId || 0);

  const buildPdfUrl = (type: "lessons" | "certificate", overrideTeacherId?: number) => {
    const params = new URLSearchParams();
    params.set("type", type);
    params.set("projectId", String(projectNumId));
    if (groupId) params.set("group", String(groupId));
    if (classId) params.set("class", String(classId));
    if (overrideTeacherId) {
      params.set("teacher", String(overrideTeacherId));
    } else if (teacherId) {
      params.set("teacher", String(teacherId));
    }
    if (roomId) params.set("room", String(roomId));
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
        { label: "Carga Horária e Certificados Docentes" },
      ]}
    >
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
        }
      `}</style>

      <div className="no-print">
        <ModuleHeader
          icon="bi-journal-text"
          title="Matriz de Aulas, Carga Horária e Certificados Docentes"
          description="Emita o relatório corporativo consolidado ou os certificados formais de atribuição docente com QR Code"
          projectName={project.name}
          statLabel="Docentes Listados"
          statValue={sortedTeachers.length}
        />

        <LessonsReportFilterBar
          groups={groups.map((g) => ({ id: Number(g.id), name: g.name }))}
          classes={classes.map((c) => ({
            id: Number(c.id),
            group_id: Number(c.group_id),
            name: c.name,
          }))}
          teachers={teachersList.map((t) => ({
            id: Number(t.id),
            name: t.name,
          }))}
          rooms={rooms.map((r) => ({ id: Number(r.id), name: r.name }))}
          selectedGroup={groupId}
          selectedClass={classId}
          selectedTeacher={teacherId}
          selectedRoom={roomId}
        />

        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body p-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div className="d-flex gap-2">
              <Link href="/reports" className="btn btn-outline-secondary btn-sm">
                <i className="bi bi-arrow-left me-1" />
                Central de Relatórios
              </Link>
              <Link href="/lessons" className="btn btn-outline-secondary btn-sm">
                <i className="bi bi-table me-1" />
                Matriz de Aulas
              </Link>
            </div>

            {sortedTeachers.length > 0 && (
              <div className="d-flex flex-wrap gap-2">
                <a
                  href={buildPdfUrl("certificate")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-dark btn-sm d-flex align-items-center gap-2 px-3 py-2 fw-semibold shadow-sm"
                >
                  <i className="bi bi-award-fill text-warning" />
                  <span>Emitir Certificados Docentes (PDF)</span>
                </a>

                <a
                  href={buildPdfUrl("lessons")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-sm d-flex align-items-center gap-2 px-3 py-2 fw-bold shadow-sm"
                >
                  <i className="bi bi-file-earmark-pdf-fill" />
                  <span>Gerar Relatório PDF (A4)</span>
                </a>

                <PrintTriggerButton />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="report-preview-container">
        <div className="report-sheet portrait report-sheet-flow">
          <header className="report-header-corp">
            <div className="report-header-left">
              <div className="d-flex align-items-center gap-2 mb-1">
                <span className="report-corp-badge badge-lessons">
                  RELATÓRIO CORPORATIVO • MATRIZ DOCENTE
                </span>
                <span className="report-serial-tag">Nº Série: {serial}</span>
              </div>
              <h1 className="report-institution">{project.institution_name}</h1>
              <div className="report-entity-title" style={{ color: "#0369a1" }}>
                Distribuição Consolidada de Aulas e Carga Horária Semanal
              </div>
              <div className="report-meta-strip">
                <span>
                  <strong>Projeto:</strong> {project.name}
                </span>
                <span>
                  <strong>Vigência:</strong>{" "}
                  {project.academic_period || "Atual"}
                </span>
                <span>
                  <strong>Docentes:</strong> {sortedTeachers.length}
                </span>
                <span>
                  <strong>Total Geral:</strong> {grandTotalLessons} tempos/sem
                </span>
                {activeFilterLabels.length > 0 && (
                  <span>
                    <strong>Filtros:</strong> {activeFilterLabels.join(" | ")}
                  </span>
                )}
              </div>
            </div>

            <div className="report-qr-box">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/reports/qr?type=workload&projectId=${projectNumId}&targetId=${
                  teacherId || 0
                }`}
                alt="QR Code de Validação"
                className="report-qr-img"
              />
              <div className="report-qr-text">
                <div className="report-qr-title">Validação em Tempo Real</div>
                <div className="report-qr-desc">
                  Aponte a câmera para validar esta matriz on-line.
                </div>
              </div>
            </div>
          </header>

          {sortedTeachers.length === 0 ? (
            <div className="text-center py-5 text-muted border rounded-2 my-3">
              Nenhuma aula encontrada para os filtros selecionados.
            </div>
          ) : (
            sortedTeachers.map((tGroup) => {
              const totalLessons = tGroup.rows.reduce(
                (acc, r) => acc + r.number_of_lessons,
                0
              );
              return (
                <section
                  key={tGroup.teacherId}
                  className="report-teacher-section"
                >
                  <div className="report-teacher-banner">
                    <span>{tGroup.teacherName}</span>
                    <div className="d-flex align-items-center gap-2">
                      <a
                        href={buildPdfUrl("certificate", tGroup.teacherId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-outline-dark btn-sm py-0 px-2 no-print"
                        style={{ fontSize: "0.7rem" }}
                        title="Emitir Certificado Individual deste Professor"
                      >
                        <i className="bi bi-award-fill text-warning me-1" />
                        Certificado PDF
                      </a>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: "#0284c7",
                          fontSize: "7.5pt",
                        }}
                      >
                        Total: {totalLessons} tempos/semana
                      </span>
                    </div>
                  </div>
                  <table className="report-matrix-table">
                    <thead>
                      <tr>
                        <th style={{ width: "40%" }}>Disciplina</th>
                        <th style={{ width: "26%" }}>Turma(s)</th>
                        <th style={{ width: "22%" }}>Sala / Local</th>
                        <th
                          style={{
                            width: "12%",
                            textAlign: "center",
                          }}
                        >
                          Tempos
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tGroup.rows.map((row, i) => (
                        <tr key={i}>
                          <td className="fw-semibold">{row.subject}</td>
                          <td>{row.classes}</td>
                          <td>{row.room}</td>
                          <td
                            style={{
                              textAlign: "center",
                              fontWeight: 700,
                            }}
                          >
                            {row.number_of_lessons}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              );
            })
          )}

          <div className="report-footer-corp">
            <span>
              <strong>{project.institution_name}</strong> • Sistema Corporativo
              Schedule Pro • Autenticação: {serial}
            </span>
            <span>Emitido em: {generatedAt}</span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
