"use client";

import React from "react";
import { useRouter } from "next/navigation";

export function TeacherReportFilterBar({
  groups,
  teachers,
  selectedGroup,
  selectedTeacher,
}: {
  groups: { id: number; name: string }[];
  teachers: { id: number; name: string }[];
  selectedGroup: number | null;
  selectedTeacher: number | null;
}) {
  const router = useRouter();

  const updateFilter = (nextGroup: string, nextTeacher: string) => {
    const params = new URLSearchParams();
    if (nextGroup) params.set("group", nextGroup);
    if (nextTeacher) params.set("teacher", nextTeacher);
    router.push(`/reports/teacher?${params.toString()}`);
  };

  return (
    <div className="card border-0 shadow-sm mb-4">
      <div className="card-body p-3">
        <div className="row g-3 align-items-end">
          <div className="col-md-5">
            <label className="form-label small fw-semibold mb-1">
              Filtrar por Curso / Grupo
            </label>
            <select
              className="form-select form-select-sm"
              value={selectedGroup || ""}
              onChange={(e) =>
                updateFilter(
                  e.target.value,
                  selectedTeacher ? String(selectedTeacher) : ""
                )
              }
            >
              <option value="">Todos os Cursos</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-5">
            <label className="form-label small fw-semibold mb-1">
              Professor Específico
            </label>
            <select
              className="form-select form-select-sm"
              value={selectedTeacher || ""}
              onChange={(e) =>
                updateFilter(
                  selectedGroup ? String(selectedGroup) : "",
                  e.target.value
                )
              }
            >
              <option value="">Todos os professores com aula</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
