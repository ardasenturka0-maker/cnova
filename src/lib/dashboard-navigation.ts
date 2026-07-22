import {
  BarChart3,
  Boxes,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Settings,
  Stethoscope,
  Users,
  UserRoundCog,
  type LucideIcon
} from "lucide-react";
import { canAccess, type ModuleKey } from "@/lib/rbac";
import type { Role } from "@prisma/client";

export type DashboardNavigationItem = {
  href: string;
  key: string;
  permission: ModuleKey;
  icon: LucideIcon;
};

// Masaüstü ve mobil menü aynı katalogdan beslenir. Yeni bir modül yalnızca
// burada tanımlanır; görünürlüğü rol yetkisiyle otomatik belirlenir.
export const dashboardNavigation: DashboardNavigationItem[] = [
  { href: "/dashboard", key: "dashboard", permission: "dashboard", icon: LayoutDashboard },
  { href: "/dashboard/patients", key: "patients", permission: "patients", icon: Users },
  { href: "/dashboard/appointments", key: "appointments", permission: "appointments", icon: CalendarDays },
  { href: "/dashboard/treatments", key: "treatments", permission: "treatments", icon: Stethoscope },
  { href: "/dashboard/treatment-plans", key: "treatmentPlans", permission: "treatments", icon: ClipboardList },
  { href: "/dashboard/finance", key: "finance", permission: "finance", icon: CreditCard },
  { href: "/dashboard/stocks", key: "stocks", permission: "stocks", icon: Boxes },
  { href: "/dashboard/staff", key: "staff", permission: "staff", icon: UserRoundCog },
  { href: "/dashboard/consents", key: "consents", permission: "consents", icon: ClipboardCheck },
  { href: "/dashboard/reports", key: "reports", permission: "reports", icon: BarChart3 },
  { href: "/dashboard/settings", key: "settings", permission: "settings", icon: Settings }
];

export function navigationForRole(role: Role) {
  return dashboardNavigation.filter((item) => canAccess(role, item.permission));
}

export function isNavigationItemActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
}
