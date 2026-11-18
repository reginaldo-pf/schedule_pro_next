"use client";

import React from "react";
import Link from "next/link";
import { ModuleHeader } from "@/components/crud/ModuleHeader";
import type { ShellProject } from "@/components/layout/AppShell";

export function DashboardClient({
  activeProject,
  totalProjects,
  totals,
  activeClassesDisplay,
  usageDescription,
  groupsData,
}: {
  activeProject: ShellProject | null;
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
      label: "Grupos / Cursos",
      value: totals.total_groups,
      description: "Cursos cadastrados",
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
      <ModuleHeader
        icon="bi-speedometer2"
        title="Visão Geral do Sistema"
        description={
          activeProject
            ? `${activeProject.institution_name} • ${activeProject.name} (${activeProject.academic_period})`
            : "Selecione ou crie um projeto ativo para iniciar o planejamento"
        }
        projectName={activeProject?.name}
        statLabel="Tempos Semanais"
        statValue={totals.total_lesson_slots}
        extraActions={
          activeProject ? (
            <div className="d-flex gap-2">
              <Link
                href="/builder"
                className="btn btn-primary btn-sm d-flex align-items-center gap-2 px-3 py-2 fw-bold shadow-sm"
              >
                <i className="bi bi-calendar-week" />
                <span>Construtor de Grade</span>
              </Link>
              <Link
                href="/reports"
                className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2 px-3 py-2 fw-semibold"
              >
                <i className="bi bi-printer" />
                <span>Relatórios</span>
              </Link>
            </div>
          ) : (
            <Link
              href="/projects"
              className="btn btn-primary btn-sm px-3 py-2 fw-bold"
            >
              <i className="bi bi-folder-plus me-1" />
              Selecionar Projeto
            </Link>
          )
        }
      />

      {/* Metric Cards */}
      <div className="row g-3 mb-4">
        {stats.map((item, idx) => {
          const cardContent = (
            <div className="dashboard-card dashboard-card-link shadow-sm h-100">
              <div className="dashboard-card-header">
                <span className="dashboard-card-label">{item.label}</span>
                <div className={`dashboard-card-icon ${item.iconClass}`}>
                  <i className={`bi ${item.icon}`} />
                </div>
              </div>
              <div>
                <h3 className="dashboard-card-value">{item.value}</h3>
                <span className="dashboard-card-description">
                  {item.description}
                </span>
              </div>
            </div>
          );

          return (
            <div key={idx} className="col-sm-6 col-lg-3">
              {item.url ? (
                <Link href={item.url} className="text-decoration-none d-block h-100">
                  {cardContent}
                </Link>
              ) : (
                cardContent
              )}
            </div>
          );
        })}
      </div>

      {/* Semester Summary by Course / Group */}
      {activeProject && (
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white border-bottom py-3 d-flex justify-content-between align-items-center">
            <div>
              <h6 className="fw-bold mb-0">
                <i className="bi bi-bar-chart-line text-primary me-2" />
                Resumo Acadêmico por Curso / Grupo
              </h6>
              <small className="text-muted">
                Estimativa baseada em 20 semanas letivas por semestre
              </small>
            </div>
            <Link href="/groups" className="btn btn-sm btn-outline-primary">
              Gerenciar Cursos
            </Link>
          </div>
          <div className="table-responsive">
            <table className="table align-middle table-hover mb-0">
              <thead className="table-light">
                <tr>
                  <th className="ps-4">Curso / Grupo</th>
                  <th className="text-center">Turmas</th>
                  <th className="text-center">Disciplinas</th>
                  <th className="text-center">Aulas / Semana</th>
                  <th className="text-center">Aulas / Semestre</th>
                  <th className="text-center">Horas / Semestre</th>
                  <th className="text-end pe-4">Ações</th>
                </tr>
              </thead>
              <tbody>
                {groupsData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-4 text-muted">
                      Nenhum curso cadastrado neste projeto.
                    </td>
                  </tr>
                ) : (
                  groupsData.map((g) => (
                    <tr key={g.id}>
                      <td className="ps-4 fw-bold">{g.name}</td>
                      <td className="text-center">
                        <span className="badge bg-success-subtle text-success">
                          {g.classes_count}
                        </span>
                      </td>
                      <td className="text-center">
                        <span className="badge bg-danger-subtle text-danger">
                          {g.subjects_count}
                        </span>
                      </td>
                      <td className="text-center fw-semibold">
                        {g.weekly_lessons} tempos
                      </td>
                      <td className="text-center text-muted">
                        {g.semester_lessons} aulas
                      </td>
                      <td className="text-center">
                        <span className="badge bg-primary-subtle text-primary px-2 py-1">
                          {g.semester_hours}h
                        </span>
                      </td>
                      <td className="text-end pe-4">
                        <Link
                          href={`/reports/course?group=${g.id}`}
                          className="btn btn-sm btn-outline-secondary"
                        >
                          <i className="bi bi-file-earmark-text me-1" />
                          Ver Grade
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
