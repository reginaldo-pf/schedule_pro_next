"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUI } from "../ui/UIProvider";

export interface BreadcrumbItem {
  label: string;
  url?: string;
}

export interface ShellUser {
  id: number;
  username: string;
  email: string;
  profile: string;
  is_superuser: boolean;
  is_staff: boolean;
}

export interface ShellProject {
  id: number;
  name: string;
  institution_name: string;
}

export interface ShellSubscription {
  active: boolean;
  isValid: boolean;
  plan: {
    name: string;
    maxClasses: number;
    isTrial: boolean;
  };
  activeClassesCount: number;
}

export function AppShell({
  user,
  activeProject,
  projects = [],
  subscription,
  breadcrumbs = [],
  children,
}: {
  user: ShellUser;
  activeProject: ShellProject | null;
  projects?: ShellProject[];
  subscription?: ShellSubscription | null;
  breadcrumbs?: BreadcrumbItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { startLoading, stopLoading, showToast } = useUI();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const isCadastrosActive =
    pathname.startsWith("/periods") ||
    pathname.startsWith("/groups") ||
    pathname.startsWith("/rooms") ||
    pathname.startsWith("/teachers") ||
    pathname.startsWith("/subjects") ||
    pathname.startsWith("/classes") ||
    pathname.startsWith("/lessons");

  const [cadastrosOpen, setCadastrosOpen] = useState(isCadastrosActive);

  useEffect(() => {
    if (isCadastrosActive) {
      setCadastrosOpen(true);
    }
  }, [isCadastrosActive]);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed") === "true";
    if (saved) setCollapsed(true);
  }, []);

  const toggleSidebar = () => {
    if (window.innerWidth < 992) {
      setMobileOpen((prev) => !prev);
    } else {
      const next = !collapsed;
      setCollapsed(next);
      localStorage.setItem("sidebar-collapsed", String(next));
    }
  };

  const handleSelectProject = async (projectId: number) => {
    startLoading();
    try {
      const res = await fetch("/api/projects/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(`Projeto ativo: ${data.projectName}`, "success");
        router.refresh();
      } else {
        showToast(data.message || "Erro ao selecionar projeto.", "danger");
      }
    } catch {
      showToast("Erro de conexão ao alterar projeto.", "danger");
    } finally {
      stopLoading();
    }
  };

  const handleLogout = async () => {
    startLoading();
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/accounts/login");
      router.refresh();
    } finally {
      stopLoading();
    }
  };

  const maxClasses =
    subscription && subscription.plan.maxClasses > 0
      ? subscription.plan.maxClasses
      : 1;
  const usagePercentage = subscription
    ? Math.min(100, Math.round((subscription.activeClassesCount / maxClasses) * 100))
    : 0;

  return (
    <div
      className={`app-wrapper ${collapsed ? "sidebar-collapsed" : ""} ${
        mobileOpen ? "sidebar-open" : ""
      }`}
    >
      {/* Top Navbar with Integrated Breadcrumbs */}
      <nav className="app-header navbar navbar-expand">
        <div className="container-fluid">
          <ul className="navbar-nav align-items-center">
            <li className="nav-item">
              <button
                type="button"
                className="sidebar-toggle-btn"
                onClick={toggleSidebar}
                title="Alternar menu lateral"
              >
                <i className="bi bi-list fs-5" />
              </button>
            </li>
            <li className="nav-item d-none d-md-flex align-items-center ms-2">
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item">
                  <Link href="/dashboard">Início</Link>
                </li>
                {breadcrumbs.map((bc, idx) => {
                  const isLast = idx === breadcrumbs.length - 1;
                  return (
                    <li
                      key={idx}
                      className={`breadcrumb-item ${isLast ? "active" : ""}`}
                    >
                      {!isLast && bc.url && bc.url !== "#" ? (
                        <Link href={bc.url}>{bc.label}</Link>
                      ) : (
                        <span>{bc.label}</span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </li>
          </ul>

          <ul className="navbar-nav ms-auto align-items-center gap-2">
            {/* Active Project Selector */}
            {projects.length > 0 && (
              <li className="nav-item d-none d-sm-flex align-items-center">
                <div className="input-group input-group-sm">
                  <span className="input-group-text bg-primary-subtle text-primary border-0 fw-semibold">
                    <i className="bi bi-folder2-open me-1" />
                    Projeto
                  </span>
                  <select
                    className="form-select form-select-sm border-light-subtle fw-medium"
                    style={{ maxWidth: 220 }}
                    value={activeProject?.id || ""}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val) handleSelectProject(val);
                    }}
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            )}

            {/* User Menu */}
            <li className="nav-item dropdown user-menu position-relative">
              <button
                type="button"
                className="nav-link border-0 bg-transparent d-flex align-items-center gap-2"
                onClick={() => setUserDropdownOpen((o) => !o)}
              >
                <i className="bi bi-person-circle fs-5 text-primary" />
                <span className="d-none d-md-inline fw-medium">
                  {user.username}
                </span>
                <i className="bi bi-chevron-down small text-muted" />
              </button>

              {userDropdownOpen && (
                <>
                  <div
                    className="position-fixed top-0 start-0 w-100 h-100"
                    style={{ zIndex: 1039 }}
                    onClick={() => setUserDropdownOpen(false)}
                  />
                  <ul
                    className="dropdown-menu dropdown-menu-end show shadow border-0 p-0 overflow-hidden"
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "110%",
                      minWidth: 240,
                      zIndex: 1040,
                    }}
                  >
                    <li className="bg-primary text-white p-3 text-center">
                      <i className="bi bi-person-circle fs-1 d-block mb-1" />
                      <div className="fw-bold">{user.username}</div>
                      <small className="opacity-75 d-block">{user.email}</small>
                      <span className="badge bg-white text-primary mt-1">
                        {user.is_superuser
                          ? "Administrador"
                          : user.profile === "teacher"
                          ? "Professor"
                          : "Coordenador"}
                      </span>
                    </li>
                    <li className="p-2 d-flex justify-content-between bg-light">
                      <Link
                        href="/accounts/profile"
                        className="btn btn-sm btn-outline-secondary px-3"
                        onClick={() => setUserDropdownOpen(false)}
                      >
                        <i className="bi bi-person me-1" />
                        Perfil
                      </Link>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger px-3"
                        onClick={handleLogout}
                      >
                        <i className="bi bi-box-arrow-right me-1" />
                        Sair
                      </button>
                    </li>
                  </ul>
                </>
              )}
            </li>
          </ul>
        </div>
      </nav>

      {/* Sidebar */}
      <aside className="app-sidebar shadow">
        <div className="sidebar-brand">
          <Link href="/dashboard" className="brand-link">
            <span className="brand-logo-mini fw-bold text-white d-none">
              SP
            </span>
            <span className="brand-text text-white">Schedule Pro</span>
          </Link>
        </div>

        <div className="sidebar-wrapper">
          <nav className="mt-2">
            <ul className="nav nav-pills nav-sidebar flex-column">
              <li className="nav-header">PRINCIPAL</li>
              <li className="nav-item">
                <Link
                  href="/dashboard"
                  className={`nav-link ${
                    pathname === "/dashboard" ? "active" : ""
                  }`}
                >
                  <i className="nav-icon bi bi-speedometer2" />
                  <p>Dashboard</p>
                </Link>
              </li>
              <li className="nav-item">
                <Link
                  href="/projects"
                  className={`nav-link ${
                    pathname.startsWith("/projects") ? "active" : ""
                  }`}
                >
                  <i className="nav-icon bi bi-folder" />
                  <p>Projetos</p>
                </Link>
              </li>

              {activeProject && (
                <>
                  <li className="nav-header">PLANEJAMENTO</li>
                  <li className="nav-item">
                    <Link
                      href="/builder"
                      className={`nav-link ${
                        pathname.startsWith("/builder") ? "active" : ""
                      }`}
                    >
                      <i className="nav-icon bi bi-calendar-event" />
                      <p>Grade Horária</p>
                    </Link>
                  </li>
                  <li className="nav-item">
                    <Link
                      href="/reports"
                      className={`nav-link ${
                        pathname.startsWith("/reports") ? "active" : ""
                      }`}
                    >
                      <i className="nav-icon bi bi-file-earmark-pdf" />
                      <p>Relatórios</p>
                    </Link>
                  </li>

                  <li
                    className={`nav-item ${cadastrosOpen ? "menu-open" : ""}`}
                  >
                    <a
                      href="#"
                      className={`nav-link ${
                        isCadastrosActive ? "active" : ""
                      }`}
                      onClick={(e) => {
                        e.preventDefault();
                        setCadastrosOpen((o) => !o);
                      }}
                    >
                      <i className="nav-icon bi bi-pencil-square" />
                      <p>
                        <span>Cadastros</span>
                        <i
                          className={`nav-arrow bi bi-chevron-${
                            cadastrosOpen ? "down" : "right"
                          }`}
                        />
                      </p>
                    </a>
                    {cadastrosOpen && (
                      <ul className="nav nav-treeview">
                        <li className="nav-item">
                          <Link
                            href="/periods"
                            className={`nav-link ${
                              pathname.startsWith("/periods") ? "active" : ""
                            }`}
                          >
                            <i className="nav-icon bi bi-clock" />
                            <p>Períodos</p>
                          </Link>
                        </li>
                        <li className="nav-item">
                          <Link
                            href="/groups"
                            className={`nav-link ${
                              pathname.startsWith("/groups") ? "active" : ""
                            }`}
                          >
                            <i className="nav-icon bi bi-collection" />
                            <p>Grupos / Cursos</p>
                          </Link>
                        </li>
                        <li className="nav-item">
                          <Link
                            href="/rooms"
                            className={`nav-link ${
                              pathname.startsWith("/rooms") ? "active" : ""
                            }`}
                          >
                            <i className="nav-icon bi bi-door-open" />
                            <p>Salas</p>
                          </Link>
                        </li>
                        <li className="nav-item">
                          <Link
                            href="/teachers"
                            className={`nav-link ${
                              pathname.startsWith("/teachers") ? "active" : ""
                            }`}
                          >
                            <i className="nav-icon bi bi-person-badge" />
                            <p>Professores</p>
                          </Link>
                        </li>
                        <li className="nav-item">
                          <Link
                            href="/subjects"
                            className={`nav-link ${
                              pathname.startsWith("/subjects") ? "active" : ""
                            }`}
                          >
                            <i className="nav-icon bi bi-book" />
                            <p>Disciplinas</p>
                          </Link>
                        </li>
                        <li className="nav-item">
                          <Link
                            href="/classes"
                            className={`nav-link ${
                              pathname.startsWith("/classes") ? "active" : ""
                            }`}
                          >
                            <i className="nav-icon bi bi-mortarboard" />
                            <p>Turmas</p>
                          </Link>
                        </li>
                        <li className="nav-item">
                          <Link
                            href="/lessons"
                            className={`nav-link ${
                              pathname.startsWith("/lessons") ? "active" : ""
                            }`}
                          >
                            <i className="nav-icon bi bi-journal-text" />
                            <p>Matriz de Aulas</p>
                          </Link>
                        </li>
                      </ul>
                    )}
                  </li>
                </>
              )}

              <li className="nav-header">CONTA</li>
              <li className="nav-item">
                <Link
                  href="/accounts/profile"
                  className={`nav-link ${
                    pathname.startsWith("/accounts/profile") ? "active" : ""
                  }`}
                >
                  <i className="nav-icon bi bi-person-circle" />
                  <p>Meu Perfil</p>
                </Link>
              </li>
              <li className="nav-item">
                <Link
                  href="/accounts/subscription"
                  className={`nav-link ${
                    pathname.startsWith("/accounts/subscription")
                      ? "active"
                      : ""
                  }`}
                >
                  <i className="nav-icon bi bi-credit-card" />
                  <p>Assinatura</p>
                </Link>
              </li>

              {user.is_superuser && (
                <>
                  <li className="nav-header">ADMINISTRAÇÃO</li>
                  <li className="nav-item">
                    <Link
                      href="/accounts/manage/users"
                      className={`nav-link ${
                        pathname.startsWith("/accounts/manage/users")
                          ? "active"
                          : ""
                      }`}
                    >
                      <i className="nav-icon bi bi-shield-lock" />
                      <p>Usuários</p>
                    </Link>
                  </li>
                  <li className="nav-item">
                    <Link
                      href="/accounts/manage/emails"
                      className={`nav-link ${
                        pathname.startsWith("/accounts/manage/emails")
                          ? "active"
                          : ""
                      }`}
                    >
                      <i className="nav-icon bi bi-envelope-gear" />
                      <p>Gestão de E-mails</p>
                    </Link>
                  </li>
                  <li className="nav-item">
                    <Link
                      href="/plans"
                      className={`nav-link ${
                        pathname.startsWith("/plans") ? "active" : ""
                      }`}
                    >
                      <i className="nav-icon bi bi-tags" />
                      <p>Planos</p>
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </nav>
        </div>

        {subscription && (
          <div className="sidebar-footer">
            <div className="small text-secondary mb-2">
              Plano:{" "}
              <strong className="text-white">{subscription.plan.name}</strong>
            </div>
            {!user.is_superuser && (
              <>
                <div className="progress mb-2" style={{ height: 5 }}>
                  <div
                    className="progress-bar"
                    style={{ width: `${usagePercentage}%` }}
                  />
                </div>
                <div
                  className="d-flex justify-content-between text-secondary"
                  style={{ fontSize: "0.7rem" }}
                >
                  <span>
                    {subscription.activeClassesCount}/
                    {subscription.plan.maxClasses} turmas
                  </span>
                  <span>{usagePercentage}%</span>
                </div>
              </>
            )}
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="app-main">
        <div className="app-content pt-4 pb-5">
          <div className="container-fluid">{children}</div>
        </div>
      </main>
    </div>
  );
}
