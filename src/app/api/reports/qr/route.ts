import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import {
  makeReportVerifyToken,
  type VerifyTokenType,
} from "@/lib/reports/verify-token";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const type = (sp.get("type") || "class") as VerifyTokenType;
  const projectId = Number(sp.get("projectId") || 0);
  const targetId = Number(sp.get("targetId") || 0);

  const origin =
    req.headers.get("x-forwarded-host") && req.headers.get("x-forwarded-proto")
      ? `${req.headers.get("x-forwarded-proto")}://${req.headers.get(
          "x-forwarded-host"
        )}`
      : req.nextUrl.origin;

  const token = makeReportVerifyToken({ type, projectId, targetId });
  const verifyUrl = `${origin}/reports/verify/${token}`;

  const svg = await QRCode.toString(verifyUrl, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
  });

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
