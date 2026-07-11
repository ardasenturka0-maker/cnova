import { NextResponse } from "next/server";
import { registerClinic } from "@/lib/services/authService";
import { registerSchema } from "@/lib/validations/auth";
import { requestClientId, takeRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
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
    const payload = registerSchema.parse(await request.json());
    const result = await registerClinic(payload);
    return NextResponse.json(
      {
        organizationId: result.organization.id,
        userId: result.user.id
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Klinik hesabi olusturulamadi." }, { status: 400 });
  }
}
