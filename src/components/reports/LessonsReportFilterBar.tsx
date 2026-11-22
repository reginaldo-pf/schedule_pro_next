"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUI } from "@/components/ui/UIProvider";

export function LessonsReportFilterBar({
  groups,
  classes,
  teachers,
  rooms,
  selectedGroup,
  selectedClass,
  selectedTeacher,
  selectedRoom,
  initialQuery = "",
}: {
  groups: { id: number; name: string }[];
  classes: { id: number; group_id: number; name: string }[];
  teachers: { id: number; name: string }[];
  rooms: { id: number; name: string }[];
  selectedGroup: string;
  selectedClass: number | null;
  selectedTeacher: number | null;
  selectedRoom: number | null;
  initialQuery?: string;
}) {
  const router = useRouter();
  const { startLoading, stopLoading } = useUI();
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    setQuery(initialQuery);
    stopLoading();
  }, [
    selectedGroup,
    selectedClass,
    selectedTeacher,
    selectedRoom,
    initialQuery,
    stopLoading,
  ]);

  const isAllCourses = selectedGroup === "ALL";
  const hasCourseSelection = Boolean(selectedGroup);

  const filteredClasses = classes.filter(
    (c) =>
      !selectedGroup || isAllCourses || String(c.group_id) === selectedGroup
  );

  const updateFilter = (next: {
    group?: string;
    classId?: string;
    teacher?: string;
    room?: string;
    q?: string;
  }) => {
    startLoading();
    const params = new URLSearchParams();
    const g = next.group !== undefined ? next.group : selectedGroup;
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

    if (g) params.set("group", g);
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
        <div className="row g-3 align-items-end">
          <div className="col-12 col-md-3">
            <label className="form-label small fw-semibold mb-1">
              Curso / Grupo
            </label>
            <select
              className="form-select form-select-sm"
              value={selectedGroup}
              onChange={(e) =>
                updateFilter({
                  group: e.target.value,
                  classId: "",
                  teacher: "",
                  room: "",
                })
              }
            >
              <option value="">Selecione o Curso / Grupo...</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
              <option value="ALL">Todos os Cursos</option>
            </select>
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
                  ? "Selecione a Turma..."
                  : "Selecione um curso primeiro..."}
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
                  ? "Selecione o Professor..."
                  : "Selecione um curso primeiro..."}
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
                {hasCourseSelection
                  ? "Selecione a Sala..."
                  : "Selecione um curso primeiro..."}
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
                  group: "",
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
