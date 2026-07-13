import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { authCookieName, createSessionToken } from "@/lib/auth";
import { shouldUseSecureCookies } from "@/lib/auth-config";
import { loginSchema } from "@/lib/validations/auth";
import { authenticate } from "@/lib/services/authService";
import { writeAuditLog } from "@/lib/services/auditLogService";
import { requestClientId, takeRateLimit } from "@/lib/rate-limit";
import { isDemoMode } from "@/lib/demo-mode";
import { verifyMfaForLogin } from "@/lib/services/mfaService";

export async function POST(request: Request) {
  const rateLimit = takeRateLimit({
    key: `auth:login:${requestClientId(request)}`,
    limit: 10,
    windowMs: 15 * 60 * 1000
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Çok fazla giriş denemesi. Lütfen daha sonra tekrar deneyin." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  try {
    const payload = loginSchema.parse(await request.json());
    const session = await authenticate(payload.email, payload.password);

    if (!session) {
      return NextResponse.json({ error: "E-posta veya sifre hatali." }, { status: 401 });
    }

    if (!isDemoMode()) {
      const result = await verifyMfaForLogin(session.userId, payload.mfaCode);
      if (result === "required") return NextResponse.json({ mfaRequired: true }, { status: 202 });
      if (result === "invalid") return NextResponse.json({ error: "Doğrulama kodu geçersiz veya daha önce kullanılmış." }, { status: 401 });
    }

    const token = await createSessionToken(session);
    const response = NextResponse.json({ user: session });
    response.cookies.set(authCookieName, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: shouldUseSecureCookies(request),
      priority: "high",
      path: "/",
      maxAge: 60 * 60 * 8
    });

    await writeAuditLog({
      userId: session.userId,
      action: "LOGIN",
      module: "auth",
      organizationId: session.organizationId,
      branchId: session.branchId
    });

    return response;
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "Giriş bilgileri geçersiz." }, { status: 400 });
    console.error("Staff login failed", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: "Giriş şu anda tamamlanamadı." }, { status: 500 });
  }
}
