import { requireShellContext } from "@/lib/shell-context";
import { PlanService } from "@/lib/services/access-control";
import { AppShell } from "@/components/layout/AppShell";
import { ModuleHeader } from "@/components/crud/ModuleHeader";
import { IncrementQuotaButton } from "@/components/plans/IncrementQuotaButton";

export default async function SubscriptionPage() {
  const {
    user,
    shellUser,
    shellProject,
    shellProjects,
    shellSubscription,
  } = await requireShellContext();

  const sub = await PlanService.getSubscription(user);

  return (
    <AppShell
      user={shellUser}
      activeProject={shellProject}
      projects={shellProjects}
      subscription={shellSubscription}
      breadcrumbs={[{ label: "Minha Assinatura" }]}
    >
      <ModuleHeader
        icon="bi-credit-card"
        title="Minha Assinatura"
        description="Detalhes do seu plano ativo, limites de turmas e projetos"
        statLabel="Status"
        statValue={sub?.isValid ? "Ativa" : "Inativa / Expirada"}
      />

      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          {sub ? (
            <div className="row g-4 align-items-center">
              <div className="col-md-6">
                <span
                  className={`badge ${
                    sub.isValid
                      ? "bg-success-subtle text-success"
                      : "bg-danger-subtle text-danger"
                  } mb-2 px-3 py-2`}
                >
                  {sub.isValid ? "Assinatura Ativa" : "Assinatura Expirada"}
                </span>
                <h3 className="fw-bold mb-1">Plano {sub.plan.name}</h3>
                <p className="text-muted mb-3">
                  {sub.plan.isTrial
                    ? "Plano de avaliação gratuita"
                    : "Plano completo com recursos avançados"}
                </p>
                <ul className="list-unstyled mb-0 d-flex flex-column gap-2">
                  <li>
                    <i className="bi bi-check-circle-fill text-success me-2" />
                    Limite de Turmas Ativas:{" "}
                    <strong>
                      {user.is_superuser ? "Ilimitado" : sub.plan.maxClasses}
                    </strong>
                  </li>
                  <li>
                    <i className="bi bi-check-circle-fill text-success me-2" />
                    Limite de Projetos:{" "}
                    <strong>
                      {user.is_superuser ? "Ilimitado" : sub.plan.maxProjects}
                    </strong>
                  </li>
                  <li>
                    <i className="bi bi-check-circle-fill text-success me-2" />
                    Limite de Cursos / Grupos:{" "}
                    <strong>
                      {user.is_superuser ? "Ilimitado" : sub.plan.maxGroups}
                    </strong>
                  </li>
                  {sub.expiresAt && (
                    <li>
                      <i className="bi bi-calendar-event text-primary me-2" />
                      Válido até:{" "}
                      <strong>
                        {new Date(sub.expiresAt).toLocaleDateString("pt-BR")}
                      </strong>
                    </li>
                  )}
                </ul>
              </div>
              <div className="col-md-6 text-md-end">
                <div className="bg-light p-4 rounded-3 border d-inline-block text-start">
                  <div className="small text-muted text-uppercase fw-bold mb-1">
                    Uso Atual de Turmas
                  </div>
                  <div className="fs-2 fw-bold text-primary">
                    {shellSubscription?.activeClassesCount || 0} /{" "}
                    {user.is_superuser ? "∞" : sub.plan.maxClasses}
                  </div>
                  {!user.is_superuser &&
                    sub.isValid &&
                    sub.plan.slug === "direcao" && (
                      <div className="mt-3 pt-3 border-top">
                        <div className="small text-muted mb-2">
                          Cotas contratadas: <strong>{sub.plan.maxGroups}</strong>{" "}
                          (1 própria + {Math.max(0, sub.plan.maxGroups - 1)} para coordenadores)
                        </div>
                        <IncrementQuotaButton label="Adicionar +1 Cota (R$ 20,00)" />
                      </div>
                    )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <i className="bi bi-exclamation-circle display-4 text-warning mb-2 d-block" />
              <h5>Nenhuma assinatura vinculada</h5>
              <p className="text-muted mb-0">
                Entre em contato com o administrador do sistema para ativar um
                plano.
              </p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
