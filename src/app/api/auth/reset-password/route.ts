import { NextResponse } from "next/server";
import { requestClientId, takeRateLimit } from "@/lib/rate-limit";
import { resetPassword } from "@/lib/services/passwordResetService";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { readJsonBody, requestBodyErrorResponse } from "@/lib/request-body";
import { rejectUntrustedMutation } from "@/lib/request-security";

export async function POST(request: Request) {
  const untrusted = rejectUntrustedMutation(request);
  if (untrusted) return untrusted;
  const rateLimit = takeRateLimit({ key: `auth:reset:${requestClientId(request)}`, limit: 8, windowMs: 60 * 60 * 1000 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Çok fazla deneme. Lütfen daha sonra tekrar deneyin." }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
  }

  let body: unknown;
  try {
    body = await readJsonBody(request, 8 * 1024);
  } catch (error) {
    return requestBodyErrorResponse(error) ?? NextResponse.json({ error: "İstek okunamadı." }, { status: 400 });
  }
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Form geçersiz." }, { status: 400 });
  const changed = await resetPassword(parsed.data.token, parsed.data.password);
  if (!changed) return NextResponse.json({ error: "Bağlantı geçersiz, kullanılmış veya süresi dolmuş." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
