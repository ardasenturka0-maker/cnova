import { cookies } from "next/headers";
import { localeCookieName, normalizeLocale } from "@/lib/i18n";

export function getLocale() {
  return normalizeLocale(cookies().get(localeCookieName)?.value);
}
