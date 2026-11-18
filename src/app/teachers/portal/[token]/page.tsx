import Link from "next/link";
import { prisma, formatTime, formatDateISO } from "@/lib/prisma";
import { verifyPortalToken } from "@/lib/auth";
import { getActiveProjectDaysList } from "@/lib/schedule/report-builder";
import { TeacherPortalClient } from "@/components/teachers/TeacherPortalClient";

export default async function TeacherPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const payload = await verifyPortalToken(token);

  if (!payload) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-body-tertiary p-3">
        <div
          className="card border-0 shadow-lg text-center p-4 p-md-5"
          style={{ maxWidth: 480 }}
        >
          <div className="mb-3 text-danger">
            <i className="bi bi-clock-history display-1" />
          </div>
          <h4 className="fw-bold mb-2">Link de Acesso Vencido ou Inválido</h4>
          <p className="text-muted mb-4">
            Por motivos de segurança, os links de preenchimento de
            disponibilidade expiram após <strong>48 horas</strong>. Solicite ao
            coordenador do seu curso o reenvio de um novo convite para o seu
            e-mail.
          </p>
          <Link href="/" className="btn btn-primary fw-bold px-4">
            <i className="bi bi-house me-2" />
            Ir para a Página Inicial
          </Link>
        </div>
      </div>
    );
  }

  const teacher = await prisma.teachers_teacher.findFirst({
    where: {
      id: BigInt(payload.teacherId),
      project_id: BigInt(payload.projectId),
    },
    include: {
      schedules_project: true,
    },
  });

  if (!teacher || !teacher.schedules_project) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-body-tertiary p-3">
        <div className="card border-0 shadow-lg text-center p-5">
          <h4>Professor ou projeto não encontrado.</h4>
          <Link href="/" className="btn btn-outline-primary mt-3">
            Voltar ao início
          </Link>
        </div>
      </div>
    );
  }

  const project = teacher.schedules_project;
  const days = getActiveProjectDaysList(project);
  const periodsRaw = await prisma.periods_period.findMany({
    where: {
      project_id: project.id,
      period_type: "CLASS",
    },
    orderBy: [{ start_time: "asc" }, { order: "asc" }],
  });

  const availabilities = await prisma.availability_teacheravailability.findMany({
    where: { teacher_id: teacher.id },
  });

  const statusMap: Record<string, string> = {};
  let validFrom = "";
  let validUntil = "";
  for (const r of availabilities) {
    statusMap[`${Number(r.period_id)}_${r.day_of_week}`] = r.status;
    if (!validFrom && r.valid_from) validFrom = formatDateISO(r.valid_from);
    if (!validUntil && r.valid_until) validUntil = formatDateISO(r.valid_until);
  }

  const periods = periodsRaw.map((p) => ({
    id: Number(p.id),
    name: p.name,
    start_time: formatTime(p.start_time),
    end_time: formatTime(p.end_time),
    shift: p.shift,
  }));

  return (
    <TeacherPortalClient
      token={token}
      teacher={{
        id: Number(teacher.id),
        name: teacher.name,
        short_name: teacher.short_name,
        email: teacher.email || "",
        color: teacher.color,
      }}
      project={{
        name: project.name,
        institution_name: project.institution_name,
        academic_period: project.academic_period,
      }}
      days={days}
      periods={periods}
      initialStatusMap={statusMap}
      initialValidFrom={validFrom}
      initialValidUntil={validUntil}
    />
  );
}
