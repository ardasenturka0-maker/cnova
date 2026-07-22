import { NextResponse } from "next/server";
import { registerClinic } from "@/lib/services/authService";
import { registerSchema } from "@/lib/validations/auth";
import { requestClientId, takeRateLimit } from "@/lib/rate-limit";
import { readJsonBody, requestBodyErrorResponse } from "@/lib/request-body";
import { rejectUntrustedMutation } from "@/lib/request-security";

export async function POST(request: Request) {
  const untrusted = rejectUntrustedMutation(request);
  if (untrusted) return untrusted;
  const rateLimit = takeRateLimit({
    key: `auth:register:${requestClientId(request)}`,
    limit: 5,
    windowMs: 60 * 60 * 1000
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Çok fazla hesap oluşturma denemesi. Lütfen daha sonra tekrar deneyin." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  try {
    const parsed = registerSchema.safeParse(await readJsonBody(request, 16 * 1024));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Kayıt formu geçersiz." }, { status: 400 });
    const result = await registerClinic(parsed.data);
    return NextResponse.json(
      {
        organizationId: result.organization.id,
        userId: result.user.id
      },
      { status: 201 }
    );
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    const message = error instanceof Error && error.message === "Bu e-posta adresiyle zaten bir hesap var."
      ? error.message
      : "Klinik hesabı oluşturulamadı. Bilgileri kontrol edip tekrar deneyin.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
