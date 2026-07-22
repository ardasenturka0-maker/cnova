"use client";

import { Activity, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { dashboardNavLabels, shellText, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { isNavigationItemActive, navigationForRole } from "@/lib/dashboard-navigation";
import type { Role } from "@prisma/client";

export function MobileSidebar({ locale = "tr", role }: { locale?: Locale; role: Role }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const text = shellText[locale];
  const labels = dashboardNavLabels[locale];

  return (
    <>
      <Button className="lg:hidden" variant="outline" size="icon" aria-label={text.menu} onClick={() => setOpen(true)}>
        <Menu className="h-4 w-4" />
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-black/40" aria-label={text.closeMenu} onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-80 max-w-[86vw] flex-col border-r bg-card shadow-soft">
            <div className="flex h-16 items-center justify-between border-b px-5">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-primary text-primary-foreground">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold">ClinicNova</div>
                  <div className="text-xs text-muted-foreground">{text.clinicOs}</div>
                </div>
              </div>
              <Button variant="outline" size="icon" aria-label={text.close} onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {navigationForRole(role).map((item) => {
                const active = isNavigationItemActive(pathname, item.href);
                return (
                <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)} className={cn("nav-item", active && "nav-item-active")}>
                  <item.icon className="h-4 w-4" />
                  <span>{labels[item.key]}</span>
                </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      ) : null}
    </>
  );
}
