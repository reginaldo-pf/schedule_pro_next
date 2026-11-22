import { NextResponse } from "next/server";
import { generateAltchaChallenge } from "@/lib/altcha";

export const dynamic = "force-dynamic";

export async function GET() {
  const challenge = await generateAltchaChallenge();
  return NextResponse.json(challenge, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
