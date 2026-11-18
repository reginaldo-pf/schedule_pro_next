import { redirect } from "next/navigation";
import { getCurrentUser, getActiveProject } from "./auth";
import { PlanService } from "./services/access-control";
import { prisma } from "./prisma";
import type {
  ShellUser,
  ShellProject,
  ShellSubscription,
} from "../components/layout/AppShell";

export async function requireShellContext(options?: {
  requireProject?: boolean;
  requireSuperuser?: boolean;
}): Promise<{
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
  activeProject: Awaited<ReturnType<typeof getActiveProject>>;
  shellUser: ShellUser;
  shellProject: ShellProject | null;
  shellProjects: ShellProject[];
  shellSubscription: ShellSubscription | null;
}> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/accounts/login?auth_required=1");
  }

  if (options?.requireSuperuser && !user.is_superuser) {
    redirect("/dashboard");
  }

  const activeProject = await getActiveProject(user);
  if (options?.requireProject && !activeProject) {
    redirect("/projects?select_project=1");
  }

  const [userProjects, subInfo, activeClassesCount] = await Promise.all([
    prisma.schedules_project.findMany({
      where: user.is_superuser
        ? {}
        : {
            OR: [
              { owner_id: user.id },
              {
                schedules_projectparticipant: {
                  some: { user_id: user.id, active: true },
                },
              },
            ],
          },
      orderBy: [{ name: "asc" }],
    }),
    PlanService.getSubscription(user),
    PlanService.getActiveClassesCount(user.id),
  ]);

  const shellUser: ShellUser = {
    id: Number(user.id),
    username: user.username,
    email: user.email,
    profile: user.profile,
    is_superuser: user.is_superuser,
    is_staff: user.is_staff,
  };

  const shellProject: ShellProject | null = activeProject
    ? {
        id: Number(activeProject.id),
        name: activeProject.name,
        institution_name: activeProject.institution_name,
        academic_period: activeProject.academic_period,
      }
    : null;

  const shellProjects: ShellProject[] = userProjects.map((p) => ({
    id: Number(p.id),
    name: p.name,
    institution_name: p.institution_name,
    academic_period: p.academic_period,
  }));

  const shellSubscription: ShellSubscription | null = subInfo
    ? {
        active: subInfo.active,
        isValid: subInfo.isValid,
        plan: {
          name: subInfo.plan.name,
          maxClasses: subInfo.plan.maxClasses,
          isTrial: subInfo.plan.isTrial,
        },
        activeClassesCount,
      }
    : null;

  return {
    user,
    activeProject,
    shellUser,
    shellProject,
    shellProjects,
    shellSubscription,
  };
}
