"use client";

import React, { useEffect } from "react";
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
}: {
  groups: { id: number; name: string }[];
  classes: { id: number; group_id: number; name: string }[];
  teachers: { id: number; name: string }[];
  rooms: { id: number; name: string }[];
  selectedGroup: number | null;
  selectedClass: number | null;
  selectedTeacher: number | null;
  selectedRoom: number | null;
}) {
  const router = useRouter();
  const { startLoading, stopLoading } = useUI();

  useEffect(() => {
    stopLoading();
  }, [selectedGroup, selectedClass, selectedTeacher, selectedRoom, stopLoading]);

  const filteredClasses = classes.filter(
    (c) => !selectedGroup || c.group_id === selectedGroup
  );

  const updateFilter = (next: {
    group?: string;
    classId?: string;
    teacher?: string;
    room?: string;
  }) => {
    startLoading();
    const params = new URLSearchParams();
    const g =
      next.group !== undefined
        ? next.group
        : selectedGroup
        ? String(selectedGroup)
        : "";
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

    if (g) params.set("group", g);
    if (c) params.set("class", c);
    if (t) params.set("teacher", t);
    if (r) params.set("room", r);

    const qs = params.toString();
    router.push(qs ? `/lessons/report?${qs}` : "/lessons/report");
  };

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
              value={selectedGroup || ""}
              onChange={(e) =>
                updateFilter({ group: e.target.value, classId: "" })
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

          <div className="col-12 col-md-3">
            <label className="form-label small fw-semibold mb-1">Turma</label>
            <select
              className="form-select form-select-sm"
              value={selectedClass || ""}
              onChange={(e) => updateFilter({ classId: e.target.value })}
            >
              <option value="">Todas as Turmas</option>
              {filteredClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-3">
            <label className="form-label small fw-semibold mb-1">
              Professor(a)
            </label>
            <select
              className="form-select form-select-sm"
              value={selectedTeacher || ""}
              onChange={(e) => updateFilter({ teacher: e.target.value })}
            >
              <option value="">Todos os Professores</option>
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
              onChange={(e) => updateFilter({ room: e.target.value })}
            >
              <option value="">Todas as Salas</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-1 text-md-end">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm w-100"
              title="Limpar Filtros"
              onClick={() =>
                updateFilter({ group: "", classId: "", teacher: "", room: "" })
              }
            >
              <i className="bi bi-x-circle" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
