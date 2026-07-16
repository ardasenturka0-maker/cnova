import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BellRing, CalendarDays, Check, ChevronLeft, ChevronRight, Send, UserRound, X } from "lucide-react";
import Link from "next/link";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { requireModuleAccess } from "@/lib/auth";
import { intlLocale, statusLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { createAppointment, getAppointmentFormOptions, getAppointments } from "@/lib/services/appointmentService";
import { getPortalAppointmentRequests, resolvePortalAppointmentRequest } from "@/lib/services/portalService";
import { sendMessage } from "@/lib/services/notificationService";
import { getWritableBranchId } from "@/lib/services/tenantService";
import { setAppointmentStatus } from "@/lib/services/treatmentStockService";
import { appointmentSchema } from "@/lib/validations/appointment";
import { formatDateTime } from "@/lib/utils";
import { AppointmentStatus, CommunicationChannel } from "@prisma/client";

function resultUrl(type: "success" | "error", message: string) {
  return `/dashboard/appointments?${type}=${encodeURIComponent(message)}`;
}

function actionErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function createAppointmentAction(formData: FormData) {
  "use server";
  const session = await requireModuleAccess("appointments");
  const parsed = appointmentSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    redirect(resultUrl("error", parsed.error.issues[0]?.message ?? "Randevu formu geçersiz."));
  }

  try {
    await createAppointment(session.organizationId, parsed.data);
  } catch (error) {
    redirect(resultUrl("error", actionErrorMessage(error, "Randevu oluşturulamadı. Lütfen bilgileri kontrol edip tekrar deneyin.")));
  }

  revalidatePath("/dashboard/appointments");
  redirect(resultUrl("success", "Randevu oluşturuldu."));
}

async function resolveRequestAction(appointmentId: string, decision: "approve" | "reject") {
  "use server";
  const session = await requireModuleAccess("appointments");
  try {
    await resolvePortalAppointmentRequest(session.organizationId, appointmentId, decision);
  } catch (error) {
    redirect(resultUrl("error", actionErrorMessage(error, "Portal talebi güncellenemedi.")));
  }

  revalidatePath("/dashboard/appointments");
  revalidatePath("/portal/appointments");
  revalidatePath("/portal");
  redirect(resultUrl("success", decision === "approve" ? "Portal randevu talebi onaylandı." : "Portal randevu talebi reddedildi."));
}

async function updateAppointmentStatusAction(appointmentId: string, formData: FormData) {
  "use server";
  const session = await requireModuleAccess("appointments");
  const status = formData.get("status");
  if (typeof status !== "string" || !Object.values(AppointmentStatus).includes(status as AppointmentStatus)) {
    redirect(resultUrl("error", "Randevu durumu geçersiz."));
  }
  try {
    await setAppointmentStatus(session.organizationId, appointmentId, status as AppointmentStatus);
  } catch (error) {
    redirect(resultUrl("error", actionErrorMessage(error, "Randevu durumu güncellenemedi.")));
  }
  revalidatePath("/dashboard/appointments");
  revalidatePath("/dashboard/stocks");
  redirect(resultUrl("success", status === AppointmentStatus.COMPLETED ? "Randevu tamamlandı; reçetedeki malzemeler stoktan otomatik düşüldü." : "Randevu durumu güncellendi; gerekiyorsa stok iadesi işlendi."));
}

async function sendReminderAction(patientId: string, phone: string) {
  "use server";
  const session = await requireModuleAccess("appointments");
  const branchId = await getWritableBranchId(session);
  try {
    await sendMessage({
      organizationId: session.organizationId,
      branchId,
      patientId,
      to: phone,
      message: "ClinicNova randevu hatırlatma: yaklaşan randevunuz için sizi bekliyoruz.",
      channel: CommunicationChannel.WHATSAPP
    });
  } catch (error) {
    redirect(resultUrl("error", actionErrorMessage(error, "Hatırlatma gönderilemedi.")));
  }

  revalidatePath("/dashboard/communication");
  redirect(resultUrl("success", "Randevu hatırlatması sağlayıcıya teslim edildi."));
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export default async function AppointmentsPage(props: { searchParams: Promise<{ success?: string; error?: string; month?: string }> }) {
  const searchParams = await props.searchParams;
  const session = await requireModuleAccess("appointments");
  const locale = await getLocale();
  const today = startOfDay(new Date());
  const requestedMonth = /^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(searchParams.month ?? "") ? searchParams.month! : null;
  const monthMatch = requestedMonth ?? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [viewYear, viewMonth] = monthMatch.split("-").map(Number);
  const monthStart = new Date(viewYear, viewMonth - 1, 1);
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(calendarStart.getDate() - ((calendarStart.getDay() + 6) % 7));
  const calendarDays = Array.from({ length: 42 }).map((_, index) => {
    const day = new Date(calendarStart);
    day.setDate(day.getDate() + index);
    return day;
  });
  const calendarEnd = new Date(calendarStart);
  calendarEnd.setDate(calendarEnd.getDate() + 42);
  const [appointments, options, portalRequests, organization] = await Promise.all([
    getAppointments(session.organizationId, { from: calendarStart, to: calendarEnd }),
    getAppointmentFormOptions(session.organizationId),
    getPortalAppointmentRequests(session.organizationId),
    prisma.organization.findUnique({ where: { id: session.organizationId }, select: { clinicSettings: true } })
  ]);
  const settings = organization?.clinicSettings as { chairs?: unknown } | null;
  const configuredChairs = Array.isArray(settings?.chairs) ? settings.chairs.filter((item): item is string => typeof item === "string") : [];
  const previousMonth = new Date(viewYear, viewMonth - 2, 1);
  const nextMonth = new Date(viewYear, viewMonth, 1);
  const monthParam = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      <ModuleHeader icon={CalendarDays} title="Randevu Modülü" description="Takvim, liste, günlük/haftalık görünüm, doktor müsaitliği ve sağlayıcı destekli hatırlatma." />

      {searchParams.success ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">{searchParams.success}</div>
      ) : null}
      {searchParams.error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{searchParams.error}</div>
      ) : null}

      {portalRequests.length > 0 ? (
        <Card className="border-amber-300/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-5 w-5 text-amber-600" />
              Hasta portalı talepleri
              <Badge variant="warning">{portalRequests.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {portalRequests.map((request) => (
              <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {request.patient.firstName} {request.patient.lastName} · {request.treatmentType}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(request.startsAt, locale)} · {request.doctor.name} · {request.branch.name} · {request.patient.phone}
                  </p>
                  {request.notes ? <p className="mt-1 text-xs text-muted-foreground">{request.notes}</p> : null}
                </div>
                <div className="flex gap-2">
                  <form action={resolveRequestAction.bind(null, request.id, "approve")}>
                    <Button type="submit" size="sm">
                      <Check className="h-4 w-4" />
                      Onayla
                    </Button>
                  </form>
                  <form action={resolveRequestAction.bind(null, request.id, "reject")}>
                    <Button type="submit" variant="outline" size="sm">
                      <X className="h-4 w-4" />
                      Reddet
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Yeni randevu</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createAppointmentAction} className="grid gap-4 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="patientId">Hasta</Label>
              <Select id="patientId" name="patientId" required>
                <option value="">Hasta seçin</option>
                {options.patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>{patient.firstName} {patient.lastName}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="doctorId">Doktor</Label>
              <Select id="doctorId" name="doctorId" required>
                <option value="">Doktor seçin</option>
                {options.doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>{doctor.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="startsAt">Tarih / saat</Label>
              <Input id="startsAt" name="startsAt" type="datetime-local" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="durationMinutes">Süre</Label>
              <Select id="durationMinutes" name="durationMinutes" defaultValue="30">
                <option value="30">30 dk</option>
                <option value="45">45 dk</option>
                <option value="60">60 dk</option>
                <option value="90">90 dk</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="room">Oda / koltuk</Label>
              {configuredChairs.length ? <Select id="room" name="room"><option value="">Seçin</option>{configuredChairs.map((chair) => <option key={chair} value={chair}>{chair}</option>)}</Select> : <Input id="room" name="room" placeholder="Koltuk 1" />}
            </div>
            <div className="space-y-2">
              <Label htmlFor="treatmentType">İşlem türü</Label>
              <Input id="treatmentType" name="treatmentType" placeholder="Muayene" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Durum</Label>
              <Select id="status" name="status" defaultValue="PLANNED">
                <option value="PLANNED">Planlandı</option>
                <option value="ARRIVED">Geldi</option>
                <option value="NO_SHOW">Gelmedi</option>
                <option value="CANCELLED">İptal</option>
                <option value="COMPLETED">Tamamlandı</option>
              </Select>
            </div>
            <div className="space-y-2 lg:col-span-4">
              <Label htmlFor="notes">Not</Label>
              <Textarea id="notes" name="notes" />
            </div>
            <Button className="w-fit lg:col-span-4" type="submit">
              <CalendarDays className="h-4 w-4" />
              Randevu Oluştur
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <Link aria-label="Önceki ay" className="rounded-md border p-2" href={`/dashboard/appointments?month=${monthParam(previousMonth)}`}><ChevronLeft className="h-4 w-4" /></Link>
          <CardTitle>{new Intl.DateTimeFormat(intlLocale(locale), { month: "long", year: "numeric" }).format(monthStart)}</CardTitle>
          <Link aria-label="Sonraki ay" className="rounded-md border p-2" href={`/dashboard/appointments?month=${monthParam(nextMonth)}`}><ChevronRight className="h-4 w-4" /></Link>
        </CardHeader>
        <CardContent className="p-0">
      <div className="grid grid-cols-7 border-l border-t">
        {Array.from({ length: 7 }, (_, index) => {
          const day = new Date(2024, 0, 1 + index);
          return <div key={index} className="border-b border-r bg-muted/50 p-2 text-center text-xs font-medium">{new Intl.DateTimeFormat(intlLocale(locale), { weekday: "short" }).format(day)}</div>;
        })}
        {calendarDays.map((day) => {
          const dayAppointments = appointments.filter((appointment) => startOfDay(appointment.startsAt).getTime() === day.getTime());
          const inMonth = day.getMonth() === monthStart.getMonth();
          const isToday = day.getTime() === today.getTime();
          return (
            <div key={day.toISOString()} data-calendar-day className={`min-h-28 border-b border-r p-2 ${inMonth ? "bg-background" : "bg-muted/40 text-muted-foreground"}`}>
                <div className={`mb-2 text-xs font-medium ${isToday ? "inline-grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground" : ""}`}>{day.getDate()}</div>
                <div className="space-y-1">{dayAppointments.map((appointment) => (
                  <div key={appointment.id} className="rounded-md border bg-background p-2 text-xs">
                    <div className="truncate font-medium">{appointment.patient.firstName} {appointment.patient.lastName}</div>
                    <div className="text-muted-foreground">{new Intl.DateTimeFormat(intlLocale(locale), { hour: "2-digit", minute: "2-digit" }).format(appointment.startsAt)} · {appointment.doctor.name}</div>
                  </div>
                ))}
                {dayAppointments.length === 0 ? <p className="text-xs text-muted-foreground">Boş</p> : null}
                </div>
            </div>
          );
        })}
      </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Liste görünümü</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarih</TableHead>
                <TableHead>Hasta</TableHead>
                <TableHead>Doktor</TableHead>
                <TableHead>İşlem</TableHead>
                <TableHead>Oda</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {appointments.map((appointment) => (
                <TableRow key={appointment.id}>
                  <TableCell>{formatDateTime(appointment.startsAt, locale)}</TableCell>
                  <TableCell>{appointment.patient.firstName} {appointment.patient.lastName}</TableCell>
                  <TableCell>{appointment.doctor.name}</TableCell>
                  <TableCell>{appointment.treatmentType}</TableCell>
                  <TableCell>{appointment.room ?? "-"}</TableCell>
                  <TableCell>
                    <form action={updateAppointmentStatusAction.bind(null, appointment.id)} className="flex min-w-48 items-center gap-2">
                      <Select name="status" defaultValue={appointment.status} aria-label={`${appointment.treatmentType} randevu durumu`}>
                        <option value="PLANNED">Planlandı</option><option value="PENDING_CONFIRMATION">Onay bekliyor</option><option value="ARRIVED">Geldi</option><option value="NO_SHOW">Gelmedi</option><option value="CANCELLED">İptal</option><option value="COMPLETED">Tamamlandı</option>
                      </Select>
                      <Button type="submit" size="sm" variant="outline">Kaydet</Button>
                    </form>
                    <div className="mt-2"><Badge variant="muted">{statusLabel(appointment.status, locale)}</Badge></div>
                  </TableCell>
                  <TableCell className="text-right">
                    <form action={sendReminderAction.bind(null, appointment.patientId, appointment.patient.phone)}>
                      <Button type="submit" variant="outline" size="sm">
                        <Send className="h-4 w-4" />
                        Hatırlat
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
          <BellRing className="h-5 w-5 text-primary" />
          Günlük ve haftalık görünüm; doktor, oda ve durum bilgilerini hızlı planlama için birlikte gösterir.
        </CardContent>
      </Card>
    </div>
  );
}
