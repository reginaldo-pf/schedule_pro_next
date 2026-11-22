"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUI } from "../ui/UIProvider";
import { AltchaWidget } from "../ui/AltchaWidget";

interface PublicProject {
  id: number;
  name: string;
  institution_name: string;
  academic_period: string;
}

export function PublicHomeClient({
  projects,
}: {
  projects: PublicProject[];
}) {
  const router = useRouter();
  const { startLoading, stopLoading, showToast } = useUI();

  const [selectedProject, setSelectedProject] = useState("");
  const [groups, setGroups] = useState<{ id: number; name: string }[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [classes, setClasses] = useState<{ id: number; name: string }[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [studentAltchaPayload, setStudentAltchaPayload] = useState("");
  const [studentAltchaResetKey, setStudentAltchaResetKey] = useState(0);

  const [teacherEmail, setTeacherEmail] = useState("");
  const [teacherAltchaPayload, setTeacherAltchaPayload] = useState("");
  const [teacherAltchaResetKey, setTeacherAltchaResetKey] = useState(0);
  const [searchedTeacher, setSearchedTeacher] = useState(false);
  const [teacherResults, setTeacherResults] = useState<
    {
      teacher: { id: number; name: string; email: string };
      project: PublicProject;
      hasSchedule: boolean;
      availabilityRequestToken?: string;
    }[]
  >([]);

  const handleProjectChange = async (projectId: string) => {
    setSelectedProject(projectId);
    setSelectedGroup("");
    setSelectedClass("");
    setGroups([]);
    setClasses([]);
    if (!projectId) return;

    startLoading();
    try {
      const res = await fetch(`/api/public/lookup?project=${projectId}`);
      const data = await res.json();
      if (data.ok) {
        setGroups(data.groups || []);
      }
    } finally {
      stopLoading();
    }
  };

  const handleGroupChange = async (groupId: string) => {
    setSelectedGroup(groupId);
    setSelectedClass("");
    setClasses([]);
    if (!groupId) return;

    startLoading();
    try {
      const res = await fetch(`/api/public/lookup?group=${groupId}`);
      const data = await res.json();
      if (data.ok) {
        setClasses(data.classes || []);
      }
    } finally {
      stopLoading();
    }
  };

  const handleViewClassSchedule = async () => {
    if (!selectedClass) return;
    if (!studentAltchaPayload) {
      showToast("Complete a verificação de segurança (Não sou um robô).", "warning");
      return;
    }

    startLoading();
    try {
      const res = await fetch("/api/public/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ altcha: studentAltchaPayload }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        router.push(`/schedule/class/${selectedClass}`);
      } else {
        showToast(
          data.message || "Falha na verificação de segurança. Tente novamente.",
          "danger"
        );
        setStudentAltchaResetKey((k) => k + 1);
      }
    } finally {
      stopLoading();
    }
  };

  const handleSendAvailabilityEmail = async (requestToken: string) => {
    startLoading();
    try {
      const res = await fetch("/api/public/send-availability-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestToken }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message, "success");
      } else {
        showToast(
          data.message || "Não foi possível enviar o link por e-mail.",
          "danger"
        );
      }
    } finally {
      stopLoading();
    }
  };

  const handleSearchTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherEmail.trim()) {
      showToast("Informe o seu e-mail institucional.", "warning");
      return;
    }
    if (!teacherAltchaPayload) {
      showToast("Complete a verificação de segurança (Não sou um robô).", "warning");
      return;
    }

    startLoading();
    try {
      const res = await fetch("/api/public/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: teacherEmail,
          altcha: teacherAltchaPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        showToast(
          data.message || "Falha na verificação de segurança. Tente novamente.",
          "danger"
        );
        return;
      }
      setSearchedTeacher(true);
      setTeacherResults(data.results || []);
    } finally {
      setTeacherAltchaResetKey((k) => k + 1);
      stopLoading();
    }
  };

  return (
    <div className="min-vh-100 d-flex flex-column bg-body-tertiary">
      {/* Top Navbar */}
      <header className="bg-white border-bottom py-3 shadow-sm">
        <div className="container d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2">
            <div className="bg-primary text-white rounded-3 px-2 py-1 fw-bold">
              SP
            </div>
            <span className="fw-bold fs-5 text-dark">Schedule Pro</span>
          </div>
          <div className="d-flex gap-2">
            <Link
              href="/accounts/login"
              className="btn btn-primary btn-sm px-3 fw-semibold"
            >
              <i className="bi bi-box-arrow-in-right me-1" />
              Entrar
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section
        className="py-5 text-white"
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
        }}
      >
        <div className="container py-3 text-center">
          <span className="badge bg-primary bg-opacity-25 text-info border border-info-subtle px-3 py-2 mb-3">
            Consulta Pública de Horários Acadêmicos
          </span>
          <h1 className="display-6 fw-bold mb-2">
            Consulte sua Grade Horária Escolar
          </h1>
          <p className="text-white-50 mx-auto mb-0" style={{ maxWidth: 640 }}>
            Estudantes e professores podem visualizar e imprimir seus horários de
            aula atualizados selecionando sua instituição/turma ou buscando pelo
            e-mail docente.
          </p>
        </div>
      </section>

      {/* Lookup Cards */}
      <div className="container my-5 flex-grow-1">
        <div className="row g-4">
          {/* Student / Class Lookup */}
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body p-4">
                <div className="d-flex align-items-center gap-3 mb-4">
                  <div className="bg-primary-subtle text-primary p-3 rounded-3">
                    <i className="bi bi-mortarboard fs-3" />
                  </div>
                  <div>
                    <h5 className="fw-bold mb-1">Horário por Turma (Alunos)</h5>
                    <p className="text-muted small mb-0">
                      Selecione a instituição, o curso e a sua turma
                    </p>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold small">
                    1. Instituição / Calendário
                  </label>
                  <select
                    className="form-select"
                    value={selectedProject}
                    onChange={(e) => handleProjectChange(e.target.value)}
                  >
                    <option value="">Selecione a Instituição...</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.institution_name} - {p.name} ({p.academic_period})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold small">
                    2. Curso / Grupo
                  </label>
                  <select
                    className="form-select"
                    value={selectedGroup}
                    disabled={!selectedProject}
                    onChange={(e) => handleGroupChange(e.target.value)}
                  >
                    <option value="">Selecione o Curso...</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="form-label fw-semibold small">
                    3. Turma
                  </label>
                  <select
                    className="form-select"
                    value={selectedClass}
                    disabled={!selectedGroup}
                    onChange={(e) => setSelectedClass(e.target.value)}
                  >
                    <option value="">Selecione a Turma...</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-3">
                  <AltchaWidget
                    onVerify={setStudentAltchaPayload}
                    resetKey={studentAltchaResetKey}
                  />
                </div>

                <button
                  type="button"
                  className="btn btn-primary w-100 py-2 fw-bold"
                  disabled={!selectedClass || !studentAltchaPayload}
                  onClick={handleViewClassSchedule}
                >
                  <i className="bi bi-calendar-week me-2" />
                  Visualizar Horário da Turma
                </button>
              </div>
            </div>
          </div>

          {/* Teacher Email Lookup */}
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body p-4">
                <div className="d-flex align-items-center gap-3 mb-4">
                  <div className="bg-success-subtle text-success p-3 rounded-3">
                    <i className="bi bi-person-badge fs-3" />
                  </div>
                  <div>
                    <h5 className="fw-bold mb-1">Horário do Professor</h5>
                    <p className="text-muted small mb-0">
                      Consulte sua grade ou altere sua disponibilidade informando seu e-mail cadastrado
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSearchTeacher} className="mb-4">
                  <label className="form-label fw-semibold small">
                    E-mail do Professor
                  </label>
                  <div className="input-group mb-2">
                    <span className="input-group-text bg-light">
                      <i className="bi bi-envelope" />
                    </span>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="professor@instituicao.edu.br"
                      value={teacherEmail}
                      onChange={(e) => setTeacherEmail(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="btn btn-success px-4 fw-bold"
                      disabled={!teacherAltchaPayload}
                    >
                      Buscar
                    </button>
                  </div>
                  <AltchaWidget
                    onVerify={setTeacherAltchaPayload}
                    resetKey={teacherAltchaResetKey}
                  />
                </form>

                {searchedTeacher && (
                  <div className="border-top pt-3">
                    {teacherResults.length === 0 ? (
                      <div className="alert alert-warning mb-0 small">
                        <i className="bi bi-info-circle me-2" />
                        Nenhum professor ativo encontrado com o e-mail{" "}
                        <strong>{teacherEmail}</strong>.
                      </div>
                    ) : (
                      <div className="d-flex flex-column gap-2">
                        {teacherResults.map((item) => (
                          <div
                            key={`${item.project.id}_${item.teacher.id}`}
                            className="p-3 rounded-3 border bg-light d-flex flex-wrap justify-content-between align-items-center gap-2"
                          >
                            <div>
                              <div className="fw-bold text-dark">
                                {item.teacher.name}
                              </div>
                              <div className="small text-muted">
                                {item.project.institution_name} •{" "}
                                {item.project.name} (
                                {item.project.academic_period})
                              </div>
                            </div>
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                              {item.hasSchedule ? (
                                <Link
                                  href={`/schedule/teacher/${item.teacher.id}`}
                                  className="btn btn-sm btn-success fw-bold px-3"
                                >
                                  <i className="bi bi-eye me-1" />
                                  Ver Horário
                                </Link>
                              ) : (
                                <span className="badge bg-secondary-subtle text-secondary">
                                  Sem horário publicado
                                </span>
                              )}
                              {item.availabilityRequestToken && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary fw-semibold px-3"
                                  title="Enviar link de alteração de disponibilidade para o seu e-mail (válido por 10 minutos)"
                                  onClick={() =>
                                    handleSendAvailabilityEmail(
                                      item.availabilityRequestToken!
                                    )
                                  }
                                >
                                  <i className="bi bi-envelope-arrow-up me-1" />
                                  Alterar Disponibilidade
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="bg-white border-top py-3 text-center text-muted small">
        Schedule Pro • Gestão e Otimização de Horários Escolares
      </footer>
    </div>
  );
}
