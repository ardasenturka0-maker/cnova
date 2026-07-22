import { ClipboardList, Stethoscope } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { statusLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { requirePatientSession } from "@/lib/patient-auth";
import { summarizePaymentPlan } from "@/lib/payment-plan";
import { getPatientTreatments } from "@/lib/services/portalService";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function PortalTreatmentsPage() {
  const session = await requirePatientSession();
  const locale = await getLocale();
  const { treatments, plans } = await getPatientTreatments(session);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Tedavilerim</h1>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Stethoscope className="h-4 w-4 text-primary" />
            Tedavi geçmişi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {treatments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Kayıtlı tedavi bulunmuyor.</p>
          ) : (
            treatments.map((treatment) => (
              <div key={treatment.id} className="space-y-1.5 rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{treatment.treatmentType}</p>
                  <Badge variant={treatment.status === "COMPLETED" ? "success" : "warning"}>{statusLabel(treatment.status, locale)}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {treatment.doctor.name} · {formatDate(treatment.performedAt, locale)}
                  {treatment.toothNumber ? ` · Diş ${treatment.toothNumber}` : ""}
                </p>
                <p className="text-sm font-medium">{formatCurrency(treatment.fee, locale)}</p>
                <p className="text-xs text-muted-foreground">{summarizePaymentPlan(treatment.paymentPlan)}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4 text-primary" />
            Tedavi planlarınız
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {plans.length === 0 ? (
            <p className="text-sm text-muted-foreground">Önerilen tedavi planı bulunmuyor.</p>
          ) : (
            plans.map((plan) => (
              <div key={plan.id} className="space-y-1.5 rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{plan.treatmentType}</p>
                  <Badge variant={plan.status === "ACCEPTED" ? "success" : "muted"}>{statusLabel(plan.status, locale)}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {plan.doctor.name} · {formatDate(plan.plannedAt, locale)}
                  {plan.toothNumber ? ` · Diş ${plan.toothNumber}` : ""}
                </p>
                <p className="text-sm font-medium">Tahmini ücret: {formatCurrency(plan.estimatedFee, locale)}</p>
                {plan.description ? <p className="text-xs text-muted-foreground">{plan.description}</p> : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
