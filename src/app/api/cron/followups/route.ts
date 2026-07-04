import { NextResponse } from "next/server";
import { runDueFollowUps } from "@/lib/services/tourismService";
import { isCronRequestAuthorized } from "@/lib/webhook-auth";

async function handle(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Yetkisiz istek." }, { status: 401 });
  }

  const result = await runDueFollowUps();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
