import { NextResponse } from "next/server";
import { authCookieName, createSessionToken } from "@/lib/auth";
import { shouldUseSecureCookies } from "@/lib/auth-config";
import { loginSchema } from "@/lib/validations/auth";
import { authenticate } from "@/lib/services/authService";
import { writeAuditLog } from "@/lib/services/auditLogService";
import { requestClientId, takeRateLimit } from "@/lib/rate-limit";

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
    return NextResponse.json({ error: error instanceof Error ? error.message : "Giris yapilamadi." }, { status: 400 });
  }
}
