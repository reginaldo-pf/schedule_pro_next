import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPortalToken } from "@/lib/auth";

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const payload = await verifyPortalToken(token);
  if (!payload) {
    return NextResponse.json(
      {
        ok: false,
        expired: true,
        message:
          "O link de acesso expirou (limite de 48 horas) ou é inválido. Solicite um novo link ao seu coordenador.",
      },
      { status: 401 }
    );
  }

  const teacherId = BigInt(payload.teacherId);
  const projectId = BigInt(payload.projectId);

  const teacher = await prisma.teachers_teacher.findFirst({
    where: { id: teacherId, project_id: projectId },
  });
  if (!teacher) {
    return NextResponse.json(
      { ok: false, message: "Professor não encontrado." },
      { status: 404 }
    );
  }

  const body = await request.json();
  const statusMap: Record<string, string> = body.statusMap || {};
  const validFrom = body.validFrom ? new Date(body.validFrom) : null;
  const validUntil = body.validUntil ? new Date(body.validUntil) : null;

  const entries = Object.entries(statusMap).filter(
    ([, st]) => st && st !== "AVAILABLE"
  );

  await prisma.$transaction([
    prisma.availability_teacheravailability.deleteMany({
      where: { teacher_id: teacherId },
    }),
    ...(entries.length > 0
      ? [
          prisma.availability_teacheravailability.createMany({
            data: entries.map(([key, st]) => {
              const [periodIdStr, ...dayParts] = key.split("_");
              return {
                teacher_id: teacherId,
                period_id: BigInt(periodIdStr),
                day_of_week: dayParts.join("_"),
                status: st,
                valid_from: validFrom,
                valid_until: validUntil,
              };
            }),
          }),
        ]
      : []),
    prisma.teachers_teacher.update({
      where: { id: teacherId },
      data: {
        name: (body.name || teacher.name).trim(),
        short_name: (body.short_name || teacher.short_name).trim(),
        email: body.email ? body.email.trim() : teacher.email,
        color: body.color || teacher.color,
        availability_updated_at: new Date(),
        updated_at: new Date(),
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    message: "Suas preferências e restrições de horários foram salvas com sucesso!",
  });
}
