"use client";

import React from "react";

export function PrintTriggerButton() {
  return (
    <button
      type="button"
      className="btn btn-dark btn-sm d-flex align-items-center gap-2 px-3 py-2 fw-bold shadow-sm"
      onClick={() => window.print()}
    >
      <i className="bi bi-printer" />
      <span>Imprimir Relatório</span>
    </button>
  );
}
