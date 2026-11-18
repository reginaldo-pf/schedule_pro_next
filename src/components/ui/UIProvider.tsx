"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

export type ToastLevel = "success" | "danger" | "warning" | "info";

interface ToastMessage {
  id: number;
  message: string;
  level: ToastLevel;
}

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  confirmVariant?: "danger" | "primary" | "warning";
}

interface UIContextType {
  isLoading: boolean;
  startLoading: () => void;
  stopLoading: () => void;
  showToast: (message: string, level?: ToastLevel) => void;
  confirmAction: (options: ConfirmOptions) => Promise<boolean>;
}

const UIContext = createContext<UIContextType | null>(null);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [loadingStatus, setLoadingStatus] = useState<"idle" | "loading" | "finished">("idle");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    options: ConfirmOptions;
    resolve: ((val: boolean) => void) | null;
  }>({
    open: false,
    options: { message: "" },
    resolve: null,
  });

  const startLoading = useCallback(() => {
    setLoadingStatus("loading");
  }, []);

  const stopLoading = useCallback(() => {
    setLoadingStatus("finished");
    setTimeout(() => {
      setLoadingStatus((prev) => (prev === "finished" ? "idle" : prev));
    }, 350);
  }, []);

  const showToast = useCallback((message: string, level: ToastLevel = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, level }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const confirmAction = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        open: true,
        options,
        resolve,
      });
    });
  }, []);

  const handleConfirmClose = (result: boolean) => {
    if (confirmState.resolve) {
      confirmState.resolve(result);
    }
    setConfirmState((prev) => ({ ...prev, open: false, resolve: null }));
  };

  return (
    <UIContext.Provider
      value={{
        isLoading: loadingStatus === "loading",
        startLoading,
        stopLoading,
        showToast,
        confirmAction,
      }}
    >
      <div
        id="global-progress-bar"
        className={`global-progress-bar ${
          loadingStatus === "loading"
            ? "loading"
            : loadingStatus === "finished"
            ? "finished"
            : ""
        }`}
      />

      {children}

      {/* Toast Container */}
      <div
        className="toast-container position-fixed top-0 end-0 p-3"
        style={{ zIndex: 2100 }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast show align-items-center text-white bg-${toast.level} border-0 mb-2 shadow`}
            role="alert"
          >
            <div className="d-flex">
              <div className="toast-body fw-medium">{toast.message}</div>
              <button
                type="button"
                className="btn-close btn-close-white me-2 m-auto"
                onClick={() =>
                  setToasts((prev) => prev.filter((t) => t.id !== toast.id))
                }
              />
            </div>
          </div>
        ))}
      </div>

      {/* Global Confirmation Modal */}
      {confirmState.open && (
        <>
          <div
            className="modal-backdrop fade show"
            style={{ zIndex: 2050 }}
            onClick={() => handleConfirmClose(false)}
          />
          <div
            className="modal fade show d-block"
            tabIndex={-1}
            style={{ zIndex: 2060 }}
          >
            <div className="modal-dialog modal-dialog-centered modal-sm">
              <div className="modal-content shadow-lg border-0">
                <div className="modal-header border-0 pb-0">
                  <h5 className="modal-title fw-bold">
                    {confirmState.options.title || "Confirmar"}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => handleConfirmClose(false)}
                  />
                </div>
                <div className="modal-body text-center py-4">
                  <i
                    className={`bi bi-exclamation-triangle text-${
                      confirmState.options.confirmVariant || "danger"
                    } display-4 mb-3 d-block`}
                  />
                  <p className="mb-0 text-secondary">
                    {confirmState.options.message}
                  </p>
                </div>
                <div className="modal-footer border-0 pt-0 justify-content-center gap-2">
                  <button
                    type="button"
                    className="btn btn-light px-4"
                    onClick={() => handleConfirmClose(false)}
                  >
                    Não
                  </button>
                  <button
                    type="button"
                    className={`btn btn-${
                      confirmState.options.confirmVariant || "danger"
                    } px-4 fw-bold`}
                    onClick={() => handleConfirmClose(true)}
                  >
                    {confirmState.options.confirmText || "Sim, Confirmar"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </UIContext.Provider>
  );
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) {
    throw new Error("useUI must be used within a UIProvider");
  }
  return ctx;
}
