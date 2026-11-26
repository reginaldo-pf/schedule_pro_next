"use client";

import React from "react";
import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-body-tertiary p-3">
      <div
        className="card border-0 shadow-lg"
        style={{ maxWidth: 460, width: "100%" }}
      >
        <div className="card-body p-4 p-md-5 text-center">
          <div className="mb-3">
            <Link href="/" className="text-decoration-none d-inline-block mb-2">
              <div className="bg-primary text-white rounded-3 px-3 py-2 fw-bold fs-4 d-inline-block shadow-sm">
                SP
              </div>
            </Link>
            <h4 className="fw-bold mb-1">Cadastro Restrito</h4>
            <p className="text-muted small mb-0">
              Gerenciador de Horários • Gestão Acadêmica
            </p>
          </div>

          <div className="alert alert-warning text-start small d-flex align-items-start gap-2 my-4">
            <i className="bi bi-shield-lock-fill fs-4 text-warning flex-shrink-0" />
            <div>
              <strong>Auto-cadastro temporariamente suspenso.</strong>
              <p className="mb-0 mt-1">
                O registro público de novas contas está desativado no momento.
                Novas contas são cadastradas pela administração e ativadas por
                meio de confirmação enviada por e-mail.
              </p>
            </div>
          </div>

          <div className="d-grid gap-2">
            <Link
              href="/accounts/login"
              className="btn btn-primary py-2 fw-bold"
            >
              <i className="bi bi-box-arrow-in-right me-2" />
              Ir para o Login
            </Link>
            <Link href="/" className="btn btn-light border py-2 small">
              <i className="bi bi-arrow-left me-1" />
              Voltar à Consulta Pública
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
