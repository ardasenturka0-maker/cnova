import "server-only";

import { headers } from "next/headers";
import { takeRateLimit } from "@/lib/rate-limit";

export async function allowServerAction(scope: string, limit: number, windowMs: number) {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientId = forwarded ?? requestHeaders.get("x-real-ip") ?? "unknown";
  return takeRateLimit({ key: `action:${scope}:${clientId}`, limit, windowMs }).allowed;
}
