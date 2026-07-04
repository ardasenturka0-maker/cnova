import type { LucideIcon } from "lucide-react";
import { Bot, Building2, ChartNoAxesCombined, FileSignature, GalleryHorizontalEnd, Handshake, HeartPulse, Hotel, MessageCircle, PackagePlus, Repeat, ShieldCheck, Star } from "lucide-react";
import type {
  BeforeAfterStatus,
  DigitalConsentStatus,
  LeadFollowUpStatus,
  PostTreatmentFollowUpStatus,
  ReservationShareStatus,
  ReviewRequestStatus,
  TourismLeadSourceChannel,
  TourismLeadStatus,
  TourismPackageStatus
} from "@prisma/client";
import { statusLabel, type Locale } from "@/lib/i18n";

const tourismRouteConfig: Array<{ href: string; key: string; icon: LucideIcon }> = [
  { href: "/dashboard/tourism", key: "salesFlow", icon: ChartNoAxesCombined },
  { href: "/dashboard/tourism/leads", key: "leadPool", icon: Handshake },
  { href: "/dashboard/tourism/package-builder", key: "packageBuilder", icon: PackagePlus },
  { href: "/dashboard/tourism/hotel-transfer", key: "hotelTransfer", icon: Hotel },
  { href: "/dashboard/tourism/followups", key: "followUps", icon: Repeat },
  { href: "/dashboard/tourism/post-treatment", key: "postTreatment", icon: HeartPulse },
  { href: "/dashboard/tourism/reviews", key: "reviews", icon: Star },
  { href: "/dashboard/tourism/gallery", key: "gallery", icon: GalleryHorizontalEnd },
  { href: "/dashboard/tourism/consents", key: "consents", icon: FileSignature },
  { href: "/dashboard/tourism/surveys", key: "satisfaction", icon: MessageCircle },
  { href: "/dashboard/tourism/chatbot", key: "chatbot", icon: Bot },
  { href: "/dashboard/tourism/analytics", key: "analytics", icon: ChartNoAxesCombined },
  { href: "/dashboard/tourism/integrations", key: "integrations", icon: Building2 }
];

const tourismRouteLabels: Record<Locale, Record<string, string>> = {
  tr: {
    salesFlow: "Satış Akışı",
    leadPool: "Lead Havuzu",
    packageBuilder: "Paket Oluşturucu",
    hotelTransfer: "Otel & Transfer",
    followUps: "Otomatik Takipler",
    postTreatment: "Tedavi Sonrası",
    reviews: "Yorum Yönetimi",
    gallery: "Önce/Sonra",
    consents: "Turizm Onamları",
    satisfaction: "Memnuniyet",
    chatbot: "AI Chatbot",
    analytics: "Analitik",
    integrations: "Entegrasyonlar"
  },
  en: {
    salesFlow: "Sales Flow",
    leadPool: "Lead Pool",
    packageBuilder: "Package Builder",
    hotelTransfer: "Hotel & Transfer",
    followUps: "Automated Follow-ups",
    postTreatment: "Post Treatment",
    reviews: "Review Management",
    gallery: "Before/After",
    consents: "Tourism Consents",
    satisfaction: "Satisfaction",
    chatbot: "AI Chatbot",
    analytics: "Analytics",
    integrations: "Integrations"
  }
};

export function tourismRoutes(locale: Locale = "tr"): Array<{ href: string; label: string; icon: LucideIcon }> {
  return tourismRouteConfig.map((item) => ({ ...item, label: tourismRouteLabels[locale][item.key] }));
}

export function sourceLabel(source: TourismLeadSourceChannel | string, locale: Locale = "tr") {
  return statusLabel(source, locale);
}

export function leadStatusLabel(status: TourismLeadStatus | string, locale: Locale = "tr") {
  return statusLabel(status, locale);
}

export function statusTone(status: string): "default" | "success" | "warning" | "danger" | "muted" {
  if (["BOOKED", "ACCEPTED", "SIGNED", "COMPLETED", "CONFIRMED", "PUBLISHED_WEBSITE", "PUBLISHED_SOCIAL", "SENT"].includes(status)) return "success";
  if (["WAITING_REPLY", "PACKAGE_SENT", "VIEWED", "SCHEDULED", "PENDING", "ACTIVE"].includes(status)) return "warning";
  if (["LOST", "REJECTED", "FAILED", "ISSUE_REPORTED", "DECLINED", "EXPIRED"].includes(status)) return "danger";
  if (["DRAFT", "PAUSED", "ARCHIVED", "STOPPED"].includes(status)) return "muted";
  return "default";
}

export function packageStatusLabel(status: TourismPackageStatus | string, locale: Locale = "tr") {
  return statusLabel(status, locale);
}

export function compactStatusLabel(status: TourismLeadStatus | TourismPackageStatus | ReservationShareStatus | LeadFollowUpStatus | PostTreatmentFollowUpStatus | ReviewRequestStatus | BeforeAfterStatus | DigitalConsentStatus | string, locale: Locale = "tr") {
  return statusLabel(status, locale);
}

export const tourismKpiTarget = {
  promise: "Satış kaybını azaltmak için her lead bir sonraki aksiyona bağlı kalır.",
  workflow: ["Lead", "Paket", "Follow-up", "Booked", "Rezervasyon", "Bakım", "Anket", "Yorum", "Galeri", "Analitik"]
};

export const gdprNotice = "KVKK/GDPR: Hasta onayı olmayan veri paylaşımı, galeri yayını veya partner rezervasyon aktarımı canlı sistemde engellenmelidir. Bu MVP demo amaçlı mock kayıt üretir.";

export { ShieldCheck };
