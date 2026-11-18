import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  parseAndVerifyReportToken,
  makeDocumentSerial,
} from "@/lib/reports/verify-token";
import {
  buildCourseReportPages,
  buildTeacherReportPages,
  getActiveProjectDaysList,
} from "@/lib/schedule/report-builder";
import { ScheduleMatrixView } from "@/components/reports/ScheduleMatrixView";

export const dynamic = "force-dynamic";

export default async function ReportVerifyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const decoded = decodeURIComponent(token);
  const payload = parseAndVerifyReportToken(decoded);

  if (!payload) {
    notFound();
  }

  const project = await prisma.schedules_project.findUnique({
    where: { id: BigInt(payload.projectId) },
  });
  if (!project) {
    notFound();
  }

  const days = getActiveProjectDaysList(project);
  const prefix =
    payload.type === "class"
      ? "TURMA"
      : payload.type === "teacher"
      ? "DOC"
      : payload.type === "certificate"
      ? "CERT"
      : "MATRIZ";
  const serial = makeDocumentSerial(prefix, payload.projectId, payload.targetId);

  if (payload.type === "class") {
    const { pages, generatedAt } = await buildCourseReportPages({
      projectId: project.id,
      classId: payload.targetId,
    });
    const classPage = pages[0];

    return (
      <div className="min-vh-100 bg-body-tertiary py-4">
        <div className="container">
          <div className="card border-0 shadow-sm mb-4 overflow-hidden">
            <div
              className="p-3 px-4 text-white d-flex justify-content-between align-items-center flex-wrap gap-2"
              style={{
                background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
              }}
            >
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-patch-check-fill fs-4 text-info" />
                <div>
                  <div className="small text-uppercase fw-bold opacity-75">
                    Verificação Oficial em Tempo Real • Schedule Pro
                  </div>
                  <h5 className="fw-bold mb-0">
                    Grade Horária Autenticada —{" "}
                    {classPage
                      ? `${classPage.header_info.group_name} (${classPage.header_info.class_name})`
                      : "Turma"}
                  </h5>
                </div>
              </div>
              <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-2">
                <i className="bi bi-check-circle-fill me-1" />
                Documento Válido • {serial}
              </span>
            </div>
            <div className="card-body p-3 px-4 bg-white d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div className="small text-secondary">
                <strong>Instituição:</strong> {project.institution_name}{" "}
                &nbsp;|&nbsp; <strong>Projeto:</strong> {project.name} (
                {project.academic_period}) &nbsp;|&nbsp;{" "}
                <strong>Última atualização da grade:</strong>{" "}
                {generatedAt || "Tempo Real"}
              </div>
              <div className="d-flex gap-2">
                <a
                  href={`/api/reports/pdf?type=course&projectId=${payload.projectId}&class=${payload.targetId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-sm fw-semibold"
                >
                  <i className="bi bi-file-earmark-pdf me-1" />
                  Baixar PDF Atualizado
                </a>
                <Link href="/" className="btn btn-outline-secondary btn-sm">
                  Portal Público
                </Link>
              </div>
            </div>
          </div>

          <ScheduleMatrixView
            mode="course"
            projectHeader={{
              name: project.name,
              institution_name: project.institution_name,
              academic_period: project.academic_period,
              report_header: project.report_header,
            }}
            days={days}
            coursePages={pages}
            generatedAt={generatedAt}
            projectId={payload.projectId}
            selectedClass={payload.targetId}
          />
        </div>
      </div>
    );
  }

  if (payload.type === "teacher") {
    const { pages, generatedAt } = await buildTeacherReportPages({
      projectId: project.id,
      teacherId: payload.targetId,
    });
    const teacherPage = pages[0];

    return (
      <div className="min-vh-100 bg-body-tertiary py-4">
        <div className="container">
          <div className="card border-0 shadow-sm mb-4 overflow-hidden">
            <div
              className="p-3 px-4 text-white d-flex justify-content-between align-items-center flex-wrap gap-2"
              style={{
                background: "linear-gradient(135deg, #0f172a 0%, #065f46 100%)",
              }}
            >
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-patch-check-fill fs-4 text-warning" />
                <div>
                  <div className="small text-uppercase fw-bold opacity-75">
                    Verificação Oficial em Tempo Real • Schedule Pro
                  </div>
                  <h5 className="fw-bold mb-0">
                    Horário Docente Autenticado —{" "}
                    {teacherPage ? teacherPage.teacher.name : "Docente"}
                  </h5>
                </div>
              </div>
              <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-2">
                <i className="bi bi-check-circle-fill me-1" />
                Documento Válido • {serial}
              </span>
            </div>
            <div className="card-body p-3 px-4 bg-white d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div className="small text-secondary">
                <strong>Instituição:</strong> {project.institution_name}{" "}
                &nbsp;|&nbsp; <strong>Projeto:</strong> {project.name} (
                {project.academic_period}) &nbsp;|&nbsp;{" "}
                <strong>Última atualização:</strong>{" "}
                {generatedAt || "Tempo Real"}
              </div>
              <div className="d-flex gap-2">
                <a
                  href={`/api/reports/pdf?type=teacher&projectId=${payload.projectId}&teacher=${payload.targetId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-success btn-sm fw-semibold"
                >
                  <i className="bi bi-file-earmark-pdf me-1" />
                  Baixar PDF Atualizado
                </a>
                <Link href="/" className="btn btn-outline-secondary btn-sm">
                  Portal Público
                </Link>
              </div>
            </div>
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
            projectId={payload.projectId}
            selectedTeacher={payload.targetId}
          />
        </div>
      </div>
    );
  }

  // payload.type === "workload" || payload.type === "certificate"
  const lessons = await prisma.lessons_lesson.findMany({
    where: {
      project_id: project.id,
      active: true,
      ...(payload.targetId > 0
        ? {
            lessons_lesson_teachers: {
              some: { teacher_id: BigInt(payload.targetId) },
            },
          }
        : {}),
    },
    include: {
      subjects_subject: { include: { rooms_room: true } },
      rooms_room: true,
      lessons_lesson_classes: { include: { classes_schoolclass: true } },
      lessons_lesson_teachers: { include: { teachers_teacher: true } },
    },
    orderBy: { subjects_subject: { name: "asc" } },
  });

  const teacher =
    payload.targetId > 0
      ? await prisma.teachers_teacher.findUnique({
          where: { id: BigInt(payload.targetId) },
        })
      : null;

  const rows = lessons.map((l) => ({
    subject: l.subjects_subject.name,
    classes:
      l.lessons_lesson_classes
        .map((lc) => lc.classes_schoolclass.name)
        .join(", ") || "-",
    room:
      l.rooms_room?.name || l.subjects_subject.rooms_room?.name || "-",
    teachers:
      l.lessons_lesson_teachers
        .map((lt) => lt.teachers_teacher.name)
        .join(", ") || "-",
    number_of_lessons: l.number_of_lessons,
  }));

  const totalLessons = rows.reduce((acc, r) => acc + r.number_of_lessons, 0);

  return (
    <div className="min-vh-100 bg-body-tertiary py-4">
      <div className="container" style={{ maxWidth: 940 }}>
        <div className="card border-0 shadow-sm mb-4 overflow-hidden">
          <div
            className="p-4 text-white d-flex justify-content-between align-items-center flex-wrap gap-3"
            style={{
              background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
            }}
          >
            <div>
              <div className="small text-uppercase fw-bold text-info mb-1">
                <i className="bi bi-shield-fill-check me-1" />
                Validação de Carga Horária e Matriz Docente • Schedule Pro
              </div>
              <h4 className="fw-bold mb-0">
                {teacher
                  ? `Carga Horária Docente — ${teacher.name}`
                  : `Matriz Consolidada de Carga Horária — ${project.name}`}
              </h4>
            </div>
            <span className="badge bg-success text-white px-3 py-2 fs-6">
              <i className="bi bi-check2-circle me-1" />
              AUTÊNTICO • {serial}
            </span>
          </div>

          <div className="card-body p-4 bg-white">
            <div className="row g-3 mb-4">
              <div className="col-md-4">
                <div className="p-3 bg-light rounded-3 border h-100">
                  <div className="text-muted small text-uppercase fw-bold">
                    Instituição
                  </div>
                  <div className="fw-bold text-dark mt-1">
                    {project.institution_name}
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="p-3 bg-light rounded-3 border h-100">
                  <div className="text-muted small text-uppercase fw-bold">
                    Projeto / Vigência
                  </div>
                  <div className="fw-bold text-dark mt-1">
                    {project.name} ({project.academic_period})
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="p-3 bg-light rounded-3 border h-100">
                  <div className="text-muted small text-uppercase fw-bold">
                    Carga Semanal Validada
                  </div>
                  <div className="fw-bold text-primary mt-1">
                    {totalLessons} tempos/semana ({rows.length} disciplinas)
                  </div>
                </div>
              </div>
            </div>

            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
              <h6 className="fw-bold mb-0 text-dark">
                Componentes Curriculares Registrados em Tempo Real
              </h6>
              <div className="d-flex gap-2">
                <a
                  href={`/api/reports/pdf?type=lessons&projectId=${payload.projectId}${
                    payload.targetId > 0 ? `&teacher=${payload.targetId}` : ""
                  }`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-sm fw-semibold"
                >
                  <i className="bi bi-file-earmark-pdf me-1" />
                  Baixar Relatório PDF
                </a>
                {payload.targetId > 0 && (
                  <Link
                    href={`/schedule/teacher/${payload.targetId}`}
                    className="btn btn-outline-success btn-sm fw-semibold"
                  >
                    <i className="bi bi-calendar3 me-1" />
                    Ver Grade de Horários
                  </Link>
                )}
              </div>
            </div>

            <table className="report-matrix-table">
              <thead>
                <tr>
                  <th style={{ width: "36%" }}>Disciplina</th>
                  <th style={{ width: "24%" }}>Docente(s)</th>
                  <th style={{ width: "20%" }}>Turma(s)</th>
                  <th style={{ width: "12%" }}>Sala</th>
                  <th style={{ width: "8%", textAlign: "center" }}>Tempos</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={idx}>
                    <td className="fw-semibold">{r.subject}</td>
                    <td>{r.teachers}</td>
                    <td>{r.classes}</td>
                    <td>{r.room}</td>
                    <td className="text-center fw-bold">
                      {r.number_of_lessons}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
