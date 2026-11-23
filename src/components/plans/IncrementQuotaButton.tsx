"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useUI } from "@/components/ui/UIProvider";

export function IncrementQuotaButton({
  label = "+1 Cota (R$ 20)",
  className = "btn btn-sm btn-outline-primary",
}: {
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const { startLoading, stopLoading, showToast, confirmAction } = useUI();

  const handleIncrement = async () => {
    const confirmed = await confirmAction({
      title: "Adicionar Cota ao Plano Direção",
      message:
        "Deseja incrementar +1 cota de curso/coordenador (+R$ 20,00/mês) à sua assinatura do plano Direção agora?",
      confirmText: "Sim, Adicionar +1 Cota",
      confirmVariant: "primary",
    });
    if (!confirmed) return;

    startLoading();
    try {
      const res = await fetch("/api/plans/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ increment_by: 1 }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message, "success");
        router.refresh();
      } else {
        showToast(data.message || "Erro ao adicionar cota.", "danger");
      }
    } finally {
      stopLoading();
    }
  };

  return (
    <button type="button" className={className} onClick={handleIncrement}>
      <i className="bi bi-plus-circle me-1" />
      {label}
    </button>
  );
}
