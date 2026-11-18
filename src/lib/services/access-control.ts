import { prisma } from "../prisma";

export interface SubscriptionInfo {
  active: boolean;
  isValid: boolean;
  expiresAt: Date | null;
  plan: {
    id: number;
    name: string;
    slug: string;
    maxClasses: number;
    maxProjects: number;
    isTrial: boolean;
    price: number;
  };
}

export class PlanService {
  static async getOrCreateTrialPlan() {
    let plan = await prisma.plans_plan.findUnique({
      where: { slug: "trial" },
    });
    if (!plan) {
      plan = await prisma.plans_plan.create({
        data: {
          slug: "trial",
          name: "Trial",
          max_classes: 1,
          max_projects: 1,
          duration_days: 30,
          is_trial: true,
          price: 0,
          active: true,
        },
      });
    }
    return plan;
  }

  static async createTrialSubscription(userId: bigint) {
    const plan = await this.getOrCreateTrialPlan();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + plan.duration_days * 24 * 60 * 60 * 1000);

    const existing = await prisma.plans_subscription.findUnique({
      where: { user_id: userId },
    });
    if (existing) return existing;

    return await prisma.plans_subscription.create({
      data: {
        user_id: userId,
        plan_id: plan.id,
        active: true,
        starts_at: now,
        expires_at: expiresAt,
        created_at: now,
        updated_at: now,
      },
    });
  }

  static async getSubscription(user: {
    id: bigint;
    is_superuser: boolean;
    is_staff: boolean;
    plans_subscription?: {
      active: boolean;
      expires_at: Date | null;
      plans_plan: {
        id: bigint;
        name: string;
        slug: string;
        max_classes: number;
        max_projects: number;
        is_trial: boolean;
        price: unknown;
      };
    } | null;
  } | null): Promise<SubscriptionInfo | null> {
    if (!user) return null;

    if (user.is_superuser || user.is_staff) {
      return {
        active: true,
        isValid: true,
        expiresAt: null,
        plan: {
          id: 0,
          name: "Administrador",
          slug: "admin",
          maxClasses: 999999,
          maxProjects: 999999,
          isTrial: false,
          price: 0,
        },
      };
    }

    let sub = user.plans_subscription;
    if (sub === undefined) {
      sub = await prisma.plans_subscription.findUnique({
        where: { user_id: user.id },
        include: { plans_plan: true },
      });
    }

    if (!sub) return null;

    const now = new Date();
    const isValid = sub.active && (!sub.expires_at || sub.expires_at >= now);

    return {
      active: sub.active,
      isValid,
      expiresAt: sub.expires_at,
      plan: {
        id: Number(sub.plans_plan.id),
        name: sub.plans_plan.name,
        slug: sub.plans_plan.slug,
        maxClasses: sub.plans_plan.max_classes,
        maxProjects: sub.plans_plan.max_projects,
        isTrial: sub.plans_plan.is_trial,
        price: Number(sub.plans_plan.price),
      },
    };
  }

  static async isSubscriptionActive(user: Parameters<typeof PlanService.getSubscription>[0]): Promise<boolean> {
    const sub = await this.getSubscription(user);
    return !!sub && sub.isValid;
  }

  static async getActiveClassesCount(userId: bigint): Promise<number> {
    return await prisma.classes_schoolclass.count({
      where: {
        responsible_id: userId,
        active: true,
      },
    });
  }

  static async canAddClass(user: Parameters<typeof PlanService.getSubscription>[0]): Promise<boolean> {
    if (!user) return false;
    if (user.is_superuser || user.is_staff) return true;
    const sub = await this.getSubscription(user);
    if (!sub || !sub.isValid) return false;
    const count = await this.getActiveClassesCount(user.id);
    return count < sub.plan.maxClasses;
  }

  static async canCreateProject(user: Parameters<typeof PlanService.getSubscription>[0]): Promise<boolean> {
    if (!user) return false;
    if (user.is_superuser || user.is_staff) return true;
    const sub = await this.getSubscription(user);
    if (!sub || !sub.isValid) return false;
    const count = await prisma.schedules_project.count({
      where: { owner_id: user.id },
    });
    return count < sub.plan.maxProjects;
  }

  static async canInviteToProject(user: Parameters<typeof PlanService.getSubscription>[0]): Promise<boolean> {
    if (!user) return false;
    if (user.is_superuser || user.is_staff) return true;
    const sub = await this.getSubscription(user);
    if (!sub || !sub.isValid) return false;
    return !sub.plan.isTrial;
  }
}

export class AccessControlService {
  static async isCoordinator(projectId: bigint, userId: bigint, ownerId: bigint): Promise<boolean> {
    if (ownerId === userId) return true;
    const participant = await prisma.schedules_projectparticipant.findFirst({
      where: {
        project_id: projectId,
        user_id: userId,
        role: "coordinator",
        active: true,
      },
    });
    return !!participant;
  }

  static async canManageProjectResources(
    user: { id: bigint; is_superuser: boolean; is_staff: boolean },
    project: { id: bigint; owner_id: bigint }
  ): Promise<boolean> {
    if (user.is_superuser || user.is_staff) return true;
    return await this.isCoordinator(project.id, user.id, project.owner_id);
  }

  static canEditProjectSettings(
    user: { id: bigint; is_superuser: boolean; is_staff: boolean },
    project: { owner_id: bigint }
  ): boolean {
    return user.is_superuser || user.is_staff || project.owner_id === user.id;
  }
}
