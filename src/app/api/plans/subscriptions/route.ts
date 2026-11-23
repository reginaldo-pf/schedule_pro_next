import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { PlanService } from "@/lib/services/access-control";

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, message: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const incrementBy = Number(body.increment_by ?? 1);
    if (!Number.isFinite(incrementBy) || incrementBy < 1 || incrementBy > 50) {
      return NextResponse.json(
        { ok: false, message: "Quantidade de cotas inválida (1 a 50)." },
        { status: 400 }
      );
    }

    const result = await PlanService.incrementDirecaoQuota(user.id, incrementBy);
    return NextResponse.json({
      ok: true,
      purchased_groups: result.purchasedGroups,
      message: `Plano incrementado! Agora você possui ${result.purchasedGroups} cotas de curso/coordenador no plano Direção.`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao incrementar cotas do plano.";
    return NextResponse.json({ ok: false, message: msg }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await getCurrentUser();
    if (!admin || !admin.is_superuser) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Apenas administradores podem renovar ou gerenciar assinaturas de usuários.",
        },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const rawUserId = Number(body.user_id);
    const rawPlanId = Number(body.plan_id);
    const renewMode = body.renew_mode === "extend_current" ? "extend_current" : "from_now";
    const explicitExpiresAt =
      typeof body.expires_at === "string" ? body.expires_at.trim() : "";
    const active = body.active !== false;

    if (!Number.isFinite(rawUserId) || rawUserId <= 0) {
      return NextResponse.json(
        { ok: false, message: "Usuário inválido." },
        { status: 400 }
      );
    }
    if (!Number.isFinite(rawPlanId) || rawPlanId <= 0) {
      return NextResponse.json(
        { ok: false, message: "Selecione um plano válido." },
        { status: 400 }
      );
    }

    const [targetUser, plan] = await Promise.all([
      prisma.accounts_user.findUnique({
        where: { id: BigInt(rawUserId) },
        select: {
          id: true,
          username: true,
          first_name: true,
          last_name: true,
          email: true,
        },
      }),
      prisma.plans_plan.findUnique({
        where: { id: BigInt(rawPlanId) },
      }),
    ]);

    if (!targetUser) {
      return NextResponse.json(
        { ok: false, message: "Usuário não encontrado." },
        { status: 404 }
      );
    }
    if (!plan) {
      return NextResponse.json(
        { ok: false, message: "Plano não encontrado." },
        { status: 404 }
      );
    }

    const existingSub = await prisma.plans_subscription.findUnique({
      where: { user_id: targetUser.id },
    });

    const now = new Date();
    const durationDays =
      Number.isFinite(Number(body.duration_days)) && Number(body.duration_days) > 0
        ? Math.floor(Number(body.duration_days))
        : plan.duration_days;

    let newExpiresAt: Date;
    if (explicitExpiresAt) {
      const parsed = new Date(`${explicitExpiresAt}T23:59:59.999Z`);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json(
          { ok: false, message: "Data de validade inválida." },
          { status: 400 }
        );
      }
      newExpiresAt = parsed;
    } else {
      const baseDate =
        renewMode === "extend_current" &&
        existingSub?.expires_at &&
        existingSub.expires_at > now
          ? existingSub.expires_at
          : now;
      newExpiresAt = new Date(
        baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000
      );
    }

    const rawPurchasedGroups =
      body.purchased_groups !== undefined &&
      body.purchased_groups !== null &&
      body.purchased_groups !== ""
        ? Math.floor(Number(body.purchased_groups))
        : null;
    const purchasedGroups =
      rawPurchasedGroups !== null && Number.isFinite(rawPurchasedGroups) && rawPurchasedGroups >= 1
        ? rawPurchasedGroups
        : null;

    if (existingSub) {
      await prisma.plans_subscription.update({
        where: { user_id: targetUser.id },
        data: {
          plan_id: plan.id,
          active,
          purchased_groups: purchasedGroups,
          starts_at:
            renewMode === "extend_current" &&
            existingSub.expires_at &&
            existingSub.expires_at > now
              ? existingSub.starts_at
              : now,
          expires_at: newExpiresAt,
          updated_at: now,
        },
      });
    } else {
      await prisma.plans_subscription.create({
        data: {
          user_id: targetUser.id,
          plan_id: plan.id,
          active,
          purchased_groups: purchasedGroups,
          starts_at: now,
          expires_at: newExpiresAt,
          created_at: now,
          updated_at: now,
        },
      });
    }

    const displayName =
      `${targetUser.first_name || ""} ${targetUser.last_name || ""}`.trim() ||
      targetUser.username;

    return NextResponse.json({
      ok: true,
      message: `Plano "${plan.name}" renovado para ${displayName} até ${newExpiresAt.toLocaleDateString("pt-BR")}.`,
    });
  } catch (err) {
    console.error("Renew subscription error:", err);
    return NextResponse.json(
      { ok: false, message: "Erro ao renovar assinatura do usuário." },
      { status: 500 }
    );
  }
}
