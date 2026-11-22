import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  buildCourseReportPages,
  buildTeacherReportPages,
  getActiveProjectDaysList,
} from "@/lib/schedule/report-builder";
import { ScheduleMatrixView } from "@/components/reports/ScheduleMatrixView";

export default async function PublicSchedulePage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = await params;
  const targetId = Number(id);
  if (!targetId) notFound();

  if (type === "class") {
    const sc = await prisma.classes_schoolclass.findUnique({
      where: { id: BigInt(targetId) },
      include: {
        schedules_project: true,
        groups_group: true,
      },
    });
    if (!sc) notFound();

    const project = sc.schedules_project;
    const days = getActiveProjectDaysList(project);
    const { pages, generatedAt } = await buildCourseReportPages({
      projectId: project.id,
      classId: Number(sc.id),
    });

    return (
      <div className="min-vh-100 bg-body-tertiary py-4">
        <div className="container">
          <div className="d-flex justify-content-between align-items-center mb-4 no-print d-print-none">
            <Link href="/" className="btn btn-outline-secondary btn-sm">
              <i className="bi bi-arrow-left me-1" />
              Voltar para Consulta Pública
            </Link>
            <span className="fw-bold text-secondary">Schedule Pro</span>
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
            projectId={Number(project.id)}
            selectedClass={Number(sc.id)}
          />
        </div>
      </div>
    );
  }

  if (type === "teacher") {
    const teacher = await prisma.teachers_teacher.findUnique({
      where: { id: BigInt(targetId) },
      include: {
        schedules_project: true,
      },
    });
    if (!teacher || !teacher.schedules_project) notFound();

    const project = teacher.schedules_project;
    const days = getActiveProjectDaysList(project);
    const { pages, generatedAt } = await buildTeacherReportPages({
      projectId: project.id,
      teacherId: Number(teacher.id),
    });

    return (
      <div className="min-vh-100 bg-body-tertiary py-4">
        <div className="container">
          <div className="d-flex justify-content-between align-items-center mb-4 no-print d-print-none">
            <Link href="/" className="btn btn-outline-secondary btn-sm">
              <i className="bi bi-arrow-left me-1" />
              Voltar para Consulta Pública
            </Link>
            <span className="fw-bold text-secondary">Schedule Pro</span>
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
            selectedTeacher={Number(teacher.id)}
          />
        </div>
      </div>
    );
  }

  notFound();
}
