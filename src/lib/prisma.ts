import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function resolveDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL || "";
  if (!envUrl) return "";
  return envUrl.includes("schema=")
    ? envUrl
    : `${envUrl}${envUrl.includes("?") ? "&" : "?"}schema=public`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: resolveDatabaseUrl(),
      },
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Formats a Prisma @db.Time(6) Date object (stored as 1970-01-01T...) to "HH:MM"
 */
export function formatTime(date: Date | null | undefined): string {
  if (!date) return "";
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * Parses a "HH:MM" string into a Date object suitable for Prisma @db.Time(6)
 */
export function parseTimeToDate(timeStr: string | null | undefined): Date | null {
  if (!timeStr || !timeStr.includes(":")) return null;
  const [h, m] = timeStr.split(":").map((v) => parseInt(v, 10));
  if (isNaN(h) || isNaN(m)) return null;
  return new Date(Date.UTC(1970, 0, 1, h, m, 0));
}

/**
 * Formats a Prisma @db.Date Date object to "YYYY-MM-DD"
 */
export function formatDateISO(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toISOString().split("T")[0];
}
