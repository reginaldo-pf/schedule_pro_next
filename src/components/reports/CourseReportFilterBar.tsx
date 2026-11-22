"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUI } from "@/components/ui/UIProvider";

export function CourseReportFilterBar({
  groups,
  classes,
  selectedGroup,
  selectedClass,
}: {
  groups: { id: number; name: string }[];
  classes: { id: number; group_id: number; name: string }[];
  selectedGroup: number | null;
  selectedClass: number | null;
}) {
  const router = useRouter();
  const { startLoading, stopLoading } = useUI();

  useEffect(() => {
    stopLoading();
  }, [selectedGroup, selectedClass, stopLoading]);

  const filteredClasses = classes.filter(
    (c) => !selectedGroup || c.group_id === selectedGroup
  );

  const updateFilter = (nextGroup: string, nextClass: string) => {
    startLoading();
    const params = new URLSearchParams();
    if (nextGroup) params.set("group", nextGroup);
    if (nextClass) params.set("class", nextClass);
    const qs = params.toString();
    router.push(qs ? `/reports/course?${qs}` : "/reports/course");
  };

  return (
    <div className="card border-0 shadow-sm mb-4">
      <div className="card-body p-3">
        <div className="row g-3 align-items-end">
          <div className="col-md-5">
            <label className="form-label small fw-semibold mb-1">
              Curso / Grupo
            </label>
            <select
              className="form-select form-select-sm"
              value={selectedGroup || ""}
              onChange={(e) => updateFilter(e.target.value, "")}
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
              Turma Específica (Opcional)
            </label>
            <select
              className="form-select form-select-sm"
              value={selectedClass || ""}
              disabled={!selectedGroup}
              onChange={(e) =>
                updateFilter(
                  selectedGroup ? String(selectedGroup) : "",
                  e.target.value
                )
              }
            >
              <option value="">
                {selectedGroup
                  ? "Todas as turmas do curso"
                  : "Selecione um curso primeiro..."}
              </option>
              {filteredClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
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
