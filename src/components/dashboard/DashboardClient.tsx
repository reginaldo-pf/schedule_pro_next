"use client";

import React from "react";
import Link from "next/link";
import type { ShellProject } from "@/components/layout/AppShell";

export function DashboardClient({
  activeProject,
  totals,
  projectsDisplay,
  projectsDescription,
  groupsDisplay,
  groupsDescription,
  activeClassesDisplay,
  usageDescription,
  planName,
  roleLabel,
  groupsData,
  subscriptionValid = true,
}: {
  activeProject: (ShellProject & { timezone?: string }) | null;
  totals: {
    total_groups: number;
    total_periods: number;
    total_classes: number;
    total_teachers: number;
    total_subjects: number;
    total_lessons: number;
    total_lesson_slots: number;
    total_rooms: number;
  };
  projectsDisplay: string;
  projectsDescription: string;
  groupsDisplay: string;
  groupsDescription: string;
  activeClassesDisplay: string;
  usageDescription: string;
  planName: string;
  roleLabel: string;
  groupsData: {
    id: number;
    name: string;
    status?: string;
    classes_count: number;
    subjects_count: number;
    weekly_lessons: number;
    semester_lessons: number;
    semester_hours: number;
  }[];
  subscriptionValid?: boolean;
}) {
  const hasProject = !!activeProject;

  const stats = [
    {
      label: "Projetos",
      value: projectsDisplay,
      description: projectsDescription,
      icon: "bi-folder2-open",
      iconClass: "icon-projects",
      url: "/projects",
    },
    {
      label: "Cursos / Grupos",
      value: groupsDisplay,
      description: groupsDescription,
      icon: "bi-diagram-3",
      iconClass: "icon-groups",
      url: hasProject ? "/groups" : null,
    },
    {
      label: "Minhas Turmas",
      value: activeClassesDisplay,
      description: usageDescription,
      icon: "bi-people",
      iconClass: "icon-classes",
      url: hasProject ? "/classes" : null,
    },
    {
      label: "Disciplinas",
      value: totals.total_subjects,
      description: "Componentes curriculares",
      icon: "bi-journal-bookmark",
      iconClass: "icon-subjects",
      url: hasProject ? "/subjects" : null,
    },
    {
      label: "Professores",
      value: totals.total_teachers,
      description: "Docentes cadastrados",
      icon: "bi-person-badge",
      iconClass: "icon-teachers",
      url: hasProject ? "/teachers" : null,
    },
    {
      label: "Salas",
      value: totals.total_rooms,
      description: "Ambientes cadastrados",
      icon: "bi-door-open",
      iconClass: "icon-rooms",
      url: hasProject ? "/rooms" : null,
    },
    {
      label: "Períodos",
      value: totals.total_periods,
      description: "Horários base",
      icon: "bi-clock-history",
      iconClass: "icon-periods",
      url: hasProject ? "/periods" : null,
    },
    {
      label: "Matriz de Aulas",
      value: totals.total_lessons,
      description: `${totals.total_lesson_slots} tempos previstos`,
      icon: "bi-calendar2-week",
      iconClass: "icon-lessons",
      url: hasProject ? "/lessons" : null,
    },
  ];

  const totalWeeklyLessons = groupsData.reduce(
    (acc, g) => acc + g.weekly_lessons,
    0
  );
  const totalSemesterLessons = groupsData.reduce(
    (acc, g) => acc + g.semester_lessons,
    0
  );
  const totalSemesterHours =
    Math.round(
      groupsData.reduce((acc, g) => acc + g.semester_hours, 0) * 10
    ) / 10;

  return (
    <div>
      {!subscriptionValid && (
        <div className="alert alert-warning d-flex align-items-center gap-2 py-2 px-3 mb-3 border-warning-subtle">
          <i className="bi bi-exclamation-triangle-fill fs-5" />
          <div className="small">
            <strong>Assinatura Inativa ou Expirada!</strong> Algumas
            funcionalidades podem estar limitadas.{" "}
            <Link href="/accounts/subscription" className="alert-link">
              Regularizar agora
            </Link>
            .
          </div>
        </div>
      )}

      {activeProject && (
        <div className="card border-0 shadow-sm py-2 px-3 mb-3 bg-white">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
            <div className="d-flex align-items-center gap-2">
              <div
                className="bg-primary-subtle text-primary rounded-2 d-flex align-items-center justify-content-center flex-shrink-0"
                style={{ width: 36, height: 36 }}
              >
                <i className="bi bi-briefcase fs-5" />
              </div>
              <div>
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <h6 className="mb-0 fw-bold text-dark">
                    {activeProject.name}
                  </h6>
                  <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                    {roleLabel}
                  </span>
                  <span className="badge bg-light text-dark border">
                    Plano: {planName}
                  </span>
                </div>
                <p
                  className="text-muted m-0 d-flex flex-wrap gap-2 align-items-center"
                  style={{ fontSize: "0.75rem" }}
                >
                  <span>
                    <i className="bi bi-building me-1" />
                    {activeProject.institution_name}
                  </span>
                  <span>•</span>
                  <span>
                    <i className="bi bi-globe me-1" />
                    {activeProject.timezone || "America/Fortaleza"}
                  </span>
                </p>
              </div>
            </div>

            <div className="d-flex flex-wrap align-items-center gap-1">
              <Link
                href="/builder"
                className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1 py-1 px-2"
              >
                <i className="bi bi-calendar-event" /> Grade Horária
              </Link>
              <Link
                href="/reports"
                className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1 py-1 px-2"
              >
                <i className="bi bi-file-earmark-pdf" /> Relatórios
              </Link>
              <div className="vr mx-1 d-none d-sm-block" />
              <Link
                href="/groups"
                className="btn btn-sm btn-outline-dark d-inline-flex align-items-center gap-1 py-1 px-2"
              >
                <i className="bi bi-plus-lg" /> Curso
              </Link>
              <Link
                href="/teachers"
                className="btn btn-sm btn-outline-dark d-inline-flex align-items-center gap-1 py-1 px-2"
              >
                <i className="bi bi-plus-lg" /> Professor
              </Link>
              <Link
                href="/rooms"
                className="btn btn-sm btn-outline-dark d-inline-flex align-items-center gap-1 py-1 px-2"
              >
                <i className="bi bi-plus-lg" /> Sala
              </Link>
              <Link
                href="/lessons"
                className="btn btn-sm btn-outline-dark d-inline-flex align-items-center gap-1 py-1 px-2"
              >
                <i className="bi bi-plus-lg" /> Aula
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Compact Metric Cards */}
      <div className="row g-2 mb-3">
        {stats.map((item, idx) => {
          const cardContent = (
            <div className="dashboard-card dashboard-card-link shadow-sm h-100">
              <span className={`dashboard-card-icon ${item.iconClass}`}>
                <i className={`bi ${item.icon}`} />
              </span>
              <div className="dashboard-card-body">
                <span className="dashboard-card-label">{item.label}</span>
                <h2 className="dashboard-card-value">{item.value}</h2>
                <small className="dashboard-card-description">
                  {item.description}
                </small>
              </div>
            </div>
          );

          return (
            <div key={idx} className="col-6 col-sm-4 col-lg-3">
              {item.url ? (
                <Link
                  href={item.url}
                  className="text-decoration-none d-block h-100"
                >
                  {cardContent}
                </Link>
              ) : (
                cardContent
              )}
            </div>
          );
        })}
      </div>

      {/* Compact Courses / Groups Summary Table */}
      {activeProject ? (
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white border-bottom py-2 px-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-journal-text text-primary fs-5" />
              <div>
                <h6 className="mb-0 fw-bold text-dark">
                  Resumo por Curso / Grupo
                </h6>
                <small className="text-muted" style={{ fontSize: "0.75rem" }}>
                  Turmas, componentes curriculares e carga horária prevista
                </small>
              </div>
            </div>
            <Link
              href="/groups"
              className="btn btn-sm btn-light border py-1 px-2 small"
            >
              Gerenciar Cursos <i className="bi bi-arrow-right ms-1" />
            </Link>
          </div>

          {groupsData.length > 0 ? (
            <div className="table-responsive">
              <table className="table table-sm table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th className="text-muted small fw-semibold text-uppercase py-2 ps-3">
                      Curso / Grupo
                    </th>
                    <th className="text-muted small fw-semibold text-uppercase py-2 text-center">
                      Turmas
                    </th>
                    <th className="text-muted small fw-semibold text-uppercase py-2 text-center">
                      Disciplinas
                    </th>
                    <th className="text-muted small fw-semibold text-uppercase py-2 text-center">
                      Aulas / Sem.
                    </th>
                    <th className="text-muted small fw-semibold text-uppercase py-2 text-center">
                      Aulas / Semestre
                    </th>
                    <th className="text-muted small fw-semibold text-uppercase py-2 pe-3 text-center">
                      Horas / Semestre
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {groupsData.map((data) => (
                    <tr key={data.id}>
                      <td className="py-2 ps-3">
                        <div className="d-flex align-items-center gap-2">
                          <span
                            className="bg-primary-subtle text-primary rounded-2 d-inline-flex align-items-center justify-content-center flex-shrink-0"
                            style={{ width: 28, height: 28 }}
                          >
                            <i className="bi bi-diagram-3 small" />
                          </span>
                          <span className="fw-semibold text-dark">
                            {data.name}
                          </span>
                          {data.status === "PREVIEW" && (
                            <span className="badge bg-warning-subtle text-warning border border-warning-subtle">
                              Prévia
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-center py-2">
                        <span className="badge bg-success-subtle text-success fw-medium px-2 py-1">
                          {data.classes_count}
                        </span>
                      </td>
                      <td className="text-center py-2">
                        <span className="badge bg-danger-subtle text-danger fw-medium px-2 py-1">
                          {data.subjects_count}
                        </span>
                      </td>
                      <td className="text-center py-2">
                        <span className="badge bg-light text-dark border fw-medium px-2 py-1">
                          {data.weekly_lessons}
                        </span>
                      </td>
                      <td className="text-center py-2">
                        <span className="badge bg-secondary-subtle text-secondary fw-medium px-2 py-1">
                          {data.semester_lessons}
                        </span>
                      </td>
                      <td className="text-center py-2 pe-3">
                        <span className="badge bg-primary-subtle text-primary fw-semibold px-2 py-1">
                          {data.semester_hours}h
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {groupsData.length > 1 && (
                  <tfoot className="table-light border-top">
                    <tr className="fw-semibold small">
                      <td className="py-2 ps-3 text-muted">
                        Total ({groupsData.length} cursos)
                      </td>
                      <td className="text-center py-2">
                        {groupsData.reduce((a, g) => a + g.classes_count, 0)}
                      </td>
                      <td className="text-center py-2">
                        {groupsData.reduce((a, g) => a + g.subjects_count, 0)}
                      </td>
                      <td className="text-center py-2">{totalWeeklyLessons}</td>
                      <td className="text-center py-2">
                        {totalSemesterLessons}
                      </td>
                      <td className="text-center py-2 pe-3 text-primary">
                        {totalSemesterHours}h
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          ) : (
            <div className="text-center py-4 text-muted">
              <i className="bi bi-journal-x fs-3 d-block mb-2 text-secondary" />
              <p className="m-0 small">
                Nenhum curso cadastrado ou sem aulas configuradas para este
                projeto.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="card border-0 shadow-sm p-4 text-center">
          <h5 className="mb-2">Nenhum projeto ativo</h5>
          <p className="text-muted small mb-3">
            Selecione um projeto existente ou crie um novo projeto para começar
            a configurar o ambiente acadêmico.
          </p>
          <div className="d-flex justify-content-center gap-2">
            <Link href="/projects" className="btn btn-sm btn-outline-dark">
              Selecionar Projeto
            </Link>
            <Link href="/projects" className="btn btn-sm btn-dark">
              Novo Projeto
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
