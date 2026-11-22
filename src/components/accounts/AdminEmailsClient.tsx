"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useUI } from "@/components/ui/UIProvider";
import { ModuleHeader } from "@/components/crud/ModuleHeader";
import type { EmailLogItem, EmailProviderMode } from "@/lib/email-settings";

interface EmailSettingsForm {
  from_email: string;
  from_name: string;
  reply_to: string;
  provider_mode: EmailProviderMode;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
  postmark_token: string;
  resend_api_key: string;
  has_smtp_pass: boolean;
  has_postmark_token: boolean;
  has_resend_api_key: boolean;
  updated_at?: string | null;
}

export function AdminEmailsClient({
  initialSettings,
  envStatus,
  initialLogs,
}: {
  initialSettings: EmailSettingsForm;
  envStatus: { smtp: boolean; postmark: boolean; resend: boolean };
  initialLogs: EmailLogItem[];
}) {
  const router = useRouter();
  const { startLoading, stopLoading, showToast } = useUI();

  const [form, setForm] = useState<EmailSettingsForm>(initialSettings);
  const [logs, setLogs] = useState<EmailLogItem[]>(initialLogs);
  const [testEmail, setTestEmail] = useState(initialSettings.from_email);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    startLoading();
    try {
      const res = await fetch("/api/accounts/manage/emails", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setForm(data.settings);
        showToast(data.message, "success");
        router.refresh();
      } else {
        showToast(data.message || "Erro ao salvar configurações.", "danger");
      }
    } finally {
      stopLoading();
    }
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail.trim()) {
      showToast("Informe o e-mail de destino para o teste.", "warning");
      return;
    }

    startLoading();
    try {
      const res = await fetch("/api/accounts/manage/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test_email: testEmail }),
      });
      const data = await res.json();
      if (data.logs) {
        setLogs(data.logs);
      }
      showToast(data.message, data.ok ? "success" : "danger");
    } finally {
      stopLoading();
    }
  };

  return (
    <div>
      <ModuleHeader
        icon="bi-envelope-gear"
        title="Gestão de Envio de E-mails"
        description="Configure o remetente oficial, provedor de disparo, realize testes e acompanhe o histórico"
        projectName="Administração Global"
        statLabel="Registros Recentes"
        statValue={logs.length}
      />

      {/* Provider Status Strip */}
      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body d-flex align-items-center justify-content-between">
              <div>
                <div className="small text-muted fw-semibold">SMTP (Nodemailer)</div>
                <div className="fw-bold">
                  {envStatus.smtp || (form.smtp_host && form.smtp_user && form.has_smtp_pass)
                    ? "Configurado"
                    : "Não configurado"}
                </div>
              </div>
              <span
                className={`badge ${
                  envStatus.smtp || (form.smtp_host && form.smtp_user && form.has_smtp_pass)
                    ? "bg-success-subtle text-success"
                    : "bg-secondary-subtle text-secondary"
                }`}
              >
                {envStatus.smtp ? "Via .env" : form.has_smtp_pass ? "Via Painel" : "Inativo"}
              </span>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body d-flex align-items-center justify-content-between">
              <div>
                <div className="small text-muted fw-semibold">Postmark API</div>
                <div className="fw-bold">
                  {envStatus.postmark || form.has_postmark_token
                    ? "Configurado"
                    : "Não configurado"}
                </div>
              </div>
              <span
                className={`badge ${
                  envStatus.postmark || form.has_postmark_token
                    ? "bg-success-subtle text-success"
                    : "bg-secondary-subtle text-secondary"
                }`}
              >
                {envStatus.postmark ? "Via .env" : form.has_postmark_token ? "Via Painel" : "Inativo"}
              </span>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body d-flex align-items-center justify-content-between">
              <div>
                <div className="small text-muted fw-semibold">Resend API</div>
                <div className="fw-bold">
                  {envStatus.resend || form.has_resend_api_key
                    ? "Configurado"
                    : "Não configurado"}
                </div>
              </div>
              <span
                className={`badge ${
                  envStatus.resend || form.has_resend_api_key
                    ? "bg-success-subtle text-success"
                    : "bg-secondary-subtle text-secondary"
                }`}
              >
                {envStatus.resend ? "Via .env" : form.has_resend_api_key ? "Via Painel" : "Inativo"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4 mb-4">
        {/* Configuration Form */}
        <div className="col-lg-8">
          <form onSubmit={handleSave} className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-bottom py-3 d-flex justify-content-between align-items-center">
              <h6 className="fw-bold mb-0">
                <i className="bi bi-sliders me-2 text-primary" />
                Configurações do Remetente e Provedor
              </h6>
              {form.updated_at && (
                <small className="text-muted">
                  Atualizado em {form.updated_at}
                </small>
              )}
            </div>
            <div className="card-body p-4">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">
                    E-mail Remetente Oficial (Sender) *
                  </label>
                  <input
                    type="email"
                    className="form-control"
                    required
                    value={form.from_email}
                    onChange={(e) =>
                      setForm({ ...form, from_email: e.target.value })
                    }
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">
                    Nome de Exibição do Remetente
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.from_name}
                    onChange={(e) =>
                      setForm({ ...form, from_name: e.target.value })
                    }
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">
                    Reply-To Padrão (Opcional)
                  </label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="Deixe vazio para não definir"
                    value={form.reply_to}
                    onChange={(e) =>
                      setForm({ ...form, reply_to: e.target.value })
                    }
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">
                    Modo do Provedor
                  </label>
                  <select
                    className="form-select"
                    value={form.provider_mode}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        provider_mode: e.target.value as EmailProviderMode,
                      })
                    }
                  >
                    <option value="auto">Automático (SMTP → Postmark → Resend)</option>
                    <option value="smtp">Somente SMTP</option>
                    <option value="postmark">Somente Postmark</option>
                    <option value="resend">Somente Resend</option>
                  </select>
                </div>

                <div className="col-12 border-top pt-3 mt-3">
                  <div className="small fw-bold text-secondary mb-2">
                    Sobrescrita Opcional de Credenciais (deixe vazio para usar o .env)
                  </div>
                </div>

                <div className="col-md-5">
                  <label className="form-label small fw-semibold">SMTP Host</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="ex: smtp.gmail.com"
                    value={form.smtp_host}
                    onChange={(e) =>
                      setForm({ ...form, smtp_host: e.target.value })
                    }
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label small fw-semibold">Porta</label>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    value={form.smtp_port}
                    onChange={(e) =>
                      setForm({ ...form, smtp_port: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="col-md-5">
                  <label className="form-label small fw-semibold">SMTP Usuário</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={form.smtp_user}
                    onChange={(e) =>
                      setForm({ ...form, smtp_user: e.target.value })
                    }
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">SMTP Senha</label>
                  <input
                    type="password"
                    className="form-control form-control-sm"
                    placeholder={form.has_smtp_pass ? "Salva (mantenha ou altere)" : ""}
                    value={form.smtp_pass === "__KEEP__" ? "" : form.smtp_pass}
                    onChange={(e) =>
                      setForm({ ...form, smtp_pass: e.target.value })
                    }
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">Postmark Token</label>
                  <input
                    type="password"
                    className="form-control form-control-sm"
                    placeholder={form.has_postmark_token ? "Salvo (mantenha ou altere)" : ""}
                    value={form.postmark_token === "__KEEP__" ? "" : form.postmark_token}
                    onChange={(e) =>
                      setForm({ ...form, postmark_token: e.target.value })
                    }
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">Resend API Key</label>
                  <input
                    type="password"
                    className="form-control form-control-sm"
                    placeholder={form.has_resend_api_key ? "Salva (mantenha ou altere)" : ""}
                    value={form.resend_api_key === "__KEEP__" ? "" : form.resend_api_key}
                    onChange={(e) =>
                      setForm({ ...form, resend_api_key: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
            <div className="card-footer bg-light border-top py-3 text-end">
              <button type="submit" className="btn btn-primary fw-semibold px-4">
                <i className="bi bi-check2-circle me-1" />
                Salvar Configurações
              </button>
            </div>
          </form>
        </div>

        {/* Test Email Card */}
        <div className="col-lg-4">
          <form onSubmit={handleSendTest} className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-bottom py-3">
              <h6 className="fw-bold mb-0">
                <i className="bi bi-send-check me-2 text-success" />
                Testar Envio de E-mail
              </h6>
            </div>
            <div className="card-body p-4 d-flex flex-column justify-content-between">
              <div>
                <p className="text-muted small">
                  Dispare um e-mail de teste usando o remetente{" "}
                  <strong>{form.from_email}</strong> para validar o provedor ativo.
                </p>
                <div className="mb-3">
                  <label className="form-label small fw-semibold">
                    E-mail de Destino *
                  </label>
                  <input
                    type="email"
                    className="form-control"
                    required
                    placeholder="destino@exemplo.com"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                  />
                </div>
              </div>
              <button
                type="submit"
                className="btn btn-success w-100 fw-semibold"
              >
                <i className="bi bi-send me-1" />
                Enviar E-mail de Teste
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Email Logs Table */}
      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white border-bottom py-3">
          <h6 className="fw-bold mb-0">
            <i className="bi bi-clock-history me-2 text-secondary" />
            Histórico de Envios Recentes
          </h6>
        </div>
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th className="ps-4">Data / Hora</th>
                <th>Destinatário</th>
                <th>Remetente</th>
                <th>Assunto</th>
                <th className="text-center">Provedor</th>
                <th className="text-center pe-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-muted">
                    Nenhum envio registrado ainda.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td className="ps-4 small text-muted">{log.created_at}</td>
                    <td className="small fw-medium">{log.to_email}</td>
                    <td className="small text-muted">{log.from_email}</td>
                    <td className="small">{log.subject}</td>
                    <td className="text-center">
                      <span className="badge bg-light text-dark border text-uppercase">
                        {log.provider}
                      </span>
                    </td>
                    <td className="text-center pe-4">
                      {log.sent ? (
                        <span className="badge bg-success-subtle text-success">
                          Enviado
                        </span>
                      ) : (
                        <span
                          className="badge bg-danger-subtle text-danger"
                          title={log.error_message}
                        >
                          Falha
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
