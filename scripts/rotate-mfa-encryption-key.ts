import { prisma } from "../src/lib/prisma";
import { reencryptMfaSecret } from "../src/lib/mfa";

async function main() {
  if (!process.env.MFA_ENCRYPTION_KEYS || !process.env.MFA_ENCRYPTION_ACTIVE_KEY_ID) throw new Error("MFA_ENCRYPTION_KEYS ve MFA_ENCRYPTION_ACTIVE_KEY_ID gerekli.");
  const users = await prisma.user.findMany({
    where: { OR: [{ mfaSecretEncrypted: { not: null } }, { mfaPendingSecretEncrypted: { not: null } }] },
    select: { id: true, mfaSecretEncrypted: true, mfaPendingSecretEncrypted: true }
  });
  for (const user of users) {
    await prisma.user.update({ where: { id: user.id }, data: {
      mfaSecretEncrypted: user.mfaSecretEncrypted ? reencryptMfaSecret(user.mfaSecretEncrypted) : null,
      mfaPendingSecretEncrypted: user.mfaPendingSecretEncrypted ? reencryptMfaSecret(user.mfaPendingSecretEncrypted) : null
    } });
  }
  console.log(`MFA anahtar rotasyonu tamamlandı: ${users.length} kullanıcı.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
