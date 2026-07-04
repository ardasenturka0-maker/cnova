import { AlertTriangle, CalendarPlus, CreditCard, MessageSquare, PackageOpen, Sparkles, Stethoscope, UserPlus, Users, WalletCards } from "lucide-react";
import Link from "next/link";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireSession } from "@/lib/auth";
import { statusLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { getAiAssistantSuggestion } from "@/lib/services/aiAssistantService";
import { getDashboardMetrics } from "@/lib/services/reportService";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await requireSession();
  const locale = getLocale();
  const metrics = await getDashboardMetrics(session.organizationId);
  const assistant = await getAiAssistantSuggestion({ topic: "general" });

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
          <p className="mt-1 text-sm text-muted-foreground">Bugünkü operasyon, finans, stok, recall ve performans görünümü.</p>
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Bugünkü randevular" value={String(metrics.todayAppointments.length)} detail={`${metrics.weeklyAppointments} haftalık randevu`} icon={CalendarPlus} />
        <StatCard title="Aylık gelir" value={formatCurrency(metrics.monthlyRevenue, locale)} detail="Ödenmiş tahsilatlar" icon={WalletCards} tone="success" />
        <StatCard title="Bekleyen ödemeler" value={formatCurrency(metrics.pendingAmount, locale)} detail="Hasta bazlı açık bakiye" icon={CreditCard} tone="warning" />
        <StatCard title="Aktif hastalar" value={String(metrics.activePatientCount)} detail={`${metrics.newPatientCount} yeni hasta`} icon={Users} tone="accent" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Bugünkü randevular</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Saat</TableHead>
                  <TableHead>Hasta</TableHead>
                  <TableHead>Doktor</TableHead>
                  <TableHead>İşlem</TableHead>
                  <TableHead>Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.todayAppointments.map((appointment) => (
                  <TableRow key={appointment.id}>
                    <TableCell>{formatDateTime(appointment.startsAt, locale)}</TableCell>
                    <TableCell>{appointment.patient.firstName} {appointment.patient.lastName}</TableCell>
                    <TableCell>{appointment.doctor.name}</TableCell>
                    <TableCell>{appointment.treatmentType}</TableCell>
                    <TableCell><Badge variant="muted">{statusLabel(appointment.status, locale)}</Badge></TableCell>
                  </TableRow>
                ))}
                {metrics.todayAppointments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">Bugün randevu görünmüyor.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent" />
                AI asistan mock
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">{assistant.answer}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Akıllı uyarılar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {metrics.smartAlerts.map((alert) => (
                <div key={alert.title + alert.description} className="flex gap-3 rounded-md border bg-background p-3">
                  <AlertTriangle className={cn("mt-0.5 h-4 w-4", alert.severity === "high" ? "text-destructive" : "text-amber-600")} />
                  <div>
                    <p className="text-sm font-medium">{alert.title}</p>
                    <p className="text-xs text-muted-foreground">{alert.description}</p>
                  </div>
                </div>
              ))}
              {metrics.smartAlerts.length === 0 ? <p className="text-sm text-muted-foreground">Kritik uyarı yok.</p> : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <DashboardCharts revenue={metrics.revenueByMonth} density={metrics.appointmentDensity} distribution={metrics.treatmentDistribution} doctors={metrics.doctorPerformance} />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Stok uyarıları</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics.lowStocks.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-md border bg-background p-3 text-sm">
                <span>{item.name}</span>
                <Badge variant="warning">{item.currentQuantity} {item.unit}</Badge>
              </div>
            ))}
            {metrics.lowStocks.length === 0 ? <p className="text-sm text-muted-foreground">Minimum altı stok yok.</p> : null}
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
