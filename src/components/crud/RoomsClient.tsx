"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useUI } from "@/components/ui/UIProvider";
import { ModuleHeader } from "@/components/crud/ModuleHeader";
import { CrudModal, type SaveActionType } from "@/components/crud/CrudModal";
import { AvailabilityMatrixModal } from "@/components/availability/AvailabilityMatrixModal";

interface RoomItem {
  id: number;
  name: string;
  description: string;
  capacity: number;
  simultaneous_lessons: number;
  active: boolean;
  lessons_count: number;
}

const emptyRoom = {
  id: 0,
  name: "",
  description: "",
  capacity: 30,
  simultaneous_lessons: 1,
  active: true,
};

export function RoomsClient({
  projectName,
  rooms,
}: {
  projectName: string;
  rooms: RoomItem[];
}) {
  const router = useRouter();
  const { startLoading, stopLoading, showToast, confirmAction } = useUI();

  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [form, setForm] = useState(emptyRoom);

  const [availRoom, setAvailRoom] = useState<RoomItem | null>(null);

  const filtered = rooms.filter(
    (r) =>
      r.name.toLowerCase().includes(query.toLowerCase()) ||
      r.description.toLowerCase().includes(query.toLowerCase())
  );

  const openCreate = () => {
    setCurrentIndex(null);
    setForm(emptyRoom);
    setModalOpen(true);
  };

  const openEdit = (index: number) => {
    const r = filtered[index];
    if (!r) return;
    setCurrentIndex(index);
    setForm({
      id: r.id,
      name: r.name,
      description: r.description,
      capacity: r.capacity,
      simultaneous_lessons: r.simultaneous_lessons,
      active: r.active,
    });
    setModalOpen(true);
  };

  const handleSave = async (action: SaveActionType) => {
    startLoading();
    try {
      const isEditing = currentIndex !== null;
      const res = await fetch("/api/crud/rooms", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message, "success");
        router.refresh();
        if (action === "save") {
          setModalOpen(false);
        } else if (action === "save_and_add_another") {
          setCurrentIndex(null);
          setForm(emptyRoom);
        }
      } else {
        showToast(data.message || "Erro ao salvar sala.", "danger");
      }
    } finally {
      stopLoading();
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirmAction({
      title: "Excluir Sala",
      message: `Tem certeza que deseja excluir a sala "${form.name}"?`,
      confirmText: "Sim, Excluir",
      confirmVariant: "danger",
    });
    if (!confirmed) return;

    startLoading();
    try {
      const res = await fetch(`/api/crud/rooms?id=${form.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message, "success");
        setModalOpen(false);
        router.refresh();
      } else {
        showToast(data.message || "Erro ao excluir sala.", "danger");
      }
    } finally {
      stopLoading();
    }
  };

  return (
    <div>
      <ModuleHeader
        icon="bi-door-open"
        title="Salas e Laboratórios"
        description="Gerencie os ambientes físicos, capacidade de alunos e limite de aulas simultâneas"
        projectName={projectName}
        statLabel="Total de Salas"
        statValue={rooms.length}
        actionLabel="Nova Sala"
        onAction={openCreate}
      />

      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white border-bottom py-3">
          <div className="input-group input-group-sm" style={{ maxWidth: 320 }}>
            <span className="input-group-text bg-light">
              <i className="bi bi-search" />
            </span>
            <input
              type="text"
              className="form-control"
              placeholder="Buscar sala ou descrição..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="table-responsive">
          <table className="table align-middle table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th className="ps-4">Sala / Ambiente</th>
                <th className="text-center">Capacidade</th>
                <th className="text-center">Aulas Simultâneas</th>
                <th className="text-center">Status</th>
                <th className="text-end pe-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-4 text-muted">
                    Nenhuma sala encontrada.
                  </td>
                </tr>
              ) : (
                filtered.map((r, idx) => (
                  <tr key={r.id}>
                    <td className="ps-4">
                      <div className="fw-bold">{r.name}</div>
                      {r.description && (
                        <small className="text-muted">{r.description}</small>
                      )}
                    </td>
                    <td className="text-center">{r.capacity} lugares</td>
                    <td className="text-center">
                      <span className="badge bg-info-subtle text-info border border-info-subtle">
                        Máx: {r.simultaneous_lessons}
                      </span>
                    </td>
                    <td className="text-center">
                      <span
                        className={`badge ${
                          r.active
                            ? "bg-success-subtle text-success"
                            : "bg-secondary-subtle text-secondary"
                        }`}
                      >
                        {r.active ? "Ativa" : "Inativa"}
                      </span>
                    </td>
                    <td className="text-end pe-4">
                      <div className="btn-group btn-group-sm">
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => setAvailRoom(r)}
                          title="Disponibilidade da Sala"
                        >
                          <i className="bi bi-calendar-check me-1" />
                          Disponibilidade
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-primary"
                          onClick={() => openEdit(idx)}
                        >
                          <i className="bi bi-pencil-square me-1" />
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CrudModal
        open={modalOpen}
        title={
          currentIndex !== null ? `Editar Sala: ${form.name}` : "Nova Sala"
        }
        icon="bi-door-open"
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
              Nome da Sala *
            </label>
            <input
              type="text"
              className="form-control"
              required
              placeholder="Ex: Laboratório de Redes 01"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label small fw-semibold">
              Capacidade (Alunos)
            </label>
            <input
              type="number"
              className="form-control"
              min={1}
              value={form.capacity}
              onChange={(e) =>
                setForm({ ...form, capacity: Number(e.target.value) })
              }
            />
          </div>
          <div className="col-md-3">
            <label className="form-label small fw-semibold">
              Aulas Simultâneas
            </label>
            <input
              type="number"
              className="form-control"
              min={1}
              value={form.simultaneous_lessons}
              onChange={(e) =>
                setForm({
                  ...form,
                  simultaneous_lessons: Number(e.target.value),
                })
              }
            />
          </div>
          <div className="col-12">
            <label className="form-label small fw-semibold">
              Descrição / Observações
            </label>
            <textarea
              className="form-control"
              rows={2}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>
          <div className="col-12">
            <div className="form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="chk_room_active"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              <label className="form-check-label" htmlFor="chk_room_active">
                Sala Ativa
              </label>
            </div>
          </div>
        </div>
      </CrudModal>

      <AvailabilityMatrixModal
        open={!!availRoom}
        entityType="room"
        entityId={availRoom?.id || null}
        entityName={availRoom?.name || ""}
        onClose={() => setAvailRoom(null)}
      />
    </div>
  );
}
