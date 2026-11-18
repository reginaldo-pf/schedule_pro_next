"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useUI } from "@/components/ui/UIProvider";
import { ModuleHeader } from "@/components/crud/ModuleHeader";
import { CrudModal, type SaveActionType } from "@/components/crud/CrudModal";

interface ProjectItem {
  id: number;
  name: string;
  institution_name: string;
  academic_period: string;
  timezone: string;
  report_header: string;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  lunch_break_enabled: boolean;
  lunch_start: string;
  lunch_end: string;
  dinner_break_enabled: boolean;
  dinner_start: string;
  dinner_end: string;
  interclass_break_enabled: boolean;
  owner_id: number;
  owner_username: string;
  is_owner: boolean;
  classes_count: number;
  teachers_count: number;
  lessons_count: number;
  participants: {
    id: number;
    user_id: number;
    username: string;
    email: string;
    role: string;
  }[];
}

const emptyProjectForm = {
  id: 0,
  name: "",
  institution_name: "",
  academic_period: "2026.2",
  timezone: "America/Fortaleza",
  report_header: "",
  monday: true,
  tuesday: true,
  wednesday: true,
  thursday: true,
  friday: true,
  saturday: false,
  sunday: false,
  lunch_break_enabled: false,
  lunch_start: "12:00",
  lunch_end: "13:00",
  dinner_break_enabled: false,
  dinner_start: "18:00",
  dinner_end: "19:00",
  interclass_break_enabled: true,
};

export function ProjectsClient({
  projects,
  activeProjectId,
}: {
  projects: ProjectItem[];
  activeProjectId: number | null;
}) {
  const router = useRouter();
  const { startLoading, stopLoading, showToast, confirmAction } = useUI();

  const [modalOpen, setModalOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [form, setForm] = useState(emptyProjectForm);

  // Participants modal state
  const [participantsProject, setParticipantsProject] =
    useState<ProjectItem | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("coordinator");

  const openCreate = () => {
    setCurrentIndex(null);
    setForm(emptyProjectForm);
    setModalOpen(true);
  };

  const openEdit = (index: number) => {
    const p = projects[index];
    if (!p) return;
    setCurrentIndex(index);
    setForm({
      id: p.id,
      name: p.name,
      institution_name: p.institution_name,
      academic_period: p.academic_period,
      timezone: p.timezone,
      report_header: p.report_header,
      monday: p.monday,
      tuesday: p.tuesday,
      wednesday: p.wednesday,
      thursday: p.thursday,
      friday: p.friday,
      saturday: p.saturday,
      sunday: p.sunday,
      lunch_break_enabled: p.lunch_break_enabled,
      lunch_start: p.lunch_start || "12:00",
      lunch_end: p.lunch_end || "13:00",
      dinner_break_enabled: p.dinner_break_enabled,
      dinner_start: p.dinner_start || "18:00",
      dinner_end: p.dinner_end || "19:00",
      interclass_break_enabled: p.interclass_break_enabled,
    });
    setModalOpen(true);
  };

  const handleSave = async (action: SaveActionType) => {
    startLoading();
    try {
      const isEditing = currentIndex !== null;
      const res = await fetch("/api/projects", {
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
          setForm(emptyProjectForm);
        }
      } else {
        showToast(data.message || "Erro ao salvar projeto.", "danger");
      }
    } finally {
      stopLoading();
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirmAction({
      title: "Excluir Projeto",
      message: `Tem certeza que deseja excluir o projeto "${form.name}" e todos os seus dados (turmas, professores, aulas e horários)?`,
      confirmText: "Sim, Excluir",
      confirmVariant: "danger",
    });
    if (!confirmed) return;

    startLoading();
    try {
      const res = await fetch(`/api/projects?id=${form.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message, "success");
        setModalOpen(false);
        router.refresh();
      } else {
        showToast(data.message || "Erro ao excluir projeto.", "danger");
      }
    } finally {
      stopLoading();
    }
  };

  const handleActivate = async (projectId: number) => {
    startLoading();
    try {
      const res = await fetch("/api/projects/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(`Projeto ativo selecionado: ${data.projectName}`, "success");
        router.refresh();
      } else {
        showToast(data.message || "Erro ao ativar projeto.", "danger");
      }
    } finally {
      stopLoading();
    }
  };

  const handleInviteParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!participantsProject || !inviteEmail.trim()) return;
    startLoading();
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "invite_participant",
          projectId: participantsProject.id,
          email: inviteEmail,
          role: inviteRole,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message, "success");
        setInviteEmail("");
        router.refresh();
      } else {
        showToast(data.message || "Erro ao convidar participante.", "danger");
      }
    } finally {
      stopLoading();
    }
  };

  const handleRemoveParticipant = async (projectId: number, userId: number) => {
    startLoading();
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove_participant",
          projectId,
          userId,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message, "success");
        router.refresh();
      } else {
        showToast(data.message || "Erro ao remover participante.", "danger");
      }
    } finally {
      stopLoading();
    }
  };

  return (
    <div>
      <ModuleHeader
        icon="bi-folder2-open"
        title="Projetos Acadêmicos"
        description="Gerencie os projetos de horários, dias letivos e participantes"
        statLabel="Total de Projetos"
        statValue={projects.length}
        actionLabel="Novo Projeto"
        onAction={openCreate}
      />

      <div className="card border-0 shadow-sm">
        <div className="table-responsive">
          <table className="table align-middle table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th className="ps-4">Projeto</th>
                <th>Instituição</th>
                <th>Período Acadêmico</th>
                <th className="text-center">Recursos</th>
                <th className="text-center">Status</th>
                <th className="text-end pe-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-5 text-muted">
                    Nenhum projeto cadastrado. Clique em{" "}
                    <strong>Novo Projeto</strong> para começar.
                  </td>
                </tr>
              ) : (
                projects.map((p, idx) => {
                  const isActive = p.id === activeProjectId;
                  return (
                    <tr key={p.id}>
                      <td className="ps-4">
                        <div className="fw-bold">{p.name}</div>
                        <small className="text-muted">
                          Responsável: {p.owner_username}
                        </small>
                      </td>
                      <td>{p.institution_name}</td>
                      <td>
                        <span className="badge bg-primary-subtle text-primary">
                          {p.academic_period}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="d-flex justify-content-center gap-2 small">
                          <span className="badge bg-light text-dark border">
                            {p.classes_count} turmas
                          </span>
                          <span className="badge bg-light text-dark border">
                            {p.teachers_count} profs
                          </span>
                          <span className="badge bg-light text-dark border">
                            {p.lessons_count} aulas
                          </span>
                        </div>
                      </td>
                      <td className="text-center">
                        {isActive ? (
                          <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-2">
                            <i className="bi bi-check-circle-fill me-1" />
                            Projeto Ativo
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-success"
                            onClick={() => handleActivate(p.id)}
                          >
                            Selecionar
                          </button>
                        )}
                      </td>
                      <td className="text-end pe-4">
                        <div className="btn-group btn-group-sm">
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => setParticipantsProject(p)}
                            title="Participantes"
                          >
                            <i className="bi bi-people me-1" />(
                            {p.participants.length})
                          </button>
                          {p.is_owner && (
                            <button
                              type="button"
                              className="btn btn-outline-primary"
                              onClick={() => openEdit(idx)}
                            >
                              <i className="bi bi-pencil-square me-1" />
                              Editar
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
      </div>

      {/* Create / Edit Project Modal */}
      <CrudModal
        open={modalOpen}
        title={
          currentIndex !== null
            ? `Editar Projeto: ${form.name}`
            : "Novo Projeto Acadêmico"
        }
        icon="bi-folder2-open"
        size="lg"
        isEditing={currentIndex !== null}
        hasPrev={currentIndex !== null && currentIndex > 0}
        hasNext={currentIndex !== null && currentIndex < projects.length - 1}
        onPrev={() => currentIndex !== null && openEdit(currentIndex - 1)}
        onNext={() => currentIndex !== null && openEdit(currentIndex + 1)}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSave}
        onDelete={currentIndex !== null ? handleDelete : undefined}
      >
        <div className="row g-3">
          <div className="col-md-5">
            <label className="form-label small fw-semibold">
              Nome do Projeto *
            </label>
            <input
              type="text"
              className="form-control"
              required
              placeholder="Ex: Calendário 2026"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="col-md-5">
            <label className="form-label small fw-semibold">
              Nome da Instituição *
            </label>
            <input
              type="text"
              className="form-control"
              required
              placeholder="Ex: IFCE - Campus Tauá"
              value={form.institution_name}
              onChange={(e) =>
                setForm({ ...form, institution_name: e.target.value })
              }
            />
          </div>
          <div className="col-md-2">
            <label className="form-label small fw-semibold">Período *</label>
            <input
              type="text"
              className="form-control"
              required
              placeholder="2026.2"
              value={form.academic_period}
              onChange={(e) =>
                setForm({ ...form, academic_period: e.target.value })
              }
            />
          </div>

          <div className="col-12">
            <label className="form-label small fw-semibold d-block mb-2">
              Dias Letivos da Semana
            </label>
            <div className="d-flex flex-wrap gap-3 bg-light p-3 rounded-3 border">
              {[
                { key: "monday", label: "Segunda" },
                { key: "tuesday", label: "Terça" },
                { key: "wednesday", label: "Quarta" },
                { key: "thursday", label: "Quinta" },
                { key: "friday", label: "Sexta" },
                { key: "saturday", label: "Sábado" },
                { key: "sunday", label: "Domingo" },
              ].map((d) => (
                <div key={d.key} className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id={`day_${d.key}`}
                    checked={Boolean(
                      form[d.key as keyof typeof emptyProjectForm]
                    )}
                    onChange={(e) =>
                      setForm({ ...form, [d.key]: e.target.checked })
                    }
                  />
                  <label className="form-check-label" htmlFor={`day_${d.key}`}>
                    {d.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="col-12">
            <label className="form-label small fw-semibold">
              Cabeçalho dos Relatórios (Opcional)
            </label>
            <textarea
              className="form-control"
              rows={2}
              value={form.report_header}
              onChange={(e) =>
                setForm({ ...form, report_header: e.target.value })
              }
            />
          </div>
        </div>
      </CrudModal>

      {/* Participants Modal */}
      {participantsProject && (
        <>
          <div
            className="modal-backdrop fade show"
            style={{ zIndex: 1055 }}
            onClick={() => setParticipantsProject(null)}
          />
          <div
            className="modal fade show d-block"
            tabIndex={-1}
            style={{ zIndex: 1060 }}
          >
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content border-0 shadow-lg">
                <div className="modal-header bg-light border-bottom py-3 px-4">
                  <h5 className="modal-title fw-bold mb-0">
                    <i className="bi bi-people text-primary me-2" />
                    Participantes: {participantsProject.name}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setParticipantsProject(null)}
                  />
                </div>
                <div className="modal-body p-4">
                  {participantsProject.is_owner && (
                    <form
                      onSubmit={handleInviteParticipant}
                      className="row g-2 mb-4 bg-light p-3 rounded-3 border"
                    >
                      <div className="col-md-6">
                        <input
                          type="email"
                          className="form-control form-control-sm"
                          placeholder="E-mail do usuário cadastrado..."
                          required
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                        />
                      </div>
                      <div className="col-md-3">
                        <select
                          className="form-select form-select-sm"
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value)}
                        >
                          <option value="coordinator">Coordenador</option>
                          <option value="viewer">Visualizador</option>
                        </select>
                      </div>
                      <div className="col-md-3">
                        <button
                          type="submit"
                          className="btn btn-primary btn-sm w-100 fw-bold"
                        >
                          Convidar
                        </button>
                      </div>
                    </form>
                  )}

                  <ul className="list-group">
                    {participantsProject.participants.length === 0 ? (
                      <li className="list-group-item text-center text-muted py-3">
                        Nenhum participante adicional neste projeto.
                      </li>
                    ) : (
                      participantsProject.participants.map((part) => (
                        <li
                          key={part.id}
                          className="list-group-item d-flex justify-content-between align-items-center"
                        >
                          <div>
                            <div className="fw-bold">{part.username}</div>
                            <small className="text-muted">{part.email}</small>
                          </div>
                          <div className="d-flex align-items-center gap-2">
                            <span className="badge bg-info-subtle text-info">
                              {part.role === "coordinator"
                                ? "Coordenador"
                                : "Visualizador"}
                            </span>
                            {participantsProject.is_owner && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() =>
                                  handleRemoveParticipant(
                                    participantsProject.id,
                                    part.user_id
                                  )
                                }
                              >
                                <i className="bi bi-trash" />
                              </button>
                            )}
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
