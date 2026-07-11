"use client";

import { Activity, BarChart3, BellRing, Boxes, CalendarDays, ClipboardCheck, CreditCard, HeartPulse, LayoutDashboard, MessageSquare, Plane, Settings, Stethoscope, Users, UserRoundCog } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { dashboardNavLabels, shellText, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { href: "/dashboard/patients", key: "patients", icon: Users },
  { href: "/dashboard/appointments", key: "appointments", icon: CalendarDays },
  { href: "/dashboard/treatments", key: "treatments", icon: Stethoscope },
  { href: "/dashboard/finance", key: "finance", icon: CreditCard },
  { href: "/dashboard/stocks", key: "stocks", icon: Boxes },
  { href: "/dashboard/staff", key: "staff", icon: UserRoundCog },
  { href: "/dashboard/consents", key: "consents", icon: ClipboardCheck },
  { href: "/dashboard/surveys", key: "surveys", icon: HeartPulse },
  { href: "/dashboard/communication", key: "communication", icon: MessageSquare },
  { href: "/dashboard/tourism", key: "tourism", icon: Plane },
  { href: "/dashboard/recalls", key: "recalls", icon: BellRing },
  { href: "/dashboard/reports", key: "reports", icon: BarChart3 },
  { href: "/dashboard/settings", key: "settings", icon: Settings }
];

export function Sidebar({ className, locale = "tr" }: { className?: string; locale?: Locale }) {
  const pathname = usePathname();
  const text = shellText[locale];
  const labels = dashboardNavLabels[locale];

  return (
    <aside className={cn("flex h-full w-72 shrink-0 flex-col border-r bg-card", className)}>
      <div className="flex h-16 items-center gap-3 border-b px-5">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-primary text-primary-foreground">
          <Activity className="h-5 w-5" />
        </div>
        <div>
          <div className="font-semibold">ClinicNova</div>
          <div className="text-xs text-muted-foreground">{text.clinicOs}</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => {
          const active = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
          return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("flex min-h-10 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground", active && "bg-primary/10 font-medium text-primary")}>
            <item.icon className="h-4 w-4" />
            <span>{labels[item.key]}</span>
          </Link>
          );
        })}
      </nav>
      <div className="border-t p-4">
        <div className="rounded-lg bg-muted p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{text.mockIntegration}</p>
            <Badge variant="success">{text.active}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{text.integrationDetail}</p>
        </div>
      </div>
    </aside>
  );
}
