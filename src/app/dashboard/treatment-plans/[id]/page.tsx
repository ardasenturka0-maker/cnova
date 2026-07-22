import { ArrowLeft, CalendarDays, ClipboardList, Stethoscope, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TreatmentStatusBadge } from "@/components/dashboard/treatment-status-badge";
import { PaymentPlanDisplay } from "@/components/dashboard/payment-plan-display";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireModuleAccess } from "@/lib/auth";
import { getLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

export default async function TreatmentPlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireModuleAccess("treatments");
  const locale = await getLocale();
  const plan = await prisma.treatmentPlan.findFirst({
    where: { id, organizationId: session.organizationId, patient: { deletedAt: null } },
    include: { patient: true, doctor: { select: { name: true } }, branch: { select: { name: true } } }
  });
  if (!plan) notFound();

  return <div className="space-y-6">
    <Link href="/dashboard/treatment-plans" className={cn(buttonVariants({ variant: "outline" }), "gap-2")}><ArrowLeft className="h-4 w-4" />Planlara dön</Link>
    <Card><CardHeader><CardTitle className="flex flex-wrap items-center justify-between gap-3"><span className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" />{plan.treatmentType}</span><TreatmentStatusBadge status={plan.status} locale={locale} /></CardTitle></CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border p-4"><p className="text-xs text-muted-foreground">Hasta</p><p className="mt-1 flex items-center gap-2 font-medium"><UserRound className="h-4 w-4" />{plan.patient.firstName} {plan.patient.lastName}</p></div>
        <div className="rounded-md border p-4"><p className="text-xs text-muted-foreground">Hekim</p><p className="mt-1 flex items-center gap-2 font-medium"><Stethoscope className="h-4 w-4" />{plan.doctor.name}</p></div>
        <div className="rounded-md border p-4"><p className="text-xs text-muted-foreground">Plan tarihi</p><p className="mt-1 flex items-center gap-2 font-medium"><CalendarDays className="h-4 w-4" />{formatDate(plan.plannedAt, locale)}</p></div>
        <div className="rounded-md border p-4"><p className="text-xs text-muted-foreground">Tahmini ücret</p><p className="mt-1 text-xl font-semibold">{formatCurrency(plan.estimatedFee, locale)}</p></div>
        <div className="rounded-md border p-4 md:col-span-2"><p className="text-xs text-muted-foreground">Diş / bölge</p><p className="mt-1 font-medium">{plan.toothNumber || "Belirtilmedi"}</p></div>
        <div className="rounded-md border p-4 md:col-span-2"><p className="text-xs text-muted-foreground">Şube</p><p className="mt-1 font-medium">{plan.branch.name}</p></div>
        <div className="md:col-span-2 xl:col-span-4"><PaymentPlanDisplay value={plan.paymentPlan} locale={locale} /></div>
        <div className="rounded-md border p-4 md:col-span-2 xl:col-span-4"><p className="text-xs text-muted-foreground">Plan açıklaması</p><p className="mt-2 whitespace-pre-wrap text-sm">{plan.description || "Açıklama girilmedi."}</p></div>
      </CardContent>
    </Card>
  </div>;
}
