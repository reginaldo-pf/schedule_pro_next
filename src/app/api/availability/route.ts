import { NextResponse } from "next/server";
import { prisma, formatTime, formatDateISO } from "@/lib/prisma";
import { getCurrentUser, getActiveProject } from "@/lib/auth";
import { getActiveProjectDaysList } from "@/lib/schedule/report-builder";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  const project = await getActiveProject(user);
  if (!user || !project) {
    return NextResponse.json(
      { ok: false, message: "Selecione um projeto ativo." },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "teacher";
  const idParam = searchParams.get("id");
  if (!idParam) {
    return NextResponse.json({ ok: false, message: "ID obrigatório." }, { status: 400 });
  }
  const entityId = BigInt(idParam);

  const days = getActiveProjectDaysList(project);
  let periodsRaw = await prisma.periods_period.findMany({
    where: {
      project_id: project.id,
      period_type: "CLASS",
    },
    orderBy: [{ start_time: "asc" }, { order: "asc" }],
  });

  if (type === "class") {
    const schoolClass = await prisma.classes_schoolclass.findFirst({
      where: { id: entityId, project_id: project.id },
      select: { shifts: true },
    });
    if (schoolClass?.shifts && schoolClass.shifts.length > 0) {
      const allowedShifts = new Set(schoolClass.shifts);
      periodsRaw = periodsRaw.filter((p) => allowedShifts.has(p.shift));
    }
  }

  const allowedPeriodIds = new Set(periodsRaw.map((p) => p.id.toString()));

  const periods = periodsRaw.map((p) => ({
    id: Number(p.id),
    name: p.name,
    start_time: formatTime(p.start_time),
    end_time: formatTime(p.end_time),
    shift: p.shift,
  }));

  const statusMap: Record<string, string> = {};
  let validFrom = "";
  let validUntil = "";

  if (type === "teacher") {
    const rows = await prisma.availability_teacheravailability.findMany({
      where: { teacher_id: entityId },
    });
    for (const r of rows) {
      statusMap[`${Number(r.period_id)}_${r.day_of_week}`] = r.status;
      if (!validFrom && r.valid_from) validFrom = formatDateISO(r.valid_from);
      if (!validUntil && r.valid_until) validUntil = formatDateISO(r.valid_until);
    }
  } else if (type === "room") {
    const rows = await prisma.availability_roomavailability.findMany({
      where: { room_id: entityId },
    });
    for (const r of rows) {
      statusMap[`${Number(r.period_id)}_${r.day_of_week}`] = r.status;
    }
  } else if (type === "class") {
    const rows = await prisma.availability_schoolclassavailability.findMany({
      where: { school_class_id: entityId },
    });
    for (const r of rows) {
      if (allowedPeriodIds.has(r.period_id.toString())) {
        statusMap[`${Number(r.period_id)}_${r.day_of_week}`] = r.status;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    days,
    periods,
    statusMap,
    validFrom,
    validUntil,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const project = await getActiveProject(user);
  if (!user || !project) {
    return NextResponse.json(
      { ok: false, message: "Selecione um projeto ativo." },
      { status: 400 }
    );
  }

  const body = await request.json();
  const type = body.type || "teacher";
  const entityId = BigInt(body.id);
  const statusMap: Record<string, string> = body.statusMap || {};
  const validFrom = body.validFrom ? new Date(body.validFrom) : null;
  const validUntil = body.validUntil ? new Date(body.validUntil) : null;

  if (validFrom && validUntil && validFrom > validUntil) {
    return NextResponse.json(
      {
        ok: false,
        message: "A data inicial não pode ser maior que a data final.",
      },
      { status: 400 }
    );
  }

  const entries = Object.entries(statusMap).filter(
    ([, st]) => st && st !== "AVAILABLE"
  );

  if (type === "teacher") {
    await prisma.$transaction([
      prisma.availability_teacheravailability.deleteMany({
        where: { teacher_id: entityId },
      }),
      ...(entries.length > 0
        ? [
            prisma.availability_teacheravailability.createMany({
              data: entries.map(([key, st]) => {
                const [periodIdStr, ...dayParts] = key.split("_");
                return {
                  teacher_id: entityId,
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
        where: { id: entityId },
        data: { availability_updated_at: new Date() },
      }),
    ]);
  } else if (type === "room") {
    await prisma.$transaction([
      prisma.availability_roomavailability.deleteMany({
        where: { room_id: entityId },
      }),
      ...(entries.length > 0
        ? [
            prisma.availability_roomavailability.createMany({
              data: entries.map(([key, st]) => {
                const [periodIdStr, ...dayParts] = key.split("_");
                return {
                  room_id: entityId,
                  period_id: BigInt(periodIdStr),
                  day_of_week: dayParts.join("_"),
                  status: st,
                };
              }),
            }),
          ]
        : []),
    ]);
  } else if (type === "class") {
    await prisma.$transaction([
      prisma.availability_schoolclassavailability.deleteMany({
        where: { school_class_id: entityId },
      }),
      ...(entries.length > 0
        ? [
            prisma.availability_schoolclassavailability.createMany({
              data: entries.map(([key, st]) => {
                const [periodIdStr, ...dayParts] = key.split("_");
                return {
                  school_class_id: entityId,
                  period_id: BigInt(periodIdStr),
                  day_of_week: dayParts.join("_"),
                  status: st,
                };
              }),
            }),
          ]
        : []),
    ]);
  }

  return NextResponse.json({
    ok: true,
    message: "Disponibilidade salva com sucesso.",
  });
}
