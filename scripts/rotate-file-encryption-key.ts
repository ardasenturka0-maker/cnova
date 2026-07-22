import { prisma } from "../src/lib/prisma";
import { reencryptStoredPatientFile } from "../src/lib/secure-file-storage";

async function main() {
  if (!process.env.FILE_ENCRYPTION_KEYS || !process.env.FILE_ENCRYPTION_ACTIVE_KEY_ID) {
    throw new Error("FILE_ENCRYPTION_KEYS ve FILE_ENCRYPTION_ACTIVE_KEY_ID gerekli.");
  }
  let cursor: string | undefined;
  let rotated = 0;
  for (;;) {
    const files = await prisma.patientFile.findMany({
      where: { storageKey: { not: null } },
      select: { id: true, storageKey: true, checksumSha256: true },
      orderBy: { id: "asc" }, take: 100,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
    });
    if (!files.length) break;
    for (const file of files) {
      if (!file.storageKey) continue;
      await reencryptStoredPatientFile(file.storageKey, file.checksumSha256);
      rotated += 1;
    }
    cursor = files.at(-1)!.id;
    console.log(`${rotated} dosya yeniden şifrelendi.`);
  }
  console.log(`Anahtar rotasyonu tamamlandı: ${rotated} dosya.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
