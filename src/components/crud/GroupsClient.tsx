"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useUI } from "@/components/ui/UIProvider";
import { ModuleHeader } from "@/components/crud/ModuleHeader";
import { CrudModal, type SaveActionType } from "@/components/crud/CrudModal";
import { TablePagination, usePagination } from "@/components/crud/TablePagination";

interface GroupItem {
  id: number;
  name: string;
  academic_period: string;
  start_date: string;
  end_date: string;
  classes_count: number;
  subjects_count: number;
}

const emptyGroupForm = {
  id: 0,
  name: "",
  academic_period: "",
  start_date: "",
  end_date: "",
};

function formatDateBr(isoDate: string): string {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

export function GroupsClient({
  projectName,
  groups,
}: {
  projectName: string;
  groups: GroupItem[];
}) {
  const router = useRouter();
  const { startLoading, stopLoading, showToast, confirmAction } = useUI();

  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [form, setForm] = useState(emptyGroupForm);

  const filtered = groups.filter(
    (g) =>
      g.name.toLowerCase().includes(query.toLowerCase()) ||
      g.academic_period.toLowerCase().includes(query.toLowerCase())
  );

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
    setForm(emptyGroupForm);
    setModalOpen(true);
  };

  const openEdit = (index: number) => {
    const g = filtered[index];
    if (!g) return;
    setCurrentIndex(index);
    setForm({
      id: g.id,
      name: g.name,
      academic_period: g.academic_period || "",
      start_date: g.start_date || "",
      end_date: g.end_date || "",
    });
    setModalOpen(true);
  };

  const handleSave = async (action: SaveActionType) => {
    startLoading();
    try {
      const isEditing = currentIndex !== null;
      const res = await fetch("/api/crud/groups", {
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
          setForm(emptyGroupForm);
        }
      } else {
        showToast(data.message || "Erro ao salvar curso/grupo.", "danger");
      }
    } finally {
      stopLoading();
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirmAction({
      title: "Excluir Curso / Grupo",
      message: `Tem certeza que deseja excluir o curso "${form.name}"?`,
      confirmText: "Sim, Excluir",
      confirmVariant: "danger",
    });
    if (!confirmed) return;

    startLoading();
    try {
      const res = await fetch(`/api/crud/groups?id=${form.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message, "success");
        setModalOpen(false);
        router.refresh();
      } else {
        showToast(data.message || "Erro ao excluir curso.", "danger");
      }
    } finally {
      stopLoading();
    }
  };

  return (
    <div>
      <ModuleHeader
        icon="bi-collection"
        title="Grupos / Cursos"
        description="Gerencie os cursos, modalidades ou segmentos de ensino do projeto"
        projectName={projectName}
        statLabel="Total de Cursos"
        statValue={groups.length}
        actionLabel="Novo Curso"
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
              placeholder="Buscar curso..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="table-responsive">
          <table className="table align-middle table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th className="ps-4">Nome do Curso / Grupo</th>
                <th>Período / Semestre</th>
                <th>Duração / Vigência</th>
                <th className="text-center">Turmas Vinculadas</th>
                <th className="text-center">Disciplinas</th>
                <th className="text-end pe-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-muted">
                    Nenhum curso encontrado.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((g, idx) => (
                  <tr key={g.id}>
                    <td className="ps-4 fw-bold">{g.name}</td>
                    <td>
                      {g.academic_period ? (
                        <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle">
                          {g.academic_period}
                        </span>
                      ) : (
                        <span className="text-muted small">—</span>
                      )}
                    </td>
                    <td className="small text-muted">
                      {g.start_date || g.end_date ? (
                        <span>
                          {g.start_date ? formatDateBr(g.start_date) : "?"} até{" "}
                          {g.end_date ? formatDateBr(g.end_date) : "?"}
                        </span>
                      ) : (
                        <span>Não definida</span>
                      )}
                    </td>
                    <td className="text-center">
                      <span className="badge bg-success-subtle text-success">
                        {g.classes_count} turmas
                      </span>
                    </td>
                    <td className="text-center">
                      <span className="badge bg-primary-subtle text-primary">
                        {g.subjects_count} disciplinas
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
          currentIndex !== null ? `Editar Curso: ${form.name}` : "Novo Curso / Grupo"
        }
        icon="bi-collection"
        size="lg"
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
          <div className="col-md-8">
            <label className="form-label small fw-semibold">
              Nome do Curso / Grupo *
            </label>
            <input
              type="text"
              className="form-control"
              required
              placeholder="Ex: Análise e Desenvolvimento de Sistemas"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label small fw-semibold">
              Período / Semestre *
            </label>
            <input
              type="text"
              className="form-control"
              required
              placeholder="Ex: 2026.2"
              value={form.academic_period}
              onChange={(e) =>
                setForm({ ...form, academic_period: e.target.value })
              }
            />
          </div>
          <div className="col-md-6">
            <label className="form-label small fw-semibold">
              Início do Período (Opcional)
            </label>
            <input
              type="date"
              className="form-control"
              value={form.start_date}
              onChange={(e) =>
                setForm({ ...form, start_date: e.target.value })
              }
            />
          </div>
          <div className="col-md-6">
            <label className="form-label small fw-semibold">
              Término do Período (Opcional)
            </label>
            <input
              type="date"
              className="form-control"
              value={form.end_date}
              onChange={(e) =>
                setForm({ ...form, end_date: e.target.value })
              }
            />
          </div>
          <div className="col-12">
            <small className="text-muted">
              <i className="bi bi-info-circle me-1" />
              Informar o período e as datas de vigência por curso permite
              planejar novas turmas ou semestres futuros sem perder o horário
              atual, além de servir como base para restrições futuras.
            </small>
          </div>
        </div>
      </CrudModal>
    </div>
  );
}
