"use client";

import React, { useState } from "react";
import { useUI } from "@/components/ui/UIProvider";

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

export function TeacherPortalClient({
  token,
  teacher,
  project,
  days,
  periods,
  initialStatusMap,
  initialValidFrom,
  initialValidUntil,
}: {
  token: string;
  teacher: {
    id: number;
    name: string;
    short_name: string;
    email: string;
    color: string;
  };
  project: {
    name: string;
    institution_name: string;
    academic_period: string;
  };
  days: { code: string; label: string }[];
  periods: {
    id: number;
    name: string;
    start_time: string;
    end_time: string;
    shift: string;
  }[];
  initialStatusMap: Record<string, string>;
  initialValidFrom: string;
  initialValidUntil: string;
}) {
  const { startLoading, stopLoading, showToast } = useUI();

  const [name, setName] = useState(teacher.name);
  const [shortName, setShortName] = useState(teacher.short_name);
  const [email, setEmail] = useState(teacher.email);
  const [color, setColor] = useState(teacher.color);

  const [statusMap, setStatusMap] =
    useState<Record<string, string>>(initialStatusMap);
  const [validFrom, setValidFrom] = useState(initialValidFrom);
  const [validUntil, setValidUntil] = useState(initialValidUntil);
  const [saving, setSaving] = useState(false);

  const toggleCell = (periodId: number, dayCode: string) => {
    const key = `${periodId}_${dayCode}`;
    const current = statusMap[key] || "AVAILABLE";
    const next =
      current === "AVAILABLE"
        ? "UNDESIRED"
        : current === "UNDESIRED"
        ? "UNAVAILABLE"
        : "AVAILABLE";
    setStatusMap((prev) => ({ ...prev, [key]: next }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    startLoading();
    try {
      const res = await fetch(`/api/portal/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          short_name: shortName,
          email,
          color,
          statusMap,
          validFrom: validFrom || null,
          validUntil: validUntil || null,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message, "success");
      } else {
        showToast(data.message || "Erro ao salvar preferências.", "danger");
      }
    } finally {
      setSaving(false);
      stopLoading();
    }
  };

  const shiftsOrder = Array.from(new Set(periods.map((p) => p.shift)));

  return (
    <div className="min-vh-100 bg-body-tertiary py-4">
      <div className="container">
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body p-4 d-flex justify-content-between align-items-center flex-wrap gap-3">
            <div>
              <span className="badge bg-primary-subtle text-primary mb-1">
                Portal Exclusivo do Docente • {project.institution_name}
              </span>
              <h4 className="fw-bold mb-0">
                Preferências de Horário — {project.name} ({project.academic_period})
              </h4>
            </div>
            <div className="d-flex gap-2">
              <span className="badge bg-success-subtle text-success border border-success-subtle p-2">
                Disponível
              </span>
              <span className="badge bg-warning text-dark p-2">Indesejado</span>
              <span className="badge bg-danger text-white p-2">
                Indisponível
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave}>
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-header bg-white border-bottom py-3">
              <h6 className="fw-bold mb-0">1. Confirme seus Dados Docentes</h6>
            </div>
            <div className="card-body p-4">
              <div className="row g-3">
                <div className="col-md-5">
                  <label className="form-label small fw-semibold">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label small fw-semibold">
                    Nome Abreviado / Sigla
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    value={shortName}
                    onChange={(e) => setShortName(e.target.value)}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label small fw-semibold">E-mail</label>
                  <input
                    type="email"
                    className="form-control"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="col-md-1">
                  <label className="form-label small fw-semibold">Cor</label>
                  <input
                    type="color"
                    className="form-control form-control-color w-100"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-sm mb-4">
            <div className="card-header bg-white border-bottom py-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
              <h6 className="fw-bold mb-0">
                2. Clique nos horários abaixo para informar sua disponibilidade
              </h6>
              <div className="d-flex gap-2 align-items-center">
                <small className="text-muted">Vigência (opcional):</small>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  style={{ width: 145 }}
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                />
                <span>até</span>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  style={{ width: 145 }}
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>
            </div>
            <div className="card-body p-4">
              <div className="table-responsive">
                <table className="table table-bordered availability-table mb-0">
                  <thead className="table-light text-center">
                    <tr>
                      <th style={{ width: 170 }}>Horário</th>
                      {days.map((d) => (
                        <th key={d.code}>{d.label}</th>
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
                          <tr className="shift-row shift-morning">
                            <td colSpan={days.length + 1} className="px-3">
                              Turno: {SHIFT_LABELS[shift] || shift}
                            </td>
                          </tr>
                          {shiftPeriods.map((p) => (
                            <tr key={p.id}>
                              <td className="bg-light px-2">
                                <span className="fw-semibold d-block">
                                  {p.name}
                                </span>
                                <small className="text-muted">
                                  {p.start_time} - {p.end_time}
                                </small>
                              </td>
                              {days.map((d) => {
                                const st =
                                  statusMap[`${p.id}_${d.code}`] || "AVAILABLE";
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
                                      onClick={() => toggleCell(p.id, d.code)}
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
            </div>
            <div className="card-footer bg-white border-top py-3 px-4 text-end">
              <button
                type="submit"
                className="btn btn-primary px-5 py-2 fw-bold shadow-sm"
                disabled={saving}
              >
                {saving ? (
                  <span className="spinner-border spinner-border-sm me-2" />
                ) : (
                  <i className="bi bi-check2-circle me-2" />
                )}
                Salvar Minhas Disponibilidades
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
