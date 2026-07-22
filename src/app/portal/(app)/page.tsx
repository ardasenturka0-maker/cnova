import { revalidatePath } from "next/cache";
import { CalendarDays, CreditCard, HeartPulse, Stethoscope, User } from "lucide-react";
import Link from "next/link";
import { HealthQuestions } from "@/components/portal/health-questions";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { statusLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { requirePatientSession } from "@/lib/patient-auth";
import { getPortalOverview, updatePatientHealthInfo } from "@/lib/services/portalService";
import { portalHealthSchema } from "@/lib/validations/portal";
import { cn, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

async function saveHealthInfoAction(formData: FormData) {
  "use server";
  const session = await requirePatientSession();
  const parsed = portalHealthSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  await updatePatientHealthInfo(session, parsed.data);
  revalidatePath("/portal");
}

export default async function PortalHomePage() {
  const session = await requirePatientSession();
  const locale = await getLocale();
  const overview = await getPortalOverview(session);
  const chronicDiseases = overview.patient?.chronicDiseases?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
  const knownConditions = new Set(["Kalp hastalığı", "Astım", "Diyabet", "Hipertansiyon"]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Merhaba, {session.name}</h1>
        <p className="text-sm text-muted-foreground">Tedavi ve randevularınızı buradan takip edebilirsiniz.</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4 text-primary" />
            Bir sonraki randevunuz
          </CardTitle>
        </CardHeader>
        <CardContent>
          {overview.nextAppointment ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-lg font-semibold">{formatDateTime(overview.nextAppointment.startsAt, locale)}</p>
                <Badge variant={overview.nextAppointment.status === "PENDING_CONFIRMATION" ? "warning" : "success"}>
                  {statusLabel(overview.nextAppointment.status, locale)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {overview.nextAppointment.treatmentType} · {overview.nextAppointment.doctor.name}
              </p>
              <p className="text-xs text-muted-foreground">{overview.nextAppointment.branch.name}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Yaklaşan randevunuz yok.</p>
              <Link className={cn(buttonVariants(), "w-full")} href="/portal/appointments">Randevu Al</Link>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Toplam ödenen</p>
            <p className="mt-1 text-lg font-semibold">{formatCurrency(overview.paidTotal, locale)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Bekleyen ödeme</p>
            <p className="mt-1 text-lg font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(overview.pendingTotal, locale)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Stethoscope className="h-4 w-4 text-primary" />
            Son tedavileriniz
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {overview.treatments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Kayıtlı tedavi bulunmuyor.</p>
          ) : (
            overview.treatments.map((treatment) => (
              <div key={treatment.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{treatment.treatmentType}</p>
                  <p className="text-xs text-muted-foreground">{treatment.doctor.name} · {formatDate(treatment.performedAt, locale)}</p>
                </div>
                <Badge variant={treatment.status === "COMPLETED" ? "success" : "warning"}>{statusLabel(treatment.status, locale)}</Badge>
              </div>
            ))
          )}
          <Link className={cn(buttonVariants({ variant: "outline" }), "w-full")} href="/portal/treatments">Tüm tedavileri gör</Link>
        </CardContent>
      </Card>

      {overview.patient ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4 text-primary" />
              Bilgileriniz
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p><span className="text-muted-foreground">Telefon:</span> {overview.patient.phone}</p>
            {overview.patient.email ? <p><span className="text-muted-foreground">E-posta:</span> {overview.patient.email}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {overview.patient ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <HeartPulse className="h-4 w-4 text-primary" />
              Sağlık Bilgilerim
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={saveHealthInfoAction} className="space-y-4">
              <p className="text-sm text-muted-foreground">Sağlık durumunuz veya kullandığınız ilaçlar değiştiğinde bu alanı güncelleyin. Bilgiler kliniğinizle paylaşılır.</p>
              <HealthQuestions defaults={{
                heartDisease: chronicDiseases.includes("Kalp hastalığı"),
                asthma: chronicDiseases.includes("Astım"),
                diabetes: chronicDiseases.includes("Diyabet"),
                hypertension: chronicDiseases.includes("Hipertansiyon"),
                otherConditions: chronicDiseases.filter((condition) => !knownConditions.has(condition)).join(", "),
                allergies: overview.patient.allergies,
                medications: overview.patient.medications
              }} />
              <Button className="w-full" type="submit">Sağlık Bilgilerimi Güncelle</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Link className={cn(buttonVariants({ variant: "outline" }), "w-full gap-2")} href="/portal/payments">
        <CreditCard className="h-4 w-4" />
        Ödeme geçmişim
      </Link>
    </div>
  );
}
