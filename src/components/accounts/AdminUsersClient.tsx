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
  const { startLoading, stopLoading, showToast } = useUI();

  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);

  const [form, setForm] = useState({
    id: 0,
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    profile: "coordinator",
    is_active: true,
    is_staff: false,
    is_superuser: false,
    plan_id: "",
    subscription_active: true,
  });

  const filtered = users.filter(
    (u) =>
      u.username.toLowerCase().includes(query.toLowerCase()) ||
      u.email.toLowerCase().includes(query.toLowerCase())
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
      profile: u.profile,
      is_active: u.is_active,
      is_staff: u.is_staff,
      is_superuser: u.is_superuser,
      plan_id: u.plan_id ? String(u.plan_id) : "",
      subscription_active: u.subscription_active,
    });
    setModalOpen(true);
  };

  const handleSave = async (action: SaveActionType) => {
    startLoading();
    try {
      const res = await fetch("/api/crud/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message, "success");
        router.refresh();
        if (action === "save") {
          setModalOpen(false);
        }
      } else {
        showToast(data.message || "Erro ao atualizar usuário.", "danger");
      }
    } finally {
      stopLoading();
    }
  };

  return (
    <div>
      <ModuleHeader
        icon="bi-shield-lock"
        title="Gestão de Usuários"
        description="Administração de contas, permissões e assinaturas de usuários"
        statLabel="Total de Usuários"
        statValue={users.length}
      />

      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white border-bottom py-3 d-flex justify-content-between align-items-center">
          <div className="input-group input-group-sm" style={{ maxWidth: 320 }}>
            <span className="input-group-text bg-light">
              <i className="bi bi-search" />
            </span>
            <input
              type="text"
              className="form-control"
              placeholder="Buscar por usuário ou e-mail..."
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
              {paginatedItems.map((u, idx) => (
                <tr key={u.id}>
                  <td className="ps-4 fw-semibold">
                    {u.username}
                    {u.is_superuser && (
                      <span className="badge bg-primary-subtle text-primary ms-2">
                        Admin
                      </span>
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
                          : "bg-secondary-subtle text-secondary"
                      }`}
                    >
                      {u.is_active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="text-muted small">{u.date_joined}</td>
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
        title={`Editar Usuário: ${form.username}`}
        icon="bi-person-gear"
        isEditing={true}
        hasPrev={currentIndex !== null && currentIndex > 0}
        hasNext={currentIndex !== null && currentIndex < filtered.length - 1}
        onPrev={() => currentIndex !== null && openEdit(currentIndex - 1)}
        onNext={() => currentIndex !== null && openEdit(currentIndex + 1)}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSave}
      >
        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label small fw-semibold">Usuário</label>
            <input
              type="text"
              className="form-control"
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </div>
          <div className="col-md-6">
            <label className="form-label small fw-semibold">E-mail</label>
            <input
              type="email"
              className="form-control"
              required
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
          <div className="col-md-6">
            <label className="form-label small fw-semibold">Plano</label>
            <select
              className="form-select"
              value={form.plan_id}
              onChange={(e) => setForm({ ...form, plan_id: e.target.value })}
            >
              <option value="">Selecione um plano...</option>
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
                id="chk_user_active"
                checked={form.is_active}
                onChange={(e) =>
                  setForm({ ...form, is_active: e.target.checked })
                }
              />
              <label className="form-check-label" htmlFor="chk_user_active">
                Conta Ativa
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
