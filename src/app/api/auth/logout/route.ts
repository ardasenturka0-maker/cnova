import { NextResponse } from "next/server";
import { authCookieName } from "@/lib/auth";
import { shouldUseSecureCookies } from "@/lib/auth-config";
import { rejectUntrustedMutation } from "@/lib/request-security";

export async function POST(request: Request) {
  const untrusted = rejectUntrustedMutation(request);
  if (untrusted) return untrusted;
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
