import crypto from "crypto";

const REPORT_VERIFY_SECRET =
  process.env.CERT_VERIFY_SECRET ||
  process.env.SESSION_SECRET ||
  process.env.JWT_SECRET ||
  "schedule-pro-corporate-verify-secret-2026";

export type VerifyTokenType = "class" | "teacher" | "workload" | "certificate";

export interface VerifyTokenPayload {
  type: VerifyTokenType;
  projectId: number;
  targetId: number; // classId, teacherId, or 0 for all
}

function sign(raw: string): string {
  return crypto
    .createHmac("sha256", REPORT_VERIFY_SECRET)
    .update(raw)
    .digest("base64url")
    .slice(0, 16);
}

export function makeReportVerifyToken(payload: VerifyTokenPayload): string {
  const raw = `${payload.type}-${payload.projectId}-${payload.targetId}`;
  return `${raw}.${sign(raw)}`;
}

export function parseAndVerifyReportToken(
  token: string
): VerifyTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [raw, sig] = parts;
  if (!raw || !sig || sig !== sign(raw)) return null;

  const [type, projectIdStr, targetIdStr] = raw.split("-");
  if (
    type !== "class" &&
    type !== "teacher" &&
    type !== "workload" &&
    type !== "certificate"
  ) {
    return null;
  }
  const projectId = Number(projectIdStr);
  const targetId = Number(targetIdStr);
  if (Number.isNaN(projectId) || Number.isNaN(targetId)) return null;

  return {
    type,
    projectId,
    targetId,
  };
}

export function makeDocumentSerial(
  prefix: string,
  projectId: number | bigint,
  targetId?: number | bigint | null
): string {
  const year = new Date().getFullYear();
  const pId = String(projectId).padStart(2, "0");
  const tId = targetId ? String(targetId).padStart(4, "0") : "0000";
  const hash = sign(`${prefix}-${projectId}-${targetId || 0}`)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
  return `SP-${prefix}-${year}-${pId}${tId}-${hash}`;
}
