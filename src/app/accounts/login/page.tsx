"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useUI } from "@/components/ui/UIProvider";

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authRequired = searchParams.get("auth_required") === "1";
  const { startLoading, stopLoading, showToast } = useUI();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    startLoading();
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message || "Bem-vindo ao Schedule Pro!", "success");
        router.push("/dashboard");
        router.refresh();
      } else {
        showToast(data.message || "Credenciais inválidas.", "danger");
      }
    } catch {
      showToast("Erro ao conectar ao servidor.", "danger");
    } finally {
      setSubmitting(false);
      stopLoading();
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-body-tertiary p-3">
      <div className="card border-0 shadow-lg" style={{ maxWidth: 430, width: "100%" }}>
        <div className="card-body p-4 p-md-5">
          <div className="text-center mb-4">
            <Link href="/" className="text-decoration-none d-inline-block mb-2">
              <div className="bg-primary text-white rounded-3 px-3 py-2 fw-bold fs-4 d-inline-block shadow-sm">
                SP
              </div>
            </Link>
            <h4 className="fw-bold mb-1">Entrar no Schedule Pro</h4>
            <p className="text-muted small mb-0">
              Acesse sua conta para gerenciar projetos e horários
            </p>
          </div>

          {authRequired && (
            <div className="alert alert-warning d-flex align-items-center gap-2 small py-2 mb-3">
              <i className="bi bi-shield-exclamation fs-5 text-warning" />
              <span>
                É necessário realizar login para acessar a página solicitada.
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label fw-semibold small">
                Usuário ou E-mail
              </label>
              <div className="input-group">
                <span className="input-group-text bg-light">
                  <i className="bi bi-person" />
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Digite seu usuário ou e-mail"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label fw-semibold small">Senha</label>
              <div className="input-group">
                <span className="input-group-text bg-light">
                  <i className="bi bi-lock" />
                </span>
                <input
                  type="password"
                  className="form-control"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                <i className="bi bi-box-arrow-in-right" />
              )}
              <span>Acessar Sistema</span>
            </button>
          </form>

          <div className="border-top mt-4 pt-3 text-center small">
            <span className="text-muted">Ainda não possui conta? </span>
            <Link href="/accounts/register" className="fw-bold text-decoration-none">
              Cadastre-se gratuitamente
            </Link>
            <div className="mt-2">
              <Link href="/" className="text-secondary text-decoration-none">
                <i className="bi bi-arrow-left me-1" />
                Voltar à consulta pública
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-vh-100 bg-body-tertiary" />}>
      <LoginFormContent />
    </Suspense>
  );
}
