"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useUI } from "@/components/ui/UIProvider";
import { ModuleHeader } from "@/components/crud/ModuleHeader";
import { CrudModal, type SaveActionType } from "@/components/crud/CrudModal";
import { TablePagination, usePagination } from "@/components/crud/TablePagination";
import {
  GROUP_STATUS_META,
  normalizeGroupStatus,
  type GroupStatus,
} from "@/lib/schedule/group-helpers";

interface GroupItem {
  id: number;
  name: string;
  academic_period: string;
  start_date: string;
  end_date: string;
  status: string;
  can_delete_inactive: boolean;
  classes_count: number;
  subjects_count: number;
}

const emptyGroupForm = {
  id: 0,
  name: "",
  academic_period: "",
  start_date: "",
  end_date: "",
  status: "PUBLISHED" as GroupStatus,
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
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [form, setForm] = useState(emptyGroupForm);

  // Copy Period Modal State
  const [copySource, setCopySource] = useState<GroupItem | null>(null);
  const [copyForm, setCopyForm] = useState({
    academic_period: "",
    start_date: "",
    end_date: "",
    copy_schedule: true,
  });

  const filtered = groups.filter((g) => {
    const st = normalizeGroupStatus(g.status);
    if (statusFilter === "ACTIVE" && st === "INACTIVE") return false;
    if (
      statusFilter !== "ALL" &&
      statusFilter !== "ACTIVE" &&
      st !== statusFilter
    ) {
      return false;
    }
    if (query) {
      const q = query.toLowerCase();
      return (
        g.name.toLowerCase().includes(q) ||
        g.academic_period.toLowerCase().includes(q)
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
      status: normalizeGroupStatus(g.status),
    });
    setModalOpen(true);
  };

  const openCopyModal = (g: GroupItem) => {
    setCopySource(g);
    setCopyForm({
      academic_period: "",
      start_date: "",
      end_date: "",
      copy_schedule: true,
    });
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

  const handleCopySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!copySource) return;
    startLoading();
    try {
      const res = await fetch(`/api/groups/${copySource.id}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(copyForm),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message, "success");
        setCopySource(null);
        router.refresh();
      } else {
        showToast(data.message || "Erro ao copiar período.", "danger");
      }
    } finally {
      stopLoading();
    }
  };

  const handlePublish = async (g: GroupItem) => {
    const periodText = g.academic_period ? ` (${g.academic_period})` : "";
    const confirmed = await confirmAction({
      title: "Publicar Período",
      message: `Ao publicar "${g.name}${periodText}", o período publicado anteriormente deste curso será marcado como INATIVO e todas as suas turmas, disciplinas e aulas vinculadas serão desativadas. Deseja continuar?`,
      confirmText: "Sim, Publicar",
      confirmVariant: "primary",
    });
    if (!confirmed) return;

    startLoading();
    try {
      const res = await fetch(`/api/groups/${g.id}/publish`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message, "success");
        router.refresh();
      } else {
        showToast(data.message || "Erro ao publicar período.", "danger");
      }
    } finally {
      stopLoading();
    }
  };

  const handleDeleteInactive = async (g: GroupItem) => {
    const periodText = g.academic_period ? ` (${g.academic_period})` : "";
    const confirmed = await confirmAction({
      title: "Excluir Período Inativo",
      message: `ATENÇÃO: Isso excluirá permanentemente o curso inativo "${g.name}${periodText}", suas turmas, disciplinas, matriz de aulas e todos os horários gerados vinculados a ele. Esta ação não pode ser desfeita.`,
      confirmText: "Excluir Permanentemente",
      confirmVariant: "danger",
    });
    if (!confirmed) return;

    startLoading();
    try {
      const res = await fetch(`/api/groups/${g.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message, "success");
        router.refresh();
      } else {
        showToast(data.message || "Erro ao excluir período inativo.", "danger");
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
        description="Gerencie os cursos, períodos letivos, publicação e cópia de semestres"
        projectName={projectName}
        statLabel="Total de Cursos"
        statValue={groups.length}
        actionLabel="Novo Curso"
        onAction={openCreate}
      />

      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white border-bottom py-3 d-flex flex-wrap gap-2 justify-content-between align-items-center">
          <div className="d-flex flex-wrap gap-2 align-items-center">
            <select
              className="form-select form-select-sm"
              style={{ maxWidth: 210 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">Todos os Estados</option>
              <option value="ACTIVE">Ativos (Publicado + Prévia)</option>
              <option value="PUBLISHED">Somente Publicados</option>
              <option value="PREVIEW">Somente Prévia</option>
              <option value="INACTIVE">Somente Inativos</option>
            </select>

            <div className="input-group input-group-sm" style={{ maxWidth: 280 }}>
              <span className="input-group-text bg-light">
                <i className="bi bi-search" />
              </span>
              <input
                type="text"
                className="form-control"
                placeholder="Buscar curso ou período..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table align-middle table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th className="ps-4">Nome do Curso / Grupo</th>
                <th>Período / Semestre</th>
                <th>Duração / Vigência</th>
                <th className="text-center">Estado</th>
                <th className="text-center">Turmas</th>
                <th className="text-center">Disciplinas</th>
                <th className="text-end pe-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-4 text-muted">
                    Nenhum curso encontrado.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((g, idx) => {
                  const st = normalizeGroupStatus(g.status);
                  const meta = GROUP_STATUS_META[st];
                  return (
                    <tr key={g.id} className={st === "INACTIVE" ? "opacity-75" : ""}>
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
                        <span className={`badge ${meta.badgeClass}`}>
                          <i className={`bi ${meta.icon} me-1`} />
                          {meta.label}
                        </span>
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
                        <div className="btn-group btn-group-sm">
                          {st !== "PUBLISHED" && (
                            <button
                              type="button"
                              className="btn btn-outline-success"
                              title="Publicar este período e desativar o anterior"
                              onClick={() => handlePublish(g)}
                            >
                              <i className="bi bi-broadcast me-1" />
                              Publicar
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            title="Copiar todo o período para um novo semestre (Prévia)"
                            onClick={() => openCopyModal(g)}
                          >
                            <i className="bi bi-copy me-1" />
                            Copiar Período
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-primary"
                            onClick={() => openEdit(startIndex + idx)}
                          >
                            <i className="bi bi-pencil-square me-1" />
                            Editar
                          </button>
                          {st === "INACTIVE" && g.can_delete_inactive && (
                            <button
                              type="button"
                              className="btn btn-outline-danger"
                              title="Excluir período inativo, aulas e horários vinculados"
                              onClick={() => handleDeleteInactive(g)}
                            >
                              <i className="bi bi-trash" />
                            </button>
                          )}
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

      {/* Create / Edit Modal */}
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
          <div className="col-md-5">
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
          <div className="col-md-3">
            <label className="form-label small fw-semibold">Estado</label>
            <select
              className="form-select"
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as GroupStatus })
              }
            >
              <option value="PUBLISHED">Publicado</option>
              <option value="PREVIEW">Prévia</option>
              {currentIndex !== null && (
                <option value="INACTIVE">Inativo</option>
              )}
            </select>
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
              Períodos em <strong>Prévia</strong> permitem planejar novas turmas
              e grades antes de publicar para alunos e docentes.
            </small>
          </div>
        </div>
      </CrudModal>

      {/* Copy Period Modal */}
      {copySource && (
        <>
          <div
            className="modal-backdrop fade show"
            style={{ zIndex: 1050 }}
            onClick={() => setCopySource(null)}
          />
          <div
            className="modal fade show d-block"
            tabIndex={-1}
            style={{ zIndex: 1055 }}
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 shadow-lg">
                <form onSubmit={handleCopySubmit}>
                  <div className="modal-header bg-light">
                    <h5 className="modal-title fw-bold">
                      <i className="bi bi-copy text-primary me-2" />
                      Copiar Período — {copySource.name}
                    </h5>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => setCopySource(null)}
                    />
                  </div>
                  <div className="modal-body">
                    <div className="alert alert-info small py-2 mb-3">
                      <i className="bi bi-info-circle me-1" />
                      Origem:{" "}
                      <strong>
                        {copySource.name}
                        {copySource.academic_period
                          ? ` (${copySource.academic_period})`
                          : ""}
                      </strong>
                      . O novo período será criado no estado{" "}
                      <strong>Prévia</strong> com todas as turmas, disciplinas e
                      matriz de aulas copiadas.
                    </div>

                    <div className="row g-3">
                      <div className="col-12">
                        <label className="form-label small fw-semibold">
                          Novo Período / Semestre *
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          required
                          autoFocus
                          placeholder="Ex: 2027.1"
                          value={copyForm.academic_period}
                          onChange={(e) =>
                            setCopyForm({
                              ...copyForm,
                              academic_period: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold">
                          Data de Início (Opcional)
                        </label>
                        <input
                          type="date"
                          className="form-control"
                          value={copyForm.start_date}
                          onChange={(e) =>
                            setCopyForm({
                              ...copyForm,
                              start_date: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold">
                          Data de Término (Opcional)
                        </label>
                        <input
                          type="date"
                          className="form-control"
                          value={copyForm.end_date}
                          onChange={(e) =>
                            setCopyForm({
                              ...copyForm,
                              end_date: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="col-12">
                        <div className="form-check">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            id="copyScheduleCheck"
                            checked={copyForm.copy_schedule}
                            onChange={(e) =>
                              setCopyForm({
                                ...copyForm,
                                copy_schedule: e.target.checked,
                              })
                            }
                          />
                          <label
                            className="form-check-label small"
                            htmlFor="copyScheduleCheck"
                          >
                            Copiar também a grade horária já alocada como base
                            inicial
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer bg-light">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => setCopySource(null)}
                    >
                      Cancelar
                    </button>
                    <button type="submit" className="btn btn-primary btn-sm">
                      <i className="bi bi-copy me-1" />
                      Criar Cópia em Prévia
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
