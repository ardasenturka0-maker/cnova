"use client";

import { Activity } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { dashboardNavLabels, shellText, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { isNavigationItemActive, navigationForRole } from "@/lib/dashboard-navigation";
import type { Role } from "@prisma/client";

export function Sidebar({ className, locale = "tr", role }: { className?: string; locale?: Locale; role: Role }) {
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
        {navigationForRole(role).map((item) => {
          const active = isNavigationItemActive(pathname, item.href);
          return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("nav-item", active && "nav-item-active")}>
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
