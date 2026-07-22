import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CommunicationChannel, CommunicationDirection, CommunicationStatus } from "@prisma/client";
import { ArrowDownLeft, ArrowUpRight, BarChart3, Inbox, MessageSquare, Send, Users } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { requireModuleAccess } from "@/lib/auth";
import { statusLabel, translateText, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { publicErrorMessage } from "@/lib/public-error";
import { sendMessage } from "@/lib/services/notificationService";
import { getWritableBranchId } from "@/lib/services/tenantService";
import { communicationSchema, incomingCommunicationSchema } from "@/lib/validations/engagement";
import { formatDateTime } from "@/lib/utils";

type LogWithPatient = {
  id: string;
  createdAt: Date;
  channel: CommunicationChannel;
  direction?: CommunicationDirection | null;
  subject?: string | null;
  source?: string | null;
  contactName?: string | null;
  contactValue?: string | null;
  message: string;
  status: CommunicationStatus;
  provider?: string | null;
  patient?: { firstName: string; lastName: string } | null;
};

type PatientOption = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
};

function channelLabel(channel: CommunicationChannel, locale: Locale) {
  return statusLabel(channel, locale);
}

function resultUrl(type: "success" | "error", message: string) {
  return `/dashboard/communication?${type}=${encodeURIComponent(message)}`;
}

function personName(log: LogWithPatient) {
  if (log.patient) return `${log.patient.firstName} ${log.patient.lastName}`;
  if (log.contactName) return log.contactName;
  return "Genel";
}

function localizedPersonName(log: LogWithPatient, locale: Locale) {
  return translateText(personName(log), locale);
}

function statusVariant(status: CommunicationStatus) {
  if (status === CommunicationStatus.SENT) return "success";
  if (status === CommunicationStatus.FAILED) return "danger";
  return "warning";
}

async function ensurePatientAccess(patientId: string | undefined, organizationId: string) {
  if (!patientId) return true;
  const count = await prisma.patient.count({ where: { id: patientId, organizationId, deletedAt: null } });
  return count > 0;
}

async function sendMessageAction(formData: FormData) {
  "use server";
  const session = await requireModuleAccess("communication");
  const parsed = communicationSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    redirect(resultUrl("error", parsed.error.issues[0]?.message ?? "Mesaj formu geçersiz."));
  }

  const payload = parsed.data;
  const patientId = payload.patientId || undefined;
  const patientAllowed = await ensurePatientAccess(patientId, session.organizationId);

  if (!patientAllowed) {
    redirect(resultUrl("error", "Seçilen hasta bu kliniğe ait değil."));
  }

  const branchId = await getWritableBranchId(session);
  try {
    await sendMessage({
      organizationId: session.organizationId,
      branchId,
      patientId,
      to: payload.to,
      message: payload.message,
      subject: payload.subject || "Klinik bilgilendirmesi",
      channel: payload.channel as CommunicationChannel
    });
  } catch (error) {
    redirect(resultUrl("error", publicErrorMessage(error, "Mesaj sağlayıcıya teslim edilemedi.")));
  }

  revalidatePath("/dashboard/communication");
  redirect(resultUrl("success", "Giden mesaj sağlayıcıya teslim edildi."));
}

async function logIncomingMessageAction(formData: FormData) {
  "use server";
  const session = await requireModuleAccess("communication");
  const parsed = incomingCommunicationSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    redirect(resultUrl("error", parsed.error.issues[0]?.message ?? "Gelen mesaj formu geçersiz."));
  }

  const payload = parsed.data;
  const patientId = payload.patientId || undefined;
  const patientAllowed = await ensurePatientAccess(patientId, session.organizationId);

  if (!patientAllowed) {
    redirect(resultUrl("error", "Seçilen hasta bu kliniğe ait değil."));
  }

  const branchId = await getWritableBranchId(session);
  await prisma.communicationLog.create({
    data: {
      organizationId: session.organizationId,
      branchId,
      patientId: patientId ?? null,
      channel: payload.channel as CommunicationChannel,
      direction: CommunicationDirection.INBOUND,
      subject: payload.subject,
      source: payload.source || "Manuel gelen kayıt",
      contactName: payload.contactName || null,
      contactValue: payload.contactValue,
      message: payload.message,
      status: CommunicationStatus.SENT,
      provider: "manuel-kayıt"
    }
  });

  revalidatePath("/dashboard/communication");
  redirect(resultUrl("success", "Gelen mesaj tabloya kaydedildi."));
}

function CommunicationRows({ logs, emptyText, locale }: { logs: LogWithPatient[]; emptyText: string; locale: Locale }) {
  if (!logs.length) {
    return (
      <TableRow>
        <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
          {emptyText}
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
      {logs.map((log) => (
        <TableRow key={log.id}>
          <TableCell className="whitespace-nowrap">{formatDateTime(log.createdAt, locale)}</TableCell>
          <TableCell>
            <div className="font-medium">{localizedPersonName(log, locale)}</div>
            <div className="text-xs text-muted-foreground">{log.contactValue ?? "-"}</div>
          </TableCell>
          <TableCell>{channelLabel(log.channel, locale)}</TableCell>
          <TableCell>
            <div className="font-medium">{translateText(log.subject ?? "Konu yok", locale)}</div>
            <div className="text-xs text-muted-foreground">{log.source ?? log.provider ? translateText(log.source ?? log.provider ?? "-", locale) : "-"}</div>
          </TableCell>
          <TableCell className="max-w-[320px] truncate">{translateText(log.message, locale)}</TableCell>
          <TableCell>
            <Badge variant={statusVariant(log.status)}>{statusLabel(log.status, locale)}</Badge>
          </TableCell>
          <TableCell>{log.provider ?? "-"}</TableCell>
        </TableRow>
      ))}
    </>
  );
}

export default async function CommunicationPage(props: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const searchParams = await props.searchParams;
  const session = await requireModuleAccess("communication");
  const locale = await getLocale();
  const [patients, logs] = await Promise.all([
    prisma.patient.findMany({ where: { organizationId: session.organizationId, deletedAt: null }, orderBy: { firstName: "asc" }, take: 200 }),
    prisma.communicationLog.findMany({ where: { organizationId: session.organizationId, OR: [{ patientId: null }, { patient: { deletedAt: null } }] }, include: { patient: true }, orderBy: { createdAt: "desc" }, take: 150 })
  ]);

  const typedPatients = patients as PatientOption[];
  const typedLogs = logs as LogWithPatient[];
  const inboundLogs = typedLogs.filter((log) => (log.direction ?? CommunicationDirection.OUTBOUND) === CommunicationDirection.INBOUND);
  const outboundLogs = typedLogs.filter((log) => (log.direction ?? CommunicationDirection.OUTBOUND) === CommunicationDirection.OUTBOUND);
  const channelStats = Object.values(CommunicationChannel).map((channel) => {
    const inbound = inboundLogs.filter((log) => log.channel === channel).length;
    const outbound = outboundLogs.filter((log) => log.channel === channel).length;
    return { channel, inbound, outbound, total: inbound + outbound };
  });
  const topChannel = [...channelStats].sort((a, b) => b.total - a.total)[0];
  const sourceStats = inboundLogs.reduce<Record<string, number>>((acc, log) => {
    const source = log.source ?? log.provider ?? "Bilinmeyen kaynak";
    acc[source] = (acc[source] ?? 0) + 1;
    return acc;
  }, {});
  const topSource = Object.entries(sourceStats).sort((a, b) => b[1] - a[1])[0];
  const patientChannelStats = Object.values(
    typedLogs.reduce<Record<string, { name: string; channel: CommunicationChannel; inbound: number; outbound: number; lastSubject: string; lastDate: Date }>>((acc, log) => {
      const name = personName(log);
      const key = `${name}-${log.channel}`;
      const direction = log.direction ?? CommunicationDirection.OUTBOUND;

      if (!acc[key]) {
        acc[key] = { name, channel: log.channel, inbound: 0, outbound: 0, lastSubject: log.subject ?? "-", lastDate: log.createdAt };
      }

      if (direction === CommunicationDirection.INBOUND) {
        acc[key].inbound += 1;
      } else {
        acc[key].outbound += 1;
      }

      if (log.createdAt > acc[key].lastDate) {
        acc[key].lastDate = log.createdAt;
        acc[key].lastSubject = log.subject ?? "-";
      }

      return acc;
    }, {})
  ).sort((a, b) => b.inbound + b.outbound - (a.inbound + a.outbound));
  const t = (value: string) => translateText(value, locale);

  return (
    <div className="space-y-6">
      <ModuleHeader icon={MessageSquare} title="İletişim" description="Giden mesajlar, gelen hasta dönüşleri, kanal kırılımı ve görünürlük istatistikleri." />

      {searchParams.success ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">{t(searchParams.success)}</div> : null}
      {searchParams.error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{t(searchParams.error)}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Gelen mesaj" value={String(inboundLogs.length)} detail={topSource ? t(`${topSource[0]} öne çıkıyor`) : t("Henüz gelen kayıt yok")} icon={Inbox} tone="accent" />
        <StatCard title="Giden mesaj" value={String(outboundLogs.length)} detail={t(`${outboundLogs.filter((log) => log.status === CommunicationStatus.SENT).length} başarılı gönderim`)} icon={Send} tone="success" />
        <StatCard title="En yoğun kanal" value={topChannel ? channelLabel(topChannel.channel, locale) : "-"} detail={topChannel ? t(`${topChannel.total} toplam temas`) : t("Veri yok")} icon={BarChart3} tone="primary" />
        <StatCard title="Hasta/kanal görünürlüğü" value={String(patientChannelStats.length)} detail={t(`${patientChannelStats.length} kişi ve kanal eşleşmesi`)} icon={Users} tone="warning" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Mesaj gönder</CardTitle>
            <CardDescription>WhatsApp, SMS veya e-postayı yapılandırılmış canlı sağlayıcı üzerinden gönderir ve teslimat sonucunu kaydeder.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={sendMessageAction} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Hasta</Label>
                <Select name="patientId">
                  <option value="">{t("Genel")}</option>
                  {typedPatients.map((patient) => (
                    <option key={patient.id} value={patient.id}>{patient.firstName} {patient.lastName}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Alıcı</Label>
                <Input name="to" placeholder="+90..., hasta@mail.com" required />
              </div>
              <div className="space-y-2">
                <Label>Kanal</Label>
                <Select name="channel" defaultValue="WHATSAPP">
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="SMS">SMS</option>
                  <option value="EMAIL">E-posta</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Konu</Label>
                <Input name="subject" defaultValue={t("Klinik bilgilendirmesi")} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Mesaj</Label>
                <Textarea name="message" defaultValue={t("ClinicNova bilgilendirme mesajı.")} />
              </div>
              <Button className="w-fit md:col-span-2" type="submit"><ArrowUpRight className="h-4 w-4" />Gönder</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gelen mesaj kaydet</CardTitle>
            <CardDescription>Hastadan gelen yanıtı kaynak, kanal ve konu bilgisiyle tabloya ekler.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={logIncomingMessageAction} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Hasta</Label>
                <Select name="patientId">
                  <option value="">{t("Bilinmeyen kişi")}</option>
                  {typedPatients.map((patient) => (
                    <option key={patient.id} value={patient.id}>{patient.firstName} {patient.lastName}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Kimden</Label>
                <Input name="contactName" placeholder={t("Ad soyad")} />
              </div>
              <div className="space-y-2">
                <Label>İletişim bilgisi</Label>
                <Input name="contactValue" placeholder="+90..., hasta@mail.com" required />
              </div>
              <div className="space-y-2">
                <Label>Kanal</Label>
                <Select name="channel" defaultValue="WHATSAPP">
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="SMS">SMS</option>
                  <option value="EMAIL">E-posta</option>
                  <option value="PHONE">Telefon</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nereden geldi</Label>
                <Input name="source" defaultValue={t("Hasta yanıtı")} placeholder={t("WhatsApp yanıtı, telefon araması...")} />
              </div>
              <div className="space-y-2">
                <Label>Konu</Label>
                <Input name="subject" placeholder={t("Randevu değişikliği, ödeme sorusu...")} required />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Mesaj</Label>
                <Textarea name="message" placeholder={t("Gelen mesaj veya görüşme notu")} required />
              </div>
              <Button className="w-fit md:col-span-2" type="submit"><ArrowDownLeft className="h-4 w-4" />Geleni Kaydet</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Kanal istatistikleri</CardTitle>
            <CardDescription>Hangi kanaldan kaç gelen ve giden temas olduğunu gösterir.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Kanal</TableHead><TableHead>Gelen</TableHead><TableHead>Giden</TableHead><TableHead>Toplam</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {channelStats.map((stat) => (
                  <TableRow key={stat.channel}>
                    <TableCell>{channelLabel(stat.channel, locale)}</TableCell>
                    <TableCell><Badge className="bg-sky-500/10 text-sky-700 dark:text-sky-300">{stat.inbound}</Badge></TableCell>
                    <TableCell><Badge variant="success">{stat.outbound}</Badge></TableCell>
                    <TableCell className="font-medium">{stat.total}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kim hangi kanaldan ulaşıyor</CardTitle>
            <CardDescription>Hasta veya kişi bazında kanal yoğunluğu ve son konu görünürlüğü.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Kişi</TableHead><TableHead>Kanal</TableHead><TableHead>Gelen</TableHead><TableHead>Giden</TableHead><TableHead>Son konu</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {patientChannelStats.slice(0, 10).map((stat) => (
                  <TableRow key={`${stat.name}-${stat.channel}`}>
                    <TableCell>{t(stat.name)}</TableCell>
                    <TableCell>{channelLabel(stat.channel, locale)}</TableCell>
                    <TableCell>{stat.inbound}</TableCell>
                    <TableCell>{stat.outbound}</TableCell>
                    <TableCell className="max-w-[220px] truncate">{t(stat.lastSubject)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gelen mesajlar</CardTitle>
          <CardDescription>Nereden geldiği, konusu, kişi bilgisi ve kanalıyla tablo halinde listelenir.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Tarih</TableHead><TableHead>Kimden</TableHead><TableHead>Kanal</TableHead><TableHead>Konu / Kaynak</TableHead><TableHead>Mesaj</TableHead><TableHead>Durum</TableHead><TableHead>Kayıt</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              <CommunicationRows logs={inboundLogs} emptyText="Henüz gelen mesaj kaydı yok." locale={locale} />
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gönderilen mesajlar</CardTitle>
          <CardDescription>Kliniğin hastalara yaptığı WhatsApp, SMS ve e-posta teslimatlarının doğrulanabilir kayıtları.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Tarih</TableHead><TableHead>Alıcı</TableHead><TableHead>Kanal</TableHead><TableHead>Konu / Kaynak</TableHead><TableHead>Mesaj</TableHead><TableHead>Durum</TableHead><TableHead>Provider</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              <CommunicationRows logs={outboundLogs} emptyText="Henüz gönderilen mesaj kaydı yok." locale={locale} />
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
