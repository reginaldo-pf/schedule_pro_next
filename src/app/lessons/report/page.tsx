import Link from "next/link";
import { requireShellContext } from "@/lib/shell-context";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { PrintTriggerButton } from "@/components/reports/PrintTriggerButton";

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
  const groupId = sp.group ? Number(sp.group) : null;
  const classId = sp.class ? Number(sp.class) : null;
  const teacherId = sp.teacher ? Number(sp.teacher) : null;
  const roomId = sp.room ? Number(sp.room) : null;

  const lessons = await prisma.lessons_lesson.findMany({
    where: {
      project_id: activeProject!.id,
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
  });

  const reportGroups = new Map<
    string,
    {
      subject: string;
      classes: string;
      room: string;
      number_of_lessons: number;
    }[]
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
      const tName = t.name;
      const arr = reportGroups.get(tName) || [];
      arr.push({
        subject: lesson.subjects_subject.name,
        classes: classNames || "-",
        room: roomName,
        number_of_lessons: lesson.number_of_lessons,
      });
      reportGroups.set(tName, arr);
    }
  }

  const sortedTeachers = Array.from(reportGroups.keys()).sort((a, b) =>
    a.localeCompare(b)
  );

  return (
    <AppShell
      user={shellUser}
      activeProject={shellProject}
      projects={shellProjects}
      subscription={shellSubscription}
      breadcrumbs={[
        { label: "Matriz de Aulas", url: "/lessons" },
        { label: "Relatório de Carga Horária" },
      ]}
    >
      <div className="d-flex justify-content-between align-items-center mb-3 no-print">
        <Link href="/lessons" className="btn btn-outline-secondary btn-sm">
          <i className="bi bi-arrow-left me-1" />
          Voltar para Matriz de Aulas
        </Link>
        <PrintTriggerButton />
      </div>

      <div className="card border-0 shadow-sm p-4">
        <div className="border-bottom pb-3 mb-4 d-flex justify-content-between align-items-start">
          <div>
            <div className="text-uppercase small fw-bold text-primary">
              {activeProject!.institution_name} • {activeProject!.name} (
              {activeProject!.academic_period})
            </div>
            <h4 className="fw-bold mb-0">
              Relatório de Distribuição de Aulas e Carga Horária Docente
            </h4>
          </div>
          <div className="text-end small text-muted">
            Emitido em {new Date().toLocaleString("pt-BR")}
          </div>
        </div>

        {sortedTeachers.length === 0 ? (
          <div className="text-center py-5 text-muted">
            Nenhuma aula encontrada para este filtro.
          </div>
        ) : (
          sortedTeachers.map((teacherName) => {
            const rows = reportGroups.get(teacherName) || [];
            const totalLessons = rows.reduce(
              (acc, r) => acc + r.number_of_lessons,
              0
            );
            return (
              <div key={teacherName} className="mb-4">
                <div className="bg-light p-2 px-3 rounded-top border d-flex justify-content-between align-items-center">
                  <strong className="text-dark">
                    <i className="bi bi-person-badge me-2 text-primary" />
                    {teacherName}
                  </strong>
                  <span className="badge bg-primary">
                    Total: {totalLessons} tempos/semana
                  </span>
                </div>
                <table className="table table-bordered table-sm mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Disciplina</th>
                      <th>Turma(s)</th>
                      <th>Sala</th>
                      <th className="text-center" style={{ width: 120 }}>
                        Tempos
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i}>
                        <td>{row.subject}</td>
                        <td>{row.classes}</td>
                        <td>{row.room}</td>
                        <td className="text-center fw-semibold">
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
