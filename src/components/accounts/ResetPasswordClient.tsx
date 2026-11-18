"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUI } from "@/components/ui/UIProvider";

export function ResetPasswordClient({
  token,
  isTokenValid,
  email,
}: {
  token: string;
  isTokenValid: boolean;
  email: string;
}) {
  const router = useRouter();
  const { startLoading, stopLoading, showToast } = useUI();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expiredState, setExpiredState] = useState(!isTokenValid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    startLoading();
    try {
      const res = await fetch("/api/auth/reset-password", {
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
        router.push("/accounts/login");
      } else {
        if (data.expired) {
          setExpiredState(true);
        }
        showToast(data.message || "Erro ao redefinir senha.", "danger");
      }
    } catch {
      showToast("Erro de conexão ao redefinir senha.", "danger");
    } finally {
      setSubmitting(false);
      stopLoading();
    }
  };

  if (expiredState) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-body-tertiary p-3">
        <div
          className="card border-0 shadow-lg text-center p-4 p-md-5"
          style={{ maxWidth: 460, width: "100%" }}
        >
          <div className="mb-3 text-danger">
            <i className="bi bi-clock-history display-1" />
          </div>
          <h4 className="fw-bold mb-2">Link de Redefinição Expirado</h4>
          <p className="text-muted small mb-4">
            Por segurança, os links de redefinição de senha são de uso único e
            expiram após <strong>1 hora</strong>. Você pode solicitar um novo
            link imediatamente abaixo.
          </p>
          <div className="d-flex flex-column gap-2">
            <Link
              href={`/accounts/forgot-password?expired=1${
                email ? `&email=${encodeURIComponent(email)}` : ""
              }`}
              className="btn btn-primary py-2 fw-bold shadow-sm"
            >
              <i className="bi bi-envelope-paper me-2" />
              Solicitar Novo Link
            </Link>
            <Link
              href="/accounts/login"
              className="btn btn-light py-2 text-secondary"
            >
              Voltar ao Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-body-tertiary p-3">
      <div
        className="card border-0 shadow-lg"
        style={{ maxWidth: 440, width: "100%" }}
      >
        <div className="card-body p-4 p-md-5">
          <div className="text-center mb-4">
            <Link href="/" className="text-decoration-none d-inline-block mb-2">
              <div className="bg-primary text-white rounded-3 px-3 py-2 fw-bold fs-4 d-inline-block shadow-sm">
                SP
              </div>
            </Link>
            <h4 className="fw-bold mb-1">Criar Nova Senha</h4>
            <p className="text-muted small mb-0">
              Defina a nova senha para a conta <strong>{email}</strong>
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label fw-semibold small">
                Nova Senha *
              </label>
              <div className="input-group">
                <span className="input-group-text bg-light">
                  <i className="bi bi-lock" />
                </span>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Mínimo de 6 caracteres"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label fw-semibold small">
                Confirmar Nova Senha *
              </label>
              <div className="input-group">
                <span className="input-group-text bg-light">
                  <i className="bi bi-shield-check" />
                </span>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Repita a nova senha"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

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
              <span>Salvar Nova Senha</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
