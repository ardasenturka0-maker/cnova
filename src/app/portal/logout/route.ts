import { NextResponse } from "next/server";
import { patientCookieName } from "@/lib/patient-auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = new URL("/portal/login", url);
  if (url.searchParams.get("reason") === "inactive") target.searchParams.set("error", "inactive");
  const response = NextResponse.redirect(target);
  response.cookies.set(patientCookieName, "", { httpOnly: true, sameSite: "lax", secure: url.protocol === "https:", path: "/", maxAge: 0 });
  return response;
}
