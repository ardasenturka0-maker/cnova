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
import { addClinicDateKey, clinicDateKey, clinicStartOfDay, clinicTimeZone, parseClinicDateKey, shiftClinicMonth } from "@/lib/clinic-time";
import { intlLocale, statusLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { publicErrorMessage } from "@/lib/public-error";
import { createAppointment, getAppointmentFormOptions, getAppointments } from "@/lib/services/appointmentService";
import { createCalendarNote, deleteCalendarNote, getCalendarNotes } from "@/lib/services/homeBoardService";
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
  return publicErrorMessage(error, fallback);
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

/** Keeps the selected day (and its month) in the URL after a note action. */
function dayResultUrl(type: "success" | "error", message: string, dayKey: string) {
  const params = new URLSearchParams();
  if (dayKey) {
    params.set("month", dayKey.slice(0, 7));
    params.set("day", dayKey);
  }
  params.set(type, message);
  return `/dashboard/appointments?${params.toString()}`;
}

async function addDayNoteAction(formData: FormData) {
  "use server";
  const session = await requireModuleAccess("appointments");
  const dayKey = String(formData.get("dateKey") ?? "");
  try {
    await createCalendarNote(
      session.organizationId,
      session.branchId,
      dayKey,
      String(formData.get("text") ?? ""),
      String(formData.get("doctor") ?? "") || null,
      session.role
    );
  } catch (error) {
    redirect(dayResultUrl("error", actionErrorMessage(error, "Hekim çalışma notu kaydedilemedi."), dayKey));
  }

  revalidatePath("/dashboard/appointments");
  revalidatePath("/dashboard");
  redirect(dayResultUrl("success", "Hekim çalışma notu eklendi.", dayKey));
}

async function deleteDayNoteAction(formData: FormData) {
  "use server";
  const session = await requireModuleAccess("appointments");
  const dayKey = String(formData.get("dateKey") ?? "");
  try {
    await deleteCalendarNote(session.organizationId, String(formData.get("noteId") ?? ""));
  } catch (error) {
    redirect(dayResultUrl("error", actionErrorMessage(error, "Not kaldırılamadı."), dayKey));
  }

  revalidatePath("/dashboard/appointments");
  revalidatePath("/dashboard");
  redirect(dayResultUrl("success", "Not kaldırıldı.", dayKey));
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

export default async function AppointmentsPage(props: { searchParams: Promise<{ success?: string; error?: string; month?: string; day?: string }> }) {
  const searchParams = await props.searchParams;
  const session = await requireModuleAccess("appointments");
  const locale = await getLocale();
  const todayKey = clinicDateKey(new Date());
  const selectedDayKey = parseClinicDateKey(searchParams.day ?? "") ?? todayKey;
  const requestedMonth = /^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(searchParams.month ?? "") ? searchParams.month! : selectedDayKey.slice(0, 7);
  const monthMatch = requestedMonth ?? todayKey.slice(0, 7);
  const monthStartKey = `${monthMatch}-01`;
  const monthStart = clinicStartOfDay(monthStartKey);
  const firstWeekday = new Date(`${monthStartKey}T12:00:00Z`).getUTCDay();
  const calendarStartKey = addClinicDateKey(monthStartKey, -((firstWeekday + 6) % 7));
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const key = addClinicDateKey(calendarStartKey, index);
    return { key, date: clinicStartOfDay(key) };
  });
  const calendarStart = clinicStartOfDay(calendarStartKey);
  const calendarEnd = clinicStartOfDay(addClinicDateKey(calendarStartKey, 42));
  const [appointments, options, portalRequests, organization, calendarNotes] = await Promise.all([
    getAppointments(session.organizationId, { from: calendarStart, to: calendarEnd }),
    getAppointmentFormOptions(session.organizationId),
    getPortalAppointmentRequests(session.organizationId),
    prisma.organization.findUnique({ where: { id: session.organizationId }, select: { clinicSettings: true } }),
    getCalendarNotes(session.organizationId, session.branchId)
  ]);
  const noteDayKeys = new Set(calendarNotes.map((note) => note.dateKey));
  const selectedDayAppointments = appointments
    .filter((appointment) => clinicDateKey(appointment.startsAt) === selectedDayKey)
    .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());
  const selectedDayNotes = calendarNotes.filter((note) => note.dateKey === selectedDayKey);
  const selectedDayLabel = new Intl.DateTimeFormat(intlLocale(locale), { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: clinicTimeZone }).format(clinicStartOfDay(selectedDayKey));
  const settings = organization?.clinicSettings as { chairs?: unknown } | null;
  const configuredChairs = Array.isArray(settings?.chairs) ? settings.chairs.filter((item): item is string => typeof item === "string") : [];
  const previousMonth = shiftClinicMonth(monthStartKey, -1).slice(0, 7);
  const nextMonth = shiftClinicMonth(monthStartKey, 1).slice(0, 7);

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
          <Link aria-label="Önceki ay" className="rounded-md border p-2" href={`/dashboard/appointments?month=${previousMonth}`}><ChevronLeft className="h-4 w-4" /></Link>
          <CardTitle>{new Intl.DateTimeFormat(intlLocale(locale), { month: "long", year: "numeric", timeZone: clinicTimeZone }).format(monthStart)}</CardTitle>
          <Link aria-label="Sonraki ay" className="rounded-md border p-2" href={`/dashboard/appointments?month=${nextMonth}`}><ChevronRight className="h-4 w-4" /></Link>
        </CardHeader>
        <CardContent className="p-0">
      <div className="grid grid-cols-7 border-l border-t">
        {Array.from({ length: 7 }, (_, index) => {
          const day = clinicStartOfDay(addClinicDateKey("2024-01-01", index));
          return <div key={index} className="border-b border-r bg-muted/50 p-2 text-center text-xs font-medium">{new Intl.DateTimeFormat(intlLocale(locale), { weekday: "short", timeZone: clinicTimeZone }).format(day)}</div>;
        })}
        {calendarDays.map((day) => {
          const dayAppointments = appointments.filter((appointment) => clinicDateKey(appointment.startsAt) === day.key);
          const inMonth = day.key.startsWith(monthMatch);
          const isToday = day.key === todayKey;
          const isSelected = day.key === selectedDayKey;
          const hasNote = noteDayKeys.has(day.key);
          return (
            <div key={day.key} data-calendar-day className={`min-h-28 border-b border-r p-2 ${inMonth ? "bg-background" : "bg-muted/40 text-muted-foreground"} ${isSelected ? "ring-2 ring-inset ring-primary" : ""}`}>
                <div className="mb-2 flex items-center gap-1.5">
                  <Link
                    href={`/dashboard/appointments?month=${monthMatch}&day=${day.key}`}
                    aria-label={`${Number(day.key.slice(-2))} gününü seç${hasNote ? ", hekim notu var" : ""}`}
                    className={`text-xs font-medium ${isToday ? "inline-grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground" : "hover:underline"}`}
                  >{Number(day.key.slice(-2))}</Link>
                  {hasNote ? <span className="h-1.5 w-1.5 rounded-full bg-accent" title="Hekim çalışma notu var" /> : null}
                </div>
                <div className="space-y-1">{dayAppointments.map((appointment) => (
                  <div key={appointment.id} className="rounded-md border bg-background p-2 text-xs">
                    <div className="truncate font-medium">{appointment.patient.firstName} {appointment.patient.lastName}</div>
                    <div className="text-muted-foreground">{new Intl.DateTimeFormat(intlLocale(locale), { hour: "2-digit", minute: "2-digit", timeZone: clinicTimeZone }).format(appointment.startsAt)} · {appointment.doctor.name}</div>
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Gün planı</CardTitle>
            <p className="text-sm capitalize text-muted-foreground">{selectedDayLabel} · {selectedDayAppointments.length} randevu</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedDayAppointments.map((appointment) => (
              <div key={appointment.id} className="flex flex-col gap-2 rounded-lg border bg-background p-3 sm:flex-row sm:items-center">
                <div className="shrink-0 rounded-md bg-primary/10 px-3 py-1.5 text-center">
                  <p className="font-bold leading-tight text-primary">{new Intl.DateTimeFormat(intlLocale(locale), { hour: "2-digit", minute: "2-digit", timeZone: clinicTimeZone }).format(appointment.startsAt)}</p>
                  <p className="text-[11px] text-primary/70">{appointment.durationMinutes} dk</p>
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/dashboard/patients/${appointment.patientId}`} className="font-medium hover:underline">
                    {appointment.patient.firstName} {appointment.patient.lastName}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted-foreground">{appointment.treatmentType} · {appointment.doctor.name}{appointment.room ? ` · ${appointment.room}` : ""}</p>
                </div>
                <Badge variant="muted" className="self-start sm:self-center">{statusLabel(appointment.status, locale)}</Badge>
              </div>
            ))}
            {selectedDayAppointments.length === 0 ? (
              <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Bu gün için randevu yok. Takvimden başka bir gün seçebilirsiniz.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Hekim çalışma notları</CardTitle>
            <p className="text-sm text-muted-foreground">Hekimin o gün çalıştığı saatler, izin ve şube bilgisi — randevu verirken burayı kontrol edin.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedDayNotes.map((note) => (
              <div key={note.id} className="flex items-start gap-3 rounded-lg border border-l-4 border-l-accent bg-muted/40 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed">{note.text}</p>
                  {note.doctor ? <p className="mt-1 text-xs font-semibold text-muted-foreground">{note.doctor}</p> : null}
                </div>
                <form action={deleteDayNoteAction}>
                  <input type="hidden" name="noteId" value={note.id} />
                  <input type="hidden" name="dateKey" value={selectedDayKey} />
                  <Button type="submit" size="sm" variant="ghost" aria-label="Notu kaldır"><X className="h-4 w-4" /></Button>
                </form>
              </div>
            ))}
            {selectedDayNotes.length === 0 ? (
              <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">Bu gün için hekim notu yok.</p>
            ) : null}

            <form action={addDayNoteAction} className="space-y-2 rounded-lg border border-dashed p-3">
              <input type="hidden" name="dateKey" value={selectedDayKey} />
              <Textarea name="text" rows={2} maxLength={500} required placeholder="Örn. Dr. Ayşe 09:00-14:00 çalışıyor, sonrasında 1 hafta izinli" aria-label="Hekim çalışma notu" />
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select name="doctor" aria-label="İlgili hekim" className="flex-1">
                  <option value="">Genel not</option>
                  {options.doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.name}>{doctor.name}</option>
                  ))}
                </Select>
                <Button type="submit" size="sm">Notu kaydet</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

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
