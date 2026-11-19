"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useUI } from "@/components/ui/UIProvider";
import { ModuleHeader } from "@/components/crud/ModuleHeader";
import { CrudModal, type SaveActionType } from "@/components/crud/CrudModal";
import { TablePagination, usePagination } from "@/components/crud/TablePagination";

interface ManagedUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  profile: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  date_joined: string;
  plan_id: number | null;
  plan_name: string;
  subscription_active: boolean;
}

export function AdminUsersClient({
  users,
  plans,
}: {
  users: ManagedUser[];
  plans: { id: number; name: string }[];
}) {
  const router = useRouter();
  const { startLoading, stopLoading, showToast, confirmAction } = useUI();

  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [lastConfirmInfo, setLastConfirmInfo] = useState<{
    username: string;
    email: string;
    url: string;
    sent: boolean;
  } | null>(null);

  const defaultPlanId = plans.length > 0 ? String(plans[0].id) : "";

  const [form, setForm] = useState({
    id: 0,
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    password: "",
    profile: "coordinator",
    is_active: false,
    is_staff: false,
    is_superuser: false,
    plan_id: defaultPlanId,
    subscription_active: true,
    send_confirmation_email: true,
  });

  const filtered = users.filter(
    (u) =>
      u.username.toLowerCase().includes(query.toLowerCase()) ||
      u.email.toLowerCase().includes(query.toLowerCase()) ||
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(query.toLowerCase())
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
    setForm({
      id: 0,
      username: "",
      email: "",
      first_name: "",
      last_name: "",
      password: "",
      profile: "coordinator",
      is_active: false,
      is_staff: false,
      is_superuser: false,
      plan_id: defaultPlanId,
      subscription_active: true,
      send_confirmation_email: true,
    });
    setModalOpen(true);
  };

  const openEdit = (index: number) => {
    const u = filtered[index];
    if (!u) return;
    setCurrentIndex(index);
    setForm({
      id: u.id,
      username: u.username,
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      password: "",
      profile: u.profile,
      is_active: u.is_active,
      is_staff: u.is_staff,
      is_superuser: u.is_superuser,
      plan_id: u.plan_id ? String(u.plan_id) : "",
      subscription_active: u.subscription_active,
      send_confirmation_email: false,
    });
    setModalOpen(true);
  };

  const handleSave = async (action: SaveActionType) => {
    startLoading();
    try {
      const isEditing = currentIndex !== null;
      const res = await fetch("/api/crud/users", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message, "success");
        if (data.confirmUrl) {
          setLastConfirmInfo({
            username: form.username,
            email: form.email,
            url: data.confirmUrl,
            sent: Boolean(data.emailSent),
          });
        }
        router.refresh();
        if (action === "save") {
          setModalOpen(false);
        } else if (action === "save_and_add_another") {
          openCreate();
        }
      } else {
        showToast(data.message || "Erro ao salvar usuário.", "danger");
      }
    } finally {
      stopLoading();
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirmAction({
      title: "Excluir Usuário",
      message: `Tem certeza que deseja excluir o usuário "${form.username}" (${form.email})? Esta ação não pode ser desfeita.`,
      confirmText: "Sim, Excluir",
      confirmVariant: "danger",
    });
    if (!confirmed) return;

    startLoading();
    try {
      const res = await fetch(`/api/crud/users?id=${form.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message, "success");
        setModalOpen(false);
        router.refresh();
      } else {
        showToast(data.message || "Erro ao excluir usuário.", "danger");
      }
    } finally {
      stopLoading();
    }
  };

  const handleSendConfirmation = async (u: ManagedUser) => {
    startLoading();
    try {
      const res = await fetch("/api/auth/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resend", userId: u.id }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message, data.sent ? "success" : "info");
        if (data.confirmUrl) {
          setLastConfirmInfo({
            username: u.username,
            email: u.email,
            url: data.confirmUrl,
            sent: Boolean(data.sent),
          });
        }
      } else {
        showToast(data.message || "Erro ao enviar e-mail de confirmação.", "danger");
      }
    } finally {
      stopLoading();
    }
  };

  const copyConfirmLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link de confirmação copiado para a área de transferência!", "success");
    } catch {
      showToast("Não foi possível copiar automaticamente.", "warning");
    }
  };

  const isEditing = currentIndex !== null;

  return (
    <div>
      <ModuleHeader
        icon="bi-shield-lock"
        title="Gestão de Usuários"
        description="Cadastro, permissões, assinaturas e envio de confirmação de conta por e-mail"
        statLabel="Total de Usuários"
        statValue={users.length}
        actionLabel="Novo Usuário"
        onAction={openCreate}
      />

      {lastConfirmInfo && (
        <div className="alert alert-info d-flex flex-wrap align-items-center justify-content-between gap-2 py-2 px-3 mb-3 border-info-subtle shadow-sm">
          <div className="small">
            <i className="bi bi-envelope-check-fill me-2" />
            <strong>
              {lastConfirmInfo.sent
                ? `E-mail de confirmação enviado para ${lastConfirmInfo.email}`
                : `Link de confirmação gerado para ${lastConfirmInfo.username} (${lastConfirmInfo.email})`}
            </strong>
            <span className="text-muted ms-2 text-break">
              {lastConfirmInfo.url}
            </span>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-sm btn-primary py-1 px-2"
              onClick={() => copyConfirmLink(lastConfirmInfo.url)}
            >
              <i className="bi bi-clipboard me-1" />
              Copiar Link
            </button>
            <button
              type="button"
              className="btn-close small"
              onClick={() => setLastConfirmInfo(null)}
            />
          </div>
        </div>
      )}

      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white border-bottom py-3 d-flex justify-content-between align-items-center">
          <div className="input-group input-group-sm" style={{ maxWidth: 340 }}>
            <span className="input-group-text bg-light">
              <i className="bi bi-search" />
            </span>
            <input
              type="text"
              className="form-control"
              placeholder="Buscar por usuário, nome ou e-mail..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="table-responsive">
          <table className="table align-middle table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th className="ps-4">Usuário</th>
                <th>E-mail</th>
                <th>Perfil</th>
                <th>Plano</th>
                <th>Status</th>
                <th>Cadastro</th>
                <th className="text-end pe-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-4 text-muted">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((u, idx) => (
                  <tr key={u.id}>
                    <td className="ps-4">
                      <div className="fw-semibold text-dark">
                        {u.username}
                        {u.is_superuser && (
                          <span className="badge bg-primary-subtle text-primary ms-2">
                            Admin
                          </span>
                        )}
                      </div>
                      {(u.first_name || u.last_name) && (
                        <small className="text-muted">
                          {`${u.first_name} ${u.last_name}`.trim()}
                        </small>
                      )}
                    </td>
                    <td>{u.email}</td>
                    <td>
                      {u.profile === "teacher" ? "Professor" : "Coordenador"}
                    </td>
                    <td>
                      <span className="badge bg-info-subtle text-info border border-info-subtle">
                        {u.plan_name}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          u.is_active
                            ? "bg-success-subtle text-success"
                            : "bg-warning-subtle text-warning-emphasis"
                        }`}
                      >
                        {u.is_active ? "Confirmado / Ativo" : "Pendente / Inativo"}
                      </span>
                    </td>
                    <td className="text-muted small">{u.date_joined}</td>
                    <td className="text-end pe-4">
                      <div className="d-inline-flex align-items-center gap-1">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          title="Enviar e-mail de confirmação ao usuário"
                          onClick={() => handleSendConfirmation(u)}
                        >
                          <i className="bi bi-envelope-paper me-1" />
                          Confirmar por E-mail
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => openEdit(startIndex + idx)}
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
        title={isEditing ? `Editar Usuário: ${form.username}` : "Novo Usuário"}
        icon={isEditing ? "bi-person-gear" : "bi-person-plus"}
        isEditing={isEditing}
        hasPrev={currentIndex !== null && currentIndex > 0}
        hasNext={currentIndex !== null && currentIndex < filtered.length - 1}
        onPrev={() => currentIndex !== null && openEdit(currentIndex - 1)}
        onNext={() => currentIndex !== null && openEdit(currentIndex + 1)}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSave}
        onDelete={isEditing ? handleDelete : undefined}
      >
        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label small fw-semibold">
              Nome de Usuário *
            </label>
            <input
              type="text"
              className="form-control"
              required
              placeholder="Ex: joao.silva"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </div>
          <div className="col-md-6">
            <label className="form-label small fw-semibold">E-mail *</label>
            <input
              type="email"
              className="form-control"
              required
              placeholder="usuario@instituicao.edu.br"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="col-md-6">
            <label className="form-label small fw-semibold">Nome</label>
            <input
              type="text"
              className="form-control"
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            />
          </div>
          <div className="col-md-6">
            <label className="form-label small fw-semibold">Sobrenome</label>
            <input
              type="text"
              className="form-control"
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            />
          </div>
          <div className="col-md-12">
            <label className="form-label small fw-semibold">
              {isEditing
                ? "Redefinir Senha (deixe em branco para manter a senha atual)"
                : "Senha Inicial (opcional — se vazio, o usuário definirá ao confirmar o e-mail)"}
            </label>
            <input
              type="password"
              className="form-control"
              placeholder={
                isEditing
                  ? "Digite apenas se desejar alterar a senha"
                  : "Opcional (mínimo de 6 caracteres)"
              }
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div className="col-md-6">
            <label className="form-label small fw-semibold">Plano</label>
            <select
              className="form-select"
              value={form.plan_id}
              onChange={(e) => setForm({ ...form, plan_id: e.target.value })}
            >
              <option value="">Plano Trial Padrão</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label small fw-semibold">Perfil</label>
            <select
              className="form-select"
              value={form.profile}
              onChange={(e) => setForm({ ...form, profile: e.target.value })}
            >
              <option value="coordinator">Coordenador</option>
              <option value="teacher">Professor</option>
            </select>
          </div>
          <div className="col-12 d-flex flex-wrap gap-4 pt-2">
            <div className="form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="chk_send_confirm"
                checked={form.send_confirmation_email}
                onChange={(e) =>
                  setForm({
                    ...form,
                    send_confirmation_email: e.target.checked,
                  })
                }
              />
              <label
                className="form-check-label fw-semibold text-primary"
                htmlFor="chk_send_confirm"
              >
                Enviar e-mail de confirmação ao salvar
              </label>
            </div>
            <div className="form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="chk_user_active"
                checked={form.is_active}
                onChange={(e) =>
                  setForm({ ...form, is_active: e.target.checked })
                }
              />
              <label className="form-check-label" htmlFor="chk_user_active">
                Conta Ativa (já confirmada)
              </label>
            </div>
            <div className="form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="chk_sub_active"
                checked={form.subscription_active}
                onChange={(e) =>
                  setForm({ ...form, subscription_active: e.target.checked })
                }
              />
              <label className="form-check-label" htmlFor="chk_sub_active">
                Assinatura Ativa
              </label>
            </div>
            <div className="form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="chk_superuser"
                checked={form.is_superuser}
                onChange={(e) =>
                  setForm({ ...form, is_superuser: e.target.checked })
                }
              />
              <label className="form-check-label" htmlFor="chk_superuser">
                Superusuário (Admin)
              </label>
            </div>
          </div>
        </div>
      </CrudModal>
    </div>
  );
}
