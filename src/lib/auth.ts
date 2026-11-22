import crypto from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const SESSION_COOKIE_NAME = "sp_session";
const SECRET_KEY = new TextEncoder().encode(
  process.env.AUTH_SECRET || "schedule-pro-next-super-secret-jwt-key-2026-railway"
);

export interface SessionPayload {
  userId: number;
  username: string;
  email: string;
  isSuperuser: boolean;
  isStaff: boolean;
  profile: string;
  activeProjectId?: number | null;
}

/**
 * Verifies a password against a Django pbkdf2_sha256 hash
 * Format: pbkdf2_sha256$<iterations>$<salt>$<hash_base64>
 */
export function verifyDjangoPassword(password: string, encoded: string): boolean {
  if (!encoded || !encoded.startsWith("pbkdf2_sha256$")) {
    return false;
  }
  const parts = encoded.split("$");
  if (parts.length !== 4) return false;
  const [, iterationsStr, salt, expectedHash] = parts;
  const iterations = parseInt(iterationsStr, 10);
  if (isNaN(iterations) || iterations <= 0) return false;

  const derivedKey = crypto.pbkdf2Sync(
    password,
    salt,
    iterations,
    32,
    "sha256"
  );
  const actualHash = derivedKey.toString("base64");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(actualHash),
      Buffer.from(expectedHash)
    );
  } catch {
    return actualHash === expectedHash;
  }
}

/**
 * Generates a Django-compatible pbkdf2_sha256 password hash
 */
export function hashDjangoPassword(password: string, iterations = 720000): string {
  const salt = crypto.randomBytes(12).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 22);
  const derivedKey = crypto.pbkdf2Sync(
    password,
    salt,
    iterations,
    32,
    "sha256"
  );
  const hashBase64 = derivedKey.toString("base64");
  return `pbkdf2_sha256$${iterations}$${salt}$${hashBase64}`;
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET_KEY);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(payload: SessionPayload) {
  const token = await createSessionToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return await verifySessionToken(token);
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.accounts_user.findUnique({
    where: { id: BigInt(session.userId) },
    include: {
      plans_subscription: {
        include: {
          plans_plan: true,
        },
      },
    },
  });

  if (!user || !user.is_active) return null;
  return user;
}

export async function getActiveProject(user?: Awaited<ReturnType<typeof getCurrentUser>>) {
  const session = await getSession();
  if (!session) return null;

  const resolvedUser = user !== undefined ? user : await getCurrentUser();
  if (!resolvedUser) return null;

  let projectId = session.activeProjectId ? BigInt(session.activeProjectId) : null;

  if (projectId) {
    const project = await prisma.schedules_project.findFirst({
      where: {
        id: projectId,
        OR: resolvedUser.is_superuser
          ? undefined
          : [
              { owner_id: resolvedUser.id },
              {
                schedules_projectparticipant: {
                  some: {
                    user_id: resolvedUser.id,
                    active: true,
                  },
                },
              },
            ],
      },
    });
    if (project) return project;
  }

  // Fallback: get first owned or participating project
  const fallbackProject = await prisma.schedules_project.findFirst({
    where: resolvedUser.is_superuser
      ? {}
      : {
          OR: [
            { owner_id: resolvedUser.id },
            {
              schedules_projectparticipant: {
                some: {
                  user_id: resolvedUser.id,
                  active: true,
                },
              },
            },
          ],
        },
    orderBy: { id: "asc" },
  });

  return fallbackProject;
}

export const PORTAL_TOKEN_TTL_SECONDS = 48 * 60 * 60;

export function isPortalTokenActive(
  lastInvitedAt: Date | null | undefined,
  nowMs = Date.now()
): boolean {
  if (!lastInvitedAt) return false;
  return nowMs - lastInvitedAt.getTime() < PORTAL_TOKEN_TTL_SECONDS * 1000;
}

/**
 * Generates a signed 48-hour Teacher Portal token.
 * When `issuedAtDate` is provided, `iat` and `exp` are derived deterministically from it.
 */
export async function generatePortalToken(
  teacherId: number,
  projectId: number,
  issuedAtDate?: Date
): Promise<string> {
  const iatSeconds = Math.floor(
    (issuedAtDate ? issuedAtDate.getTime() : Date.now()) / 1000
  );
  return await new SignJWT({ teacherId, projectId, purpose: "teacher_portal" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(iatSeconds)
    .setExpirationTime(iatSeconds + PORTAL_TOKEN_TTL_SECONDS)
    .sign(SECRET_KEY);
}

export async function verifyPortalToken(
  token: string
): Promise<{ teacherId: number; projectId: number } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    if (
      typeof payload.teacherId === "number" &&
      typeof payload.projectId === "number"
    ) {
      return {
        teacherId: payload.teacherId,
        projectId: payload.projectId,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Generates a signed 72-hour User Account Confirmation token
 */
export async function generateUserConfirmationToken(
  userId: number,
  email: string
): Promise<string> {
  return await new SignJWT({
    userId,
    email,
    purpose: "user_confirmation",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("72h")
    .sign(SECRET_KEY);
}

export async function verifyUserConfirmationToken(
  token: string
): Promise<{ userId: number; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    if (
      payload.purpose === "user_confirmation" &&
      typeof payload.userId === "number" &&
      typeof payload.email === "string"
    ) {
      return {
        userId: payload.userId,
        email: payload.email,
      };
    }
    return null;
  } catch {
    return null;
  }
}


