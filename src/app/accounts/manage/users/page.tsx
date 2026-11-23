import { redirect } from "next/navigation";
import { requireShellContext } from "@/lib/shell-context";
import { prisma } from "@/lib/prisma";
import { PlanService } from "@/lib/services/access-control";
import { AppShell } from "@/components/layout/AppShell";
import { AdminUsersClient } from "@/components/accounts/AdminUsersClient";

export default async function AdminUsersPage() {
  const {
    user,
    shellUser,
    shellProject,
    shellProjects,
    shellSubscription,
  } = await requireShellContext();

  const isDirecao = PlanService.hasActiveDirecaoPlan(user);
  if (!user.is_superuser && !isDirecao) {
    redirect("/dashboard");
  }

  let projectIds: bigint[] = [];
  if (!user.is_superuser) {
    const managedProjects = await prisma.schedules_project.findMany({
      where: {
        OR: [
          { owner_id: user.id },
          {
            schedules_projectparticipant: {
              some: { user_id: user.id, active: true },
            },
          },
        ],
      },
      select: { id: true },
    });
    projectIds = managedProjects.map((p) => p.id);
  }

  const [users, plans] = await Promise.all([
    prisma.accounts_user.findMany({
      where: user.is_superuser
        ? {}
        : {
            is_superuser: false,
            OR: [
              { id: user.id },
              {
                schedules_projectparticipant: {
                  some: {
                    project_id: { in: projectIds },
                  },
                },
              },
            ],
          },
      include: {
        plans_subscription: {
          include: { plans_plan: true },
        },
      },
      orderBy: { date_joined: "desc" },
    }),
    prisma.plans_plan.findMany({
      where: user.is_superuser
        ? { active: true }
        : { active: true, slug: { not: "direcao" } },
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
      <AdminUsersClient
        users={serializedUsers}
        plans={serializedPlans}
        isSuperuser={user.is_superuser}
      />
    </AppShell>
  );
}
