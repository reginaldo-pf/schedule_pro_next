"use client";

import React, { useState, useEffect } from "react";
import { useUI } from "../ui/UIProvider";

export interface AvailabilityCell {
  period_id: number;
  day_of_week: string;
  status: string; // AVAILABLE | UNDESIRED | UNAVAILABLE
}

export interface AvailabilityPeriodRow {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  shift: string;
}

const SHIFT_LABELS: Record<string, string> = {
  MORNING: "Manhã",
  MANHÃ: "Manhã",
  AFTERNOON: "Tarde",
  TARDE: "Tarde",
  EVENING: "Noite",
  NOITE: "Noite",
  EVENING_EXTRA: "Noite Extra",
  FULLDAY: "Integral",
};

const SHIFT_CSS: Record<string, string> = {
  MORNING: "shift-morning",
  MANHÃ: "shift-morning",
  AFTERNOON: "shift-afternoon",
  TARDE: "shift-afternoon",
  EVENING: "shift-evening",
  NOITE: "shift-evening",
  EVENING_EXTRA: "shift-evening",
  FULLDAY: "shift-fullday",
};

export function AvailabilityMatrixModal({
  open,
  entityType,
  entityId,
  entityName,
  onClose,
  onSaved,
}: {
  open: boolean;
  entityType: "teacher" | "room" | "class";
  entityId: number | null;
  entityName: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { startLoading, stopLoading, showToast } = useUI();

  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);
  const [days, setDays] = useState<{ code: string; label: string }[]>([]);
  const [periods, setPeriods] = useState<AvailabilityPeriodRow[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");

  useEffect(() => {
    if (!open || !entityId) return;
    setLoadingData(true);
    fetch(`/api/availability?type=${entityType}&id=${entityId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setDays(data.days || []);
          setPeriods(data.periods || []);
          setStatusMap(data.statusMap || {});
          setValidFrom(data.validFrom || "");
          setValidUntil(data.validUntil || "");
        } else {
          showToast(data.message || "Erro ao carregar disponibilidade.", "danger");
        }
      })
      .catch(() => {
        showToast("Erro ao carregar disponibilidade.", "danger");
      })
      .finally(() => {
        setLoadingData(false);
      });
  }, [open, entityType, entityId, showToast]);

  if (!open || !entityId) return null;

  const getCellStatus = (periodId: number, dayCode: string): string => {
    return statusMap[`${periodId}_${dayCode}`] || "AVAILABLE";
  };

  const toggleCell = (periodId: number, dayCode: string) => {
    const key = `${periodId}_${dayCode}`;
    const current = statusMap[key] || "AVAILABLE";
    let next = "AVAILABLE";
    if (entityType === "teacher") {
      if (current === "AVAILABLE") next = "UNDESIRED";
      else if (current === "UNDESIRED") next = "UNAVAILABLE";
      else next = "AVAILABLE";
    } else {
      next = current === "AVAILABLE" ? "UNAVAILABLE" : "AVAILABLE";
    }
    setStatusMap((prev) => ({ ...prev, [key]: next }));
  };

  const toggleEntireDay = (dayCode: string) => {
    const allUnavailable = periods.every(
      (p) => (statusMap[`${p.id}_${dayCode}`] || "AVAILABLE") === "UNAVAILABLE"
    );
    const targetStatus = allUnavailable ? "AVAILABLE" : "UNAVAILABLE";
    setStatusMap((prev) => {
      const next = { ...prev };
      for (const p of periods) {
        next[`${p.id}_${dayCode}`] = targetStatus;
      }
      return next;
    });
  };

  const toggleEntireShift = (shift: string) => {
    const shiftPeriods = periods.filter((p) => p.shift === shift);
    const allUnavailable = shiftPeriods.every((p) =>
      days.every(
        (d) => (statusMap[`${p.id}_${d.code}`] || "AVAILABLE") === "UNAVAILABLE"
      )
    );
    const targetStatus = allUnavailable ? "AVAILABLE" : "UNAVAILABLE";
    setStatusMap((prev) => {
      const next = { ...prev };
      for (const p of shiftPeriods) {
        for (const d of days) {
          next[`${p.id}_${d.code}`] = targetStatus;
        }
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    startLoading();
    try {
      const res = await fetch("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: entityType,
          id: entityId,
          statusMap,
          validFrom: entityType === "teacher" ? validFrom || null : null,
          validUntil: entityType === "teacher" ? validUntil || null : null,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast("Disponibilidade salva com sucesso!", "success");
        onSaved?.();
        onClose();
      } else {
        showToast(data.message || "Erro ao salvar disponibilidade.", "danger");
      }
    } catch {
      showToast("Erro de conexão ao salvar disponibilidade.", "danger");
    } finally {
      setSaving(false);
      stopLoading();
    }
  };

  // Group periods by shift in order
  const shiftsOrder = Array.from(new Set(periods.map((p) => p.shift)));

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
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-xl">
          <div className="modal-content border-0 shadow-lg">
            <div className="modal-header bg-light border-bottom py-3 px-4">
              <div className="d-flex align-items-center gap-2">
                <div className="bg-primary-subtle text-primary rounded-2 p-1 px-2">
                  <i className="bi bi-calendar-check" />
                </div>
                <div>
                  <h5 className="modal-title fw-bold mb-0">
                    Grade de Disponibilidade: {entityName}
                  </h5>
                  <small className="text-muted">
                    Clique nos horários para alternar entre Disponível
                    {entityType === "teacher" ? ", Indesejado" : ""} e Indisponível
                  </small>
                </div>
              </div>
              <button
                type="button"
                className="btn-close"
                onClick={onClose}
                disabled={saving}
              />
            </div>

            <div className="modal-body p-4">
              {loadingData ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary mb-2" />
                  <p className="text-muted small mb-0">
                    Carregando matriz de disponibilidade...
                  </p>
                </div>
              ) : (
                <>
                  {entityType === "teacher" && (
                    <div className="row g-3 mb-3 align-items-end bg-light p-3 rounded-3 border">
                      <div className="col-md-4">
                        <label className="form-label small fw-bold mb-1">
                          Válido a partir de (Opcional)
                        </label>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={validFrom}
                          onChange={(e) => setValidFrom(e.target.value)}
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label small fw-bold mb-1">
                          Válido até (Opcional)
                        </label>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={validUntil}
                          onChange={(e) => setValidUntil(e.target.value)}
                        />
                      </div>
                      <div className="col-md-4 d-flex gap-2 justify-content-md-end">
                        <span className="badge bg-success-subtle text-success border border-success-subtle p-2">
                          Disponível
                        </span>
                        <span className="badge bg-warning text-dark p-2">
                          Indesejado
                        </span>
                        <span className="badge bg-danger text-white p-2">
                          Indisponível
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="table-responsive">
                    <table className="table table-bordered availability-table mb-0">
                      <thead className="table-light text-center">
                        <tr>
                          <th style={{ width: 170 }}>Período / Horário</th>
                          {days.map((d) => (
                            <th key={d.code}>
                              <div className="d-flex flex-column align-items-center gap-1 py-1">
                                <span>{d.label}</span>
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary btn-sm py-0 px-2"
                                  style={{ fontSize: "0.65rem" }}
                                  onClick={() => toggleEntireDay(d.code)}
                                >
                                  Alternar Dia
                                </button>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {shiftsOrder.map((shift) => {
                          const shiftPeriods = periods.filter(
                            (p) => p.shift === shift
                          );
                          return (
                            <React.Fragment key={shift}>
                              <tr
                                className={`shift-row ${
                                  SHIFT_CSS[shift] || "shift-morning"
                                }`}
                              >
                                <td colSpan={days.length + 1} className="px-3">
                                  <div className="d-flex justify-content-between align-items-center">
                                    <span>
                                      <i className="bi bi-clock-history me-2" />
                                      Turno: {SHIFT_LABELS[shift] || shift}
                                    </span>
                                    <button
                                      type="button"
                                      className="btn btn-outline-dark btn-sm py-0 px-2"
                                      style={{ fontSize: "0.7rem" }}
                                      onClick={() => toggleEntireShift(shift)}
                                    >
                                      Alternar Turno
                                    </button>
                                  </div>
                                </td>
                              </tr>
                              {shiftPeriods.map((period) => (
                                <tr key={period.id}>
                                  <td className="bg-light px-2">
                                    <span className="fw-semibold d-block">
                                      {period.name}
                                    </span>
                                    <small className="text-muted">
                                      {period.start_time} - {period.end_time}
                                    </small>
                                  </td>
                                  {days.map((d) => {
                                    const st = getCellStatus(period.id, d.code);
                                    const cls =
                                      st === "UNAVAILABLE"
                                        ? "unavailable"
                                        : st === "UNDESIRED"
                                        ? "undesired"
                                        : "available";
                                    const label =
                                      st === "UNAVAILABLE"
                                        ? "Indisponível"
                                        : st === "UNDESIRED"
                                        ? "Indesejado"
                                        : "Disponível";
                                    return (
                                      <td key={d.code}>
                                        <div
                                          className={`availability-chip ${cls}`}
                                          onClick={() =>
                                            toggleCell(period.id, d.code)
                                          }
                                        >
                                          <span>{label}</span>
                                        </div>
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer bg-light border-top py-3 px-4">
              <button
                type="button"
                className="btn btn-light btn-sm px-4 py-2"
                onClick={onClose}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm px-4 py-2 fw-bold d-flex align-items-center gap-2 shadow-sm"
                onClick={handleSave}
                disabled={saving || loadingData}
              >
                {saving ? (
                  <span className="spinner-border spinner-border-sm" />
                ) : (
                  <i className="bi bi-check2-circle" />
                )}
                <span>Salvar Disponibilidade</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
