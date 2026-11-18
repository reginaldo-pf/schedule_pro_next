import { requireShellContext } from "@/lib/shell-context";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { AdminUsersClient } from "@/components/accounts/AdminUsersClient";

export default async function AdminUsersPage() {
  const {
    shellUser,
    shellProject,
    shellProjects,
    shellSubscription,
  } = await requireShellContext({ requireSuperuser: true });

  const [users, plans] = await Promise.all([
    prisma.accounts_user.findMany({
      include: {
        plans_subscription: {
          include: { plans_plan: true },
        },
      },
      orderBy: { date_joined: "desc" },
    }),
    prisma.plans_plan.findMany({
      where: { active: true },
      orderBy: { price: "asc" },
    }),
  ]);

  const serializedUsers = users.map((u) => ({
    id: Number(u.id),
    username: u.username,
    email: u.email,
    first_name: u.first_name,
    last_name: u.last_name,
    profile: u.profile,
    is_active: u.is_active,
    is_staff: u.is_staff,
    is_superuser: u.is_superuser,
    date_joined: u.date_joined.toLocaleDateString("pt-BR"),
    plan_id: u.plans_subscription ? Number(u.plans_subscription.plan_id) : null,
    plan_name: u.plans_subscription?.plans_plan?.name || "Sem plano",
    subscription_active: u.plans_subscription ? u.plans_subscription.active : false,
  }));

  const serializedPlans = plans.map((p) => ({
    id: Number(p.id),
    name: p.name,
  }));

  return (
    <AppShell
      user={shellUser}
      activeProject={shellProject}
      projects={shellProjects}
      subscription={shellSubscription}
      breadcrumbs={[{ label: "Administração" }, { label: "Usuários" }]}
    >
      <AdminUsersClient users={serializedUsers} plans={serializedPlans} />
    </AppShell>
  );
}
