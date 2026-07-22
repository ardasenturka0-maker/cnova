import { Role } from "@prisma/client";
import { loginWithPassword } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

export async function authenticate(email: string, password: string) {
  return loginWithPassword(email, password);
}

export async function registerClinic(input: {
  clinicName: string;
  fullName: string;
  email: string;
  password: string;
}) {
  const normalizedEmail = input.email.trim().toLowerCase();
  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } });
  if (existingUser) throw new Error("Bu e-posta adresiyle zaten bir hesap var.");

  const slug = input.clinicName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const passwordHash = await hashPassword(input.password);

  return prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: input.clinicName,
        slug: `${slug || "clinic"}-${Date.now()}`,
        plan: "Baslangic"
      }
    });

    const branch = await tx.branch.create({
      data: {
        name: "Merkez Klinik",
        city: "Belirtilmedi",
        organizationId: organization.id
      }
    });

    const user = await tx.user.create({
      data: {
        name: input.fullName,
        email: normalizedEmail,
        passwordHash,
        role: Role.CLINIC_OWNER,
        organizationId: organization.id,
        branchId: branch.id
      }
    });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "REGISTER",
        module: "auth",
        organizationId: organization.id,
        branchId: branch.id,
        metadata: { plan: "Baslangic" }
      }
    });

    return { organization, branch, user };
  });
}
