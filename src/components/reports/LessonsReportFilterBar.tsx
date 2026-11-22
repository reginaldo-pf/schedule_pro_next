"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUI } from "@/components/ui/UIProvider";
import {
  MultiSelectCheckbox,
  type MultiSelectOption,
} from "@/components/reports/MultiSelectCheckbox";

export function LessonsReportFilterBar({
  groupOptions,
  selectedGroupIds,
  classes,
  teachers,
  rooms,
  selectedClass,
  selectedTeacher,
  selectedRoom,
  initialQuery = "",
}: {
  groupOptions: MultiSelectOption[];
  selectedGroupIds: number[];
  classes: { id: number; group_id: number; name: string }[];
  teachers: { id: number; name: string }[];
  rooms: { id: number; name: string }[];
  selectedClass: number | null;
  selectedTeacher: number | null;
  selectedRoom: number | null;
  initialQuery?: string;
}) {
  const router = useRouter();
  const { startLoading, stopLoading } = useUI();
  const [query, setQuery] = useState(initialQuery);

  const selectedValues = selectedGroupIds.map(String);
  const groupsKey = selectedValues.join(",");

  useEffect(() => {
    setQuery(initialQuery);
    stopLoading();
  }, [
    groupsKey,
    selectedClass,
    selectedTeacher,
    selectedRoom,
    initialQuery,
    stopLoading,
  ]);

  const hasCourseSelection = selectedGroupIds.length > 0;
  const matchingSet = new Set(selectedGroupIds);
  const filteredClasses = classes.filter(
    (c) => matchingSet.size === 0 || matchingSet.has(c.group_id)
  );

  const updateFilter = (next: {
    groups?: string[];
    classId?: string;
    teacher?: string;
    room?: string;
    q?: string;
  }) => {
    startLoading();
    const params = new URLSearchParams();
    const gs = next.groups !== undefined ? next.groups : selectedValues;
    const c =
      next.classId !== undefined
        ? next.classId
        : selectedClass
        ? String(selectedClass)
        : "";
    const t =
      next.teacher !== undefined
        ? next.teacher
        : selectedTeacher
        ? String(selectedTeacher)
        : "";
    const r =
      next.room !== undefined
        ? next.room
        : selectedRoom
        ? String(selectedRoom)
        : "";
    const q = next.q !== undefined ? next.q : query;

    if (gs.length > 0) params.set("groups", gs.join(","));
    if (c) params.set("class", c);
    if (t) params.set("teacher", t);
    if (r) params.set("room", r);
    if (q.trim()) params.set("q", q.trim());

    const qs = params.toString();
    router.push(qs ? `/lessons/report?${qs}` : "/lessons/report");
  };

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed === initialQuery) return;
    const timer = setTimeout(() => {
      updateFilter({ q: trimmed });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="card border-0 shadow-sm mb-3 no-print">
      <div className="card-body p-3">
        <div className="row g-2 align-items-end">
          <div className="col-12 col-md-3">
            <label className="form-label small fw-semibold mb-1">
              Cursos / Períodos
            </label>
            <MultiSelectCheckbox
              options={groupOptions}
              selected={selectedValues}
              placeholder="Selecione Cursos / Períodos..."
              onChange={(nextGroups) =>
                updateFilter({
                  groups: nextGroups,
                  classId: "",
                  teacher: "",
                  room: "",
                })
              }
            />
          </div>

          <div className="col-12 col-md-2">
            <label className="form-label small fw-semibold mb-1">Turma</label>
            <select
              className="form-select form-select-sm"
              value={selectedClass || ""}
              disabled={!hasCourseSelection}
              onChange={(e) => updateFilter({ classId: e.target.value })}
            >
              <option value="">
                {hasCourseSelection
                  ? "Todas as Turmas..."
                  : "Selecione curso/período..."}
              </option>
              {filteredClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-2">
            <label className="form-label small fw-semibold mb-1">
              Professor(a)
            </label>
            <select
              className="form-select form-select-sm"
              value={selectedTeacher || ""}
              disabled={!hasCourseSelection}
              onChange={(e) => updateFilter({ teacher: e.target.value })}
            >
              <option value="">
                {hasCourseSelection
                  ? "Todos os Professores..."
                  : "Selecione curso/período..."}
              </option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-2">
            <label className="form-label small fw-semibold mb-1">Sala</label>
            <select
              className="form-select form-select-sm"
              value={selectedRoom || ""}
              disabled={!hasCourseSelection}
              onChange={(e) => updateFilter({ room: e.target.value })}
            >
              <option value="">
                {hasCourseSelection ? "Todas..." : "Selecione curso..."}
              </option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-2">
            <label className="form-label small fw-semibold mb-1">
              Pesquisa Rápida
            </label>
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Buscar aula ou professor..."
              title="Digite o nome da aula/disciplina ou do professor"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="col-12 col-md-1 text-md-end">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm w-100"
              title="Limpar Filtros"
              onClick={() => {
                setQuery("");
                updateFilter({
                  groups: [],
                  classId: "",
                  teacher: "",
                  room: "",
                  q: "",
                });
              }}
            >
              <i className="bi bi-x-circle" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
