"use client";

import React from "react";

export function ModuleHeader({
  icon,
  title,
  description,
  projectName,
  statLabel,
  statValue,
  actionLabel,
  onAction,
  extraActions,
}: {
  icon: string;
  title: string;
  description: string;
  projectName?: string;
  statLabel?: string;
  statValue?: string | number;
  actionLabel?: string;
  onAction?: () => void;
  extraActions?: React.ReactNode;
}) {
  return (
    <div className="card border-0 shadow-sm mb-4">
      <div className="card-body p-3">
        <div className="row align-items-center g-3">
          {/* Título e Ícone */}
          <div className="col-md-auto me-auto">
            <div className="d-flex align-items-center gap-3">
              <div className="bg-primary-subtle p-2 rounded-3 text-primary d-flex align-items-center justify-content-center">
                <i className={`bi ${icon} fs-4`} />
              </div>
              <div>
                <h4 className="mb-0 fw-bold">{title}</h4>
                <p className="text-muted small m-0 d-none d-md-block">
                  {description}
                </p>
              </div>
            </div>
          </div>

          {/* Estatísticas e Contexto */}
          {(projectName || statLabel) && (
            <div className="col-md-auto">
              <div className="d-flex gap-4 px-md-4 border-start border-end d-none d-lg-flex">
                {projectName && (
                  <div>
                    <small
                      className="text-muted d-block text-uppercase fw-bold"
                      style={{ fontSize: "0.65rem" }}
                    >
                      Projeto
                    </small>
                    <span className="fw-medium">{projectName}</span>
                  </div>
                )}
                {statLabel && (
                  <div>
                    <small
                      className="text-muted d-block text-uppercase fw-bold"
                      style={{ fontSize: "0.65rem" }}
                    >
                      {statLabel}
                    </small>
                    <span className="fw-medium text-primary">{statValue}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="col-md-auto d-flex align-items-center gap-2">
            {extraActions}
            {actionLabel && onAction && (
              <button
                type="button"
                onClick={onAction}
                className="btn btn-primary btn-sm d-flex align-items-center gap-2 px-3 py-2 shadow-sm"
              >
                <i className="bi bi-plus-lg" />
                <span className="fw-bold">{actionLabel}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
