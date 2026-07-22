import { CommunicationChannel } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo-mode";
import { sendMessage } from "@/lib/services/notificationService";
import { getWritableBranchId } from "@/lib/services/tenantService";
import { canAccess } from "@/lib/rbac";
import { readJsonBody, requestBodyErrorResponse } from "@/lib/request-body";
import { rejectUntrustedMutation } from "@/lib/request-security";
import { publicErrorMessage } from "@/lib/public-error";

const payloadSchema = z.object({
  to: z.string().trim().min(3).max(240),
  message: z.string().trim().min(1).max(10_000),
  patientId: z.string().trim().max(128).optional(),
  channel: z.nativeEnum(CommunicationChannel).optional()
});

export async function POST(request: Request) {
  if (!isDemoMode()) return NextResponse.json({ error: "Bu demo endpoint'i üretimde kapalıdır." }, { status: 404 });
  const untrusted = rejectUntrustedMutation(request);
  if (untrusted) return untrusted;
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
    if (!canAccess(session.role, "communication")) return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
    const branchId = await getWritableBranchId(session);
    const payload = payloadSchema.parse(await readJsonBody(request));

    const result = await sendMessage({
      organizationId: session.organizationId,
      branchId,
      patientId: payload.patientId,
      to: payload.to,
      message: payload.message,
      channel: payload.channel ?? CommunicationChannel.WHATSAPP
    });

    return NextResponse.json(result);
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    return NextResponse.json({ error: publicErrorMessage(error, "Bildirim gonderilemedi.") }, { status: 400 });
  }
}
