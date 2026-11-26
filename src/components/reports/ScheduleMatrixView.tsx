"use client";

import React, { useState } from "react";
import type {
  CourseReportPage,
  TeacherReportPage,
} from "@/lib/schedule/report-builder";

const PERIOD_TYPE_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  INTERVAL: { label: "INTERVALO", color: "#92400e", bg: "#fef3c7" },
  LUNCH: { label: "INTERVALO DE ALMOÇO", color: "#166534", bg: "#dcfce7" },
  DINNER: { label: "INTERVALO DE JANTAR", color: "#166534", bg: "#dcfce7" },
  SHIFT_CHANGE: { label: "TRANSIÇÃO DE TURNO", color: "#1e40af", bg: "#dbeafe" },
};

function getDensityClass(
  rowCount: number,
  orientation: "portrait" | "landscape"
): string {
  if (orientation === "landscape") {
    if (rowCount > 11) return "density-ultra";
    if (rowCount > 7) return "density-compact";
    return "";
  }
  if (rowCount > 15) return "density-ultra";
  if (rowCount > 10) return "density-compact";
  return "";
}

export function ScheduleMatrixView({
  mode,
  projectHeader,
  days,
  coursePages = [],
  teacherPages = [],
  generatedAt,
  showPrintButton = true,
  defaultOrientation = "portrait",
  projectId,
  selectedGroup,
  selectedGroups = [],
  selectedClass,
  selectedTeacher,
  hasFilterApplied = true,
}: {
  mode: "course" | "teacher";
  projectHeader: {
    name: string;
    institution_name: string;
    academic_period?: string;
    report_header: string;
  };
  days: { code: string; label: string }[];
  coursePages?: CourseReportPage[];
  teacherPages?: TeacherReportPage[];
  generatedAt: string;
  showPrintButton?: boolean;
  defaultOrientation?: "portrait" | "landscape";
  projectId?: number;
  selectedGroup?: number | null;
  selectedGroups?: number[];
  selectedClass?: number | null;
  selectedTeacher?: number | null;
  hasFilterApplied?: boolean;
}) {
  const [orientation, setOrientation] = useState<"portrait" | "landscape">(
    defaultOrientation
  );

  const pagesCount =
    mode === "course" ? coursePages.length : teacherPages.length;

  const buildPdfUrl = (overrideType?: string, overrideTeacherId?: number) => {
    const params = new URLSearchParams();
    params.set("type", overrideType || mode);
    params.set("orientation", orientation);
    if (projectId) params.set("projectId", String(projectId));
    if (selectedGroups.length > 0) {
      params.set("groups", selectedGroups.join(","));
    }
    if (selectedGroup) params.set("group", String(selectedGroup));
    if (selectedClass) params.set("class", String(selectedClass));
    if (overrideTeacherId) {
      params.set("teacher", String(overrideTeacherId));
    } else if (selectedTeacher) {
      params.set("teacher", String(selectedTeacher));
    }
    return `/api/reports/pdf?${params.toString()}`;
  };

  const year = new Date().getFullYear();

  return (
    <div>
      <style>{`
        @media print {
          @page {
            size: A4 ${orientation};
            margin: 8mm;
          }
        }
      `}</style>

      {showPrintButton && pagesCount > 0 && (
        <div className="card border-0 shadow-sm mb-3 no-print d-print-none">
          <div className="card-body p-3 d-flex flex-wrap justify-content-between align-items-center gap-3">
            <div className="d-flex align-items-center gap-2">
              <span className="small fw-bold text-secondary text-uppercase">
                Orientação A4:
              </span>
              <div className="btn-group btn-group-sm" role="group">
                <button
                  type="button"
                  className={`btn ${
                    orientation === "portrait"
                      ? "btn-dark fw-semibold"
                      : "btn-outline-secondary bg-white"
                  } d-flex align-items-center gap-1 px-3`}
                  onClick={() => setOrientation("portrait")}
                >
                  <i className="bi bi-file-earmark-text" />
                  Retrato
                </button>
                <button
                  type="button"
                  className={`btn ${
                    orientation === "landscape"
                      ? "btn-dark fw-semibold"
                      : "btn-outline-secondary bg-white"
                  } d-flex align-items-center gap-1 px-3`}
                  onClick={() => setOrientation("landscape")}
                >
                  <i className="bi bi-file-earmark-spreadsheet" />
                  Paisagem
                </button>
              </div>
            </div>

            <div className="d-flex flex-wrap align-items-center gap-2">
              <a
                href={buildPdfUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-sm d-flex align-items-center gap-2 px-3 py-2 shadow-sm fw-bold"
                title="Imprimir ou gerar PDF oficial (A4)"
              >
                <i className="bi bi-file-earmark-pdf-fill" />
                <span>Imprimir / Gerar PDF (A4)</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {pagesCount === 0 ? (
        <div className="card border-0 shadow-sm p-5 text-center">
          <i
            className={`bi ${
              hasFilterApplied ? "bi-calendar-x" : "bi-funnel"
            } display-3 text-muted mb-3`}
          />
          <h5 className="fw-bold text-secondary">
            {hasFilterApplied
              ? "Nenhum horário encontrado para os filtros selecionados"
              : "Selecione um filtro acima para carregar o relatório"}
          </h5>
          <p className="text-muted small mb-0">
            {hasFilterApplied
              ? "Tente outro filtro ou gere os horários no Construtor de Grade."
              : "Para evitar carregamentos desnecessários, escolha uma opção nos filtros acima."}
          </p>
        </div>
      ) : (
        <div className="report-preview-container">
          {mode === "course"
            ? coursePages.map((page, idx) => {
                const density = getDensityClass(
                  page.timeline_rows.length,
                  orientation
                );

                return (
                  <div
                    key={page.school_class.id}
                    className={`report-sheet ${orientation} ${density} ${
                      idx < coursePages.length - 1 ? "print-page-break" : ""
                    }`}
                  >
                    {/* Header */}
                    <div className="report-header-corp">
                      <div className="report-header-left">
                        <div className="d-flex align-items-center gap-2 mb-1">
                          <span className="report-corp-badge">
                            GRADE HORÁRIA • TURMA
                          </span>
                        </div>
                        <h1 className="report-institution">
                          {projectHeader.institution_name}
                        </h1>
                        <div className="report-entity-title">
                          {page.header_info.group_name} — Turma{" "}
                          {page.header_info.class_name}
                        </div>
                        <div className="report-meta-strip">
                          <span>
                            <strong>Projeto:</strong> {projectHeader.name}
                          </span>
                          <span>
                            <strong>Vigência:</strong>{" "}
                            {page.header_info.academic_period ||
                              projectHeader.academic_period ||
                              "Atual"}
                          </span>
                          {page.header_info.room_name && (
                            <span>
                              <strong>Local/Sala:</strong>{" "}
                              {page.header_info.room_name}
                            </span>
                          )}
                          <span>
                            <strong>Carga Alocada:</strong> {page.lesson_count}{" "}
                            tempos/semana
                          </span>
                        </div>
                      </div>
                    </div>

                    <table className="report-grid-table">
                      <thead>
                        <tr className="report-thead-corp">
                          <th className="report-time-col-head">HORÁRIO</th>
                          {days.map((d) => (
                            <th key={d.code}>{d.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {page.timeline_rows.map((row, rIdx) => {
                          if (row.type === "interval") {
                            if (rIdx === page.timeline_rows.length - 1) {
                              return null;
                            }
                            const cfg = PERIOD_TYPE_CONFIG[row.period_type] || {
                              label: "INTERVALO",
                              color: "#92400e",
                              bg: "#fef3c7",
                            };
                            return (
                              <tr
                                key={row.period.id}
                                className="report-interval-row"
                              >
                                <td className="report-time-col">
                                  {row.period.start_time}
                                </td>
                                <td
                                  colSpan={days.length}
                                  style={{ backgroundColor: cfg.bg }}
                                >
                                  <span
                                    style={{
                                      color: cfg.color,
                                      fontWeight: 700,
                                    }}
                                  >
                                    [ {cfg.label} ]
                                  </span>
                                  <span
                                    style={{
                                      marginLeft: 6,
                                      color: "#334155",
                                      fontWeight: 500,
                                    }}
                                  >
                                    {row.period.name} ({row.period.start_time}{" "}
                                    às {row.period.end_time})
                                  </span>
                                </td>
                              </tr>
                            );
                          }

                          return (
                            <tr key={row.period.id}>
                              <td className="report-time-col">
                                {row.period.start_time}
                                <span>às {row.period.end_time}</span>
                              </td>
                              {days.map((d) => {
                                const cell =
                                  page.matrix[d.code]?.[row.period.id];
                                return (
                                  <td key={d.code}>
                                    {cell ? (
                                      <div
                                        className="report-entry-card"
                                        style={{
                                          borderLeftColor:
                                            cell.subject_color || "#1e3a8a",
                                        }}
                                        title={`${cell.subject_name}${
                                          cell.teacher_names
                                            ? ` — Prof: ${cell.teacher_names}`
                                            : ""
                                        }${
                                          cell.room_name
                                            ? ` — Sala: ${cell.room_name}`
                                            : ""
                                        }`}
                                      >
                                        <div
                                          className="report-subject-short"
                                          style={{
                                            color:
                                              cell.subject_color || "#0f172a",
                                          }}
                                        >
                                          {cell.subject_abbreviated ||
                                            cell.subject_name}
                                        </div>
                                        <div className="report-subject-name">
                                          {cell.subject_name}
                                        </div>
                                        {cell.teacher_names && (
                                          <div className="report-meta-primary">
                                            Prof: {cell.teacher_names}
                                          </div>
                                        )}
                                        {cell.room_name && (
                                          <div className="report-meta-secondary">
                                            Sala: {cell.room_name}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="report-empty-cell">—</div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    <div className="report-footer-corp">
                      <span>
                        <strong>{projectHeader.institution_name}</strong> •
                        Sistema Gerenciador de Horários
                      </span>
                      <span>
                        Emitido em: {generatedAt || "Tempo Real"} • Página{" "}
                        {idx + 1} de {coursePages.length}
                      </span>
                    </div>
                  </div>
                );
              })
            : teacherPages.map((page, idx) => {
                const density = getDensityClass(
                  page.timeline_rows.length,
                  orientation
                );

                return (
                  <div
                    key={page.teacher.id}
                    className={`report-sheet ${orientation} ${density} ${
                      idx < teacherPages.length - 1 ? "print-page-break" : ""
                    }`}
                  >
                    {/* Header */}
                    <div className="report-header-corp theme-teacher">
                      <div className="report-header-left">
                        <div className="d-flex align-items-center gap-2 mb-1">
                          <span className="report-corp-badge badge-teacher">
                            GRADE HORÁRIA • DOCENTE
                          </span>
                        </div>
                        <h1 className="report-institution">
                          {projectHeader.institution_name}
                        </h1>
                        <div className="report-entity-title text-teacher">
                          Docente: {page.teacher.name}
                        </div>
                        <div className="report-meta-strip">
                          <span>
                            <strong>Projeto:</strong> {projectHeader.name}
                          </span>
                          {page.group_names && (
                            <span>
                              <strong>Curso(s):</strong> {page.group_names}
                            </span>
                          )}
                          {projectHeader.academic_period && (
                            <span>
                              <strong>Vigência:</strong>{" "}
                              {projectHeader.academic_period}
                            </span>
                          )}
                          {page.teacher.email && (
                            <span>
                              <strong>E-mail:</strong> {page.teacher.email}
                            </span>
                          )}
                          <span>
                            <strong>Carga Alocada:</strong> {page.lesson_count}{" "}
                            tempos/semana
                          </span>
                        </div>
                      </div>
                    </div>

                    <table className="report-grid-table">
                      <thead>
                        <tr className="report-thead-corp thead-teacher">
                          <th className="report-time-col-head">HORÁRIO</th>
                          {days.map((d) => (
                            <th key={d.code}>{d.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {page.timeline_rows.map((row, rIdx) => {
                          if (row.type === "interval") {
                            if (rIdx === page.timeline_rows.length - 1) {
                              return null;
                            }
                            const cfg = PERIOD_TYPE_CONFIG[row.period_type] || {
                              label: "INTERVALO",
                              color: "#92400e",
                              bg: "#fef3c7",
                            };
                            return (
                              <tr
                                key={row.period.id}
                                className="report-interval-row"
                              >
                                <td className="report-time-col">
                                  {row.period.start_time}
                                </td>
                                <td
                                  colSpan={days.length}
                                  style={{ backgroundColor: cfg.bg }}
                                >
                                  <span
                                    style={{
                                      color: cfg.color,
                                      fontWeight: 700,
                                    }}
                                  >
                                    [ {cfg.label} ]
                                  </span>
                                  <span
                                    style={{
                                      marginLeft: 6,
                                      color: "#334155",
                                      fontWeight: 500,
                                    }}
                                  >
                                    {row.period.name} ({row.period.start_time}{" "}
                                    às {row.period.end_time})
                                  </span>
                                </td>
                              </tr>
                            );
                          }

                          return (
                            <tr key={row.period.id}>
                              <td className="report-time-col">
                                {row.period.start_time}
                                <span>às {row.period.end_time}</span>
                              </td>
                              {days.map((d) => {
                                const cell =
                                  page.matrix[d.code]?.[row.period.id];
                                return (
                                  <td key={d.code}>
                                    {cell ? (
                                      <div
                                        className="report-entry-card"
                                        style={{
                                          borderLeftColor:
                                            cell.subject_color || "#065f46",
                                        }}
                                        title={`${cell.subject_name} — Turma: ${
                                          cell.class_name
                                        }${
                                          cell.room_name
                                            ? ` — Sala: ${cell.room_name}`
                                            : ""
                                        }`}
                                      >
                                        <div
                                          className="report-subject-short"
                                          style={{
                                            color:
                                              cell.subject_color || "#0f172a",
                                          }}
                                        >
                                          {cell.subject_abbreviated ||
                                            cell.subject_name}
                                        </div>
                                        <div className="report-meta-primary teacher-class">
                                          Turma: {cell.class_name}
                                        </div>
                                        <div className="report-subject-name">
                                          {cell.subject_name}
                                        </div>
                                        {cell.room_name && (
                                          <div className="report-meta-secondary">
                                            Sala: {cell.room_name}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="report-empty-cell">—</div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    <div className="report-footer-corp">
                      <span>
                        <strong>{projectHeader.institution_name}</strong> •
                        Sistema Gerenciador de Horários
                      </span>
                      <span>
                        Emitido em: {generatedAt || "Tempo Real"} • Página{" "}
                        {idx + 1} de {teacherPages.length}
                      </span>
                    </div>
                  </div>
                );
              })}
        </div>
      )}
    </div>
  );
}
