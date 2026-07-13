import { PrismaClient } from "@prisma/client";
import { deleteStoredPatientFile, preparePatientUpload, storePatientFile } from "../src/lib/secure-file-storage";

const prisma = new PrismaClient();

async function main() {
  const files = await prisma.patientFile.findMany({ where: { storageKey: null, data: { not: null } } });
  let migrated = 0;
  for (const file of files) {
    if (!file.data) continue;
    const prepared = await preparePatientUpload(Buffer.from(file.data));
    const storageKey = await storePatientFile(file.organizationId, file.patientId, prepared);
    try {
      await prisma.patientFile.update({ where: { id: file.id }, data: { storageKey, checksumSha256: prepared.checksumSha256, storedMimeType: prepared.mimeType, mimeType: prepared.mimeType, size: prepared.bytes.length, data: null } });
      migrated += 1;
    } catch (error) {
      await deleteStoredPatientFile(storageKey);
      throw error;
    }
  }
  console.log(`${migrated} hasta dosyası şifreli dosya alanına taşındı.`);
}

main().finally(() => prisma.$disconnect());
