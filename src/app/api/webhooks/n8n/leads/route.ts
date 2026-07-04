import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createOrUpdateLeadFromIntake } from "@/lib/services/tourismService";
import { tourismLeadSchema } from "@/lib/validations/tourism";
import { isWebhookRequestAuthorized } from "@/lib/webhook-auth";

async function getWebhookTenant() {
  const organization = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!organization) throw new Error("Organizasyon bulunamadı.");
  const branch = await prisma.branch.findFirst({ where: { organizationId: organization.id }, orderBy: { createdAt: "asc" } });
  if (!branch) throw new Error("Şube bulunamadı.");
  return { organization, branch };
}

export async function POST(request: Request) {
  if (!isWebhookRequestAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Yetkisiz istek." }, { status: 401 });
  }

  try {
    const payload = tourismLeadSchema.parse(await request.json());
    const { organization, branch } = await getWebhookTenant();
    const result = await createOrUpdateLeadFromIntake(
      {
        ...payload,
        sourceChannel: payload.sourceChannel === "MANUAL" ? "N8N_WEBHOOK" : payload.sourceChannel
      },
      { organizationId: organization.id, branchId: branch.id }
    );

    return NextResponse.json({ ok: true, duplicate: result.duplicate, leadId: result.lead.id });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Lead webhook işlenemedi." }, { status: 400 });
  }
}
