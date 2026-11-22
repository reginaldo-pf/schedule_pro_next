"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUI } from "@/components/ui/UIProvider";
import {
  MultiSelectCheckbox,
  type MultiSelectOption,
} from "@/components/reports/MultiSelectCheckbox";

export function CourseReportFilterBar({
  groupOptions,
  selectedGroupIds,
  classes,
  selectedClass,
}: {
  groupOptions: MultiSelectOption[];
  selectedGroupIds: number[];
  classes: { id: number; group_id: number; name: string }[];
  selectedClass: number | null;
}) {
  const router = useRouter();
  const { startLoading, stopLoading } = useUI();

  const selectedValues = selectedGroupIds.map(String);
  const groupsKey = selectedValues.join(",");

  useEffect(() => {
    stopLoading();
  }, [groupsKey, selectedClass, stopLoading]);

  const hasSelection = selectedGroupIds.length > 0;
  const matchingSet = new Set(selectedGroupIds);
  const filteredClasses = classes.filter(
    (c) => matchingSet.size === 0 || matchingSet.has(c.group_id)
  );

  const updateFilter = (next: { groups?: string[]; classId?: string }) => {
    startLoading();
    const params = new URLSearchParams();
    const gs = next.groups !== undefined ? next.groups : selectedValues;
    const c =
      next.classId !== undefined
        ? next.classId
        : selectedClass
        ? String(selectedClass)
        : "";

    if (gs.length > 0) params.set("groups", gs.join(","));
    if (c) params.set("class", c);

    const qs = params.toString();
    router.push(qs ? `/reports/course?${qs}` : "/reports/course");
  };

  return (
    <div className="card border-0 shadow-sm mb-4">
      <div className="card-body p-3">
        <div className="row g-3 align-items-end">
          <div className="col-md-5">
            <label className="form-label small fw-semibold mb-1">
              Cursos / Períodos
            </label>
            <MultiSelectCheckbox
              options={groupOptions}
              selected={selectedValues}
              placeholder="Selecione Cursos / Períodos..."
              onChange={(nextGroups) =>
                updateFilter({ groups: nextGroups, classId: "" })
              }
            />
          </div>
          <div className="col-md-5">
            <label className="form-label small fw-semibold mb-1">
              Turma Específica (Opcional)
            </label>
            <select
              className="form-select form-select-sm"
              value={selectedClass || ""}
              disabled={!hasSelection}
              onChange={(e) => updateFilter({ classId: e.target.value })}
            >
              <option value="">
                {hasSelection
                  ? "Todas as turmas filtradas"
                  : "Selecione curso/período primeiro..."}
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
              onClick={() => updateFilter({ groups: [], classId: "" })}
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
