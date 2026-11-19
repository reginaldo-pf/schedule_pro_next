"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useUI } from "@/components/ui/UIProvider";
import { ModuleHeader } from "@/components/crud/ModuleHeader";
import { CrudModal, type SaveActionType } from "@/components/crud/CrudModal";
import { TablePagination, usePagination } from "@/components/crud/TablePagination";

interface SubjectItem {
  id: number;
  name: string;
  abbreviated_name: string;
  color: string;
  group_id: number;
  group_name: string;
  room_id: number | null;
  room_name: string;
  active: boolean;
}

const emptySubject = {
  id: 0,
  name: "",
  abbreviated_name: "",
  color: "#0d6efd",
  group_id: "",
  room_id: "",
  active: true,
};

export function SubjectsClient({
  projectName,
  subjects,
  groups,
  rooms,
}: {
  projectName: string;
  subjects: SubjectItem[];
  groups: { id: number; name: string }[];
  rooms: { id: number; name: string }[];
}) {
  const router = useRouter();
  const { startLoading, stopLoading, showToast, confirmAction } = useUI();

  const [query, setQuery] = useState("");
  const [filterGroup, setFilterGroup] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [form, setForm] = useState(emptySubject);

  const filtered = subjects.filter((s) => {
    if (filterGroup && String(s.group_id) !== filterGroup) return false;
    if (query) {
      const q = query.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.abbreviated_name.toLowerCase().includes(q)
      );
    }
    return true;
  });

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
    setForm({
      ...emptySubject,
      group_id: filterGroup || (groups[0] ? String(groups[0].id) : ""),
    });
    setModalOpen(true);
  };

  const openEdit = (index: number) => {
    const s = filtered[index];
    if (!s) return;
    setCurrentIndex(index);
    setForm({
      id: s.id,
      name: s.name,
      abbreviated_name: s.abbreviated_name,
      color: s.color,
      group_id: String(s.group_id),
      room_id: s.room_id ? String(s.room_id) : "",
      active: s.active,
    });
    setModalOpen(true);
  };

  const handleSave = async (action: SaveActionType) => {
    startLoading();
    try {
      const isEditing = currentIndex !== null;
      const res = await fetch("/api/crud/subjects", {
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
            ...emptySubject,
            group_id: form.group_id,
          });
        }
      } else {
        showToast(data.message || "Erro ao salvar disciplina.", "danger");
      }
    } finally {
      stopLoading();
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirmAction({
      title: "Excluir Disciplina",
      message: `Tem certeza que deseja excluir a disciplina "${form.name}"?`,
      confirmText: "Sim, Excluir",
      confirmVariant: "danger",
    });
    if (!confirmed) return;

    startLoading();
    try {
      const res = await fetch(`/api/crud/subjects?id=${form.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message, "success");
        setModalOpen(false);
        router.refresh();
      } else {
        showToast(data.message || "Erro ao excluir disciplina.", "danger");
      }
    } finally {
      stopLoading();
    }
  };

  return (
    <div>
      <ModuleHeader
        icon="bi-book"
        title="Disciplinas"
        description="Gerencie os componentes curriculares, cores de identificação e salas padrão"
        projectName={projectName}
        statLabel="Total de Disciplinas"
        statValue={subjects.length}
        actionLabel="Nova Disciplina"
        onAction={openCreate}
      />

      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white border-bottom py-3 d-flex flex-wrap gap-2">
          <select
            className="form-select form-select-sm"
            style={{ maxWidth: 260 }}
            value={filterGroup}
            onChange={(e) => setFilterGroup(e.target.value)}
          >
            <option value="">Todos os Cursos / Grupos</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>

          <div className="input-group input-group-sm" style={{ maxWidth: 320 }}>
            <span className="input-group-text bg-light">
              <i className="bi bi-search" />
            </span>
            <input
              type="text"
              className="form-control"
              placeholder="Buscar disciplina ou sigla..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="table-responsive">
          <table className="table align-middle table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th className="ps-4">Disciplina</th>
                <th>Sigla</th>
                <th>Curso / Grupo</th>
                <th>Sala Padrão</th>
                <th className="text-center">Status</th>
                <th className="text-end pe-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-muted">
                    Nenhuma disciplina encontrada.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((s, idx) => (
                  <tr key={s.id}>
                    <td className="ps-4">
                      <div className="d-flex align-items-center gap-2">
                        <span
                          className="rounded-2 d-inline-block flex-shrink-0"
                          style={{
                            width: 14,
                            height: 14,
                            backgroundColor: s.color,
                          }}
                        />
                        <span className="fw-bold">{s.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="badge bg-light text-dark border">
                        {s.abbreviated_name}
                      </span>
                    </td>
                    <td>{s.group_name}</td>
                    <td>
                      {s.room_name || (
                        <span className="text-muted small">Não definida</span>
                      )}
                    </td>
                    <td className="text-center">
                      <span
                        className={`badge ${
                          s.active
                            ? "bg-success-subtle text-success"
                            : "bg-secondary-subtle text-secondary"
                        }`}
                      >
                        {s.active ? "Ativa" : "Inativa"}
                      </span>
                    </td>
                    <td className="text-end pe-4">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => openEdit(startIndex + idx)}
                      >
                        <i className="bi bi-pencil-square me-1" />
                        Editar
                      </button>
                    </td>
                  </tr>
                ))
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
          currentIndex !== null
            ? `Editar Disciplina: ${form.name}`
            : "Nova Disciplina"
        }
        icon="bi-book"
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
              Nome da Disciplina *
            </label>
            <input
              type="text"
              className="form-control"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label small fw-semibold">
              Sigla / Abreviação *
            </label>
            <input
              type="text"
              className="form-control"
              required
              value={form.abbreviated_name}
              onChange={(e) =>
                setForm({ ...form, abbreviated_name: e.target.value })
              }
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
            <div className="form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="chk_subject_active"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              <label className="form-check-label" htmlFor="chk_subject_active">
                Disciplina Ativa
              </label>
            </div>
          </div>
        </div>
      </CrudModal>
    </div>
  );
}
