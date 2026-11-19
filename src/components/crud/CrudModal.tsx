"use client";

import React, { useState } from "react";

export type SaveActionType =
  | "save"
  | "save_and_continue"
  | "save_and_add_another";

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
  const [submittingAction, setSubmittingAction] = useState<
    SaveActionType | "delete" | null
  >(null);

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
            {/* Fixed-height Header with Truncated Title & Non-deforming Prev/Next navigation */}
            <div className="modal-header bg-light border-bottom py-3 px-4 d-flex align-items-center justify-content-between flex-nowrap">
              <div
                className="d-flex align-items-center gap-2 flex-grow-1 me-3"
                style={{ minWidth: 0 }}
              >
                <div className="bg-primary-subtle text-primary rounded-2 p-1 px-2 flex-shrink-0">
                  <i className={`bi ${icon}`} />
                </div>
                <h5
                  className="modal-title fw-bold mb-0 text-truncate"
                  title={title}
                >
                  {title}
                </h5>
              </div>

              <div className="d-flex align-items-center gap-2 ms-auto flex-shrink-0">
                {isEditing && (onPrev || onNext) && (
                  <div className="btn-group btn-group-sm me-1 flex-shrink-0">
                    <button
                      type="button"
                      className="btn btn-outline-secondary text-nowrap d-inline-flex align-items-center gap-1 px-2"
                      disabled={!hasPrev || submittingAction !== null}
                      onClick={onPrev}
                      title="Registro Anterior"
                    >
                      <i className="bi bi-chevron-left" />
                      <span>Anterior</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary text-nowrap d-inline-flex align-items-center gap-1 px-2"
                      disabled={!hasNext || submittingAction !== null}
                      onClick={onNext}
                      title="Próximo Registro"
                    >
                      <span>Próximo</span>
                      <i className="bi bi-chevron-right" />
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  className="btn-close flex-shrink-0"
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
              <div className="modal-footer bg-light border-top py-2 px-4 d-flex justify-content-between align-items-center flex-nowrap gap-2 overflow-x-auto">
                <div className="flex-shrink-0">
                  {isEditing && onDelete && (
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm px-2 py-1 d-inline-flex align-items-center gap-1 text-nowrap"
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

                <div className="d-flex align-items-center gap-2 ms-auto flex-shrink-0">
                  <button
                    type="button"
                    className="btn btn-light border btn-sm px-3 py-1 text-nowrap"
                    disabled={submittingAction !== null}
                    onClick={onClose}
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm px-2 py-1 d-inline-flex align-items-center gap-1 text-nowrap"
                    disabled={submittingAction !== null}
                    onClick={() => handleAction("save_and_add_another")}
                  >
                    {submittingAction === "save_and_add_another" ? (
                      <span className="spinner-border spinner-border-sm me-1" />
                    ) : (
                      <i className="bi bi-plus-circle" />
                    )}
                    <span>Salvar e Adicionar Outro</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm px-2 py-1 d-inline-flex align-items-center gap-1 text-nowrap"
                    disabled={submittingAction !== null}
                    onClick={() => handleAction("save_and_continue")}
                  >
                    {submittingAction === "save_and_continue" ? (
                      <span className="spinner-border spinner-border-sm me-1" />
                    ) : (
                      <i className="bi bi-arrow-repeat" />
                    )}
                    <span>Salvar e Continuar</span>
                  </button>

                  <button
                    type="submit"
                    className="btn btn-primary btn-sm px-3 py-1 fw-semibold d-inline-flex align-items-center gap-1 shadow-sm text-nowrap"
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
