import { NextResponse } from "next/server";
import { purgeExpiredTrash } from "@/lib/services/trashService";
import { isCronRequestAuthorized } from "@/lib/webhook-auth";

async function handle(request: Request) {
  if (!isCronRequestAuthorized(request)) return NextResponse.json({ ok: false, error: "Yetkisiz istek." }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await purgeExpiredTrash()) });
}

export async function GET(request: Request) { return handle(request); }
export async function POST(request: Request) { return handle(request); }
