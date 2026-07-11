import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { demoRequestSchema } from "@/lib/validations/demo";
import { requestClientId, takeRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const rateLimit = takeRateLimit({
    key: `demo-request:${requestClientId(request)}`,
    limit: 5,
    windowMs: 60 * 60 * 1000
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Çok fazla demo talebi gönderildi. Lütfen daha sonra tekrar deneyin." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  try {
    const payload = demoRequestSchema.parse(await request.json());
    const demoRequest = await prisma.demoRequest.create({
      data: {
        fullName: payload.fullName,
        clinicName: payload.clinicName,
        phone: payload.phone,
        email: payload.email,
        city: payload.city,
        clinicSize: payload.clinicSize,
        message: payload.message || null
      }
    });
    return NextResponse.json({ demoRequest }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Demo talebi kaydedilemedi." }, { status: 400 });
  }
}
