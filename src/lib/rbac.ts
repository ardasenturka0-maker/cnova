import { Role } from "@prisma/client";
import { roleLabels, type Locale } from "@/lib/i18n";

export type ModuleKey =
  | "dashboard"
  | "patients"
  | "appointments"
  | "treatments"
  | "finance"
  | "stocks"
  | "staff"
  | "consents"
  | "surveys"
  | "communication"
  | "tourism"
  | "recalls"
  | "reports"
  | "settings";

const permissions: Record<Role, ModuleKey[]> = {
  SUPER_ADMIN: ["dashboard", "patients", "appointments", "treatments", "finance", "stocks", "staff", "consents", "surveys", "communication", "tourism", "reports", "settings"],
  CLINIC_OWNER: ["dashboard", "patients", "appointments", "treatments", "finance", "stocks", "staff", "consents", "surveys", "communication", "tourism", "reports", "settings"],
  MANAGER: ["dashboard", "patients", "appointments", "treatments", "finance", "stocks", "staff", "consents", "surveys", "communication", "tourism", "reports", "settings"],
  DOCTOR: ["dashboard", "patients", "appointments", "treatments", "consents", "surveys", "communication", "tourism", "reports"],
  ASSISTANT: ["dashboard", "patients", "appointments", "treatments", "stocks", "consents", "communication", "tourism"],
  ACCOUNTANT: ["dashboard", "patients", "finance", "reports"],
  RECEPTIONIST: ["dashboard", "patients", "appointments", "communication", "tourism", "recalls"]
};

export function canAccess(role: Role, module: ModuleKey) {
  return permissions[role]?.includes(module) ?? false;
}

export function roleLabel(role: Role, locale: Locale = "tr") {
  return roleLabels[locale][role] ?? role;
}
