"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUI } from "@/components/ui/UIProvider";

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
  const { startLoading, stopLoading } = useUI();

  useEffect(() => {
    stopLoading();
  }, [selectedGroup, selectedTeacher, stopLoading]);

  const updateFilter = (nextGroup: string, nextTeacher: string) => {
    startLoading();
    const params = new URLSearchParams();
    if (nextGroup) params.set("group", nextGroup);
    if (nextTeacher) params.set("teacher", nextTeacher);
    const qs = params.toString();
    router.push(qs ? `/reports/teacher?${qs}` : "/reports/teacher");
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
              <option value="">Selecione o Curso / Grupo...</option>
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
              <option value="">Selecione o Professor...</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-2 text-md-end">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm w-100"
              onClick={() => updateFilter("", "")}
            >
              <i className="bi bi-x-circle me-1" />
              Limpar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
