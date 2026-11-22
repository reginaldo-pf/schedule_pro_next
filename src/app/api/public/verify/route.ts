import { NextResponse } from "next/server";
import { verifyAltchaPayload } from "@/lib/altcha";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const isValid = await verifyAltchaPayload(body?.altcha);
  if (!isValid) {
    return NextResponse.json(
      {
        ok: false,
        message: "Complete a verificação de segurança (Não sou um robô) antes de continuar.",
      },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
