import { revalidatePath } from "next/cache";
import { BellRing, CalendarDays, Send } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { requireSession } from "@/lib/auth";
import { intlLocale, statusLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { createAppointment, getAppointmentFormOptions, getAppointments } from "@/lib/services/appointmentService";
import { sendMockMessage } from "@/lib/services/notificationService";
import { getWritableBranchId } from "@/lib/services/tenantService";
import { appointmentSchema } from "@/lib/validations/appointment";
import { formatDateTime } from "@/lib/utils";
import { CommunicationChannel } from "@prisma/client";

async function createAppointmentAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  const payload = appointmentSchema.parse(Object.fromEntries(formData));
  await createAppointment(session.organizationId, payload);
  revalidatePath("/dashboard/appointments");
}

async function sendReminderAction(patientId: string, phone: string) {
  "use server";
  const session = await requireSession();
  const branchId = await getWritableBranchId(session);
  await sendMockMessage({
    organizationId: session.organizationId,
    branchId,
    patientId,
    to: phone,
    message: "ClinicNova randevu hatırlatma: yaklaşan randevunuz için sizi bekliyoruz.",
    channel: CommunicationChannel.WHATSAPP
  });
  revalidatePath("/dashboard/communication");
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export default async function AppointmentsPage() {
  const session = await requireSession();
  const locale = getLocale();
  const [appointments, options] = await Promise.all([
    getAppointments(session.organizationId),
    getAppointmentFormOptions(session.organizationId)
  ]);
  const today = startOfDay(new Date());
  const weekDays = Array.from({ length: 7 }).map((_, index) => {
    const day = new Date(today);
    day.setDate(day.getDate() + index);
    return day;
  });

  return (
    <div className="space-y-6">
      <ModuleHeader icon={CalendarDays} title="Randevu Modülü" description="Takvim, liste, günlük/haftalık görünüm, doktor müsaitliği ve mock hatırlatma." />

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
              <Input id="room" name="room" placeholder="Koltuk 1" />
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

      <div className="grid gap-4 xl:grid-cols-7">
        {weekDays.map((day) => {
          const dayAppointments = appointments.filter((appointment) => startOfDay(appointment.startsAt).getTime() === day.getTime());
          return (
            <Card key={day.toISOString()} className="xl:col-span-1">
              <CardHeader className="p-4">
                <CardTitle className="text-sm">{new Intl.DateTimeFormat(intlLocale(locale), { weekday: "short", day: "numeric", month: "short" }).format(day)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-4 pt-0">
                {dayAppointments.slice(0, 4).map((appointment) => (
                  <div key={appointment.id} className="rounded-md border bg-background p-2 text-xs">
                    <div className="font-medium">{appointment.patient.firstName} {appointment.patient.lastName}</div>
                    <div className="text-muted-foreground">{new Intl.DateTimeFormat(intlLocale(locale), { hour: "2-digit", minute: "2-digit" }).format(appointment.startsAt)}</div>
                  </div>
                ))}
                {dayAppointments.length === 0 ? <p className="text-xs text-muted-foreground">Boş</p> : null}
              </CardContent>
            </Card>
          );
        })}
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
                  <TableCell><Badge variant="muted">{statusLabel(appointment.status, locale)}</Badge></TableCell>
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
          Sürükle-bırak takvim için FullCalendar adapter yeri ayrıldı; MVP’de hızlı ve stabil custom takvim görünümü kullanılıyor.
        </CardContent>
      </Card>
    </div>
  );
}
