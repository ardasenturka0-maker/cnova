import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { intlLocale, type Locale } from "@/lib/i18n";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | string | { toString: () => string }, locale: Locale = "tr") {
  const amount = typeof value === "number" ? value : Number(value.toString());
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatDate(date: Date | string, locale: Locale = "tr") {
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: "medium"
  }).format(parsedDate);
}

export function formatDateTime(date: Date | string, locale: Locale = "tr") {
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(parsedDate);
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function toNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
