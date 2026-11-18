"use client";

import React from "react";
import type {
  CourseReportPage,
  TeacherReportPage,
} from "@/lib/schedule/report-builder";

const PERIOD_TYPE_LABELS: Record<string, string> = {
  INTERVAL: "Intervalo",
  LUNCH: "Almoço",
  DINNER: "Jantar",
  SHIFT_CHANGE: "Troca de Turno",
};

export function ScheduleMatrixView({
  mode,
  projectHeader,
  days,
  coursePages = [],
  teacherPages = [],
  generatedAt,
  showPrintButton = true,
}: {
  mode: "course" | "teacher";
  projectHeader: {
    name: string;
    institution_name: string;
    academic_period: string;
    report_header: string;
  };
  days: { code: string; label: string }[];
  coursePages?: CourseReportPage[];
  teacherPages?: TeacherReportPage[];
  generatedAt: string;
  showPrintButton?: boolean;
}) {
  const pagesCount = mode === "course" ? coursePages.length : teacherPages.length;

  return (
    <div>
      {showPrintButton && pagesCount > 0 && (
        <div className="d-flex justify-content-end mb-3 no-print">
          <button
            type="button"
            className="btn btn-dark btn-sm d-flex align-items-center gap-2 px-3 py-2 shadow-sm"
            onClick={() => window.print()}
          >
            <i className="bi bi-printer" />
            <span className="fw-bold">Imprimir / Salvar PDF</span>
          </button>
        </div>
      )}

      {pagesCount === 0 ? (
        <div className="card border-0 shadow-sm p-5 text-center">
          <i className="bi bi-calendar-x display-3 text-muted mb-3" />
          <h5 className="fw-bold text-secondary">
            Nenhum horário encontrado para os filtros selecionados
          </h5>
          <p className="text-muted small mb-0">
            Selecione um filtro acima ou gere os horários no Construtor de Grade.
          </p>
        </div>
      ) : mode === "course" ? (
        coursePages.map((page, idx) => (
          <div
            key={page.school_class.id}
            className={`card border-0 shadow-sm mb-4 p-4 ${
              idx < coursePages.length - 1 ? "print-page-break" : ""
            }`}
          >
            <div className="border-bottom pb-3 mb-3 d-flex justify-content-between align-items-start flex-wrap gap-2">
              <div>
                <div className="text-uppercase small fw-bold text-primary">
                  {projectHeader.institution_name} • {projectHeader.name} (
                  {projectHeader.academic_period})
                </div>
                <h4 className="fw-bold mb-1">
                  {page.header_info.group_name} — {page.header_info.class_name}
                </h4>
                {page.header_info.room_name && (
                  <span className="badge bg-light text-dark border">
                    <i className="bi bi-door-open me-1" />
                    Sala(s): {page.header_info.room_name}
                  </span>
                )}
              </div>
              <div className="text-end small text-muted">
                <div>Total: {page.lesson_count} tempos/semana</div>
                {generatedAt && <div>Gerado em: {generatedAt}</div>}
              </div>
            </div>

            <div className="table-responsive">
              <table className="table table-bordered table-sm text-center align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 130 }}>Horário</th>
                    {days.map((d) => (
                      <th key={d.code}>{d.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {page.timeline_rows.map((row) => {
                    if (row.type === "interval") {
                      return (
                        <tr key={row.period.id} className="table-secondary">
                          <td className="fw-semibold small text-muted">
                            {row.period.start_time} - {row.period.end_time}
                          </td>
                          <td
                            colSpan={days.length}
                            className="small fw-bold text-uppercase text-muted py-1"
                          >
                            {PERIOD_TYPE_LABELS[row.period_type] ||
                              row.period.name}
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={row.period.id}>
                        <td className="bg-light fw-semibold small">
                          <div>{row.period.name}</div>
                          <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                            {row.period.start_time} às {row.period.end_time}
                          </div>
                        </td>
                        {days.map((d) => {
                          const cell = page.matrix[d.code]?.[row.period.id];
                          return (
                            <td
                              key={d.code}
                              className="p-1"
                              style={{ minWidth: 135, height: 64 }}
                            >
                              {cell ? (
                                <div
                                  className="rounded-2 p-2 h-100 d-flex flex-column justify-content-center shadow-sm"
                                  style={{
                                    backgroundColor: cell.subject_color || "#1e293b",
                                    color: "#ffffff",
                                  }}
                                >
                                  <div
                                    className="fw-bold text-truncate"
                                    style={{ fontSize: "0.8rem" }}
                                    title={cell.subject_name}
                                  >
                                    {cell.subject_name}
                                  </div>
                                  <div
                                    className="text-truncate opacity-90"
                                    style={{ fontSize: "0.72rem" }}
                                  >
                                    Prof: {cell.teacher_names}
                                  </div>
                                  {cell.room_name && (
                                    <div
                                      className="text-truncate opacity-75"
                                      style={{ fontSize: "0.68rem" }}
                                    >
                                      Sala: {cell.room_name}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted opacity-25">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))
      ) : (
        teacherPages.map((page, idx) => (
          <div
            key={page.teacher.id}
            className={`card border-0 shadow-sm mb-4 p-4 ${
              idx < teacherPages.length - 1 ? "print-page-break" : ""
            }`}
          >
            <div className="border-bottom pb-3 mb-3 d-flex justify-content-between align-items-start flex-wrap gap-2">
              <div>
                <div className="text-uppercase small fw-bold text-primary">
                  {projectHeader.institution_name} • {projectHeader.name} (
                  {projectHeader.academic_period})
                </div>
                <h4 className="fw-bold mb-1">
                  Professor(a): {page.teacher.name}
                </h4>
                {page.teacher.email && (
                  <small className="text-muted">{page.teacher.email}</small>
                )}
              </div>
              <div className="text-end small text-muted">
                <div>Carga Alocada: {page.lesson_count} tempos/semana</div>
                {generatedAt && <div>Gerado em: {generatedAt}</div>}
              </div>
            </div>

            <div className="table-responsive">
              <table className="table table-bordered table-sm text-center align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 130 }}>Horário</th>
                    {days.map((d) => (
                      <th key={d.code}>{d.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {page.timeline_rows.map((row) => {
                    if (row.type === "interval") {
                      return (
                        <tr key={row.period.id} className="table-secondary">
                          <td className="fw-semibold small text-muted">
                            {row.period.start_time} - {row.period.end_time}
                          </td>
                          <td
                            colSpan={days.length}
                            className="small fw-bold text-uppercase text-muted py-1"
                          >
                            {PERIOD_TYPE_LABELS[row.period_type] ||
                              row.period.name}
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={row.period.id}>
                        <td className="bg-light fw-semibold small">
                          <div>{row.period.name}</div>
                          <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                            {row.period.start_time} às {row.period.end_time}
                          </div>
                        </td>
                        {days.map((d) => {
                          const cell = page.matrix[d.code]?.[row.period.id];
                          return (
                            <td
                              key={d.code}
                              className="p-1"
                              style={{ minWidth: 135, height: 64 }}
                            >
                              {cell ? (
                                <div
                                  className="rounded-2 p-2 h-100 d-flex flex-column justify-content-center shadow-sm"
                                  style={{
                                    backgroundColor: cell.subject_color || "#1e293b",
                                    color: "#ffffff",
                                  }}
                                >
                                  <div
                                    className="fw-bold text-truncate"
                                    style={{ fontSize: "0.8rem" }}
                                    title={cell.subject_name}
                                  >
                                    {cell.subject_name}
                                  </div>
                                  <div
                                    className="text-truncate opacity-90"
                                    style={{ fontSize: "0.72rem" }}
                                  >
                                    Turma: {cell.class_name}
                                  </div>
                                  {cell.room_name && (
                                    <div
                                      className="text-truncate opacity-75"
                                      style={{ fontSize: "0.68rem" }}
                                    >
                                      Sala: {cell.room_name}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted opacity-25">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
