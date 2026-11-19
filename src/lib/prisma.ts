import { PrismaClient } from "@prisma/client";

function resolveDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL || "";
  if (!envUrl) return "";

  try {
    const parsed = new URL(envUrl);

    // Ensure schema is set
    if (!parsed.searchParams.has("schema")) {
      parsed.searchParams.set("schema", "public");
    }

    // For Neon PgBouncer pooler endpoints, avoid channel_binding overhead and enable pgbouncer mode
    if (parsed.hostname.includes("-pooler")) {
      parsed.searchParams.delete("channel_binding");
      if (!parsed.searchParams.has("pgbouncer")) {
        parsed.searchParams.set("pgbouncer", "true");
      }
    }

    // Increase connection and pool timeouts to handle Neon scale-to-zero cold starts
    if (!parsed.searchParams.has("connect_timeout")) {
      parsed.searchParams.set("connect_timeout", "30");
    }
    if (!parsed.searchParams.has("pool_timeout")) {
      parsed.searchParams.set("pool_timeout", "30");
    }
    // Limit concurrent connections per worker so Promise.all bursts don't overwhelm the pooler
    if (!parsed.searchParams.has("connection_limit")) {
      parsed.searchParams.set("connection_limit", "5");
    }

    return parsed.toString();
  } catch {
    return envUrl.includes("schema=")
      ? envUrl
      : `${envUrl}${envUrl.includes("?") ? "&" : "?"}schema=public&connect_timeout=30&pool_timeout=30&connection_limit=5`;
  }
}

const TRANSIENT_ERROR_CODES = new Set(["P1001", "P1002", "P1008", "P1017", "P2024"]);

function isTransientConnectionError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: string }).code;
  if (code && TRANSIENT_ERROR_CODES.has(code)) return true;
  const msg = String((err as { message?: string }).message || "");
  return (
    msg.includes("Can't reach database server") ||
    msg.includes("Server has closed the connection") ||
    msg.includes("Timed out fetching a new connection") ||
    msg.includes("Connection reset by peer") ||
    msg.includes("Closed")
  );
}

function createPrismaClient() {
  const baseClient = new PrismaClient({
    datasources: {
      db: {
        url: resolveDatabaseUrl(),
      },
    },
  });

  return baseClient.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const maxRetries = 3;
          let lastError: unknown;
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              return await query(args);
            } catch (err) {
              lastError = err;
              if (attempt < maxRetries && isTransientConnectionError(err)) {
                const delayMs = attempt * 600;
                await new Promise((resolve) => setTimeout(resolve, delayMs));
                continue;
              }
              throw err;
            }
          }
          throw lastError;
        },
      },
    },
  }) as unknown as PrismaClient;
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaV2?: PrismaClient;
};

// Disconnect legacy cached client on HMR if upgrading to prismaV2
if (globalForPrisma.prisma && !globalForPrisma.prismaV2) {
  globalForPrisma.prisma.$disconnect().catch(() => {});
  delete globalForPrisma.prisma;
}

export const prisma = globalForPrisma.prismaV2 ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaV2 = prisma;
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
