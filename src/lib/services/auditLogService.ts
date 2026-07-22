import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditInput = {
  userId?: string | null;
  action: string;
  module: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonObject;
  organizationId: string;
  branchId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

export async function writeAuditLog(input: AuditInput) {
  return prisma.auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      module: input.module,
      entityId: input.entityId ?? null,
      metadata: input.metadata,
      organizationId: input.organizationId,
      branchId: input.branchId ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null
    }
  });
}
