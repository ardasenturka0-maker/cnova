"use client";

import { CalendarPlus, ChevronDown, CreditCard, Users, WalletCards, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type KpiIcon = "appointments" | "revenue" | "pending" | "patients";
type KpiTone = "primary" | "accent" | "success" | "warning";

export type DashboardKpiSummary = {
  id: string;
  title: string;
  value: string;
  detail: string;
  icon: KpiIcon;
  tone: KpiTone;
  summaryTitle: string;
  rows: Array<{ label: string; value: string }>;
  note?: string;
  href: string;
  hrefLabel: string;
};

const icons: Record<KpiIcon, LucideIcon> = {
  appointments: CalendarPlus,
  revenue: WalletCards,
  pending: CreditCard,
  patients: Users
};

const tones: Record<KpiTone, { icon: string; active: string }> = {
  primary: { icon: "bg-primary/10 text-primary", active: "border-primary/45 ring-primary/20" },
  accent: { icon: "bg-accent/10 text-accent", active: "border-accent/45 ring-accent/20" },
  success: { icon: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", active: "border-emerald-500/45 ring-emerald-500/20" },
  warning: { icon: "bg-amber-500/12 text-amber-700 dark:text-amber-300", active: "border-amber-500/45 ring-amber-500/20" }
};

export function DashboardKpiSummaries({ cards }: { cards: DashboardKpiSummary[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openCard = cards.find((card) => card.id === openId) ?? null;

  return (
    <section aria-label="Klinik özetleri" className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = icons[card.icon];
          const open = card.id === openId;
          return (
            <button
              key={card.id}
              type="button"
              aria-expanded={open}
              aria-controls="dashboard-kpi-detail"
              onClick={() => setOpenId(open ? null : card.id)}
              className={cn(
                "min-w-0 rounded-lg border bg-card p-5 text-left text-card-foreground shadow-sm transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                open && `ring-2 ${tones[card.tone].active}`
              )}
            >
              <span className="flex items-center gap-4">
                <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-md", tones[card.tone].icon)}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-muted-foreground">{card.title}</span>
                  <span className="mt-1 block break-words text-2xl font-semibold">{card.value}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{card.detail}</span>
                </span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180 text-primary")} />
              </span>
              <span className="mt-3 block text-xs font-medium text-primary">Özeti {open ? "kapat" : "göster"}</span>
            </button>
          );
        })}
      </div>

      {openCard ? (
        <Card id="dashboard-kpi-detail" className="overflow-hidden border-primary/20 bg-gradient-to-br from-card to-primary/[0.025]">
          <CardHeader className="flex-row items-center justify-between gap-3">
            <CardTitle>{openCard.summaryTitle}</CardTitle>
            <button type="button" className="text-xs font-medium text-muted-foreground hover:text-foreground" onClick={() => setOpenId(null)}>Kapat</button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {openCard.rows.map((row) => (
                <div key={row.label} className="rounded-md border bg-background/85 p-3">
                  <p className="text-xs text-muted-foreground">{row.label}</p>
                  <p className="mt-1 break-words text-lg font-semibold">{row.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {openCard.note ? <p className="text-sm text-muted-foreground">{openCard.note}</p> : <span />}
              <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={openCard.href}>{openCard.hrefLabel}</Link>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
