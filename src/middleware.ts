import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authAudience, authCookieName, authIssuer, getAuthSecret } from "@/lib/auth-config";

const patientCookieName = "clinicnova_patient_session";

async function verifyToken(token: string | undefined, expectedKind: "patient" | "staff") {
  if (!token) return false;

  try {
    const { payload } = await jwtVerify(token, getAuthSecret(), {
      issuer: authIssuer,
      audience: authAudience
    });
    if (expectedKind === "patient") return payload.kind === "patient";
    return payload.kind === "staff";
  } catch {
    return false;
  }
}

function redirectToLogin(request: NextRequest, loginPath: string) {
  const loginUrl = new URL(loginPath, request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/portal")) {
    if (pathname === "/portal/login" || pathname === "/portal/register") {
      return NextResponse.next();
    }

    const authorized = await verifyToken(request.cookies.get(patientCookieName)?.value, "patient");
    return authorized ? NextResponse.next() : redirectToLogin(request, "/portal/login");
  }

  const authorized = await verifyToken(request.cookies.get(authCookieName)?.value, "staff");
  return authorized ? NextResponse.next() : redirectToLogin(request, "/login");
}

export const config = {
  matcher: ["/dashboard/:path*", "/portal/:path*", "/mobile-connect"]
};
