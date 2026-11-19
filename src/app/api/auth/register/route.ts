import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      message:
        "O auto-cadastro está temporariamente desativado. Solicite a criação da sua conta ao administrador do sistema.",
    },
    { status: 403 }
  );
}
