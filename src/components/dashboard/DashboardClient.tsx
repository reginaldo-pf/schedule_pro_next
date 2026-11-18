"use client";

import React from "react";
import Link from "next/link";
import type { ShellProject } from "@/components/layout/AppShell";

export function DashboardClient({
  activeProject,
  totalProjects,
  totals,
  activeClassesDisplay,
  usageDescription,
  groupsData,
  subscriptionValid = true,
}: {
  activeProject: (ShellProject & { timezone?: string }) | null;
  totalProjects: number;
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
  activeClassesDisplay: string;
  usageDescription: string;
  groupsData: {
    id: number;
    name: string;
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
      value: totalProjects,
      description: "Projetos do usuário",
      icon: "bi-folder2-open",
      iconClass: "icon-projects",
      url: "/projects",
    },
    {
      label: "Grupos",
      value: totals.total_groups,
      description: "Grupos cadastrados",
      icon: "bi-diagram-3",
      iconClass: "icon-groups",
      url: hasProject ? "/groups" : null,
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
      label: "Minhas Turmas",
      value: activeClassesDisplay,
      description: usageDescription,
      icon: "bi-people",
      iconClass: "icon-classes",
      url: hasProject ? "/classes" : null,
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
      label: "Disciplinas",
      value: totals.total_subjects,
      description: "Componentes curriculares",
      icon: "bi-journal-bookmark",
      iconClass: "icon-subjects",
      url: hasProject ? "/subjects" : null,
    },
    {
      label: "Aulas",
      value: totals.total_lessons,
      description: `${totals.total_lesson_slots} tempos previstos`,
      icon: "bi-calendar2-week",
      iconClass: "icon-lessons",
      url: hasProject ? "/lessons" : null,
    },
    {
      label: "Salas",
      value: totals.total_rooms,
      description: "Ambientes cadastrados",
      icon: "bi-door-open",
      iconClass: "icon-rooms",
      url: hasProject ? "/rooms" : null,
    },
  ];

  return (
    <div>
      {!subscriptionValid && (
        <div className="alert alert-warning d-flex align-items-center gap-3 mb-4 border-warning-subtle">
          <i className="bi bi-exclamation-triangle-fill fs-4" />
          <div>
            <strong>Assinatura Inativa ou Expirada!</strong>
            <p className="m-0 small">
              Sua assinatura expirou ou foi desativada. Algumas funcionalidades
              podem estar limitadas.{" "}
              <Link href="/accounts/subscription" className="alert-link">
                Regularizar agora
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      {activeProject && (
        <div className="card border-0 shadow-sm p-3 mb-4 bg-white">
          <div className="row align-items-center g-3">
            <div className="col-md-auto me-auto">
              <div className="d-flex align-items-center gap-3">
                <div
                  className="bg-primary-subtle text-primary rounded-3 d-flex align-items-center justify-content-center"
                  style={{ width: 44, height: 44 }}
                >
                  <i className="bi bi-briefcase fs-4" />
                </div>
                <div>
                  <h5 className="mb-0 fw-bold text-dark">
                    {activeProject.name}
                  </h5>
                  <p className="text-muted small m-0 d-flex flex-wrap gap-2 align-items-center">
                    <span>
                      <i className="bi bi-building me-1" />
                      {activeProject.institution_name}
                    </span>
                    <span className="text-muted">•</span>
                    <span>
                      <i className="bi bi-calendar3 me-1" />
                      {activeProject.academic_period}
                    </span>
                    <span className="text-muted">•</span>
                    <span>
                      <i className="bi bi-globe me-1" />
                      {activeProject.timezone || "America/Fortaleza"}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="col-md-auto">
              <div className="d-flex flex-wrap align-items-center gap-2">
                <Link
                  href="/groups"
                  className="btn btn-sm btn-dark d-flex align-items-center gap-1"
                >
                  <i className="bi bi-plus-lg" /> Novo Curso
                </Link>
                <Link
                  href="/teachers"
                  className="btn btn-sm btn-outline-dark d-flex align-items-center gap-1"
                >
                  <i className="bi bi-plus-lg" /> Professor
                </Link>
                <Link
                  href="/rooms"
                  className="btn btn-sm btn-outline-dark d-flex align-items-center gap-1"
                >
                  <i className="bi bi-plus-lg" /> Sala
                </Link>
                <Link
                  href="/lessons"
                  className="btn btn-sm btn-outline-dark d-flex align-items-center gap-1"
                >
                  <i className="bi bi-plus-lg" /> Aula
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Metric Cards */}
      <div className="row g-3">
        {stats.map((item, idx) => {
          const cardContent = (
            <div className="dashboard-card dashboard-card-link shadow-sm h-100">
              <div className="dashboard-card-header">
                <span className="dashboard-card-label">{item.label}</span>
                <span className={`dashboard-card-icon ${item.iconClass}`}>
                  <i className={`bi ${item.icon}`} />
                </span>
              </div>
              <div>
                <h2 className="dashboard-card-value">{item.value}</h2>
                <small className="dashboard-card-description">
                  {item.description}
                </small>
              </div>
            </div>
          );

          return (
            <div key={idx} className="col-6 col-md-4 col-xl-3">
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

      {/* Courses / Groups Summary Table */}
      {activeProject ? (
        <div className="card border-0 shadow-sm p-4 mt-4">
          <div className="d-flex justify-content-between mb-4 pb-2 border-bottom">
            <div>
              <h5 className="mb-1 text-dark">
                <i className="bi bi-journal-text text-primary me-2" />
                Cursos / Grupos
              </h5>
              <p className="text-muted small m-0">
                Resumo da carga horária e quantidade de aulas dos cursos
                cadastrados
              </p>
            </div>
          </div>

          {groupsData.length > 0 ? (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th className="text-muted small fw-bold text-uppercase py-3">
                      Curso / Grupo
                    </th>
                    <th className="text-muted small fw-bold text-uppercase py-3 text-center">
                      Aulas Semanais
                    </th>
                    <th className="text-muted small fw-bold text-uppercase py-3 text-center">
                      Aulas por Semestre
                    </th>
                    <th className="text-muted small fw-bold text-uppercase py-3 text-center">
                      Horas por Semestre
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {groupsData.map((data) => (
                    <tr key={data.id}>
                      <td className="py-3">
                        <div className="d-flex align-items-center gap-3">
                          <span
                            className="avatar-span bg-primary-subtle text-primary rounded-circle d-flex align-items-center justify-content-center"
                            style={{ width: 38, height: 38 }}
                          >
                            <i className="bi bi-diagram-3 fs-5" />
                          </span>
                          <div>
                            <span className="fw-bold text-dark d-block">
                              {data.name}
                            </span>
                            <span className="text-muted small">
                              {data.classes_count} turmas •{" "}
                              {data.subjects_count} disciplinas
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="text-center py-3">
                        <span className="badge bg-light text-dark border px-3 py-2 fs-6 fw-normal">
                          {data.weekly_lessons}
                        </span>
                      </td>
                      <td className="text-center py-3">
                        <span className="badge bg-secondary-subtle text-secondary px-3 py-2 fs-6 fw-normal">
                          {data.semester_lessons}
                        </span>
                      </td>
                      <td className="text-center py-3">
                        <span className="badge bg-primary-subtle text-primary px-3 py-2 fs-6 fw-semibold">
                          {data.semester_hours}h
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-journal-x fs-1 d-block mb-3 text-secondary" />
              <p className="m-0">
                Nenhum curso cadastrado ou sem aulas configuradas para este
                projeto.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="row mt-4">
          <div className="col-md-12">
            <div className="card border-0 shadow-sm p-4 text-center py-5">
              <h4 className="mb-3">Nenhum projeto ativo</h4>
              <p className="text-muted mb-4">
                Selecione um projeto existente ou crie um novo projeto para
                começar a configurar o ambiente acadêmico.
              </p>
              <div className="d-flex justify-content-center gap-2">
                <Link href="/projects" className="btn btn-outline-dark">
                  Selecionar Projeto
                </Link>
                <Link href="/projects" className="btn btn-dark">
                  Novo Projeto
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
