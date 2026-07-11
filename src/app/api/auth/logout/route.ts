import { NextResponse } from "next/server";
import { authCookieName } from "@/lib/auth";
import { shouldUseSecureCookies } from "@/lib/auth-config";

export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(authCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(request),
    path: "/",
    maxAge: 0
  });
  return response;
}
