import { ArrowUpRight, CalendarPlus, CircleDollarSign, Clock, CreditCard, MessageSquare, Sparkles, Stethoscope, UserPlus, Users, WalletCards } from "lucide-react";
import Link from "next/link";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/auth";
import { clinicTimeZone } from "@/lib/clinic-time";
import { intlLocale, statusLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { getAiAssistantSuggestion } from "@/lib/services/aiAssistantService";
import { getDashboardMetrics } from "@/lib/services/reportService";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";

const statusTones: Record<string, "default" | "success" | "warning" | "danger" | "muted"> = {
  PENDING_CONFIRMATION: "warning",
  PLANNED: "default",
  ARRIVED: "success",
  COMPLETED: "success",
  NO_SHOW: "warning",
  CANCELLED: "danger"
};

export default async function DashboardPage() {
  const session = await requireSession();
  const locale = await getLocale();
  const metrics = await getDashboardMetrics(session.organizationId);
  const assistant = await getAiAssistantSuggestion({ topic: "general" });

  const timeFormatter = new Intl.DateTimeFormat(intlLocale(locale), { hour: "2-digit", minute: "2-digit", timeZone: clinicTimeZone });

  const quickActions = [
    { label: "Yeni hasta", href: "/dashboard/patients/new", icon: UserPlus },
    { label: "Yeni randevu", href: "/dashboard/appointments", icon: CalendarPlus },
    { label: "Ödeme al", href: "/dashboard/payments", icon: CreditCard },
    { label: "Tedavi ekle", href: "/dashboard/treatments", icon: Stethoscope },
    { label: "WhatsApp gönder", href: "/dashboard/communication", icon: MessageSquare }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Klinik dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Bugünkü operasyon, finans, recall ve performans görünümü.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <Link key={action.label} href={action.href} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")}>
              <action.icon className="h-4 w-4" />
              {action.label}
            </Link>
          ))}
        </div>
      </div>

      <section aria-labelledby="revenue-opportunities-title" className="overflow-hidden rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 via-background to-emerald-50 shadow-sm dark:border-orange-950 dark:from-orange-950/35 dark:to-emerald-950/25">
        <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)] md:p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-orange-500 text-white shadow-sm">
              <ArrowUpRight className="h-5 w-5" />
            </span>
            <div>
              <h2 id="revenue-opportunities-title" className="text-lg font-semibold">Geciken tahsilatlar</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {metrics.overduePaymentCount} geciken tahsilat bugün aksiyon bekliyor.
              </p>
            </div>
          </div>
          <div>
            <Link href="/dashboard/payments" className="group flex min-h-16 items-center gap-3 rounded-lg border bg-background/85 p-3 transition hover:border-primary/40 hover:bg-background">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><CircleDollarSign className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1"><strong className="block text-sm">{metrics.overduePaymentCount} geciken tahsilat</strong><small className="text-xs text-muted-foreground">Tahsilatları aç</small></span>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Bugünkü randevular" value={String(metrics.todayAppointments.length)} detail={`${metrics.weeklyAppointments} haftalık randevu`} icon={CalendarPlus} />
        <StatCard title="Aylık gelir" value={formatCurrency(metrics.monthlyRevenue, locale)} detail="Ödenmiş tahsilatlar" icon={WalletCards} tone="success" />
        <StatCard title="Bekleyen ödemeler" value={formatCurrency(metrics.pendingAmount, locale)} detail="Hasta bazlı açık bakiye" icon={CreditCard} tone="warning" />
        <StatCard title="Aktif hastalar" value={String(metrics.activePatientCount)} detail={`${metrics.newPatientCount} yeni hasta`} icon={Users} tone="accent" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Clock className="h-5 w-5 text-accent" />
            Bugünkü randevular
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {metrics.todayAppointments.map((appointment) => {
            const startsAt = new Date(appointment.startsAt);
            const endsAt = new Date(startsAt.getTime() + appointment.durationMinutes * 60_000);
            return (
              <div key={appointment.id} className="flex flex-col gap-3 rounded-lg border bg-background p-4 sm:flex-row sm:items-center">
                <div className="flex shrink-0 items-center gap-3 sm:w-56">
                  <div className="rounded-md bg-primary/10 px-3 py-2 text-center">
                    <p className="text-lg font-bold leading-tight text-primary">{timeFormatter.format(startsAt)}</p>
                    <p className="text-xs font-medium text-primary/70">→ {timeFormatter.format(endsAt)}</p>
                  </div>
                  <Badge variant="muted" className="whitespace-nowrap">{appointment.durationMinutes} dk</Badge>
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/dashboard/patients/${appointment.patientId}`} className="text-base font-semibold hover:underline">
                    {appointment.patient.firstName} {appointment.patient.lastName}
                  </Link>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {appointment.treatmentType} · {appointment.doctor.name}
                    {appointment.room ? ` · ${appointment.room}` : ""}
                  </p>
                </div>
                <Badge variant={statusTones[appointment.status] ?? "muted"} className="self-start sm:self-center">
                  {statusLabel(appointment.status, locale)}
                </Badge>
              </div>
            );
          })}
          {metrics.todayAppointments.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Bugün randevu görünmüyor.</p>
          ) : null}
        </CardContent>
      </Card>

      <DashboardCharts revenue={metrics.revenueByMonth} density={metrics.appointmentDensity} distribution={metrics.treatmentDistribution} doctors={metrics.doctorPerformance} />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              Operasyon asistanı
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">{assistant.answer}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Takip listesi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics.recalls.map((recall) => (
              <div key={recall.id} className="rounded-md border bg-background p-3 text-sm">
                <div className="font-medium">{recall.patient.firstName} {recall.patient.lastName}</div>
                <div className="mt-1 text-xs text-muted-foreground">{recall.reason} · {formatDateTime(recall.dueDate, locale)}</div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Doktor performansı</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics.doctorPerformance.slice(0, 5).map((doctor) => (
              <div key={doctor.name} className="rounded-md border bg-background p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{doctor.name}</span>
                  <Badge variant="success">{doctor.satisfaction}</Badge>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">{doctor.appointments} randevu · {doctor.treatments} tedavi · {formatCurrency(doctor.revenue, locale)}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
