"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useUI } from "@/components/ui/UIProvider";
import { ModuleHeader } from "@/components/crud/ModuleHeader";
import { CrudModal, type SaveActionType } from "@/components/crud/CrudModal";
import { TablePagination, usePagination } from "@/components/crud/TablePagination";
import { AvailabilityMatrixModal } from "@/components/availability/AvailabilityMatrixModal";

interface TeacherItem {
  id: number;
  name: string;
  short_name: string;
  email: string;
  admission_date: string;
  color: string;
  min_lessons_day: number;
  max_lessons_day: number;
  max_lessons_level: number;
  max_lessons_group: number;
  displacement: string;
  activity_hours: string;
  external_code: string;
  reduce_days: boolean;
  reduce_windows: boolean;
  active: boolean;
  weekly_load: number;
  last_invited_at: string | null;
  availability_updated_at: string | null;
  portal_token: string | null;
}

const emptyTeacher = {
  id: 0,
  name: "",
  short_name: "",
  email: "",
  admission_date: "",
  color: "#2c3e50",
  min_lessons_day: 1,
  max_lessons_day: 5,
  max_lessons_level: 2,
  max_lessons_group: 2,
  displacement: "NORMAL",
  activity_hours: "",
  external_code: "",
  reduce_days: false,
  reduce_windows: false,
  active: true,
};

export function TeachersClient({
  projectName,
  teachers,
}: {
  projectName: string;
  teachers: TeacherItem[];
}) {
  const router = useRouter();
  const { startLoading, stopLoading, showToast, confirmAction } = useUI();

  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [form, setForm] = useState(emptyTeacher);
  const [availTeacher, setAvailTeacher] = useState<TeacherItem | null>(null);
  const [localTokens, setLocalTokens] = useState<Record<number, string>>({});

  const filtered = teachers.filter(
    (t) =>
      t.name.toLowerCase().includes(query.toLowerCase()) ||
      t.short_name.toLowerCase().includes(query.toLowerCase()) ||
      t.email.toLowerCase().includes(query.toLowerCase())
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
    setForm(emptyTeacher);
    setModalOpen(true);
  };

  const openEdit = (index: number) => {
    const t = filtered[index];
    if (!t) return;
    setCurrentIndex(index);
    setForm({
      id: t.id,
      name: t.name,
      short_name: t.short_name,
      email: t.email,
      admission_date: t.admission_date,
      color: t.color,
      min_lessons_day: t.min_lessons_day,
      max_lessons_day: t.max_lessons_day,
      max_lessons_level: t.max_lessons_level,
      max_lessons_group: t.max_lessons_group,
      displacement: t.displacement,
      activity_hours: t.activity_hours,
      external_code: t.external_code,
      reduce_days: t.reduce_days,
      reduce_windows: t.reduce_windows,
      active: t.active,
    });
    setModalOpen(true);
  };

  const handleSave = async (action: SaveActionType) => {
    startLoading();
    try {
      const isEditing = currentIndex !== null;
      const res = await fetch("/api/crud/teachers", {
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
          setForm(emptyTeacher);
        }
      } else {
        showToast(data.message || "Erro ao salvar professor.", "danger");
      }
    } finally {
      stopLoading();
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirmAction({
      title: "Excluir Professor",
      message: `Tem certeza que deseja excluir o professor "${form.name}"?`,
      confirmText: "Sim, Excluir",
      confirmVariant: "danger",
    });
    if (!confirmed) return;

    startLoading();
    try {
      const res = await fetch(`/api/crud/teachers?id=${form.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message, "success");
        setModalOpen(false);
        router.refresh();
      } else {
        showToast(data.message || "Erro ao excluir professor.", "danger");
      }
    } finally {
      stopLoading();
    }
  };

  const copyToClipboard = async (text: string): Promise<boolean> => {
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Fallback below if clipboard permission is unavailable
      }
    }
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      return copied;
    } catch {
      return false;
    }
  };

  const buildPortalUrl = (token: string) =>
    `${window.location.origin}/teachers/portal/${token}`;

  const handleGeneratePortalLink = async (teacher: TeacherItem) => {
    startLoading();
    try {
      const res = await fetch("/api/teachers/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId: teacher.id, sendEmail: false }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        if (data.token) {
          setLocalTokens((prev) => ({ ...prev, [teacher.id]: data.token }));
        }
        const urlToCopy =
          data.portalUrl || (data.token ? buildPortalUrl(data.token) : "");
        const copied = urlToCopy ? await copyToClipboard(urlToCopy) : false;
        showToast(
          copied
            ? `Link de disponibilidade gerado para ${teacher.name} e copiado!`
            : `Link de disponibilidade gerado para ${teacher.name}!`,
          "success"
        );
        router.refresh();
      } else {
        showToast(data.message || "Erro ao gerar link.", "danger");
      }
    } finally {
      stopLoading();
    }
  };

  const handleCopyPortalLink = async (teacher: TeacherItem, token: string) => {
    const portalUrl = buildPortalUrl(token);
    const copied = await copyToClipboard(portalUrl);
    if (copied) {
      showToast(
        `Link de disponibilidade de ${teacher.name} copiado para a área de transferência!`,
        "success"
      );
    } else {
      showToast(
        `Não foi possível copiar automaticamente. URL: ${portalUrl}`,
        "warning"
      );
    }
  };

  const handleSendPortalInvite = async (teacher: TeacherItem) => {
    startLoading();
    try {
      const res = await fetch("/api/teachers/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId: teacher.id, sendEmail: true }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        if (data.token) {
          setLocalTokens((prev) => ({ ...prev, [teacher.id]: data.token }));
        }
        if (data.portalUrl) {
          await copyToClipboard(data.portalUrl);
        }
        showToast(
          `${data.message} (Link também copiado para a área de transferência)`,
          "success"
        );
        router.refresh();
      } else {
        showToast(data.message || "Erro ao enviar convite.", "danger");
      }
    } finally {
      stopLoading();
    }
  };

  return (
    <div>
      <ModuleHeader
        icon="bi-person-badge"
        title="Professores"
        description="Gerencie o corpo docente, limites diários, janelas e disponibilidades"
        projectName={projectName}
        statLabel="Docentes Cadastrados"
        statValue={teachers.length}
        actionLabel="Novo Professor"
        onAction={openCreate}
      />

      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white border-bottom py-3">
          <div className="input-group input-group-sm" style={{ maxWidth: 360 }}>
            <span className="input-group-text bg-light">
              <i className="bi bi-search" />
            </span>
            <input
              type="text"
              className="form-control"
              placeholder="Buscar por nome, sigla ou e-mail..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="table-responsive">
          <table className="table align-middle table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th className="ps-4">Professor</th>
                <th>E-mail</th>
                <th className="text-center">Limites (Mín/Máx Dia)</th>
                <th className="text-center">Preferências</th>
                <th className="text-center">Carga Semanal</th>
                <th className="text-center">Status</th>
                <th className="text-end pe-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-4 text-muted">
                    Nenhum professor encontrado.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((t, idx) => {
                  const activeToken = localTokens[t.id] ?? t.portal_token;
                  return (
                  <tr key={t.id}>
                    <td className="ps-4">
                      <div className="d-flex align-items-center gap-2">
                        <span
                          className="rounded-circle d-inline-block flex-shrink-0"
                          style={{
                            width: 12,
                            height: 12,
                            backgroundColor: t.color,
                          }}
                        />
                        <div>
                          <div className="fw-bold">{t.name}</div>
                          <small className="text-muted">
                            Sigla: {t.short_name}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      {t.email ? (
                        <div>
                          <div>{t.email}</div>
                          {t.availability_updated_at && (
                            <small className="text-success">
                              <i className="bi bi-check2-all me-1" />
                              Atualizado em {t.availability_updated_at}
                            </small>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted small">Não informado</span>
                      )}
                    </td>
                    <td className="text-center">
                      <span className="badge bg-light text-dark border">
                        {t.min_lessons_day} a {t.max_lessons_day} aulas/dia
                      </span>
                    </td>
                    <td className="text-center">
                      <div className="d-flex justify-content-center gap-1 flex-wrap">
                        {t.reduce_days && (
                          <span className="badge bg-info-subtle text-info">
                            Reduzir Dias
                          </span>
                        )}
                        {t.reduce_windows && (
                          <span className="badge bg-warning-subtle text-warning">
                            Evitar Janelas
                          </span>
                        )}
                        {!t.reduce_days && !t.reduce_windows && (
                          <span className="text-muted small">Padrão</span>
                        )}
                      </div>
                    </td>
                    <td className="text-center">
                      <span className="badge bg-primary-subtle text-primary">
                        {t.weekly_load} tempos
                      </span>
                    </td>
                    <td className="text-center">
                      <span
                        className={`badge ${
                          t.active
                            ? "bg-success-subtle text-success"
                            : "bg-secondary-subtle text-secondary"
                        }`}
                      >
                        {t.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="text-end pe-4">
                      <div className="btn-group btn-group-sm">
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => setAvailTeacher(t)}
                          title="Grade de Disponibilidade"
                        >
                          <i className="bi bi-calendar-check me-1" />
                          Disponibilidade
                        </button>
                        {activeToken ? (
                          <button
                            type="button"
                            className="btn btn-success"
                            onClick={() => handleCopyPortalLink(t, activeToken)}
                            title="Copiar link ativo do Portal do Professor (48h)"
                          >
                            <i className="bi bi-clipboard-check me-1" />
                            Copiar Link
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-outline-success"
                            onClick={() => handleGeneratePortalLink(t)}
                            title="Gerar link de alteração de disponibilidade (48h)"
                          >
                            <i className="bi bi-link-45deg me-1" />
                            Gerar Link
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-outline-info"
                          onClick={() => handleSendPortalInvite(t)}
                          title="Enviar link do Portal do Professor por e-mail (48h)"
                        >
                          <i className="bi bi-send" />
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
          currentIndex !== null
            ? `Editar Professor: ${form.name}`
            : "Novo Professor"
        }
        icon="bi-person-badge"
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
          <div className="col-md-6">
            <label className="form-label small fw-semibold">
              Nome Completo *
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
              Nome Abreviado / Sigla *
            </label>
            <input
              type="text"
              className="form-control"
              required
              value={form.short_name}
              onChange={(e) =>
                setForm({ ...form, short_name: e.target.value })
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
              E-mail Institucional
            </label>
            <input
              type="email"
              className="form-control"
              placeholder="professor@instituicao.edu.br"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label small fw-semibold">
              Código Externo
            </label>
            <input
              type="text"
              className="form-control"
              value={form.external_code}
              onChange={(e) =>
                setForm({ ...form, external_code: e.target.value })
              }
            />
          </div>
          <div className="col-md-3">
            <label className="form-label small fw-semibold">Deslocamento</label>
            <select
              className="form-select"
              value={form.displacement}
              onChange={(e) =>
                setForm({ ...form, displacement: e.target.value })
              }
            >
              <option value="NORMAL">Normal</option>
              <option value="LENTO">Lento</option>
              <option value="MUITO_LENTO">Muito Lento</option>
              <option value="NAO_PERMITIDO">Não Permitido</option>
            </select>
          </div>

          <div className="col-md-3">
            <label className="form-label small fw-semibold">
              Mín. Aulas / Dia
            </label>
            <input
              type="number"
              className="form-control"
              min={1}
              value={form.min_lessons_day}
              onChange={(e) =>
                setForm({ ...form, min_lessons_day: Number(e.target.value) })
              }
            />
          </div>
          <div className="col-md-3">
            <label className="form-label small fw-semibold">
              Máx. Aulas / Dia
            </label>
            <input
              type="number"
              className="form-control"
              min={1}
              value={form.max_lessons_day}
              onChange={(e) =>
                setForm({ ...form, max_lessons_day: Number(e.target.value) })
              }
            />
          </div>
          <div className="col-md-3">
            <label className="form-label small fw-semibold">
              Máx. Aulas / Nível
            </label>
            <input
              type="number"
              className="form-control"
              min={1}
              value={form.max_lessons_level}
              onChange={(e) =>
                setForm({ ...form, max_lessons_level: Number(e.target.value) })
              }
            />
          </div>
          <div className="col-md-3">
            <label className="form-label small fw-semibold">
              Máx. Aulas / Curso
            </label>
            <input
              type="number"
              className="form-control"
              min={1}
              value={form.max_lessons_group}
              onChange={(e) =>
                setForm({ ...form, max_lessons_group: Number(e.target.value) })
              }
            />
          </div>

          <div className="col-12 d-flex flex-wrap gap-4 pt-2">
            <div className="form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="chk_reduce_days"
                checked={form.reduce_days}
                onChange={(e) =>
                  setForm({ ...form, reduce_days: e.target.checked })
                }
              />
              <label className="form-check-label" htmlFor="chk_reduce_days">
                Reduzir quantidade de dias na escola
              </label>
            </div>
            <div className="form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="chk_reduce_windows"
                checked={form.reduce_windows}
                onChange={(e) =>
                  setForm({ ...form, reduce_windows: e.target.checked })
                }
              />
              <label className="form-check-label" htmlFor="chk_reduce_windows">
                Evitar janelas (horários vagos entre aulas)
              </label>
            </div>
            <div className="form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="chk_teacher_active"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              <label className="form-check-label" htmlFor="chk_teacher_active">
                Professor Ativo
              </label>
            </div>
          </div>
        </div>
      </CrudModal>

      <AvailabilityMatrixModal
        open={!!availTeacher}
        entityType="teacher"
        entityId={availTeacher?.id || null}
        entityName={availTeacher?.name || ""}
        onClose={() => setAvailTeacher(null)}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
