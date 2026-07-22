import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  clinicName: z.string().trim().min(2),
  clinicSlug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  branchName: z.string().trim().min(2),
  branchCity: z.string().trim().min(2),
  branchAddress: z.string().trim().optional(),
  branchPhone: z.string().trim().optional(),
  ownerName: z.string().trim().min(2),
  ownerEmail: z.string().trim().toLowerCase().email(),
  ownerPassword: z.string().min(12).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/)
});

const input = schema.safeParse({
  clinicName: process.env.CLINIC_NAME,
  clinicSlug: process.env.CLINIC_SLUG,
  branchName: process.env.BRANCH_NAME,
  branchCity: process.env.BRANCH_CITY,
  branchAddress: process.env.BRANCH_ADDRESS || undefined,
  branchPhone: process.env.BRANCH_PHONE || undefined,
  ownerName: process.env.OWNER_NAME,
  ownerEmail: process.env.OWNER_EMAIL,
  ownerPassword: process.env.OWNER_PASSWORD
});

if (!input.success) {
  console.error("Klinik başlangıç bilgileri eksik veya geçersiz:");
  for (const issue of input.error.issues) console.error(`- ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const existing = await prisma.organization.findUnique({ where: { slug: input.data.clinicSlug }, select: { id: true } });
  const existingOwner = await prisma.user.findUnique({ where: { email: input.data.ownerEmail }, select: { id: true } });
  if (existing || existingOwner) throw new Error("Aynı klinik kodu veya yönetici e-postası zaten var; ikinci kez başlangıç kurulumu yapılmadı.");

  const passwordHash = await bcrypt.hash(input.data.ownerPassword, 12);
  const result = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: { name: input.data.clinicName, slug: input.data.clinicSlug, plan: "Klinik" }
    });
    const branch = await tx.branch.create({
      data: {
        name: input.data.branchName,
        city: input.data.branchCity,
        address: input.data.branchAddress,
        phone: input.data.branchPhone,
        organizationId: organization.id
      }
    });
    const owner = await tx.user.create({
      data: {
        name: input.data.ownerName,
        email: input.data.ownerEmail,
        passwordHash,
        role: Role.CLINIC_OWNER,
        organizationId: organization.id,
        branchId: branch.id
      }
    });
    await tx.auditLog.create({
      data: {
        userId: owner.id,
        action: "CLINIC_BOOTSTRAP",
        module: "auth",
        organizationId: organization.id,
        branchId: branch.id,
        metadata: { source: "clinic:bootstrap" }
      }
    });
    return { organization, branch, owner };
  });
  console.log(`Klinik hazır: ${result.organization.name} (${result.organization.slug})`);
  console.log(`Şube: ${result.branch.name}`);
  console.log(`Yönetici: ${result.owner.email}`);
  console.log("İlk girişten sonra 2FA etkinleştirin.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
