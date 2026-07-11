import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Hotel, PlaneLanding, Share2, Truck } from "lucide-react";
import { TourismCurrency } from "@prisma/client";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { requireSession } from "@/lib/auth";
import { statusLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { getWritableBranchId } from "@/lib/services/tenantService";
import { shareReservation } from "@/lib/services/tourismService";
import { formatCurrency, formatDate } from "@/lib/utils";
import { packageStatusLabel, statusTone } from "@/lib/tourism";

function resultUrl(type: "success" | "error", message: string) {
  return `/dashboard/tourism/hotel-transfer?${type}=${encodeURIComponent(message)}`;
}

async function createHotelAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  const branchId = await getWritableBranchId(session);
  await prisma.hotelPartner.create({
    data: {
      organizationId: session.organizationId,
      branchId,
      name: String(formData.get("name") ?? ""),
      contactPerson: String(formData.get("contactPerson") ?? "") || null,
      phone: String(formData.get("phone") ?? "") || null,
      email: String(formData.get("email") ?? "") || null,
      city: String(formData.get("city") ?? "İstanbul"),
      district: String(formData.get("district") ?? "") || null,
      starRating: Number(formData.get("starRating") ?? 4),
      pricePerNight: Number(formData.get("pricePerNight") ?? 0),
      currency: String(formData.get("currency") ?? "EUR") as TourismCurrency,
      notes: String(formData.get("notes") ?? "") || null,
      active: true
    }
  });
  revalidatePath("/dashboard/tourism/hotel-transfer");
  redirect(resultUrl("success", "Otel partneri eklendi."));
}

async function createTransferAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  const branchId = await getWritableBranchId(session);
  await prisma.transferPartner.create({
    data: {
      organizationId: session.organizationId,
      branchId,
      name: String(formData.get("name") ?? ""),
      contactPerson: String(formData.get("contactPerson") ?? "") || null,
      phone: String(formData.get("phone") ?? "") || null,
      email: String(formData.get("email") ?? "") || null,
      vehicleTypes: String(formData.get("vehicleTypes") ?? "Vito").split(",").map((item) => item.trim()).filter(Boolean),
      airportList: String(formData.get("airportList") ?? "IST,SAW").split(",").map((item) => item.trim()).filter(Boolean),
      basePrice: Number(formData.get("basePrice") ?? 0),
      currency: String(formData.get("currency") ?? "EUR") as TourismCurrency,
      notes: String(formData.get("notes") ?? "") || null,
      active: true
    }
  });
  revalidatePath("/dashboard/tourism/hotel-transfer");
  redirect(resultUrl("success", "Transfer partneri eklendi."));
}

async function shareReservationAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  const packageId = String(formData.get("packageId") ?? "");
  const hotelPartnerId = String(formData.get("hotelPartnerId") ?? "");
  const transferPartnerId = String(formData.get("transferPartnerId") ?? "");
  if (!packageId) redirect(resultUrl("error", "Paket seçin."));
  await shareReservation(packageId, session.organizationId, hotelPartnerId || null, transferPartnerId || null);
  revalidatePath("/dashboard/tourism/hotel-transfer");
  redirect(resultUrl("success", "Otel ve transfer bilgisi n8n mock ile paylaşıldı."));
}

export default async function HotelTransferPage(props: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const searchParams = await props.searchParams;
  const session = await requireSession();
  const locale = await getLocale();
  const [hotels, transfers, packages, reservations] = await Promise.all([
    prisma.hotelPartner.findMany({ where: { organizationId: session.organizationId }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.transferPartner.findMany({ where: { organizationId: session.organizationId }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.tourismPackage.findMany({ where: { organizationId: session.organizationId }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.reservationShare.findMany({ where: { organizationId: session.organizationId }, orderBy: { createdAt: "desc" }, take: 50 })
  ]);

  return (
    <div className="space-y-6">
      <ModuleHeader icon={Hotel} title="Otel & Transfer" description="BOOKED olan paketlerin otel ve havalimanı transfer bilgilerini n8n mock ile partnerlere paylaş." />
      {searchParams.success ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{searchParams.success}</div> : null}
      {searchParams.error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{searchParams.error}</div> : null}

      <Card>
        <CardHeader><CardTitle>Rezervasyon Paylaş</CardTitle><CardDescription>Paket kabul edildiğinde otel/transfer firmalarına gönderilecek mock payload.</CardDescription></CardHeader>
        <CardContent>
          <form action={shareReservationAction} className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2"><Label>Paket</Label><Select name="packageId">{packages.map((item) => <option key={item.id} value={item.id}>{item.packageTitle} · {packageStatusLabel(item.packageStatus, locale)}</option>)}</Select></div>
            <div className="space-y-2"><Label>Otel</Label><Select name="hotelPartnerId"><option value="">Varsayılan aktif otel</option>{hotels.map((hotel) => <option key={hotel.id} value={hotel.id}>{hotel.name}</option>)}</Select></div>
            <div className="space-y-2"><Label>Transfer</Label><Select name="transferPartnerId"><option value="">Varsayılan aktif transfer</option>{transfers.map((transfer) => <option key={transfer.id} value={transfer.id}>{transfer.name}</option>)}</Select></div>
            <Button className="w-fit md:col-span-4" type="submit"><Share2 className="h-4 w-4" />n8n ile Partnerlere Paylaş</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Yeni Otel Partneri</CardTitle></CardHeader>
          <CardContent>
            <form action={createHotelAction} className="grid gap-3 md:grid-cols-2">
              <Input name="name" placeholder="Otel adı" required />
              <Input name="contactPerson" placeholder="Yetkili" />
              <Input name="phone" placeholder="Telefon" />
              <Input name="email" type="email" placeholder="E-posta" />
              <Input name="city" defaultValue="İstanbul" />
              <Input name="district" placeholder="İlçe" />
              <Input name="starRating" type="number" defaultValue={4} min={1} max={5} />
              <Input name="pricePerNight" type="number" placeholder="Gecelik fiyat" required />
              <Select name="currency" defaultValue="EUR"><option value="EUR">EUR</option><option value="USD">USD</option><option value="GBP">GBP</option><option value="TRY">TRY</option></Select>
              <Textarea name="notes" placeholder="Not" />
              <Button className="w-fit md:col-span-2" type="submit"><PlaneLanding className="h-4 w-4" />Otel Ekle</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Yeni Transfer Partneri</CardTitle></CardHeader>
          <CardContent>
            <form action={createTransferAction} className="grid gap-3 md:grid-cols-2">
              <Input name="name" placeholder="Firma adı" required />
              <Input name="contactPerson" placeholder="Yetkili" />
              <Input name="phone" placeholder="Telefon" />
              <Input name="email" type="email" placeholder="E-posta" />
              <Input name="vehicleTypes" defaultValue="Vito, Mercedes E" />
              <Input name="airportList" defaultValue="IST, SAW" />
              <Input name="basePrice" type="number" placeholder="Baz fiyat" required />
              <Select name="currency" defaultValue="EUR"><option value="EUR">EUR</option><option value="USD">USD</option><option value="GBP">GBP</option><option value="TRY">TRY</option></Select>
              <Textarea name="notes" placeholder="Not" />
              <Button className="w-fit md:col-span-2" type="submit"><Truck className="h-4 w-4" />Transfer Ekle</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Otel Partnerleri</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {hotels.map((hotel) => (
              <div key={hotel.id} className="rounded-md border bg-background p-3">
                <div className="flex items-center justify-between"><strong>{hotel.name}</strong><Badge variant={hotel.active ? "success" : "muted"}>{hotel.active ? "Aktif" : "Pasif"}</Badge></div>
                <p className="mt-1 text-sm text-muted-foreground">{hotel.city} / {hotel.district ?? "-"} · {hotel.starRating ?? "-"} yıldız · {formatCurrency(hotel.pricePerNight, locale)}/gece</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Transfer Partnerleri</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {transfers.map((transfer) => (
              <div key={transfer.id} className="rounded-md border bg-background p-3">
                <div className="flex items-center justify-between"><strong>{transfer.name}</strong><Badge variant={transfer.active ? "success" : "muted"}>{transfer.active ? "Aktif" : "Pasif"}</Badge></div>
                <p className="mt-1 text-sm text-muted-foreground">Havalimanı: {Array.isArray(transfer.airportList) ? transfer.airportList.join(", ") : "-"} · {formatCurrency(transfer.basePrice, locale)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Paylaşım Geçmişi</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Tarih</TableHead><TableHead>Paket</TableHead><TableHead>Kanal</TableHead><TableHead>Durum</TableHead><TableHead>Payload</TableHead></TableRow></TableHeader>
            <TableBody>
              {reservations.map((reservation) => {
                const tourismPackage = packages.find((item) => item.id === reservation.packageId);
                return (
                  <TableRow key={reservation.id}>
                    <TableCell>{formatDate(reservation.createdAt, locale)}</TableCell>
                    <TableCell>{tourismPackage?.packageTitle ?? reservation.packageId}</TableCell>
                    <TableCell>{statusLabel(reservation.sharedVia, locale)}</TableCell>
                    <TableCell><Badge variant={statusTone(reservation.status)}>{statusLabel(reservation.status, locale)}</Badge></TableCell>
                    <TableCell className="max-w-[320px] truncate">{JSON.stringify(reservation.payloadJson)}</TableCell>
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
