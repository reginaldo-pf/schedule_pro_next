import { NextResponse } from "next/server";
import { getCurrentUser, getActiveProject } from "@/lib/auth";
import { ScheduleGenerationService } from "@/lib/schedule/solver";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const project = await getActiveProject(user);
    if (!user || !project) {
      return NextResponse.json(
        { ok: false, message: "Selecione um projeto ativo." },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    let classIds: number[] | null = null;
    if (body.class_ids) {
      classIds = (Array.isArray(body.class_ids) ? body.class_ids : [body.class_ids])
        .map(Number)
        .filter(Boolean);
    }

    const result = await ScheduleGenerationService.run({
      projectId: project.id,
      user,
      persist: true,
      classIds,
    });

    const isOk =
      result.run.status === "SATISFIABLE" || result.run.status === "PARTIAL";
    const statusCode =
      result.run.status === "INVALID"
        ? 422
        : !isOk
        ? 409
        : 200;

    return NextResponse.json(
      {
        ok: isOk,
        persisted: true,
        run: result.run,
        entries: result.entries,
      },
      { status: statusCode }
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Erro ao executar geração de horários.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
