import { prisma } from "../src/lib/prisma";
import { verifyAuditIntegrity } from "../src/lib/services/auditIntegrityService";

async function main() {
  const result = await verifyAuditIntegrity(process.env.AUDIT_VERIFY_ORGANIZATION_ID);
  if (!result.valid) throw new Error(`Audit zinciri doğrulanamadı:\n${result.errors.join("\n")}`);
  console.log(`Audit zinciri geçerli: ${result.checked} kayıt, ${result.organizations} tenant.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
