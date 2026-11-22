import { createChallenge, verifySolution } from "altcha-lib/v1";

const ALTCHA_HMAC_KEY =
  process.env.ALTCHA_HMAC_KEY ||
  process.env.AUTH_SECRET ||
  "schedule-pro-next-altcha-hmac-key-2026-railway";

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const usedChallenges = new Map<string, number>();

function cleanupUsedChallenges(now: number) {
  if (usedChallenges.size < 500) return;
  for (const [key, expiresAt] of usedChallenges.entries()) {
    if (expiresAt <= now) {
      usedChallenges.delete(key);
    }
  }
}

export async function generateAltchaChallenge() {
  return await createChallenge({
    hmacKey: ALTCHA_HMAC_KEY,
    maxNumber: 50000,
    expires: new Date(Date.now() + CHALLENGE_TTL_MS),
  });
}

export async function verifyAltchaPayload(
  payload: string | null | undefined
): Promise<boolean> {
  if (!payload || typeof payload !== "string") {
    return false;
  }

  let decodedKey = "";
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64").toString("utf-8")
    ) as { challenge?: string; salt?: string };
    if (!parsed?.challenge || !parsed?.salt) {
      return false;
    }
    decodedKey = `${parsed.salt}:${parsed.challenge}`;
  } catch {
    return false;
  }

  const now = Date.now();
  cleanupUsedChallenges(now);

  const existingExpiry = usedChallenges.get(decodedKey);
  if (existingExpiry && existingExpiry > now) {
    return false;
  }

  const isValid = await verifySolution(payload, ALTCHA_HMAC_KEY, true);
  if (!isValid) {
    return false;
  }

  usedChallenges.set(decodedKey, now + CHALLENGE_TTL_MS);
  return true;
}
