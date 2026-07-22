import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CalendarDays, CalendarPlus, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { clinicDateKey } from "@/lib/clinic-time";
import { statusLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { requirePatientSession } from "@/lib/patient-auth";
import {
  bookAppointment,
  cancelAppointment,
  getPatientAppointments,
  getPortalDoctors,
  portalTreatmentTypes
} from "@/lib/services/portalService";
import { portalAppointmentSchema } from "@/lib/validations/portal";
import { formatDateTime } from "@/lib/utils";

async function bookAppointmentAction(formData: FormData) {
  "use server";
  const session = await requirePatientSession();
  const parsed = portalAppointmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect("/portal/appointments?error=form");
  }

  try {
    await bookAppointment(session, parsed.data);
  } catch {
    redirect("/portal/appointments?error=date");
  }

  revalidatePath("/portal/appointments");
  revalidatePath("/portal");
  redirect("/portal/appointments?success=1");
}

async function cancelAppointmentAction(formData: FormData) {
  "use server";
  const session = await requirePatientSession();
  const appointmentId = String(formData.get("appointmentId") ?? "");

  try {
    await cancelAppointment(session, appointmentId);
  } catch {
    redirect("/portal/appointments?error=cancel");
  }

  revalidatePath("/portal/appointments");
  revalidatePath("/portal");
  redirect("/portal/appointments?cancelled=1");
}

const messages: Record<string, { text: string; tone: "success" | "error" }> = {
  success: { text: "Randevu talebiniz alındı. Klinik onayladığında bilgilendirileceksiniz.", tone: "success" },
  cancelled: { text: "Randevunuz iptal edildi.", tone: "success" },
  form: { text: "Lütfen tüm alanları doldurun.", tone: "error" },
  date: { text: "Randevu oluşturulamadı. Lütfen ileri bir tarih seçip tekrar deneyin.", tone: "error" },
  cancel: { text: "Bu randevu iptal edilemez.", tone: "error" }
};

const timeSlots = Array.from({ length: 18 }).map((_, index) => {
  const hour = 9 + Math.floor(index / 2);
  const minute = index % 2 === 0 ? "00" : "30";
  return `${String(hour).padStart(2, "0")}:${minute}`;
});

export default async function PortalAppointmentsPage(
  props: {
    searchParams: Promise<{ success?: string; cancelled?: string; error?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const session = await requirePatientSession();
  const locale = await getLocale();
  const [{ upcoming, past }, doctors] = await Promise.all([
    getPatientAppointments(session),
    getPortalDoctors(session.organizationId, session.branchId)
  ]);

  const messageKey = searchParams.success ? "success" : searchParams.cancelled ? "cancelled" : searchParams.error;
  const message = messageKey ? messages[messageKey] : null;
  const today = clinicDateKey(new Date());

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Randevularım</h1>

      {message ? (
        <p
          className={
            message.tone === "success"
              ? "rounded-md border border-emerald-200 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300"
              : "rounded-md border border-red-200 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300"
          }
        >
          {message.text}
        </p>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarPlus className="h-4 w-4 text-primary" />
            Randevu Al
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={bookAppointmentAction} className="space-y-4">
            <div className="space-y-2">
              <Label>Doktor</Label>
              <Select name="doctorId" required>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>{doctor.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>İşlem</Label>
              <Select name="treatmentType" required>
                {portalTreatmentTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tarih</Label>
                <Input name="date" type="date" min={today} required />
              </div>
              <div className="space-y-2">
                <Label>Saat</Label>
                <Select name="time" defaultValue="10:00" required>
                  {timeSlots.map((slot) => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notunuz (opsiyonel)</Label>
              <Textarea name="notes" rows={2} placeholder="Şikayetiniz veya talebiniz" />
            </div>
            <Button className="w-full" type="submit">Randevu Talebi Gönder</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4 text-primary" />
            Yaklaşan randevular
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">Yaklaşan randevunuz yok.</p>
          ) : (
            upcoming.map((appointment) => (
              <div key={appointment.id} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{formatDateTime(appointment.startsAt, locale)}</p>
                  <Badge variant={appointment.status === "PENDING_CONFIRMATION" ? "warning" : appointment.status === "PLANNED" ? "success" : "muted"}>
                    {statusLabel(appointment.status, locale)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {appointment.treatmentType} · {appointment.doctor.name} · {appointment.branch.name}
                </p>
                {appointment.status === "PLANNED" || appointment.status === "PENDING_CONFIRMATION" ? (
                  <form action={cancelAppointmentAction}>
                    <input type="hidden" name="appointmentId" value={appointment.id} />
                    <Button variant="outline" size="sm" type="submit">İptal Et</Button>
                  </form>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-primary" />
            Geçmiş randevular
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {past.length === 0 ? (
            <p className="text-sm text-muted-foreground">Geçmiş randevu bulunmuyor.</p>
          ) : (
            past.slice(0, 20).map((appointment) => (
              <div key={appointment.id} className="flex items-center justify-between gap-2 rounded-md border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{appointment.treatmentType}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(appointment.startsAt, locale)} · {appointment.doctor.name}</p>
                </div>
                <Badge variant={appointment.status === "COMPLETED" || appointment.status === "ARRIVED" ? "success" : "muted"}>
                  {statusLabel(appointment.status, locale)}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
