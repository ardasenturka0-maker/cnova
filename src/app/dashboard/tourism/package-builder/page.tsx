import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Eye, Mail, PackagePlus, Send, Share2 } from "lucide-react";
import { TourismLeadStatus, TourismPackageStatus } from "@prisma/client";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { requireSession } from "@/lib/auth";
import { getLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { sendPackageToN8n } from "@/lib/services/integrations/n8nProvider";
import { packageBuilderSchema } from "@/lib/validations/tourism";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { leadStatusLabel, packageStatusLabel, sourceLabel, statusTone } from "@/lib/tourism";

function resultUrl(type: "success" | "error", message: string) {
  return `/dashboard/tourism/package-builder?${type}=${encodeURIComponent(message)}`;
}

async function createPackageAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  const parsed = packageBuilderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(resultUrl("error", parsed.error.issues[0]?.message ?? "Paket formu geçersiz."));
  const payload = parsed.data;
  const lead = await prisma.lead.findFirst({ where: { id: payload.leadId, organizationId: session.organizationId } });
  if (!lead) redirect(resultUrl("error", "Lead bulunamadı."));

  const treatmentTotal = payload.quantity * payload.unitPrice;
  const finalPrice = treatmentTotal + payload.hotelPrice + payload.transferPrice - payload.discount;
  const tourismPackage = await prisma.tourismPackage.create({
    data: {
      organizationId: session.organizationId,
      branchId: lead.branchId,
      leadId: lead.id,
      publicToken: randomUUID(),
      packageTitle: payload.packageTitle,
      treatmentSummary: payload.treatmentSummary,
      hotelInfo: payload.hotelInfo || null,
      transferInfo: payload.transferInfo || null,
      arrivalAirport: payload.arrivalAirport || null,
      arrivalDate: payload.arrivalDate ? new Date(payload.arrivalDate) : null,
      departureDate: payload.departureDate ? new Date(payload.departureDate) : null,
      numberOfCompanions: payload.numberOfCompanions,
      totalTreatmentPrice: treatmentTotal,
      hotelPrice: payload.hotelPrice,
      transferPrice: payload.transferPrice,
      discount: payload.discount,
      finalPrice,
      currency: payload.currency,
      packageStatus: TourismPackageStatus.SENT,
      validUntil: payload.validUntil ? new Date(payload.validUntil) : null,
      notes: payload.notes || null,
      createdByUserId: session.userId
    }
  });

  await prisma.treatmentPackageItem.create({
    data: {
      organizationId: session.organizationId,
      packageId: tourismPackage.id,
      treatmentName: payload.treatmentName,
      toothArea: payload.toothArea || null,
      quantity: payload.quantity,
      unitPrice: payload.unitPrice,
      totalPrice: treatmentTotal,
      estimatedDuration: "3-7 gün",
      explanation: payload.treatmentSummary
    }
  });

  await prisma.lead.update({ where: { id: lead.id }, data: { leadStatus: TourismLeadStatus.PACKAGE_SENT, lastContactAt: new Date(), nextFollowUpAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) } });
  await prisma.leadMessage.create({
    data: {
      organizationId: session.organizationId,
      branchId: lead.branchId,
      leadId: lead.id,
      direction: "OUTBOUND",
      channel: "WHATSAPP",
      source: "package-builder",
      subject: "Tedavi + otel + transfer paketi",
      message: `${payload.packageTitle} paketi gönderildi. Public link: /package/${tourismPackage.publicToken}`
    }
  });
  await sendPackageToN8n(tourismPackage);
  revalidatePath("/dashboard/tourism/package-builder");
  redirect(resultUrl("success", "Paket oluşturuldu, lead PACKAGE_SENT oldu ve n8n mock tetiklendi."));
}

export default async function PackageBuilderPage(
  props: { searchParams: Promise<{ leadId?: string; success?: string; error?: string }> }
) {
  const searchParams = await props.searchParams;
  const session = await requireSession();
  const locale = await getLocale();
  const [leads, packages, items, hotels, transfers] = await Promise.all([
    prisma.lead.findMany({ where: { organizationId: session.organizationId }, orderBy: { leadScore: "desc" }, take: 100 }),
    prisma.tourismPackage.findMany({ where: { organizationId: session.organizationId }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.treatmentPackageItem.findMany({ where: { organizationId: session.organizationId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.hotelPartner.findMany({ where: { organizationId: session.organizationId, active: true }, orderBy: { pricePerNight: "asc" }, take: 20 }),
    prisma.transferPartner.findMany({ where: { organizationId: session.organizationId, active: true }, orderBy: { basePrice: "asc" }, take: 20 })
  ]);
  const selectedLead = leads.find((lead) => lead.id === searchParams.leadId) ?? leads[0];
  const defaultHotel = hotels[0];
  const defaultTransfer = transfers[0];

  return (
    <div className="space-y-6">
      <ModuleHeader icon={PackagePlus} title="Paket Oluşturucu" description="Satış temsilcisi tek ekranda tedavi + otel + transfer teklifini hazırlayıp hastaya gönderir." />
      {searchParams.success ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{searchParams.success}</div> : null}
      {searchParams.error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{searchParams.error}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader><CardTitle>Paket Formu</CardTitle><CardDescription>Oluşturulan paket public link, WhatsApp/e-posta metni ve n8n paylaşımına hazırdır.</CardDescription></CardHeader>
          <CardContent>
            <form action={createPackageAction} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2"><Label>Lead</Label><Select name="leadId" defaultValue={selectedLead?.id}>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.fullName} · {lead.country} · {lead.interestedTreatment}</option>)}</Select></div>
              <div className="space-y-2"><Label>Paket başlığı</Label><Input name="packageTitle" defaultValue={selectedLead ? `${selectedLead.interestedTreatment} + Hotel + Transfer` : ""} required /></div>
              <div className="space-y-2"><Label>Tedavi kalemi</Label><Input name="treatmentName" defaultValue={selectedLead?.interestedTreatment ?? "Dental Implant"} required /></div>
              <div className="space-y-2"><Label>Diş/bölge</Label><Input name="toothArea" defaultValue="Smile zone" /></div>
              <div className="space-y-2"><Label>Adet</Label><Input name="quantity" type="number" defaultValue={1} min={1} /></div>
              <div className="space-y-2"><Label>Birim fiyat</Label><Input name="unitPrice" type="number" defaultValue={4200} min={0} /></div>
              <div className="space-y-2"><Label>Otel</Label><Select name="hotelInfo" defaultValue={defaultHotel?.name}>{hotels.map((hotel) => <option key={hotel.id} value={`${hotel.name}, ${hotel.city}`}>{hotel.name} · {formatCurrency(hotel.pricePerNight, locale)}/gece</option>)}</Select></div>
              <div className="space-y-2"><Label>Transfer</Label><Select name="transferInfo" defaultValue={defaultTransfer?.name}>{transfers.map((transfer) => <option key={transfer.id} value={`${transfer.name}, ${transfer.airportList}`}>{transfer.name} · {formatCurrency(transfer.basePrice, locale)}</option>)}</Select></div>
              <div className="space-y-2"><Label>Havalimanı</Label><Select name="arrivalAirport" defaultValue="IST"><option value="IST">IST</option><option value="SAW">SAW</option></Select></div>
              <div className="space-y-2"><Label>Geliş</Label><Input name="arrivalDate" type="date" /></div>
              <div className="space-y-2"><Label>Dönüş</Label><Input name="departureDate" type="date" /></div>
              <div className="space-y-2"><Label>Refakatçi</Label><Input name="numberOfCompanions" type="number" defaultValue={0} min={0} /></div>
              <div className="space-y-2"><Label>Otel fiyatı</Label><Input name="hotelPrice" type="number" defaultValue={Number(defaultHotel?.pricePerNight ?? 90) * 4} min={0} /></div>
              <div className="space-y-2"><Label>Transfer fiyatı</Label><Input name="transferPrice" type="number" defaultValue={Number(defaultTransfer?.basePrice ?? 60) * 2} min={0} /></div>
              <div className="space-y-2"><Label>İndirim</Label><Input name="discount" type="number" defaultValue={250} min={0} /></div>
              <div className="space-y-2"><Label>Para birimi</Label><Select name="currency" defaultValue="EUR"><option value="EUR">EUR</option><option value="USD">USD</option><option value="GBP">GBP</option><option value="TRY">TRY</option></Select></div>
              <div className="space-y-2"><Label>Geçerlilik</Label><Input name="validUntil" type="date" /></div>
              <div className="space-y-2 md:col-span-2"><Label>Tedavi özeti</Label><Textarea name="treatmentSummary" defaultValue="Doktor değerlendirmesi sonrası tedavi süresi ve fiyat netleşir. Paket tedavi, otel ve havalimanı transferi içerir." /></div>
              <div className="space-y-2 md:col-span-2"><Label>Notlar</Label><Textarea name="notes" defaultValue="Hasta kabul ederse otel ve transfer bilgisi n8n mock ile partnerlere paylaşılır." /></div>
              <Button className="w-fit md:col-span-2" type="submit"><Send className="h-4 w-4" />Paketi Oluştur ve Gönder</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Canlı Paket Önizleme</CardTitle><CardDescription>Klinik logosu mock, hasta adı, tedavi özeti ve toplam fiyat görünümü.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border bg-background p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-xs uppercase text-muted-foreground">ClinicNova Tourism</p><h3 className="text-xl font-semibold">{selectedLead?.fullName ?? "Hasta"}</h3></div>
                <Badge variant="success">TR/EN</Badge>
              </div>
              <div className="mt-4 grid gap-3 text-sm">
                <div className="flex justify-between"><span>Tedavi</span><strong>{selectedLead?.interestedTreatment ?? "-"}</strong></div>
                <div className="flex justify-between"><span>Kaynak</span><strong>{selectedLead ? sourceLabel(selectedLead.sourceChannel, locale) : "-"}</strong></div>
                <div className="flex justify-between"><span>Otel</span><strong>{defaultHotel?.name ?? "-"}</strong></div>
                <div className="flex justify-between"><span>Transfer</span><strong>{defaultTransfer?.name ?? "-"}</strong></div>
                <div className="flex justify-between border-t pt-3 text-base"><span>Tahmini toplam</span><strong>{formatCurrency(4200 + Number(defaultHotel?.pricePerNight ?? 90) * 4 + Number(defaultTransfer?.basePrice ?? 60) * 2 - 250, locale)}</strong></div>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="outline"><Eye className="h-4 w-4" />PDF Mock</Button>
              <Button variant="outline"><Send className="h-4 w-4" />WhatsApp</Button>
              <Button variant="outline"><Mail className="h-4 w-4" />E-posta</Button>
              <Button variant="outline"><Share2 className="h-4 w-4" />n8n Paylaş</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Gönderilen Paketler</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Paket</TableHead><TableHead>Lead</TableHead><TableHead>Tutar</TableHead><TableHead>Durum</TableHead><TableHead>Geçerlilik</TableHead><TableHead>Public Link</TableHead></TableRow></TableHeader>
            <TableBody>
              {packages.map((item) => {
                const lead = leads.find((entry) => entry.id === item.leadId);
                return (
                  <TableRow key={item.id}>
                    <TableCell><div className="font-medium">{item.packageTitle}</div><div className="text-xs text-muted-foreground">{items.filter((packageItem) => packageItem.packageId === item.id).length} tedavi kalemi</div></TableCell>
                    <TableCell>{lead?.fullName ?? "-"}</TableCell>
                    <TableCell>{formatCurrency(item.finalPrice, locale)}</TableCell>
                    <TableCell><Badge variant={statusTone(item.packageStatus)}>{packageStatusLabel(item.packageStatus, locale)}</Badge></TableCell>
                    <TableCell>{formatDate(item.validUntil ?? item.createdAt, locale)}</TableCell>
                    <TableCell><Link className={cn(buttonVariants({ variant: "outline", size: "sm" }))} href={`/package/${item.publicToken}`}>Görüntüle</Link></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
