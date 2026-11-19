"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useUI } from "@/components/ui/UIProvider";
import { ModuleHeader } from "@/components/crud/ModuleHeader";
import { CrudModal, type SaveActionType } from "@/components/crud/CrudModal";
import { TablePagination, usePagination } from "@/components/crud/TablePagination";

interface PlanItem {
  id: number;
  name: string;
  slug: string;
  max_classes: number;
  max_projects: number;
  duration_days: number;
  is_trial: boolean;
  price: number;
  active: boolean;
}

const emptyPlan = {
  id: 0,
  name: "",
  slug: "",
  max_classes: 10,
  max_projects: 1,
  duration_days: 30,
  is_trial: false,
  price: 0,
  active: true,
};

export function PlansClient({ plans }: { plans: PlanItem[] }) {
  const router = useRouter();
  const { startLoading, stopLoading, showToast } = useUI();

  const [modalOpen, setModalOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [form, setForm] = useState(emptyPlan);

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
  } = usePagination(plans, 10);

  const openCreate = () => {
    setCurrentIndex(null);
    setForm(emptyPlan);
    setModalOpen(true);
  };

  const openEdit = (index: number) => {
    const p = plans[index];
    if (!p) return;
    setCurrentIndex(index);
    setForm({ ...p });
    setModalOpen(true);
  };

  const handleSubmit = async (action: SaveActionType) => {
    startLoading();
    try {
      const isEditing = currentIndex !== null;
      const res = await fetch("/api/crud/plans", {
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
          setForm(emptyPlan);
        }
      } else {
        showToast(data.message || "Erro ao salvar plano.", "danger");
      }
    } finally {
      stopLoading();
    }
  };

  return (
    <div>
      <ModuleHeader
        icon="bi-tags"
        title="Planos de Assinatura"
        description="Gerencie os planos comerciais, limites de turmas, projetos e duração"
        statLabel="Planos Cadastrados"
        statValue={plans.length}
        actionLabel="Novo Plano"
        onAction={openCreate}
      />

      <div className="card border-0 shadow-sm">
        <div className="table-responsive">
          <table className="table align-middle table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th className="ps-4">Nome</th>
                <th>Slug</th>
                <th>Máx. Turmas</th>
                <th>Máx. Projetos</th>
                <th>Duração</th>
                <th>Preço</th>
                <th>Status</th>
                <th className="text-end pe-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((p, idx) => (
                <tr key={p.id}>
                  <td className="ps-4 fw-bold">
                    {p.name}
                    {p.is_trial && (
                      <span className="badge bg-warning-subtle text-warning ms-2">
                        Trial
                      </span>
                    )}
                  </td>
                  <td className="text-muted">{p.slug}</td>
                  <td>{p.max_classes}</td>
                  <td>{p.max_projects}</td>
                  <td>{p.duration_days} dias</td>
                  <td>R$ {p.price.toFixed(2)}</td>
                  <td>
                    <span
                      className={`badge ${
                        p.active
                          ? "bg-success-subtle text-success"
                          : "bg-secondary-subtle text-secondary"
                      }`}
                    >
                      {p.active ? "Ativo" : "Inativo"}
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
              ))}
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
        title={currentIndex !== null ? `Editar Plano: ${form.name}` : "Novo Plano"}
        icon="bi-tags"
        isEditing={currentIndex !== null}
        hasPrev={currentIndex !== null && currentIndex > 0}
        hasNext={currentIndex !== null && currentIndex < plans.length - 1}
        onPrev={() => currentIndex !== null && openEdit(currentIndex - 1)}
        onNext={() => currentIndex !== null && openEdit(currentIndex + 1)}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      >
        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label small fw-semibold">Nome do Plano *</label>
            <input
              type="text"
              className="form-control"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="col-md-6">
            <label className="form-label small fw-semibold">Slug *</label>
            <input
              type="text"
              className="form-control"
              required
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label small fw-semibold">Máx. Turmas</label>
            <input
              type="number"
              className="form-control"
              min={1}
              value={form.max_classes}
              onChange={(e) =>
                setForm({ ...form, max_classes: Number(e.target.value) })
              }
            />
          </div>
          <div className="col-md-3">
            <label className="form-label small fw-semibold">Máx. Projetos</label>
            <input
              type="number"
              className="form-control"
              min={1}
              value={form.max_projects}
              onChange={(e) =>
                setForm({ ...form, max_projects: Number(e.target.value) })
              }
            />
          </div>
          <div className="col-md-3">
            <label className="form-label small fw-semibold">Duração (dias)</label>
            <input
              type="number"
              className="form-control"
              min={1}
              value={form.duration_days}
              onChange={(e) =>
                setForm({ ...form, duration_days: Number(e.target.value) })
              }
            />
          </div>
          <div className="col-md-3">
            <label className="form-label small fw-semibold">Preço (R$)</label>
            <input
              type="number"
              step="0.01"
              className="form-control"
              value={form.price}
              onChange={(e) =>
                setForm({ ...form, price: Number(e.target.value) })
              }
            />
          </div>
          <div className="col-12 d-flex gap-4 pt-2">
            <div className="form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="chk_plan_trial"
                checked={form.is_trial}
                onChange={(e) =>
                  setForm({ ...form, is_trial: e.target.checked })
                }
              />
              <label className="form-check-label" htmlFor="chk_plan_trial">
                Plano Trial (Avaliação)
              </label>
            </div>
            <div className="form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="chk_plan_active"
                checked={form.active}
                onChange={(e) =>
                  setForm({ ...form, active: e.target.checked })
                }
              />
              <label className="form-check-label" htmlFor="chk_plan_active">
                Ativo
              </label>
            </div>
          </div>
        </div>
      </CrudModal>
    </div>
  );
}
