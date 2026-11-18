"use client";

import React, { useState } from "react";

export type SaveActionType = "save" | "save_and_continue" | "save_and_add_another";

export function CrudModal({
  open,
  title,
  icon = "bi-pencil-square",
  size = "lg",
  isEditing = false,
  hasPrev = false,
  hasNext = false,
  onPrev,
  onNext,
  onClose,
  onSubmit,
  onDelete,
  children,
}: {
  open: boolean;
  title: string;
  icon?: string;
  size?: "md" | "lg" | "xl";
  isEditing?: boolean;
  hasPrev?: boolean;
  hasNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
  onSubmit: (action: SaveActionType) => Promise<void>;
  onDelete?: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [submittingAction, setSubmittingAction] = useState<SaveActionType | "delete" | null>(null);

  if (!open) return null;

  const handleAction = async (action: SaveActionType) => {
    setSubmittingAction(action);
    try {
      await onSubmit(action);
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setSubmittingAction("delete");
    try {
      await onDelete();
    } finally {
      setSubmittingAction(null);
    }
  };

  return (
    <>
      <div
        className="modal-backdrop fade show"
        style={{ zIndex: 1055 }}
        onClick={onClose}
      />
      <div
        className="modal fade show d-block"
        tabIndex={-1}
        style={{ zIndex: 1060 }}
      >
        <div
          className={`modal-dialog modal-dialog-centered modal-dialog-scrollable modal-${size}`}
        >
          <div className="modal-content border-0 shadow-lg">
            {/* Header with Prev/Next navigation */}
            <div className="modal-header bg-light border-bottom py-3 px-4">
              <div className="d-flex align-items-center gap-2">
                <div className="bg-primary-subtle text-primary rounded-2 p-1 px-2">
                  <i className={`bi ${icon}`} />
                </div>
                <h5 className="modal-title fw-bold mb-0">{title}</h5>
              </div>

              <div className="d-flex align-items-center gap-2 ms-auto">
                {isEditing && (onPrev || onNext) && (
                  <div className="btn-group btn-group-sm me-2">
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      disabled={!hasPrev || submittingAction !== null}
                      onClick={onPrev}
                      title="Registro Anterior"
                    >
                      <i className="bi bi-chevron-left me-1" />
                      Anterior
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      disabled={!hasNext || submittingAction !== null}
                      onClick={onNext}
                      title="Próximo Registro"
                    >
                      Próximo
                      <i className="bi bi-chevron-right ms-1" />
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  className="btn-close"
                  onClick={onClose}
                  disabled={submittingAction !== null}
                />
              </div>
            </div>

            {/* Body */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAction("save");
              }}
            >
              <div className="modal-body p-4">{children}</div>

              {/* Standardized Multi-Action Footer */}
              <div className="modal-footer bg-light border-top py-3 px-4 d-flex justify-content-between flex-wrap gap-2">
                <div>
                  {isEditing && onDelete && (
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm px-3 py-2 d-flex align-items-center gap-2"
                      disabled={submittingAction !== null}
                      onClick={handleDelete}
                    >
                      {submittingAction === "delete" ? (
                        <span className="spinner-border spinner-border-sm" />
                      ) : (
                        <i className="bi bi-trash" />
                      )}
                      <span>Excluir</span>
                    </button>
                  )}
                </div>

                <div className="d-flex flex-wrap align-items-center gap-2 ms-auto">
                  <button
                    type="button"
                    className="btn btn-light btn-sm px-3 py-2"
                    disabled={submittingAction !== null}
                    onClick={onClose}
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm px-3 py-2 d-flex align-items-center gap-1"
                    disabled={submittingAction !== null}
                    onClick={() => handleAction("save_and_add_another")}
                  >
                    {submittingAction === "save_and_add_another" && (
                      <span className="spinner-border spinner-border-sm me-1" />
                    )}
                    <i className="bi bi-plus-circle" />
                    <span>Salvar e Adicionar Outro</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm px-3 py-2 d-flex align-items-center gap-1"
                    disabled={submittingAction !== null}
                    onClick={() => handleAction("save_and_continue")}
                  >
                    {submittingAction === "save_and_continue" && (
                      <span className="spinner-border spinner-border-sm me-1" />
                    )}
                    <i className="bi bi-arrow-repeat" />
                    <span>Salvar e Continuar</span>
                  </button>

                  <button
                    type="submit"
                    className="btn btn-primary btn-sm px-4 py-2 fw-bold d-flex align-items-center gap-1 shadow-sm"
                    disabled={submittingAction !== null}
                  >
                    {submittingAction === "save" ? (
                      <span className="spinner-border spinner-border-sm me-1" />
                    ) : (
                      <i className="bi bi-check2-circle" />
                    )}
                    <span>Salvar</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
