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

  const [plans, users] = await Promise.all([
    prisma.plans_plan.findMany({
      orderBy: { price: "asc" },
    }),
    prisma.accounts_user.findMany({
      where: { is_superuser: false },
      include: {
        plans_subscription: {
          include: { plans_plan: true },
        },
      },
      orderBy: [{ first_name: "asc" }, { username: "asc" }],
    }),
  ]);

  const serialized = plans.map((p) => ({
    id: Number(p.id),
    name: p.name,
    slug: p.slug,
    max_classes: p.max_classes,
    max_projects: p.max_projects,
    max_groups: p.max_groups,
    duration_days: p.duration_days,
    is_trial: p.is_trial,
    price: Number(p.price),
    active: p.active,
  }));

  const now = new Date();
  const serializedSubscriptions = users.map((u) => {
    const sub = u.plans_subscription;
    const isExpired = Boolean(sub?.expires_at && sub.expires_at < now);
    const isValid = Boolean(sub && sub.active && !isExpired);
    const fullName = `${u.first_name || ""} ${u.last_name || ""}`.trim();

    return {
      user_id: Number(u.id),
      username: u.username,
      full_name: fullName || u.username,
      email: u.email,
      profile: u.profile,
      user_active: u.is_active,
      plan_id: sub ? Number(sub.plan_id) : null,
      plan_name: sub?.plans_plan?.name || "Sem plano",
      purchased_groups: sub?.purchased_groups ?? null,
      effective_max_groups: sub
        ? sub.purchased_groups ?? sub.plans_plan.max_groups
        : null,
      sub_active: sub ? sub.active : false,
      is_valid: isValid,
      is_expired: isExpired,
      starts_at: sub ? sub.starts_at.toISOString().slice(0, 10) : "",
      expires_at: sub?.expires_at ? sub.expires_at.toISOString().slice(0, 10) : "",
    };
  });

  return (
    <AppShell
      user={shellUser}
      activeProject={shellProject}
      projects={shellProjects}
      subscription={shellSubscription}
      breadcrumbs={[{ label: "Administração" }, { label: "Planos" }]}
    >
      <PlansClient plans={serialized} userSubscriptions={serializedSubscriptions} />
    </AppShell>
  );
}
