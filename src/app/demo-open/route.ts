import { NextResponse } from "next/server";
import { authCookieName, createSessionToken, loginWithPassword } from "@/lib/auth";
import { shouldUseSecureCookies } from "@/lib/auth-config";
import { isDemoMode } from "@/lib/demo-mode";

export async function GET(request: Request) {
  if (!isDemoMode()) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const session = await loginWithPassword("owner@clinicnova.test", "password123");
  if (!session) {
    return NextResponse.redirect(new URL("/login?error=demo", request.url));
  }

  const token = await createSessionToken(session);
  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  response.cookies.set(authCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(request),
    priority: "high",
    path: "/",
    maxAge: 60 * 60 * 8
  });
  return response;
}
