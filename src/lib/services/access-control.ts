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
    maxGroups: number;
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
          max_groups: 1,
          duration_days: 30,
          is_trial: true,
          price: 0,
          active: true,
        },
      });
    }
    return plan;
  }

  static async getOrCreateDirecaoPlan() {
    let plan = await prisma.plans_plan.findUnique({
      where: { slug: "direcao" },
    });
    if (!plan) {
      plan = await prisma.plans_plan.create({
        data: {
          slug: "direcao",
          name: "Direção",
          max_classes: 50,
          max_projects: 1,
          max_groups: 10,
          duration_days: 30,
          is_trial: false,
          price: 149,
          active: true,
        },
      });
    }
    return plan;
  }

  static hasActiveSubscription(user: {
    is_superuser?: boolean;
    plans_subscription?: {
      active: boolean;
      expires_at: Date | null;
    } | null;
  } | null): boolean {
    if (!user) return false;
    if (user.is_superuser) return true;
    const sub = user.plans_subscription;
    if (!sub || !sub.active) return false;
    if (sub.expires_at && sub.expires_at < new Date()) return false;
    return true;
  }

  static hasActivePaidSubscription(user: {
    is_superuser?: boolean;
    plans_subscription?: {
      active: boolean;
      expires_at: Date | null;
      plans_plan: { is_trial?: boolean };
    } | null;
  } | null): boolean {
    if (!user) return false;
    if (user.is_superuser) return true;
    const sub = user.plans_subscription;
    if (!sub || !sub.active) return false;
    if (sub.expires_at && sub.expires_at < new Date()) return false;
    return !sub.plans_plan.is_trial;
  }

  static hasActiveDirecaoPlan(user: {
    plans_subscription?: {
      active: boolean;
      expires_at: Date | null;
      plans_plan: { slug: string; is_trial?: boolean };
    } | null;
  } | null): boolean {
    if (!user) return false;
    const sub = user.plans_subscription;
    if (!sub || !sub.active) return false;
    if (sub.expires_at && sub.expires_at < new Date()) return false;
    return sub.plans_plan.slug === "direcao" && !sub.plans_plan.is_trial;
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
      purchased_groups?: number | null;
      plans_plan: {
        id: bigint;
        name: string;
        slug: string;
        max_classes: number;
        max_projects: number;
        max_groups: number;
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
          maxGroups: 999999,
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
    const effectiveMaxGroups = sub.purchased_groups ?? sub.plans_plan.max_groups;
    const effectiveMaxClasses =
      sub.plans_plan.slug === "direcao" && sub.purchased_groups
        ? Math.max(sub.plans_plan.max_classes, effectiveMaxGroups * 5)
        : sub.plans_plan.max_classes;

    return {
      active: sub.active,
      isValid,
      expiresAt: sub.expires_at,
      plan: {
        id: Number(sub.plans_plan.id),
        name: sub.plans_plan.name,
        slug: sub.plans_plan.slug,
        maxClasses: effectiveMaxClasses,
        maxProjects: sub.plans_plan.max_projects,
        maxGroups: effectiveMaxGroups,
        isTrial: sub.plans_plan.is_trial,
        price: Number(sub.plans_plan.price),
      },
    };
  }

  static async incrementDirecaoQuota(userId: bigint, incrementBy = 1) {
    const sub = await prisma.plans_subscription.findUnique({
      where: { user_id: userId },
      include: { plans_plan: true },
    });
    if (!sub || !sub.active || (sub.expires_at && sub.expires_at < new Date())) {
      throw new Error("Assinatura inativa ou expirada.");
    }
    if (sub.plans_plan.slug !== "direcao") {
      throw new Error("O auto-incremento de cotas está disponível apenas para o plano Direção.");
    }
    const currentGroups = Math.max(1, sub.purchased_groups ?? sub.plans_plan.max_groups);
    const nextGroups = currentGroups + Math.max(1, Math.floor(incrementBy));
    const updated = await prisma.plans_subscription.update({
      where: { user_id: userId },
      data: {
        purchased_groups: nextGroups,
        updated_at: new Date(),
      },
    });
    return {
      purchasedGroups: updated.purchased_groups ?? nextGroups,
      previousGroups: currentGroups,
    };
  }

  static async isSubscriptionActive(user: Parameters<typeof PlanService.getSubscription>[0]): Promise<boolean> {
    const sub = await this.getSubscription(user);
    return !!sub && sub.isValid;
  }

  static async getActiveClassesCount(userId: bigint): Promise<number> {
    return await prisma.classes_schoolclass.count({
      where: {
        active: true,
        OR: [
          { groups_group: { owner_id: userId } },
          {
            responsible_id: userId,
            groups_group: { owner_id: null },
          },
        ],
      },
    });
  }

  static async getSponsoredSeatsInfo(projectId: bigint, projectOwnerId: bigint) {
    const [owner, usedSponsoredSeats] = await Promise.all([
      prisma.accounts_user.findUnique({
        where: { id: projectOwnerId },
        include: {
          plans_subscription: {
            include: { plans_plan: true },
          },
        },
      }),
      prisma.schedules_projectparticipant.count({
        where: {
          project_id: projectId,
          active: true,
          role: "coordinator",
          license_source: "PROJECT_SPONSORED",
        },
      }),
    ]);

    const ownerSub = await this.getSubscription(owner);
    const ownerSubValid = Boolean(owner?.is_superuser || ownerSub?.isValid);
    // O diretor precisa de pelo menos 1 quota paga para uso próprio
    const maxSponsoredSeats = owner?.is_superuser
      ? 999999
      : ownerSubValid && ownerSub && !ownerSub.plan.isTrial
      ? Math.max(0, ownerSub.plan.maxGroups - 1)
      : 0;

    return {
      maxSponsoredSeats,
      usedSponsoredSeats,
      availableSponsoredSeats: Math.max(0, maxSponsoredSeats - usedSponsoredSeats),
      ownerSubValid,
    };
  }

  static async canAddClass(
    user: Parameters<typeof PlanService.getSubscription>[0],
    projectId?: bigint
  ): Promise<boolean> {
    if (!user) return false;
    if (user.is_superuser || user.is_staff) return true;
    const sub = await this.getSubscription(user);
    if (sub && sub.isValid && !sub.plan.isTrial) {
      const count = await this.getActiveClassesCount(user.id);
      return count < sub.plan.maxClasses;
    }

    if (projectId) {
      const participant = await prisma.schedules_projectparticipant.findFirst({
        where: {
          project_id: projectId,
          user_id: user.id,
          active: true,
          role: "coordinator",
          license_source: "PROJECT_SPONSORED",
        },
      });
      if (participant) {
        const project = await prisma.schedules_project.findUnique({
          where: { id: projectId },
          select: { owner_id: true },
        });
        if (project) {
          const owner = await prisma.accounts_user.findUnique({
            where: { id: project.owner_id },
            include: { plans_subscription: { include: { plans_plan: true } } },
          });
          const ownerSub = await this.getSubscription(owner);
          if (owner?.is_superuser || (ownerSub && ownerSub.isValid)) {
            const projectClassCount = await prisma.classes_schoolclass.count({
              where: { project_id: projectId, active: true },
            });
            return owner?.is_superuser
              ? true
              : projectClassCount < (ownerSub?.plan.maxClasses ?? 0);
          }
        }
      }
    }

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

  static async canCreateGroup(
    user: Parameters<typeof PlanService.getSubscription>[0],
    projectId?: bigint
  ): Promise<boolean> {
    if (!user) return false;
    if (user.is_superuser || user.is_staff) return true;
    const sub = await this.getSubscription(user);
    if (sub && sub.isValid) {
      const isDirecao = sub.plan.slug === "direcao";
      const count = await prisma.groups_group.count({
        where:
          isDirecao && projectId
            ? {
                project_id: projectId,
                status: { not: "INACTIVE" },
              }
            : {
                owner_id: user.id,
                status: { not: "INACTIVE" },
              },
      });
      return count < sub.plan.maxGroups;
    }

    if (projectId) {
      const participant = await prisma.schedules_projectparticipant.findFirst({
        where: {
          project_id: projectId,
          user_id: user.id,
          active: true,
          role: "coordinator",
          license_source: "PROJECT_SPONSORED",
        },
      });
      if (participant) {
        const project = await prisma.schedules_project.findUnique({
          where: { id: projectId },
          select: { owner_id: true },
        });
        if (project) {
          const owner = await prisma.accounts_user.findUnique({
            where: { id: project.owner_id },
            include: { plans_subscription: { include: { plans_plan: true } } },
          });
          const ownerSub = await this.getSubscription(owner);
          if (owner?.is_superuser || (ownerSub && ownerSub.isValid)) {
            const projectGroupCount = await prisma.groups_group.count({
              where: { project_id: projectId, status: { not: "INACTIVE" } },
            });
            return owner?.is_superuser
              ? true
              : projectGroupCount < (ownerSub?.plan.maxGroups ?? 0);
          }
        }
      }
    }

    return false;
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
    user: {
      id: bigint;
      is_superuser: boolean;
      is_staff: boolean;
      plans_subscription?: {
        active: boolean;
        expires_at: Date | null;
        plans_plan: { slug: string };
      } | null;
    },
    project: { owner_id: bigint }
  ): boolean {
    return (
      user.is_superuser ||
      user.is_staff ||
      project.owner_id === user.id ||
      PlanService.hasActiveDirecaoPlan(user)
    );
  }

  static isProjectAdmin(
    user: {
      id: bigint;
      is_superuser: boolean;
      plans_subscription?: {
        active: boolean;
        expires_at: Date | null;
        plans_plan: { slug: string };
      } | null;
    },
    project: { owner_id: bigint }
  ): boolean {
    if (user.is_superuser) return true;
    if (PlanService.hasActiveDirecaoPlan(user)) return true;
    if (project.owner_id === user.id) {
      return user.plans_subscription === undefined
        ? true
        : PlanService.hasActiveSubscription(user);
    }
    return false;
  }

  static canManageGroup(
    user: {
      id: bigint;
      is_superuser: boolean;
      plans_subscription?: {
        active: boolean;
        expires_at: Date | null;
        plans_plan: { slug: string };
      } | null;
    },
    project: { owner_id: bigint },
    group: { owner_id: bigint | null }
  ): boolean {
    return (
      this.isProjectAdmin(user, project) ||
      (group.owner_id !== null && group.owner_id === user.id)
    );
  }

  static async hasValidProjectLicense(
    user: {
      id: bigint;
      is_superuser: boolean;
      plans_subscription?: {
        active: boolean;
        expires_at: Date | null;
        plans_plan: { slug: string; is_trial?: boolean };
      } | null;
    },
    project: { id: bigint; owner_id: bigint }
  ): Promise<{
    valid: boolean;
    source:
      | "ADMIN"
      | "OWNER"
      | "INDIVIDUAL"
      | "PROJECT_SPONSORED"
      | "INDIVIDUAL_EXPIRED"
      | "PROJECT_SPONSORED_EXPIRED"
      | "NONE";
  }> {
    if (user.is_superuser) return { valid: true, source: "ADMIN" };
    if (project.owner_id === user.id) {
      if (user.plans_subscription === undefined) {
        return { valid: true, source: "OWNER" };
      }
      const participantsCount = await prisma.schedules_projectparticipant.count({
        where: { project_id: project.id, active: true },
      });
      // Se houver participantes no projeto, a cota própria do diretor/dono também deve ser paga
      const valid =
        participantsCount > 0
          ? PlanService.hasActivePaidSubscription(user)
          : PlanService.hasActiveSubscription(user);
      return { valid, source: "OWNER" };
    }

    const participant = await prisma.schedules_projectparticipant.findFirst({
      where: {
        project_id: project.id,
        user_id: user.id,
        active: true,
      },
      select: { license_source: true, role: true },
    });

    if (!participant) {
      return { valid: false, source: "NONE" };
    }

    if (participant.license_source === "PROJECT_SPONSORED") {
      const owner = await prisma.accounts_user.findUnique({
        where: { id: project.owner_id },
        select: {
          is_superuser: true,
          plans_subscription: {
            select: {
              active: true,
              expires_at: true,
              plans_plan: { select: { is_trial: true } },
            },
          },
        },
      });
      // A cota própria do diretor também deve ser paga para sustentar vagas patrocinadas
      const ownerValid = Boolean(
        owner?.is_superuser || PlanService.hasActivePaidSubscription(owner)
      );
      return {
        valid: ownerValid,
        source: ownerValid ? "PROJECT_SPONSORED" : "PROJECT_SPONSORED_EXPIRED",
      };
    }

    // A cota própria do coordenador (INDIVIDUAL) também deve ser paga
    let individualValid = false;
    if (user.plans_subscription !== undefined) {
      individualValid = PlanService.hasActivePaidSubscription(user);
    } else {
      const sub = await PlanService.getSubscription(
        user as Parameters<typeof PlanService.getSubscription>[0]
      );
      individualValid = Boolean(sub && sub.isValid && !sub.plan.isTrial);
    }

    return {
      valid: individualValid,
      source: individualValid ? "INDIVIDUAL" : "INDIVIDUAL_EXPIRED",
    };
  }

  static async canManageGroupIds(
    user: {
      id: bigint;
      is_superuser: boolean;
      plans_subscription?: {
        active: boolean;
        expires_at: Date | null;
        plans_plan: { slug: string };
      } | null;
    },
    project: { id: bigint; owner_id: bigint },
    groupIds: bigint[]
  ): Promise<boolean> {
    if (this.isProjectAdmin(user, project)) return true;
    const license = await this.hasValidProjectLicense(user, project);
    if (!license.valid) return false;
    const uniqueIds = Array.from(new Set(groupIds));
    if (uniqueIds.length === 0) return false;
    const groups = await prisma.groups_group.findMany({
      where: { id: { in: uniqueIds }, project_id: project.id },
      select: { id: true, owner_id: true },
    });
    if (groups.length !== uniqueIds.length) return false;
    return groups.every((g) => this.canManageGroup(user, project, g));
  }
}
