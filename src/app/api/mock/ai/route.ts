import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo-mode";
import { getAiAssistantSuggestion } from "@/lib/services/aiAssistantService";
import { readJsonBody, requestBodyErrorResponse } from "@/lib/request-body";
import { rejectUntrustedMutation } from "@/lib/request-security";

const payloadSchema = z.object({ topic: z.enum(["patient", "appointments", "finance", "stock", "general"]).default("general"), prompt: z.string().trim().max(4000).optional() });

export async function POST(request: Request) {
  if (!isDemoMode()) return NextResponse.json({ error: "Bu demo endpoint'i üretimde kapalıdır." }, { status: 404 });
  const untrusted = rejectUntrustedMutation(request);
  if (untrusted) return untrusted;
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  try {
    const payload = payloadSchema.parse(await readJsonBody(request));
    const result = await getAiAssistantSuggestion(payload);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return requestBodyErrorResponse(error) ?? NextResponse.json({ error: "İstek geçersiz." }, { status: 400 });
  }
}
