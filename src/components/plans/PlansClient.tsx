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
  max_groups: number;
  duration_days: number;
  is_trial: boolean;
  price: number;
  active: boolean;
}

interface UserSubscriptionItem {
  user_id: number;
  username: string;
  full_name: string;
  email: string;
  profile: string;
  user_active: boolean;
  plan_id: number | null;
  plan_name: string;
  sub_active: boolean;
  is_valid: boolean;
  is_expired: boolean;
  starts_at: string;
  expires_at: string;
}

function formatDateBr(isoDate: string): string {
  if (!isoDate) return "—";
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

function addDaysIso(baseIso: string, days: number): string {
  const base = baseIso ? new Date(`${baseIso}T00:00:00Z`) : new Date();
  const target = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  return target.toISOString().slice(0, 10);
}

const emptyPlan = {
  id: 0,
  name: "",
  slug: "",
  max_classes: 10,
  max_projects: 1,
  max_groups: 1,
  duration_days: 30,
  is_trial: false,
  price: 0,
  active: true,
};

export function PlansClient({
  plans,
  userSubscriptions,
}: {
  plans: PlanItem[];
  userSubscriptions: UserSubscriptionItem[];
}) {
  const router = useRouter();
  const { startLoading, stopLoading, showToast } = useUI();

  const [activeTab, setActiveTab] = useState<"subscriptions" | "plans">("subscriptions");
  const [modalOpen, setModalOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [form, setForm] = useState(emptyPlan);

  // User subscriptions filter & renewal modal state
  const [subQuery, setSubQuery] = useState("");
  const [subStatusFilter, setSubStatusFilter] = useState<string>("ALL");
  const [renewTarget, setRenewTarget] = useState<UserSubscriptionItem | null>(null);
  const [renewForm, setRenewForm] = useState({
    plan_id: "",
    duration_days: 30,
    renew_mode: "from_now" as "from_now" | "extend_current",
    expires_at: "",
    active: true,
  });

  const filteredSubs = userSubscriptions.filter((u) => {
    if (subStatusFilter === "ACTIVE" && !u.is_valid) return false;
    if (subStatusFilter === "EXPIRED" && (u.is_valid || !u.plan_id)) return false;
    if (subStatusFilter === "NONE" && u.plan_id !== null) return false;
    if (subQuery) {
      const q = subQuery.toLowerCase();
      return (
        u.full_name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.plan_name.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const {
    page: subPage,
    pageSize: subPageSize,
    totalPages: subTotalPages,
    totalItems: subTotalItems,
    startIndex: subStartIndex,
    endIndex: subEndIndex,
    paginatedItems: paginatedSubs,
    setPage: setSubPage,
    setPageSize: setSubPageSize,
  } = usePagination(filteredSubs, 10);

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

  const openRenewModal = (u: UserSubscriptionItem) => {
    const defaultPlan =
      plans.find((p) => p.id === u.plan_id) ||
      plans.find((p) => p.active) ||
      plans[0];
    const defaultDays = defaultPlan ? defaultPlan.duration_days : 30;
    const todayIso = new Date().toISOString().slice(0, 10);
    const canExtend = Boolean(u.expires_at && u.expires_at > todayIso);
    const defaultMode = canExtend ? "extend_current" : "from_now";
    const baseIso = defaultMode === "extend_current" ? u.expires_at : todayIso;

    setRenewTarget(u);
    setRenewForm({
      plan_id: defaultPlan ? String(defaultPlan.id) : "",
      duration_days: defaultDays,
      renew_mode: defaultMode,
      expires_at: addDaysIso(baseIso, defaultDays),
      active: true,
    });
  };

  const handleRenewPlanChange = (planIdStr: string) => {
    const selectedPlan = plans.find((p) => String(p.id) === planIdStr);
    const days = selectedPlan ? selectedPlan.duration_days : renewForm.duration_days;
    const todayIso = new Date().toISOString().slice(0, 10);
    const baseIso =
      renewForm.renew_mode === "extend_current" &&
      renewTarget?.expires_at &&
      renewTarget.expires_at > todayIso
        ? renewTarget.expires_at
        : todayIso;

    setRenewForm((prev) => ({
      ...prev,
      plan_id: planIdStr,
      duration_days: days,
      expires_at: addDaysIso(baseIso, days),
    }));
  };

  const handleRenewDaysOrModeChange = (
    days: number,
    mode: "from_now" | "extend_current"
  ) => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const baseIso =
      mode === "extend_current" &&
      renewTarget?.expires_at &&
      renewTarget.expires_at > todayIso
        ? renewTarget.expires_at
        : todayIso;

    setRenewForm((prev) => ({
      ...prev,
      duration_days: days,
      renew_mode: mode,
      expires_at: addDaysIso(baseIso, Math.max(1, days)),
    }));
  };

  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewTarget || !renewForm.plan_id) return;
    startLoading();
    try {
      const res = await fetch("/api/plans/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: renewTarget.user_id,
          plan_id: Number(renewForm.plan_id),
          duration_days: renewForm.duration_days,
          renew_mode: renewForm.renew_mode,
          expires_at: renewForm.expires_at,
          active: renewForm.active,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message, "success");
        setRenewTarget(null);
        router.refresh();
      } else {
        showToast(data.message || "Erro ao renovar assinatura.", "danger");
      }
    } finally {
      stopLoading();
    }
  };

  return (
    <div>
      <ModuleHeader
        icon="bi-tags"
        title="Gestão de Planos e Assinaturas"
        description="Renove assinaturas de usuários individualmente e gerencie os planos comerciais"
        statLabel="Assinaturas Ativas"
        statValue={`${userSubscriptions.filter((u) => u.is_valid).length} / ${userSubscriptions.length}`}
        actionLabel="Novo Plano"
        onAction={openCreate}
      />

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link fw-semibold ${
              activeTab === "subscriptions" ? "active" : ""
            }`}
            onClick={() => setActiveTab("subscriptions")}
          >
            <i className="bi bi-people me-2" />
            Assinaturas por Usuário
            <span className="badge bg-primary-subtle text-primary ms-2">
              {userSubscriptions.length}
            </span>
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link fw-semibold ${
              activeTab === "plans" ? "active" : ""
            }`}
            onClick={() => setActiveTab("plans")}
          >
            <i className="bi bi-tags me-2" />
            Planos Cadastrados
            <span className="badge bg-secondary-subtle text-secondary ms-2">
              {plans.length}
            </span>
          </button>
        </li>
      </ul>

      {activeTab === "subscriptions" && (
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white border-bottom py-3 d-flex flex-wrap gap-2 justify-content-between align-items-center">
            <div className="d-flex flex-wrap gap-2 align-items-center">
              <select
                className="form-select form-select-sm"
                style={{ maxWidth: 210 }}
                value={subStatusFilter}
                onChange={(e) => {
                  setSubStatusFilter(e.target.value);
                  setSubPage(1);
                }}
              >
                <option value="ALL">Todas as Assinaturas</option>
                <option value="ACTIVE">Somente Ativas</option>
                <option value="EXPIRED">Expiradas / Inativas</option>
                <option value="NONE">Sem Plano</option>
              </select>

              <div className="input-group input-group-sm" style={{ maxWidth: 280 }}>
                <span className="input-group-text bg-light">
                  <i className="bi bi-search" />
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Buscar usuário, e-mail ou plano..."
                  value={subQuery}
                  onChange={(e) => {
                    setSubQuery(e.target.value);
                    setSubPage(1);
                  }}
                />
              </div>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table align-middle table-hover mb-0">
              <thead className="table-light">
                <tr>
                  <th className="ps-4">Usuário</th>
                  <th>E-mail</th>
                  <th>Plano Atual</th>
                  <th>Início</th>
                  <th>Validade / Expiração</th>
                  <th className="text-center">Status</th>
                  <th className="text-end pe-4">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-4 text-muted">
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                ) : (
                  paginatedSubs.map((u) => (
                    <tr key={u.user_id}>
                      <td className="ps-4">
                        <div className="fw-bold">{u.full_name}</div>
                        <div className="small text-muted">@{u.username}</div>
                      </td>
                      <td className="small text-muted">{u.email}</td>
                      <td>
                        <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle">
                          {u.plan_name}
                        </span>
                      </td>
                      <td className="small text-muted">
                        {formatDateBr(u.starts_at)}
                      </td>
                      <td className="small">
                        {u.expires_at ? (
                          <span
                            className={
                              u.is_expired
                                ? "text-danger fw-semibold"
                                : "text-dark"
                            }
                          >
                            {formatDateBr(u.expires_at)}
                          </span>
                        ) : (
                          <span className="text-muted">Sem expiração</span>
                        )}
                      </td>
                      <td className="text-center">
                        {u.plan_id === null ? (
                          <span className="badge bg-secondary-subtle text-secondary">
                            Sem plano
                          </span>
                        ) : u.is_valid ? (
                          <span className="badge bg-success-subtle text-success">
                            Ativa
                          </span>
                        ) : u.is_expired ? (
                          <span className="badge bg-danger-subtle text-danger">
                            Expirada
                          </span>
                        ) : (
                          <span className="badge bg-warning-subtle text-warning-emphasis">
                            Inativa
                          </span>
                        )}
                      </td>
                      <td className="text-end pe-4">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          title="Renovar ou alterar plano deste usuário"
                          onClick={() => openRenewModal(u)}
                        >
                          <i className="bi bi-arrow-repeat me-1" />
                          Renovar Plano
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <TablePagination
            page={subPage}
            pageSize={subPageSize}
            totalPages={subTotalPages}
            totalItems={subTotalItems}
            startIndex={subStartIndex}
            endIndex={subEndIndex}
            onPageChange={setSubPage}
            onPageSizeChange={setSubPageSize}
          />
        </div>
      )}

      {activeTab === "plans" && (
        <div className="card border-0 shadow-sm">
        <div className="table-responsive">
          <table className="table align-middle table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th className="ps-4">Nome</th>
                <th>Slug</th>
                <th>Máx. Turmas</th>
                <th>Máx. Projetos</th>
                <th>Máx. Cursos</th>
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
                  <td>{p.max_groups}</td>
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
      )}

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
            <label className="form-label small fw-semibold">Máx. Cursos</label>
            <input
              type="number"
              className="form-control"
              min={1}
              value={form.max_groups}
              onChange={(e) =>
                setForm({ ...form, max_groups: Number(e.target.value) })
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

      {/* Individual Subscription Renewal Modal */}
      {renewTarget && (
        <>
          <div className="modal-backdrop fade show" />
          <div
            className="modal fade show d-block"
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 shadow-lg">
                <form onSubmit={handleRenewSubmit}>
                  <div className="modal-header bg-light">
                    <h5 className="modal-title fw-bold">
                      <i className="bi bi-arrow-repeat text-primary me-2" />
                      Renovar Plano — {renewTarget.full_name}
                    </h5>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => setRenewTarget(null)}
                    />
                  </div>
                  <div className="modal-body">
                    <div className="alert alert-info small py-2 mb-3">
                      <i className="bi bi-person-badge me-1" />
                      Usuário: <strong>@{renewTarget.username}</strong> ({renewTarget.email})
                      <br />
                      Plano atual: <strong>{renewTarget.plan_name}</strong>
                      {renewTarget.expires_at && (
                        <>
                          {" "}
                          • Validade atual:{" "}
                          <strong>{formatDateBr(renewTarget.expires_at)}</strong>
                        </>
                      )}
                    </div>

                    <div className="row g-3">
                      <div className="col-12">
                        <label className="form-label small fw-semibold">
                          Plano *
                        </label>
                        <select
                          className="form-select"
                          required
                          value={renewForm.plan_id}
                          onChange={(e) => handleRenewPlanChange(e.target.value)}
                        >
                          <option value="">Selecione um plano...</option>
                          {plans.map((p) => (
                            <option key={p.id} value={String(p.id)}>
                              {p.name} ({p.duration_days} dias • {p.max_classes} turmas • R${" "}
                              {p.price.toFixed(2)})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-md-6">
                        <label className="form-label small fw-semibold">
                          Dias de Renovação *
                        </label>
                        <input
                          type="number"
                          className="form-control"
                          min={1}
                          required
                          value={renewForm.duration_days}
                          onChange={(e) =>
                            handleRenewDaysOrModeChange(
                              Number(e.target.value) || 1,
                              renewForm.renew_mode
                            )
                          }
                        />
                      </div>

                      <div className="col-md-6">
                        <label className="form-label small fw-semibold">
                          Nova Data de Expiração *
                        </label>
                        <input
                          type="date"
                          className="form-control"
                          required
                          value={renewForm.expires_at}
                          onChange={(e) =>
                            setRenewForm({ ...renewForm, expires_at: e.target.value })
                          }
                        />
                      </div>

                      <div className="col-12">
                        <label className="form-label small fw-semibold">
                          Base de Contagem
                        </label>
                        <select
                          className="form-select"
                          value={renewForm.renew_mode}
                          onChange={(e) =>
                            handleRenewDaysOrModeChange(
                              renewForm.duration_days,
                              e.target.value as "from_now" | "extend_current"
                            )
                          }
                        >
                          <option value="from_now">A partir de hoje</option>
                          {renewTarget.expires_at && (
                            <option value="extend_current">
                              Somar ao vencimento atual ({formatDateBr(renewTarget.expires_at)})
                            </option>
                          )}
                        </select>
                      </div>

                      <div className="col-12">
                        <div className="form-check form-switch">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            id="chk_renew_active"
                            checked={renewForm.active}
                            onChange={(e) =>
                              setRenewForm({ ...renewForm, active: e.target.checked })
                            }
                          />
                          <label
                            className="form-check-label small"
                            htmlFor="chk_renew_active"
                          >
                            Manter assinatura ativa
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer bg-light">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => setRenewTarget(null)}
                    >
                      Cancelar
                    </button>
                    <button type="submit" className="btn btn-primary btn-sm">
                      <i className="bi bi-check2-circle me-1" />
                      Confirmar Renovação
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
