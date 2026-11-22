"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUI } from "@/components/ui/UIProvider";
import {
  MultiSelectCheckbox,
  type MultiSelectOption,
} from "@/components/reports/MultiSelectCheckbox";

export function TeacherReportFilterBar({
  groupOptions,
  selectedGroupIds,
  teachers,
  selectedTeacher,
}: {
  groupOptions: MultiSelectOption[];
  selectedGroupIds: number[];
  teachers: { id: number; name: string }[];
  selectedTeacher: number | null;
}) {
  const router = useRouter();
  const { startLoading, stopLoading } = useUI();

  const selectedValues = selectedGroupIds.map(String);
  const groupsKey = selectedValues.join(",");

  useEffect(() => {
    stopLoading();
  }, [groupsKey, selectedTeacher, stopLoading]);

  const updateFilter = (next: { groups?: string[]; teacher?: string }) => {
    startLoading();
    const params = new URLSearchParams();
    const gs = next.groups !== undefined ? next.groups : selectedValues;
    const t =
      next.teacher !== undefined
        ? next.teacher
        : selectedTeacher
        ? String(selectedTeacher)
        : "";

    if (gs.length > 0) params.set("groups", gs.join(","));
    if (t) params.set("teacher", t);

    const qs = params.toString();
    router.push(qs ? `/reports/teacher?${qs}` : "/reports/teacher");
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
              onChange={(nextGroups) => updateFilter({ groups: nextGroups })}
            />
          </div>
          <div className="col-md-5">
            <label className="form-label small fw-semibold mb-1">
              Professor Específico
            </label>
            <select
              className="form-select form-select-sm"
              value={selectedTeacher || ""}
              onChange={(e) => updateFilter({ teacher: e.target.value })}
            >
              <option value="">Todos os Professores...</option>
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
              onClick={() => updateFilter({ groups: [], teacher: "" })}
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
