import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { requestClientId, takeRateLimit } from "@/lib/rate-limit";
import { requestPasswordReset } from "@/lib/services/passwordResetService";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { readJsonBody, requestBodyErrorResponse } from "@/lib/request-body";
import { rejectUntrustedMutation } from "@/lib/request-security";

export async function POST(request: Request) {
  const untrusted = rejectUntrustedMutation(request);
  if (untrusted) return untrusted;
  const rateLimit = takeRateLimit({ key: `auth:forgot:${requestClientId(request)}`, limit: 5, windowMs: 60 * 60 * 1000 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Çok fazla deneme. Lütfen daha sonra tekrar deneyin." }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
  }

  let body: unknown;
  try {
    body = await readJsonBody(request, 8 * 1024);
  } catch (error) {
    return requestBodyErrorResponse(error) ?? NextResponse.json({ error: "İstek okunamadı." }, { status: 400 });
  }
  const parsed = forgotPasswordSchema.safeParse(body);
  if (parsed.success) {
    const accountKey = createHash("sha256").update(parsed.data.email).digest("base64url");
    const accountRateLimit = takeRateLimit({ key: `auth:forgot-account:${accountKey}`, limit: 3, windowMs: 60 * 60 * 1000 });
    if (accountRateLimit.allowed) await requestPasswordReset(parsed.data.email).catch(() => undefined);
  }
  return NextResponse.json({ ok: true, message: "Hesap bulunursa şifre yenileme bağlantısı e-posta ile gönderilir." });
}
