import { requireShellContext } from "@/lib/shell-context";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { PlansClient } from "@/components/plans/PlansClient";

export default async function PlansPage() {
  const {
    shellUser,
    shellProject,
    shellProjects,
    shellSubscription,
  } = await requireShellContext({ requireSuperuser: true });

  const plans = await prisma.plans_plan.findMany({
    orderBy: { price: "asc" },
  });

  const serialized = plans.map((p) => ({
    id: Number(p.id),
    name: p.name,
    slug: p.slug,
    max_classes: p.max_classes,
    max_projects: p.max_projects,
    duration_days: p.duration_days,
    is_trial: p.is_trial,
    price: Number(p.price),
    active: p.active,
  }));

  return (
    <AppShell
      user={shellUser}
      activeProject={shellProject}
      projects={shellProjects}
      subscription={shellSubscription}
      breadcrumbs={[{ label: "Administração" }, { label: "Planos" }]}
    >
      <PlansClient plans={serialized} />
    </AppShell>
  );
}
