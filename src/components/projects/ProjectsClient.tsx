"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useUI } from "@/components/ui/UIProvider";
import { ModuleHeader } from "@/components/crud/ModuleHeader";
import { CrudModal, type SaveActionType } from "@/components/crud/CrudModal";
import { TablePagination, usePagination } from "@/components/crud/TablePagination";
import { IncrementQuotaButton } from "@/components/plans/IncrementQuotaButton";

interface ProjectItem {
  id: number;
  name: string;
  institution_name: string;
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
  can_leave?: boolean;
  classes_count: number;
  teachers_count: number;
  lessons_count: number;
  sponsored_seats?: {
    max: number;
    used: number;
    available: number;
  };
  participants: {
    id: number;
    user_id: number;
    username: string;
    email: string;
    role: string;
    license_source?: string;
    individual_sub_valid?: boolean;
    individual_plan_name?: string;
  }[];
}

const emptyProjectForm = {
  id: 0,
  name: "",
  institution_name: "",
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
  isDirecaoPlan = false,
}: {
  projects: ProjectItem[];
  activeProjectId: number | null;
  isDirecaoPlan?: boolean;
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
  const [inviteLicenseSource, setInviteLicenseSource] = useState("AUTO");

  const activeModalProject = participantsProject
    ? projects.find((p) => p.id === participantsProject.id) ?? participantsProject
    : null;

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
  } = usePagination(projects, 10);

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
    if (!activeModalProject || !inviteEmail.trim()) return;
    startLoading();
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "invite_participant",
          projectId: activeModalProject.id,
          email: inviteEmail,
          role: inviteRole,
          license_source: inviteLicenseSource,
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

  const handleChangeParticipantLicense = async (
    projectId: number,
    userId: number,
    licenseSource: "INDIVIDUAL" | "PROJECT_SPONSORED"
  ) => {
    startLoading();
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change_participant_license",
          projectId,
          userId,
          license_source: licenseSource,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message, "success");
        router.refresh();
      } else {
        showToast(data.message || "Erro ao alterar licença.", "danger");
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

  const handleLeaveProject = async (project: ProjectItem) => {
    const confirmed = await confirmAction({
      title: "Sair do Projeto",
      message: `Tem certeza que deseja sair do projeto "${project.name}"? Você perderá o acesso a este projeto e não levará nenhum curso, turma ou registro vinculado. Os cursos que estavam sob sua responsabilidade ficarão no projeto sem coordenador atribuído.`,
      confirmText: "Sim, Sair do Projeto",
      confirmVariant: "danger",
    });
    if (!confirmed) return;

    startLoading();
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "leave_project",
          projectId: project.id,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message, "success");
        router.refresh();
      } else {
        showToast(data.message || "Erro ao sair do projeto.", "danger");
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
                <th className="text-center">Recursos</th>
                <th className="text-center">Status</th>
                <th className="text-end pe-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-5 text-muted">
                    Nenhum projeto cadastrado. Clique em{" "}
                    <strong>Novo Projeto</strong> para começar.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((p, idx) => {
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
                              onClick={() => openEdit(startIndex + idx)}
                            >
                              <i className="bi bi-pencil-square me-1" />
                              Editar
                            </button>
                          )}
                          {p.can_leave && (
                            <button
                              type="button"
                              className="btn btn-outline-danger"
                              onClick={() => handleLeaveProject(p)}
                              title="Sair do projeto"
                            >
                              <i className="bi bi-box-arrow-right me-1" />
                              Sair
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
          <div className="col-md-6">
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
          <div className="col-md-6">
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
      {activeModalProject && (
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
                    Participantes: {activeModalProject.name}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setParticipantsProject(null)}
                  />
                </div>
                <div className="modal-body p-4">
                  {activeModalProject.sponsored_seats && (
                    <div className="alert alert-light border d-flex flex-wrap justify-content-between align-items-center gap-2 py-2 px-3 mb-3 small">
                      <div>
                        <i className="bi bi-ticket-perforated text-primary me-2" />
                        <strong>Vagas Patrocinadas pelo Projeto:</strong>{" "}
                        {activeModalProject.sponsored_seats.used} /{" "}
                        {activeModalProject.sponsored_seats.max >= 999999
                          ? "∞"
                          : activeModalProject.sponsored_seats.max}{" "}
                        usadas{" "}
                        <span className="text-muted">
                          (1 cota reservada ao diretor)
                        </span>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <span className="badge bg-success-subtle text-success border border-success-subtle">
                          Licenças Próprias:{" "}
                          {
                            activeModalProject.participants.filter(
                              (part) =>
                                part.role === "coordinator" &&
                                part.license_source !== "PROJECT_SPONSORED"
                            ).length
                          }
                        </span>
                        {isDirecaoPlan && activeModalProject.is_owner && (
                          <IncrementQuotaButton />
                        )}
                      </div>
                    </div>
                  )}

                  {activeModalProject.is_owner && (
                    <form
                      onSubmit={handleInviteParticipant}
                      className="row g-2 mb-4 bg-light p-3 rounded-3 border"
                    >
                      <div className="col-md-5">
                        <input
                          type="email"
                          className="form-control form-control-sm"
                          placeholder="E-mail do usuário cadastrado..."
                          required
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                        />
                      </div>
                      <div className="col-md-2">
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
                        <select
                          className="form-select form-select-sm"
                          value={inviteLicenseSource}
                          onChange={(e) => setInviteLicenseSource(e.target.value)}
                          disabled={inviteRole !== "coordinator"}
                          title="Origem da licença do coordenador"
                        >
                          <option value="AUTO">Licença: Automática</option>
                          <option value="PROJECT_SPONSORED">
                            Patrocinada (1 cota)
                          </option>
                          <option value="INDIVIDUAL">
                            Licença Própria (sem cota)
                          </option>
                        </select>
                      </div>
                      <div className="col-md-2">
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
                    {activeModalProject.participants.length === 0 ? (
                      <li className="list-group-item text-center text-muted py-3">
                        Nenhum participante adicional neste projeto.
                      </li>
                    ) : (
                      activeModalProject.participants.map((part) => {
                        const isSponsored =
                          part.license_source === "PROJECT_SPONSORED";
                        return (
                          <li
                            key={part.id}
                            className="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2"
                          >
                            <div>
                              <div className="fw-bold">{part.username}</div>
                              <small className="text-muted">{part.email}</small>
                            </div>
                            <div className="d-flex flex-wrap align-items-center gap-2">
                              <span className="badge bg-info-subtle text-info">
                                {part.role === "coordinator"
                                  ? "Coordenador"
                                  : "Visualizador"}
                              </span>
                              {part.role === "coordinator" &&
                                (isSponsored ? (
                                  <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                                    Patrocinada pelo Projeto
                                  </span>
                                ) : part.individual_sub_valid ? (
                                  <span className="badge bg-success-subtle text-success border border-success-subtle">
                                    Licença Própria ({part.individual_plan_name})
                                  </span>
                                ) : (
                                  <span className="badge bg-danger-subtle text-danger border border-danger-subtle">
                                    Licença Individual Expirada
                                  </span>
                                ))}
                              {activeModalProject.is_owner &&
                                part.role === "coordinator" &&
                                !isSponsored &&
                                !part.individual_sub_valid && (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() =>
                                      handleChangeParticipantLicense(
                                        activeModalProject.id,
                                        part.user_id,
                                        "PROJECT_SPONSORED"
                                      )
                                    }
                                    title="Assumir com 1 vaga patrocinada do projeto"
                                  >
                                    Patrocinar
                                  </button>
                                )}
                              {activeModalProject.is_owner &&
                                part.role === "coordinator" &&
                                isSponsored &&
                                part.individual_sub_valid && (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-success"
                                    onClick={() =>
                                      handleChangeParticipantLicense(
                                        activeModalProject.id,
                                        part.user_id,
                                        "INDIVIDUAL"
                                      )
                                    }
                                    title="Liberar vaga do projeto e usar licença individual do coordenador"
                                  >
                                    Usar Licença Própria
                                  </button>
                                )}
                              {activeModalProject.is_owner && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() =>
                                    handleRemoveParticipant(
                                      activeModalProject.id,
                                      part.user_id
                                    )
                                  }
                                  title="Remover participante"
                                >
                                  <i className="bi bi-trash" />
                                </button>
                              )}
                            </div>
                          </li>
                        );
                      })
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
