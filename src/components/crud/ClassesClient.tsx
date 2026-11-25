"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useUI } from "@/components/ui/UIProvider";
import { ModuleHeader } from "@/components/crud/ModuleHeader";
import { CrudModal, type SaveActionType } from "@/components/crud/CrudModal";
import { TablePagination, usePagination } from "@/components/crud/TablePagination";
import { AvailabilityMatrixModal } from "@/components/availability/AvailabilityMatrixModal";
import {
  GROUP_STATUS_META,
  normalizeGroupStatus,
} from "@/lib/schedule/group-helpers";

interface ClassItem {
  id: number;
  name: string;
  color: string;
  level: string;
  group_id: number;
  group_name: string;
  group_period: string;
  group_status: string;
  room_id: number | null;
  room_name: string;
  shifts: string[];
  active: boolean;
  allocated_lessons: number;
  total_lessons: number;
}

const SHIFT_OPTIONS = [
  { value: "MORNING", label: "Manhã" },
  { value: "AFTERNOON", label: "Tarde" },
  { value: "EVENING", label: "Noite" },
  { value: "EVENING_EXTRA", label: "Noite Extra" },
  { value: "FULLDAY", label: "Integral" },
];

const emptyClass = {
  id: 0,
  name: "",
  color: "#198754",
  level: "1",
  group_id: "",
  room_id: "",
  shifts: ["MORNING"] as string[],
  active: true,
};

export function ClassesClient({
  projectName,
  classes,
  groups,
  rooms,
}: {
  projectName: string;
  classes: ClassItem[];
  groups: { id: number; name: string; status: string }[];
  rooms: { id: number; name: string }[];
}) {
  const router = useRouter();
  const { startLoading, stopLoading, showToast, confirmAction } = useUI();

  const [query, setQuery] = useState("");
  const [filterGroup, setFilterGroup] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "PUBLISHED" | "PREVIEW" | "ALL">("ACTIVE");
  const [modalOpen, setModalOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [form, setForm] = useState(emptyClass);
  const [availClass, setAvailClass] = useState<ClassItem | null>(null);

  const visibleGroups = groups.filter((g) => {
    const st = normalizeGroupStatus(g.status);
    if (statusFilter === "ACTIVE") return st !== "INACTIVE";
    if (statusFilter === "PUBLISHED") return st === "PUBLISHED";
    if (statusFilter === "PREVIEW") return st === "PREVIEW";
    return true;
  });

  const hasSelection = Boolean(filterGroup || query.trim());

  const filtered = hasSelection
    ? classes.filter((c) => {
        const st = normalizeGroupStatus(c.group_status);
        if (statusFilter === "ACTIVE" && st === "INACTIVE") return false;
        if (statusFilter === "PUBLISHED" && st !== "PUBLISHED") return false;
        if (statusFilter === "PREVIEW" && st !== "PREVIEW") return false;
        if (filterGroup && filterGroup !== "ALL" && String(c.group_id) !== filterGroup) {
          return false;
        }
        if (query.trim()) {
          const q = query.trim().toLowerCase();
          return (
            c.name.toLowerCase().includes(q) ||
            c.group_name.toLowerCase().includes(q) ||
            c.group_period.toLowerCase().includes(q)
          );
        }
        return true;
      })
    : [];

  const {
    page,
    pageSize,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
    paginatedItems,
    setPage,
    setPageSize,
  } = usePagination(filtered, 10);

  const openCreate = () => {
    setCurrentIndex(null);
    const defaultGroupId =
      filterGroup && filterGroup !== "ALL"
        ? filterGroup
        : visibleGroups[0]
        ? String(visibleGroups[0].id)
        : groups[0]
        ? String(groups[0].id)
        : "";
    setForm({
      ...emptyClass,
      group_id: defaultGroupId,
    });
    setModalOpen(true);
  };

  const openEdit = (index: number) => {
    const c = filtered[index];
    if (!c) return;
    setCurrentIndex(index);
    setForm({
      id: c.id,
      name: c.name,
      color: c.color,
      level: c.level,
      group_id: String(c.group_id),
      room_id: c.room_id ? String(c.room_id) : "",
      shifts: c.shifts || [],
      active: c.active,
    });
    setModalOpen(true);
  };

  const toggleShift = (shiftVal: string) => {
    setForm((prev) => {
      const exists = prev.shifts.includes(shiftVal);
      return {
        ...prev,
        shifts: exists
          ? prev.shifts.filter((s) => s !== shiftVal)
          : [...prev.shifts, shiftVal],
      };
    });
  };

  const handleSave = async (action: SaveActionType) => {
    startLoading();
    try {
      const isEditing = currentIndex !== null;
      const res = await fetch("/api/crud/classes", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          group_id: Number(form.group_id),
          room_id: form.room_id ? Number(form.room_id) : null,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message, "success");
        router.refresh();
        if (action === "save") {
          setModalOpen(false);
        } else if (action === "save_and_add_another") {
          setCurrentIndex(null);
          setForm({
            ...emptyClass,
            group_id: form.group_id,
          });
        }
      } else {
        showToast(data.message || "Erro ao salvar turma.", "danger");
      }
    } finally {
      stopLoading();
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirmAction({
      title: "Excluir Turma",
      message: `Tem certeza que deseja excluir a turma "${form.name}"?`,
      confirmText: "Sim, Excluir",
      confirmVariant: "danger",
    });
    if (!confirmed) return;

    startLoading();
    try {
      const res = await fetch(`/api/crud/classes?id=${form.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message, "success");
        setModalOpen(false);
        router.refresh();
      } else {
        showToast(data.message || "Erro ao excluir turma.", "danger");
      }
    } finally {
      stopLoading();
    }
  };

  return (
    <div>
      <ModuleHeader
        icon="bi-mortarboard"
        title="Turmas"
        description="Gerencie as turmas acadêmicas, séries/níveis, turnos e salas de aula"
        projectName={projectName}
        statLabel="Total de Turmas"
        statValue={classes.length}
        actionLabel="Nova Turma"
        onAction={openCreate}
      />

      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white border-bottom py-3 d-flex flex-wrap gap-2">
          <select
            className="form-select form-select-sm"
            style={{ maxWidth: 290 }}
            value={filterGroup}
            onChange={(e) => setFilterGroup(e.target.value)}
          >
            <option value="">Selecione o Curso / Período...</option>
            {visibleGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
            <option value="ALL">Todos os Cursos</option>
          </select>

          <select
            className="form-select form-select-sm"
            style={{ maxWidth: 220 }}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as "ACTIVE" | "PUBLISHED" | "PREVIEW" | "ALL");
              setFilterGroup("");
            }}
          >
            <option value="ACTIVE">Períodos Ativos (Pub + Prévia)</option>
            <option value="PUBLISHED">Somente Publicados</option>
            <option value="PREVIEW">Somente Prévia</option>
            <option value="ALL">Todos (incluindo Inativos)</option>
          </select>

          <div className="input-group input-group-sm" style={{ maxWidth: 300 }}>
            <span className="input-group-text bg-light">
              <i className="bi bi-search" />
            </span>
            <input
              type="text"
              className="form-control"
              placeholder="Buscar turma ou período..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="table-responsive">
          <table className="table align-middle table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th className="ps-4">Turma</th>
                <th>Curso / Período</th>
                <th className="text-center">Nível / Semestre</th>
                <th>Turnos</th>
                <th>Sala Padrão</th>
                <th className="text-center">Aulas Alocadas</th>
                <th className="text-center">Status</th>
                <th className="text-end pe-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {!hasSelection ? (
                <tr>
                  <td colSpan={8} className="text-center py-5 text-muted">
                    <i className="bi bi-funnel me-2" />
                    Selecione um <strong>Curso / Período</strong> acima ou
                    digite na busca para visualizar as turmas.
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-4 text-muted">
                    Nenhuma turma encontrada.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((c, idx) => {
                  const st = normalizeGroupStatus(c.group_status);
                  const stMeta = GROUP_STATUS_META[st];
                  return (
                  <tr key={c.id}>
                    <td className="ps-4">
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <span
                          className="rounded-circle d-inline-block flex-shrink-0"
                          style={{
                            width: 12,
                            height: 12,
                            backgroundColor: c.color,
                          }}
                        />
                        <span className="fw-bold">{c.name}</span>
                        {c.group_period && (
                          <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle">
                            {c.group_period}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div>{c.group_name}</div>
                      {st !== "PUBLISHED" && (
                        <span className={`badge ${stMeta.badgeClass} mt-1`}>
                          {stMeta.label}
                        </span>
                      )}
                    </td>
                    <td className="text-center">{c.level}</td>
                    <td>
                      <div className="d-flex flex-wrap gap-1">
                        {c.shifts.map((sh) => {
                          const opt = SHIFT_OPTIONS.find(
                            (o) => o.value === sh
                          );
                          return (
                            <span
                              key={sh}
                              className="badge bg-info-subtle text-info border border-info-subtle"
                            >
                              {opt ? opt.label : sh}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td>
                      {c.room_name || (
                        <span className="text-muted small">Não definida</span>
                      )}
                    </td>
                    <td className="text-center">
                      {c.total_lessons > 0 ? (
                        <span
                          className={`badge border ${
                            c.allocated_lessons >= c.total_lessons
                              ? "bg-success-subtle text-success border-success-subtle"
                              : c.allocated_lessons > 0
                              ? "bg-warning-subtle text-warning-emphasis border-warning-subtle"
                              : "bg-secondary-subtle text-secondary border-secondary-subtle"
                          }`}
                          title={`${c.allocated_lessons} alocadas no horário de ${c.total_lessons} aulas cadastradas`}
                        >
                          <i className="bi bi-calendar3 me-1" />
                          {c.allocated_lessons} / {c.total_lessons}
                        </span>
                      ) : (
                        <span
                          className="badge bg-secondary-subtle text-secondary border border-secondary-subtle"
                          title="Nenhuma aula ativa cadastrada para esta turma"
                        >
                          {c.allocated_lessons > 0
                            ? `${c.allocated_lessons} alocadas`
                            : "0"}
                        </span>
                      )}
                    </td>
                    <td className="text-center">
                      <span
                        className={`badge ${
                          c.active
                            ? "bg-success-subtle text-success"
                            : "bg-secondary-subtle text-secondary"
                        }`}
                      >
                        {c.active ? "Ativa" : "Inativa"}
                      </span>
                    </td>
                    <td className="text-end pe-4">
                      <div className="btn-group btn-group-sm">
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => setAvailClass(c)}
                          title="Disponibilidade da Turma"
                        >
                          <i className="bi bi-calendar-check me-1" />
                          Disponibilidade
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-primary"
                          onClick={() => openEdit(startIndex + idx)}
                        >
                          <i className="bi bi-pencil-square me-1" />
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={page}
          pageSize={pageSize}
          totalPages={totalPages}
          totalItems={totalItems}
          startIndex={startIndex}
          endIndex={endIndex}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      <CrudModal
        open={modalOpen}
        title={
          currentIndex !== null ? `Editar Turma: ${form.name}` : "Nova Turma"
        }
        icon="bi-mortarboard"
        isEditing={currentIndex !== null}
        hasPrev={currentIndex !== null && currentIndex > 0}
        hasNext={currentIndex !== null && currentIndex < filtered.length - 1}
        onPrev={() => currentIndex !== null && openEdit(currentIndex - 1)}
        onNext={() => currentIndex !== null && openEdit(currentIndex + 1)}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSave}
        onDelete={currentIndex !== null ? handleDelete : undefined}
      >
        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label small fw-semibold">
              Nome da Turma *
            </label>
            <input
              type="text"
              className="form-control"
              required
              placeholder="Ex: ADS - 1º Semestre"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label small fw-semibold">
              Nível / Semestre *
            </label>
            <input
              type="text"
              className="form-control"
              required
              placeholder="Ex: 1º Semestre"
              value={form.level}
              onChange={(e) => setForm({ ...form, level: e.target.value })}
            />
          </div>
          <div className="col-md-2">
            <label className="form-label small fw-semibold">Cor</label>
            <input
              type="color"
              className="form-control form-control-color w-100"
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
            />
          </div>

          <div className="col-md-6">
            <label className="form-label small fw-semibold">
              Curso / Grupo *
            </label>
            <select
              className="form-select"
              required
              value={form.group_id}
              onChange={(e) => setForm({ ...form, group_id: e.target.value })}
            >
              <option value="">Selecione um curso...</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-md-6">
            <label className="form-label small fw-semibold">
              Sala Padrão (Opcional)
            </label>
            <select
              className="form-select"
              value={form.room_id}
              onChange={(e) => setForm({ ...form, room_id: e.target.value })}
            >
              <option value="">Nenhuma sala padrão</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12">
            <label className="form-label small fw-semibold d-block mb-2">
              Turnos Permitidos para a Turma
            </label>
            <div className="d-flex flex-wrap gap-3 bg-light p-3 rounded-3 border">
              {SHIFT_OPTIONS.map((opt) => (
                <div key={opt.value} className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id={`shift_${opt.value}`}
                    checked={form.shifts.includes(opt.value)}
                    onChange={() => toggleShift(opt.value)}
                  />
                  <label
                    className="form-check-label"
                    htmlFor={`shift_${opt.value}`}
                  >
                    {opt.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="col-12">
            <div className="form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="chk_class_active"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              <label className="form-check-label" htmlFor="chk_class_active">
                Turma Ativa
              </label>
            </div>
          </div>
        </div>
      </CrudModal>

      <AvailabilityMatrixModal
        open={!!availClass}
        entityType="class"
        entityId={availClass?.id || null}
        entityName={availClass?.name || ""}
        onClose={() => setAvailClass(null)}
      />
    </div>
  );
}
