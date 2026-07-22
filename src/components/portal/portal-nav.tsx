"use client";

import { CalendarDays, CreditCard, Home, Stethoscope } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/portal", label: "Ana Sayfa", icon: Home },
  { href: "/portal/appointments", label: "Randevular", icon: CalendarDays },
  { href: "/portal/treatments", label: "Tedaviler", icon: Stethoscope },
  { href: "/portal/payments", label: "Ödemeler", icon: CreditCard }
];

export function PortalNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur">
      <div className="mx-auto grid max-w-lg grid-cols-4">
        {items.map((item) => {
          const active = item.href === "/portal" ? pathname === "/portal" : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
