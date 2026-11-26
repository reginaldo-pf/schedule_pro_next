"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUI } from "@/components/ui/UIProvider";

export function ConfirmAccountClient({
  token,
  valid,
  user,
  needsPassword,
}: {
  token: string;
  valid: boolean;
  user: {
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    is_active: boolean;
  } | null;
  needsPassword: boolean;
}) {
  const router = useRouter();
  const { startLoading, stopLoading, showToast } = useUI();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    startLoading();
    try {
      const res = await fetch("/api/auth/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password,
          confirm_password: confirmPassword,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message, "success");
        router.push("/accounts/login?confirmed=1");
      } else {
        showToast(data.message || "Erro ao confirmar conta.", "danger");
      }
    } catch {
      showToast("Erro de conexão ao servidor.", "danger");
    } finally {
      setSubmitting(false);
      stopLoading();
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-body-tertiary p-3">
      <div
        className="card border-0 shadow-lg"
        style={{ maxWidth: 460, width: "100%" }}
      >
        <div className="card-body p-4 p-md-5">
          <div className="text-center mb-4">
            <Link href="/" className="text-decoration-none d-inline-block mb-2">
              <div className="bg-primary text-white rounded-3 px-3 py-2 fw-bold fs-4 d-inline-block shadow-sm">
                SP
              </div>
            </Link>
            <h4 className="fw-bold mb-1">Confirmação de Conta</h4>
            <p className="text-muted small mb-0">
              Validação de e-mail e ativação de acesso ao Gerenciador de Horários
            </p>
          </div>

          {!valid || !user ? (
            <div className="text-center">
              <div className="alert alert-danger small text-start d-flex align-items-center gap-2">
                <i className="bi bi-exclamation-octagon-fill fs-4 flex-shrink-0" />
                <div>
                  <strong>Link inválido ou expirado.</strong>
                  <div className="mt-1">
                    Este link de confirmação não é mais válido. Solicite o
                    reenvio da confirmação ao administrador do sistema.
                  </div>
                </div>
              </div>
              <Link
                href="/accounts/login"
                className="btn btn-outline-primary w-100 mt-2"
              >
                Ir para a Tela de Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleConfirm}>
              <div className="bg-light border rounded-3 p-3 mb-3">
                <div className="d-flex align-items-center gap-2 mb-1">
                  <i className="bi bi-person-check-fill text-primary fs-5" />
                  <span className="fw-bold text-dark">
                    {user.first_name || user.last_name
                      ? `${user.first_name} ${user.last_name}`.trim()
                      : user.username}
                  </span>
                </div>
                <div className="small text-muted">
                  <div>
                    <strong>Usuário:</strong> {user.username}
                  </div>
                  <div>
                    <strong>E-mail:</strong> {user.email}
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold small">
                  {needsPassword
                    ? "Definir Senha de Acesso *"
                    : "Nova Senha (opcional — deixe em branco para manter a senha inicial)"}
                </label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Mínimo de 6 caracteres"
                  required={needsPassword}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {(needsPassword || password.length > 0) && (
                <div className="mb-4">
                  <label className="form-label fw-semibold small">
                    Confirmar Senha *
                  </label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Repita a senha"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary w-100 py-2 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm"
                disabled={submitting}
              >
                {submitting ? (
                  <span className="spinner-border spinner-border-sm" />
                ) : (
                  <i className="bi bi-check2-circle" />
                )}
                <span>Confirmar e Ativar Minha Conta</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
