"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useUI } from "@/components/ui/UIProvider";
import { ModuleHeader } from "@/components/crud/ModuleHeader";
import type { ShellSubscription } from "@/components/layout/AppShell";

export function ProfileClient({
  user,
  subscription,
}: {
  user: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    profile: string;
  };
  subscription: ShellSubscription | null;
}) {
  const router = useRouter();
  const { startLoading, stopLoading, showToast } = useUI();

  const [firstName, setFirstName] = useState(user.first_name);
  const [lastName, setLastName] = useState(user.last_name);
  const [email, setEmail] = useState(user.email);
  const [savingProfile, setSavingProfile] = useState(false);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    startLoading();
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message, "success");
        router.refresh();
      } else {
        showToast(data.message || "Erro ao atualizar perfil.", "danger");
      }
    } finally {
      setSavingProfile(false);
      stopLoading();
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPassword(true);
    startLoading();
    try {
      const res = await fetch("/api/auth/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message, "success");
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        showToast(data.message || "Erro ao alterar senha.", "danger");
      }
    } finally {
      setSavingPassword(false);
      stopLoading();
    }
  };

  return (
    <div>
      <ModuleHeader
        icon="bi-person-circle"
        title="Meu Perfil"
        description="Gerencie seus dados pessoais, credenciais de segurança e plano ativo"
        statLabel="Plano Atual"
        statValue={subscription ? subscription.plan.name : "Sem Plano"}
      />

      <div className="row g-4">
        <div className="col-lg-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-bottom py-3">
              <h6 className="fw-bold mb-0">
                <i className="bi bi-person-lines-fill text-primary me-2" />
                Dados Pessoais
              </h6>
            </div>
            <div className="card-body p-4">
              <form onSubmit={handleSaveProfile}>
                <div className="mb-3">
                  <label className="form-label small fw-semibold">
                    Usuário (Login)
                  </label>
                  <input
                    type="text"
                    className="form-control bg-light"
                    value={user.username}
                    disabled
                  />
                </div>
                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">Nome</label>
                    <input
                      type="text"
                      className="form-control"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">
                      Sobrenome
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="form-label small fw-semibold">E-mail</label>
                  <input
                    type="email"
                    className="form-control"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm px-4 py-2 fw-bold"
                  disabled={savingProfile}
                >
                  {savingProfile ? (
                    <span className="spinner-border spinner-border-sm me-2" />
                  ) : (
                    <i className="bi bi-check2-circle me-2" />
                  )}
                  Salvar Alterações
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-bottom py-3">
              <h6 className="fw-bold mb-0">
                <i className="bi bi-shield-lock text-primary me-2" />
                Alterar Senha
              </h6>
            </div>
            <div className="card-body p-4">
              <form onSubmit={handleChangePassword}>
                <div className="mb-3">
                  <label className="form-label small fw-semibold">
                    Senha Atual
                  </label>
                  <input
                    type="password"
                    className="form-control"
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-semibold">
                    Nova Senha
                  </label>
                  <input
                    type="password"
                    className="form-control"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="mb-4">
                  <label className="form-label small fw-semibold">
                    Confirmar Nova Senha
                  </label>
                  <input
                    type="password"
                    className="form-control"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-outline-primary btn-sm px-4 py-2 fw-bold"
                  disabled={savingPassword}
                >
                  {savingPassword ? (
                    <span className="spinner-border spinner-border-sm me-2" />
                  ) : (
                    <i className="bi bi-key me-2" />
                  )}
                  Atualizar Senha
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
