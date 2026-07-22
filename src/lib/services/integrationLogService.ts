import { IntegrationLogStatus, IntegrationProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function jsonSafe(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export async function writeIntegrationLog(input: {
  organizationId: string;
  branchId?: string | null;
  provider: IntegrationProvider;
  eventType: string;
  payloadJson: unknown;
  responseJson?: unknown;
  status?: IntegrationLogStatus;
  errorMessage?: string | null;
}) {
  return prisma.integrationLog.create({
    data: {
      organizationId: input.organizationId,
      branchId: input.branchId ?? null,
      provider: input.provider,
      eventType: input.eventType,
      payloadJson: jsonSafe(input.payloadJson),
      responseJson: jsonSafe(input.responseJson ?? { ok: true }),
      status: input.status ?? IntegrationLogStatus.SUCCESS,
      errorMessage: input.errorMessage ?? null
    }
  });
}
