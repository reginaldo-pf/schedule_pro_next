"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useUI } from "@/components/ui/UIProvider";

function ForgotPasswordContent() {
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") || "";
  const expiredWarning = searchParams.get("expired") === "1";

  const { startLoading, stopLoading, showToast } = useUI();
  const [email, setEmail] = useState(initialEmail);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [fallbackResetUrl, setFallbackResetUrl] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    startLoading();
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSent(true);
        setFallbackResetUrl(data.fallbackResetUrl || null);
        showToast(
          data.message || "Instruções de recuperação geradas!",
          "success"
        );
      } else {
        showToast(data.message || "Erro ao solicitar recuperação.", "danger");
      }
    } catch {
      showToast("Erro de conexão com o servidor.", "danger");
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
            <h4 className="fw-bold mb-1">Recuperar Senha</h4>
            <p className="text-muted small mb-0">
              Informe o e-mail da sua conta para receber o link de redefinição
            </p>
          </div>

          {expiredWarning && !sent && (
            <div className="alert alert-warning d-flex align-items-center gap-2 small py-2 mb-3">
              <i className="bi bi-clock-history fs-5 text-warning" />
              <span>
                O link anterior expirou. Informe seu e-mail abaixo para receber
                um novo link de redefinição.
              </span>
            </div>
          )}

          {sent ? (
            <div className="text-center py-2">
              <div className="mb-3 text-success">
                <i className="bi bi-envelope-check-fill display-3" />
              </div>
              <h5 className="fw-bold mb-2">
                {fallbackResetUrl
                  ? "Link de Redefinição Gerado"
                  : "Verifique sua Caixa de Entrada"}
              </h5>
              <p className="text-muted small mb-3">
                {fallbackResetUrl ? (
                  <>
                    O link exclusivo de recuperação para{" "}
                    <strong>{email}</strong> (válido por 1 hora) foi gerado.
                    Como o envio externo de e-mail não está ativo neste
                    ambiente, clique no botão abaixo para redefinir sua senha
                    agora:
                  </>
                ) : (
                  <>
                    Se houver uma conta ativa associada a{" "}
                    <strong>{email}</strong>, enviamos um link exclusivo com
                    validade de <strong>1 hora</strong> para redefinir sua
                    senha.
                  </>
                )}
              </p>

              {fallbackResetUrl && (
                <div className="mb-3">
                  <Link
                    href={fallbackResetUrl}
                    className="btn btn-success w-100 py-2 fw-bold shadow-sm"
                  >
                    <i className="bi bi-key-fill me-2" />
                    Redefinir Minha Senha Agora
                  </Link>
                </div>
              )}

              <div className="d-flex flex-column gap-2">
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm py-2 fw-semibold"
                  disabled={submitting}
                  onClick={handleSubmit}
                >
                  <i className="bi bi-arrow-repeat me-1" />
                  Gerar / Enviar Novamente
                </button>
                <Link
                  href="/accounts/login"
                  className="btn btn-light btn-sm py-2 text-secondary"
                >
                  Voltar para o Login
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="form-label fw-semibold small">
                  E-mail Cadastrado
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-light">
                    <i className="bi bi-envelope" />
                  </span>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="seuemail@instituicao.edu.br"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                  <i className="bi bi-send" />
                )}
                <span>Enviar Link de Recuperação</span>
              </button>
            </form>
          )}

          <div className="border-top mt-4 pt-3 text-center small">
            <Link
              href="/accounts/login"
              className="text-secondary text-decoration-none fw-medium"
            >
              <i className="bi bi-arrow-left me-1" />
              Voltar para a tela de Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="min-vh-100 bg-body-tertiary" />}>
      <ForgotPasswordContent />
    </Suspense>
  );
}
