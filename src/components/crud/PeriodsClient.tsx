"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useUI } from "@/components/ui/UIProvider";
import { ModuleHeader } from "@/components/crud/ModuleHeader";
import { CrudModal, type SaveActionType } from "@/components/crud/CrudModal";

interface PeriodItem {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  shift: string;
  period_type: string;
  order: number;
}

const SHIFT_LABELS: Record<string, string> = {
  MORNING: "Manhã",
  MANHÃ: "Manhã",
  AFTERNOON: "Tarde",
  TARDE: "Tarde",
  EVENING: "Noite",
  NOITE: "Noite",
  EVENING_EXTRA: "Noite Extra",
  FULLDAY: "Integral",
};

const TYPE_LABELS: Record<string, string> = {
  CLASS: "Aula",
  INTERVAL: "Intervalo",
  LUNCH: "Almoço",
  DINNER: "Jantar",
  SHIFT_CHANGE: "Troca de Turno",
};

const emptyPeriod = {
  id: 0,
  name: "",
  start_time: "07:30",
  end_time: "08:20",
  shift: "MORNING",
  period_type: "CLASS",
  order: 1,
};

export function PeriodsClient({
  projectName,
  periods,
}: {
  projectName: string;
  periods: PeriodItem[];
}) {
  const router = useRouter();
  const { startLoading, stopLoading, showToast, confirmAction } = useUI();

  const [filterShift, setFilterShift] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [form, setForm] = useState(emptyPeriod);

  const filtered = periods.filter(
    (p) => !filterShift || p.shift === filterShift
  );

  const openCreate = () => {
    setCurrentIndex(null);
    setForm({
      ...emptyPeriod,
      order: periods.length + 1,
    });
    setModalOpen(true);
  };

  const openEdit = (index: number) => {
    const p = filtered[index];
    if (!p) return;
    setCurrentIndex(index);
    setForm({ ...p });
    setModalOpen(true);
  };

  const handleSave = async (action: SaveActionType) => {
    startLoading();
    try {
      const isEditing = currentIndex !== null;
      const res = await fetch("/api/crud/periods", {
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
          setForm({
            ...emptyPeriod,
            shift: form.shift,
            order: form.order + 1,
          });
        }
      } else {
        showToast(data.message || "Erro ao salvar período.", "danger");
      }
    } finally {
      stopLoading();
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirmAction({
      title: "Excluir Período",
      message: `Tem certeza que deseja excluir o período "${form.name}"?`,
      confirmText: "Sim, Excluir",
      confirmVariant: "danger",
    });
    if (!confirmed) return;

    startLoading();
    try {
      const res = await fetch(`/api/crud/periods?id=${form.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message, "success");
        setModalOpen(false);
        router.refresh();
      } else {
        showToast(data.message || "Erro ao excluir período.", "danger");
      }
    } finally {
      stopLoading();
    }
  };

  return (
    <div>
      <ModuleHeader
        icon="bi-clock"
        title="Períodos e Horários"
        description="Configure os tempos de aula, intervalos e turnos da grade"
        projectName={projectName}
        statLabel="Total de Períodos"
        statValue={periods.length}
        actionLabel="Novo Período"
        onAction={openCreate}
      />

      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white border-bottom py-3 d-flex gap-2 align-items-center">
          <select
            className="form-select form-select-sm"
            style={{ maxWidth: 220 }}
            value={filterShift}
            onChange={(e) => setFilterShift(e.target.value)}
          >
            <option value="">Todos os Turnos</option>
            <option value="MORNING">Manhã</option>
            <option value="AFTERNOON">Tarde</option>
            <option value="EVENING">Noite</option>
            <option value="EVENING_EXTRA">Noite Extra</option>
            <option value="FULLDAY">Integral</option>
          </select>
        </div>

        <div className="table-responsive">
          <table className="table align-middle table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th className="ps-4">Ordem</th>
                <th>Nome</th>
                <th>Horário</th>
                <th>Turno</th>
                <th>Tipo</th>
                <th className="text-end pe-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-muted">
                    Nenhum período cadastrado.
                  </td>
                </tr>
              ) : (
                filtered.map((p, idx) => (
                  <tr key={p.id}>
                    <td className="ps-4 fw-semibold">{p.order}º</td>
                    <td className="fw-bold">{p.name}</td>
                    <td>
                      <span className="badge bg-light text-dark border">
                        {p.start_time} às {p.end_time}
                      </span>
                    </td>
                    <td>{SHIFT_LABELS[p.shift] || p.shift}</td>
                    <td>
                      <span
                        className={`badge ${
                          p.period_type === "CLASS"
                            ? "bg-primary-subtle text-primary"
                            : "bg-secondary-subtle text-secondary"
                        }`}
                      >
                        {TYPE_LABELS[p.period_type] || p.period_type}
                      </span>
                    </td>
                    <td className="text-end pe-4">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => openEdit(idx)}
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
      </div>

      <CrudModal
        open={modalOpen}
        title={
          currentIndex !== null
            ? `Editar Período: ${form.name}`
            : "Novo Período"
        }
        icon="bi-clock"
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
          <div className="col-md-5">
            <label className="form-label small fw-semibold">
              Nome do Período *
            </label>
            <input
              type="text"
              className="form-control"
              required
              placeholder="Ex: 1º Horário"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label small fw-semibold">Turno *</label>
            <select
              className="form-select"
              value={form.shift}
              onChange={(e) => setForm({ ...form, shift: e.target.value })}
            >
              <option value="MORNING">Manhã</option>
              <option value="AFTERNOON">Tarde</option>
              <option value="EVENING">Noite</option>
              <option value="EVENING_EXTRA">Noite Extra</option>
              <option value="FULLDAY">Integral</option>
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label small fw-semibold">Ordem *</label>
            <input
              type="number"
              className="form-control"
              min={1}
              required
              value={form.order}
              onChange={(e) =>
                setForm({ ...form, order: Number(e.target.value) })
              }
            />
          </div>
          <div className="col-md-4">
            <label className="form-label small fw-semibold">Início *</label>
            <input
              type="time"
              className="form-control"
              required
              value={form.start_time}
              onChange={(e) =>
                setForm({ ...form, start_time: e.target.value })
              }
            />
          </div>
          <div className="col-md-4">
            <label className="form-label small fw-semibold">Término *</label>
            <input
              type="time"
              className="form-control"
              required
              value={form.end_time}
              onChange={(e) => setForm({ ...form, end_time: e.target.value })}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label small fw-semibold">
              Tipo de Período
            </label>
            <select
              className="form-select"
              value={form.period_type}
              onChange={(e) =>
                setForm({ ...form, period_type: e.target.value })
              }
            >
              <option value="CLASS">Aula</option>
              <option value="INTERVAL">Intervalo</option>
              <option value="LUNCH">Almoço</option>
              <option value="DINNER">Jantar</option>
              <option value="SHIFT_CHANGE">Troca de Turno</option>
            </select>
          </div>
        </div>
      </CrudModal>
    </div>
  );
}
