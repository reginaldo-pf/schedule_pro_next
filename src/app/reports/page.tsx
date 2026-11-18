import Link from "next/link";
import { requireShellContext } from "@/lib/shell-context";
import { AppShell } from "@/components/layout/AppShell";
import { ModuleHeader } from "@/components/crud/ModuleHeader";

export default async function ReportsHomePage() {
  const {
    shellUser,
    shellProject,
    shellProjects,
    shellSubscription,
  } = await requireShellContext({ requireProject: true });

  const cards = [
    {
      title: "Horários por Curso e Turma",
      description:
        "Grades horárias corporativas por curso ou turma com PDF nativo A4 (Retrato/Paisagem) e QR Code de consulta em tempo real.",
      icon: "bi-mortarboard",
      colorClass: "icon-classes",
      url: "/reports/course",
      badge: "PDF A4 + QR Code",
    },
    {
      title: "Horários por Professor",
      description:
        "Emita a grade semanal individual de cada docente ou de todos os professores com QR Code de sincronização automática.",
      icon: "bi-person-badge",
      colorClass: "icon-teachers",
      url: "/reports/teacher",
      badge: "PDF A4 + QR Code",
    },
    {
      title: "Carga Horária e Matriz Docente",
      description:
        "Relatório corporativo consolidado de disciplinas, turmas, salas e total de tempos semanais atribuídos por professor.",
      icon: "bi-journal-text",
      colorClass: "icon-lessons",
      url: "/lessons/report",
      badge: "Relatório Corporativo",
    },
    {
      title: "Certificados de Atribuição Docente",
      description:
        "Certificado formal frente e verso de atribuição de aulas e carga horária com código de série e validação criptográfica via QR Code.",
      icon: "bi-award",
      colorClass: "icon-periods",
      url: "/lessons/report",
      badge: "Frente e Verso + Validação",
    },
  ];

  return (
    <AppShell
      user={shellUser}
      activeProject={shellProject}
      projects={shellProjects}
      subscription={shellSubscription}
      breadcrumbs={[
        { label: shellProject?.name || "Projeto", url: "/projects" },
        { label: "Relatórios e Certificados" },
      ]}
    >
      <ModuleHeader
        icon="bi-file-earmark-pdf"
        title="Central de Relatórios Corporativos e Certificados"
        description="Emita grades horárias, matrizes de carga horária e certificados docentes em PDF nativo A4 com QR Code em tempo real"
        projectName={shellProject?.name}
        statLabel="Modelos Oficiais"
        statValue={cards.length}
      />

      <div className="row g-4">
        {cards.map((c, idx) => (
          <div key={idx} className="col-md-6 col-xl-3">
            <Link href={c.url} className="text-decoration-none d-block h-100">
              <div className="card border-0 shadow-sm h-100 dashboard-card-link p-4 d-flex flex-column">
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <div className={`dashboard-card-icon ${c.colorClass}`}>
                    <i className={`bi ${c.icon}`} />
                  </div>
                  <span className="badge bg-light text-dark border small">
                    {c.badge}
                  </span>
                </div>
                <h5 className="fw-bold text-dark mb-2">{c.title}</h5>
                <p className="text-muted small mb-3">{c.description}</p>
                <div className="mt-auto text-primary fw-semibold small">
                  Acessar Emissão <i className="bi bi-arrow-right ms-1" />
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
