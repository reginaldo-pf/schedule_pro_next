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
        "Visualize e imprima as grades horárias completas organizadas por curso/grupo ou por turma específica.",
      icon: "bi-mortarboard",
      colorClass: "icon-classes",
      url: "/reports/course",
    },
    {
      title: "Horários por Professor",
      description:
        "Emita a grade semanal individual de cada professor ou de todos os docentes de um curso.",
      icon: "bi-person-badge",
      colorClass: "icon-teachers",
      url: "/reports/teacher",
    },
    {
      title: "Carga Horária e Matriz Docente",
      description:
        "Relatório consolidado de disciplinas, turmas, salas e total de tempos semanais por professor.",
      icon: "bi-journal-text",
      colorClass: "icon-lessons",
      url: "/lessons/report",
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
        { label: "Relatórios" },
      ]}
    >
      <ModuleHeader
        icon="bi-file-earmark-pdf"
        title="Central de Relatórios e Impressão"
        description="Emita grades horárias e relatórios acadêmicos prontos para impressão ou exportação em PDF"
        projectName={shellProject?.name}
        statLabel="Modelos Disponíveis"
        statValue={cards.length}
      />

      <div className="row g-4">
        {cards.map((c, idx) => (
          <div key={idx} className="col-md-4">
            <Link href={c.url} className="text-decoration-none d-block h-100">
              <div className="card border-0 shadow-sm h-100 dashboard-card-link p-4">
                <div className={`dashboard-card-icon ${c.colorClass} mb-3`}>
                  <i className={`bi ${c.icon}`} />
                </div>
                <h5 className="fw-bold text-dark mb-2">{c.title}</h5>
                <p className="text-muted small mb-3">{c.description}</p>
                <div className="mt-auto text-primary fw-semibold small">
                  Acessar Relatório <i className="bi bi-arrow-right ms-1" />
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
