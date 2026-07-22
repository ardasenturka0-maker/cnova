import { decryptMfaSecret, hashRecoveryCode, verifyTotp } from "@/lib/mfa";
import { prisma } from "@/lib/prisma";

export type MfaLoginResult = "not_required" | "required" | "verified" | "invalid";

export async function verifyMfaForLogin(userId: string, code?: string): Promise<MfaLoginResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaEnabledAt: true, mfaSecretEncrypted: true, mfaRecoveryCodeHashes: true, mfaLastUsedCounter: true }
  });
  if (!user?.mfaEnabledAt || !user.mfaSecretEncrypted) return "not_required";
  if (!code) return "required";

  const hashes = Array.isArray(user.mfaRecoveryCodeHashes)
    ? user.mfaRecoveryCodeHashes.filter((item): item is string => typeof item === "string")
    : [];
  const recoveryHash = hashRecoveryCode(code);
  if (hashes.includes(recoveryHash)) {
    const consumed = await prisma.$executeRaw`
      UPDATE "User"
         SET "mfaRecoveryCodeHashes" = COALESCE(
           (SELECT jsonb_agg(value) FROM jsonb_array_elements_text("mfaRecoveryCodeHashes") AS value WHERE value <> ${recoveryHash}),
           '[]'::jsonb
         )
       WHERE "id" = ${userId}
         AND "mfaRecoveryCodeHashes" @> ${JSON.stringify([recoveryHash])}::jsonb
    `;
    return consumed === 1 ? "verified" : "invalid";
  }

  const counter = verifyTotp(decryptMfaSecret(user.mfaSecretEncrypted), code);
  if (counter === null || counter <= user.mfaLastUsedCounter) return "invalid";
  const consumed = await prisma.user.updateMany({
    where: { id: userId, mfaEnabledAt: { not: null }, mfaLastUsedCounter: { lt: counter } },
    data: { mfaLastUsedCounter: counter }
  });
  return consumed.count === 1 ? "verified" : "invalid";
}
