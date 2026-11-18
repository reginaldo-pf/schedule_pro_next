"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUI } from "@/components/ui/UIProvider";

export default function RegisterPage() {
  const router = useRouter();
  const { startLoading, stopLoading, showToast } = useUI();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    startLoading();
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          email,
          first_name: firstName,
          last_name: lastName,
          password,
          confirm_password: confirmPassword,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message, "success");
        router.push("/accounts/login");
      } else {
        showToast(data.message || "Erro ao criar conta.", "danger");
      }
    } catch {
      showToast("Erro de conexão.", "danger");
    } finally {
      setSubmitting(false);
      stopLoading();
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-body-tertiary p-3">
      <div className="card border-0 shadow-lg" style={{ maxWidth: 480, width: "100%" }}>
        <div className="card-body p-4 p-md-5">
          <div className="text-center mb-4">
            <Link href="/" className="text-decoration-none d-inline-block mb-2">
              <div className="bg-primary text-white rounded-3 px-3 py-2 fw-bold fs-4 d-inline-block shadow-sm">
                SP
              </div>
            </Link>
            <h4 className="fw-bold mb-1">Criar Conta no Schedule Pro</h4>
            <p className="text-muted small mb-0">
              Inicie agora com plano Trial gratuito para sua instituição
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label fw-semibold small">Nome</label>
                <input
                  type="text"
                  className="form-control"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold small">Sobrenome</label>
                <input
                  type="text"
                  className="form-control"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold small">
                Nome de Usuário *
              </label>
              <input
                type="text"
                className="form-control"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold small">E-mail *</label>
              <input
                type="email"
                className="form-control"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="row g-3 mb-4">
              <div className="col-md-6">
                <label className="form-label fw-semibold small">Senha *</label>
                <input
                  type="password"
                  className="form-control"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold small">
                  Confirmar Senha *
                </label>
                <input
                  type="password"
                  className="form-control"
                  required
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
                <i className="bi bi-person-plus" />
              )}
              <span>Criar Minha Conta</span>
            </button>
          </form>

          <div className="border-top mt-4 pt-3 text-center small">
            <span className="text-muted">Já possui uma conta? </span>
            <Link href="/accounts/login" className="fw-bold text-decoration-none">
              Fazer Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
