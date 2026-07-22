import type { AuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getWritableBranchId(session: AuthSession) {
  if (session.branchId) {
    const assignedBranch = await prisma.branch.findFirst({
      where: { id: session.branchId, organizationId: session.organizationId },
      select: { id: true }
    });
    if (assignedBranch) return assignedBranch.id;
  }

  const branch = await prisma.branch.findFirst({
    where: { organizationId: session.organizationId },
    orderBy: { createdAt: "asc" },
    select: { id: true }
  });

  if (!branch) {
    throw new Error("Bu organizasyon icin sube bulunamadi.");
  }

  return branch.id;
}

export async function getBranches(organizationId: string) {
  return prisma.branch.findMany({
    where: { organizationId },
    orderBy: { name: "asc" }
  });
}
