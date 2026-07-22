import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, CircleDot, History, Pencil, PlayCircle, Stethoscope } from "lucide-react";
import Link from "next/link";
import { Role, TreatmentStatus } from "@prisma/client";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { PaymentPlanBuilder } from "@/components/dashboard/payment-plan-builder";
import { PaymentPlanDisplay } from "@/components/dashboard/payment-plan-display";
import { TreatmentStatusBadge } from "@/components/dashboard/treatment-status-badge";
import { PatientDoctorFields } from "@/components/dashboard/patient-doctor-fields";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { requireModuleAccess } from "@/lib/auth";
import { clinicDateKey, parseClinicDateTime } from "@/lib/clinic-time";
import { getLocale } from "@/lib/i18n-server";
import { buildPaymentPlan, parsePaymentPlan } from "@/lib/payment-plan";
import { prisma } from "@/lib/prisma";
import { publicErrorMessage } from "@/lib/public-error";
import { consumeTreatmentRecipe, setTreatmentStatus, updateTreatmentRecord } from "@/lib/services/treatmentStockService";
import { treatmentSchema } from "@/lib/validations/treatment";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

function resultUrl(type: "success" | "error", message: string) {
  return `/dashboard/treatments?${type}=${encodeURIComponent(message)}`;
}

async function createTreatmentAction(formData: FormData) {
  "use server";
  const session = await requireModuleAccess("treatments");
  const parsed = treatmentSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    redirect(resultUrl("error", parsed.error.issues[0]?.message ?? "Tedavi formu geçersiz."));
  }

  const payload = parsed.data;
  const patient = await prisma.patient.findFirst({ where: { id: payload.patientId, organizationId: session.organizationId, deletedAt: null }, select: { branchId: true } });

  if (!patient) {
    redirect(resultUrl("error", "Seçilen hasta bulunamadı veya bu kliniğe ait değil."));
  }

  const doctor = await prisma.user.findFirst({
    where: {
      id: payload.doctorId,
      organizationId: session.organizationId,
      active: true,
      role: { in: [Role.DOCTOR, Role.CLINIC_OWNER] },
      OR: [{ branchId: patient.branchId }, { branchId: null }]
    },
    select: { id: true }
  });

  if (!doctor) {
    redirect(resultUrl("error", "Seçilen doktor aktif değil veya hastanın şubesinde çalışmıyor."));
  }

  try {
    const paymentPlan = buildPaymentPlan({
      total: payload.fee,
      downPayment: payload.downPayment,
      installmentCount: payload.installmentCount,
      firstInstallmentDate: payload.firstInstallmentDate || null,
      note: payload.paymentPlanNote || null
    });

    await prisma.$transaction(async (tx) => {
      const treatment = await tx.treatment.create({ data: {
        patientId: payload.patientId,
        doctorId: payload.doctorId,
        toothNumber: payload.toothNumber || null,
        treatmentType: payload.treatmentType,
        description: payload.description || null,
        fee: payload.fee,
        paymentPlan,
        status: payload.status as TreatmentStatus,
        performedAt: payload.date ? parseClinicDateTime(`${payload.date}T12:00`)! : new Date(),
        organizationId: session.organizationId,
        branchId: patient.branchId
      } });
      if (treatment.status === TreatmentStatus.COMPLETED) {
        await consumeTreatmentRecipe(tx, session.organizationId, patient.branchId, treatment.treatmentType, { treatmentId: treatment.id });
      }
      return treatment;
    });
  } catch (error) {
    redirect(resultUrl("error", publicErrorMessage(error, "Tedavi kaydedilemedi. Lütfen bilgileri kontrol edip tekrar deneyin.")));
  }

  revalidatePath("/dashboard/treatments");
  revalidatePath(`/dashboard/patients/${payload.patientId}`);
  revalidatePath("/dashboard/reports");
  redirect(resultUrl("success", "Tedavi kaydı oluşturuldu."));
}

async function updateTreatmentStatusAction(treatmentId: string, formData: FormData) {
  "use server";
  const session = await requireModuleAccess("treatments");
  const status = formData.get("status");
  if (typeof status !== "string" || !Object.values(TreatmentStatus).includes(status as TreatmentStatus)) {
    redirect(resultUrl("error", "Tedavi durumu geçersiz."));
  }
  try {
    const treatment = await setTreatmentStatus(session.organizationId, treatmentId, status as TreatmentStatus);
    revalidatePath(`/dashboard/patients/${treatment.patientId}`);
  } catch (error) {
    redirect(resultUrl("error", publicErrorMessage(error, "Tedavi durumu güncellenemedi.")));
  }
  revalidatePath("/dashboard/treatments");
  revalidatePath("/dashboard/stocks");
  revalidatePath("/dashboard/reports");
  redirect(resultUrl("success", status === TreatmentStatus.COMPLETED ? "Tedavi tamamlandı; reçetedeki malzemeler stoktan otomatik düşüldü." : "Tedavi durumu güncellendi; gerekiyorsa stok iadesi işlendi."));
}

async function updateTreatmentRecordAction(treatmentId: string, formData: FormData) {
  "use server";
  const session = await requireModuleAccess("treatments");
  const parsed = treatmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(resultUrl("error", parsed.error.issues[0]?.message ?? "Tedavi güncelleme formu geçersiz."));
  try {
    const treatment = await updateTreatmentRecord(session.organizationId, treatmentId, parsed.data);
    revalidatePath(`/dashboard/patients/${treatment.patientId}`);
  } catch (error) {
    redirect(resultUrl("error", publicErrorMessage(error, "Tedavi kaydı güncellenemedi.")));
  }
  revalidatePath("/dashboard/treatments");
  revalidatePath("/dashboard/stocks");
  revalidatePath("/dashboard/reports");
  redirect(resultUrl("success", "Tedavi bilgileri ve tahsilat planı güncellendi."));
}

export default async function TreatmentsPage(props: { searchParams: Promise<{ success?: string; error?: string; historyPage?: string }> }) {
  const searchParams = await props.searchParams;
  const session = await requireModuleAccess("treatments");
  const locale = await getLocale();
  const today = clinicDateKey(new Date());
  const treatmentScope = { organizationId: session.organizationId, patient: { deletedAt: null } };
  const activeStatuses = [TreatmentStatus.PROPOSED, TreatmentStatus.ACCEPTED, TreatmentStatus.STARTED];
  const historyPageSize = 50;
  const requestedHistoryPage = Math.max(1, Number.parseInt(searchParams.historyPage ?? "1", 10) || 1);
  const [activeTreatments, activeTreatmentCount, completedTreatmentCount, cancelledTreatments, patients, doctors] = await Promise.all([
    prisma.treatment.findMany({
      where: { ...treatmentScope, status: { in: activeStatuses } },
      include: { patient: true, doctor: { select: { name: true } }, branch: { select: { name: true } } },
      orderBy: { performedAt: "desc" },
      take: 200
    }),
    prisma.treatment.count({ where: { ...treatmentScope, status: { in: activeStatuses } } }),
    prisma.treatment.count({ where: { ...treatmentScope, status: TreatmentStatus.COMPLETED } }),
    prisma.treatment.findMany({
      where: { ...treatmentScope, status: TreatmentStatus.CANCELLED },
      include: { patient: true, doctor: { select: { name: true } }, branch: { select: { name: true } } },
      orderBy: { performedAt: "desc" },
      take: 50
    }),
    prisma.patient.findMany({ where: { organizationId: session.organizationId, deletedAt: null }, select: { id: true, firstName: true, lastName: true, branchId: true }, orderBy: { firstName: "asc" }, take: 200 }),
    prisma.user.findMany({ where: { organizationId: session.organizationId, role: { in: [Role.DOCTOR, Role.CLINIC_OWNER] }, active: true }, select: { id: true, name: true, branchId: true }, orderBy: { name: "asc" } })
  ]);
  const completedTreatmentPages = Math.max(1, Math.ceil(completedTreatmentCount / historyPageSize));
  const historyPage = Math.min(requestedHistoryPage, completedTreatmentPages);
  const completedTreatments = await prisma.treatment.findMany({
    where: { ...treatmentScope, status: TreatmentStatus.COMPLETED },
    include: { patient: true, doctor: { select: { name: true } }, branch: { select: { name: true } } },
    orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
    skip: (historyPage - 1) * historyPageSize,
    take: historyPageSize
  });

  return (
    <div className="space-y-6">
      <ModuleHeader icon={Stethoscope} title="Tedavi Modülü" description="Tedaviyi adım adım ilerletin; bitirdiğiniz kayıt otomatik olarak hasta ve geçmiş tedavi raporlarına taşınsın." actionHref="/dashboard/treatment-plans" actionLabel="Tedavi Planları" />
      {searchParams.success ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">{searchParams.success}</div>
      ) : null}
      {searchParams.error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{searchParams.error}</div>
      ) : null}
      <Card>
        <CardHeader><CardTitle>Tedavi ekle</CardTitle></CardHeader>
        <CardContent>
          <form action={createTreatmentAction} className="grid gap-4 lg:grid-cols-4">
            <PatientDoctorFields patients={patients} doctors={doctors} />
            <div className="space-y-2"><Label>Diş no</Label><Input name="toothNumber" /></div>
            <div className="space-y-2"><Label>Tedavi türü</Label><Input name="treatmentType" placeholder="Dolgu" required /></div>
            <PaymentPlanBuilder totalName="fee" totalLabel="Tedavi ücreti" today={today} locale={locale} />
            <div className="space-y-2"><Label>Durum</Label><Select name="status" defaultValue="STARTED"><option value="PROPOSED">Önerildi</option><option value="ACCEPTED">Kabul edildi</option><option value="STARTED">Başladı</option><option value="COMPLETED">Tamamlandı</option><option value="CANCELLED">İptal</option></Select></div>
            <div className="space-y-2"><Label>Tarih</Label><Input name="date" type="date" /></div>
            <div className="space-y-2 lg:col-span-4"><Label>Açıklama</Label><Textarea name="description" /></div>
            <Button className="w-fit lg:col-span-4" type="submit">Tedavi Kaydet</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><PlayCircle className="h-5 w-5 text-amber-600" />Tedavi ilerletme <span className="text-sm font-normal text-muted-foreground">({activeTreatmentCount} devam eden)</span></CardTitle>
        </CardHeader>
        <CardContent>
          {activeTreatments.length ? <div className="grid gap-4 xl:grid-cols-2">
            {activeTreatments.map((item) => {
              const stages: TreatmentStatus[] = [TreatmentStatus.PROPOSED, TreatmentStatus.ACCEPTED, TreatmentStatus.STARTED, TreatmentStatus.COMPLETED];
              const currentStage = stages.indexOf(item.status);
              const nextStatus = item.status === TreatmentStatus.PROPOSED ? TreatmentStatus.ACCEPTED : item.status === TreatmentStatus.ACCEPTED ? TreatmentStatus.STARTED : TreatmentStatus.COMPLETED;
              const nextLabel = item.status === TreatmentStatus.PROPOSED ? "Planı kabul et" : item.status === TreatmentStatus.ACCEPTED ? "Tedaviyi başlat" : "Tedaviyi bitir";
              const paymentPlan = parsePaymentPlan(item.paymentPlan);
              const eligibleDoctors = doctors.filter((doctor) => doctor.branchId === null || doctor.branchId === item.branchId);
              return <article key={item.id} className="rounded-xl border bg-background p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={`/dashboard/patients/${item.patientId}`} className="font-semibold text-primary hover:underline">{item.patient.firstName} {item.patient.lastName}</Link>
                    <p className="mt-1 text-sm"><strong>{item.treatmentType}</strong>{item.toothNumber ? ` · Diş ${item.toothNumber}` : ""}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.doctor.name} · {item.branch.name} · {formatDate(item.performedAt, locale)}</p>
                  </div>
                  <TreatmentStatusBadge status={item.status} locale={locale} />
                </div>

                <ol className="mt-4 grid grid-cols-4 gap-1" aria-label="Tedavi ilerleme aşamaları">
                  {stages.map((stage, index) => <li key={stage} className="min-w-0 text-center">
                    <span className={index <= currentStage ? "mx-auto grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground" : "mx-auto grid h-7 w-7 place-items-center rounded-full border bg-muted text-muted-foreground"}>
                      {index < currentStage ? <CheckCircle2 className="h-4 w-4" /> : <CircleDot className="h-3.5 w-3.5" />}
                    </span>
                    <span className="mt-1 block truncate text-[10px] text-muted-foreground">{stage === TreatmentStatus.PROPOSED ? "Önerildi" : stage === TreatmentStatus.ACCEPTED ? "Kabul" : stage === TreatmentStatus.STARTED ? "Başladı" : "Bitti"}</span>
                  </li>)}
                </ol>

                {item.description ? <p className="mt-4 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">{item.description}</p> : null}
                <div className="mt-4"><PaymentPlanDisplay value={item.paymentPlan} locale={locale} compact /></div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <form action={updateTreatmentStatusAction.bind(null, item.id)} className="flex items-center gap-2">
                    <Select name="status" defaultValue={item.status} aria-label={`${item.treatmentType} durumu`}>
                      <option value="PROPOSED">Önerildi</option><option value="ACCEPTED">Kabul edildi</option><option value="STARTED">Başladı</option><option value="COMPLETED">Tamamlandı</option><option value="CANCELLED">İptal</option>
                    </Select>
                    <Button type="submit" size="sm" variant="outline">Durumu kaydet</Button>
                  </form>
                  <form action={updateTreatmentStatusAction.bind(null, item.id)}>
                    <Button type="submit" name="status" value={nextStatus} size="sm" variant={nextStatus === TreatmentStatus.COMPLETED ? "default" : "accent"}>
                      {nextLabel}<ArrowRight className="h-4 w-4" />
                    </Button>
                  </form>
                </div>

                <details className="mt-4 border-t pt-4">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-primary"><Pencil className="h-4 w-4" />Tedaviyi geliştir / bilgileri düzenle</summary>
                  <form action={updateTreatmentRecordAction.bind(null, item.id)} className="mt-4 grid gap-4 rounded-lg border bg-muted/20 p-4 md:grid-cols-2 lg:grid-cols-4">
                    <input type="hidden" name="patientId" value={item.patientId} />
                    <div className="space-y-2"><Label>Hasta</Label><Input value={`${item.patient.firstName} ${item.patient.lastName}`} disabled /></div>
                    <div className="space-y-2"><Label>Doktor</Label><Select name="doctorId" defaultValue={item.doctorId} required>{eligibleDoctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}</Select></div>
                    <div className="space-y-2"><Label>Diş no</Label><Input name="toothNumber" defaultValue={item.toothNumber ?? ""} /></div>
                    <div className="space-y-2"><Label>Tedavi türü</Label><Input name="treatmentType" defaultValue={item.treatmentType} required /></div>
                    <PaymentPlanBuilder
                      idPrefix={`treatment-${item.id}`}
                      totalName="fee"
                      totalLabel="Tedavi ücreti"
                      today={today}
                      locale={locale}
                      initialTotal={Number(item.fee)}
                      initialDownPayment={paymentPlan?.downPayment ?? 0}
                      initialInstallmentCount={paymentPlan?.installmentCount ?? 1}
                      initialFirstInstallmentDate={paymentPlan?.firstInstallmentDate ?? ""}
                      initialNote={paymentPlan?.note ?? ""}
                    />
                    <div className="space-y-2"><Label>Durum</Label><Select name="status" defaultValue={item.status}><option value="PROPOSED">Önerildi</option><option value="ACCEPTED">Kabul edildi</option><option value="STARTED">Başladı</option><option value="COMPLETED">Tamamlandı</option><option value="CANCELLED">İptal</option></Select></div>
                    <div className="space-y-2"><Label>İşlem tarihi</Label><Input name="date" type="date" defaultValue={clinicDateKey(item.performedAt)} /></div>
                    <div className="space-y-2 md:col-span-2 lg:col-span-4"><Label>Klinik açıklama / ilerleme notu</Label><Textarea name="description" defaultValue={item.description ?? ""} /></div>
                    <Button type="submit" className="w-fit md:col-span-2 lg:col-span-4"><Pencil className="h-4 w-4" />Değişiklikleri kaydet</Button>
                  </form>
                </details>
              </article>;
            })}
          </div> : <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Devam eden tedavi yok. Yeni tedavi eklediğinizde ilerleme adımları burada görünür.</p>}
        </CardContent>
      </Card>

      <Card id="gecmis-tedaviler">
        <CardHeader><CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-emerald-600" />Geçmiş tedaviler <span className="text-sm font-normal text-muted-foreground">({completedTreatmentCount} tamamlanan)</span></CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Bitiş / işlem tarihi</TableHead><TableHead>Hasta</TableHead><TableHead>Doktor</TableHead><TableHead>Tedavi</TableHead><TableHead>Ücret</TableHead><TableHead>Tahsilat planı</TableHead><TableHead>Durum</TableHead><TableHead className="text-right">İşlem</TableHead></TableRow></TableHeader>
            <TableBody>
              {completedTreatments.map((item) => <TableRow key={item.id}>
                <TableCell>{formatDate(item.performedAt, locale)}</TableCell>
                <TableCell><Link href={`/dashboard/patients/${item.patientId}`} className="font-medium text-primary hover:underline">{item.patient.firstName} {item.patient.lastName}</Link></TableCell>
                <TableCell>{item.doctor.name}</TableCell>
                <TableCell>{item.treatmentType}{item.toothNumber ? ` · Diş ${item.toothNumber}` : ""}</TableCell>
                <TableCell className="font-medium">{formatCurrency(item.fee, locale)}</TableCell>
                <TableCell><PaymentPlanDisplay value={item.paymentPlan} locale={locale} compact /></TableCell>
                <TableCell><TreatmentStatusBadge status={item.status} locale={locale} /></TableCell>
                <TableCell className="text-right"><form action={updateTreatmentStatusAction.bind(null, item.id)}><Button type="submit" name="status" value={TreatmentStatus.STARTED} size="sm" variant="outline">Tedaviyi yeniden aç</Button></form></TableCell>
              </TableRow>)}
              {!completedTreatments.length ? <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">Bitirilen tedaviler otomatik olarak burada ve hasta raporunda görünür.</TableCell></TableRow> : null}
            </TableBody>
          </Table>
          {completedTreatmentPages > 1 ? <div className="flex items-center justify-between gap-3 border-t p-4 text-sm">
            <span className="text-muted-foreground">Sayfa {historyPage} / {completedTreatmentPages}</span>
            <div className="flex gap-2">
              {historyPage > 1 ? <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }))} href={`/dashboard/treatments?historyPage=${historyPage - 1}#gecmis-tedaviler`}>Önceki</Link> : null}
              {historyPage < completedTreatmentPages ? <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }))} href={`/dashboard/treatments?historyPage=${historyPage + 1}#gecmis-tedaviler`}>Sonraki</Link> : null}
            </div>
          </div> : null}
        </CardContent>
      </Card>

      {cancelledTreatments.length ? <details className="rounded-lg border bg-card p-4">
        <summary className="cursor-pointer text-sm font-semibold">İptal edilen tedaviler ({cancelledTreatments.length})</summary>
        <div className="mt-3 space-y-2">{cancelledTreatments.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"><span>{item.patient.firstName} {item.patient.lastName} · {item.treatmentType}</span><TreatmentStatusBadge status={item.status} locale={locale} /></div>)}</div>
      </details> : null}
    </div>
  );
}
