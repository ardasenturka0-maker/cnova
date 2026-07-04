import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Handshake, MessageSquare, PackagePlus, Repeat, Search, XCircle } from "lucide-react";
import Link from "next/link";
import { TourismLeadSourceChannel, TourismLeadStatus } from "@prisma/client";
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
import { getWritableBranchId } from "@/lib/services/tenantService";
import { createOrUpdateLeadFromIntake, markLeadStatus, startFollowUpForLead } from "@/lib/services/tourismService";
import { tourismLeadSchema } from "@/lib/validations/tourism";
import { cn, formatDate } from "@/lib/utils";
import { leadStatusLabel, sourceLabel, statusTone } from "@/lib/tourism";

function resultUrl(type: "success" | "error", message: string) {
  return `/dashboard/tourism/leads?${type}=${encodeURIComponent(message)}`;
}

async function createLeadAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  const parsed = tourismLeadSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(resultUrl("error", parsed.error.issues[0]?.message ?? "Lead formu geçersiz."));
  const branchId = await getWritableBranchId(session);
  const result = await createOrUpdateLeadFromIntake(parsed.data, { organizationId: session.organizationId, branchId, userId: session.userId });
  revalidatePath("/dashboard/tourism/leads");
  redirect(resultUrl("success", result.duplicate ? "Aynı kişi bulundu; mesaj eski lead'e eklendi." : "Yeni lead havuza eklendi."));
}

async function setLeadStatusAction(leadId: string, status: TourismLeadStatus) {
  "use server";
  const session = await requireSession();
  await markLeadStatus(leadId, status, session.organizationId);
  revalidatePath("/dashboard/tourism/leads");
  redirect(resultUrl("success", `Lead durumu ${leadStatusLabel(status)} olarak güncellendi.`));
}

async function startFollowUpAction(leadId: string) {
  "use server";
  const session = await requireSession();
  await startFollowUpForLead(leadId, session.organizationId);
  revalidatePath("/dashboard/tourism/leads");
  redirect(resultUrl("success", "3/7/14 follow-up dizisi başlatıldı."));
}

export default async function TourismLeadsPage({ searchParams }: { searchParams: { q?: string; source?: string; status?: string; country?: string; treatment?: string; success?: string; error?: string } }) {
  const session = await requireSession();
  const locale = getLocale();
  const [leads, users, messages, packages, followUps] = await Promise.all([
    prisma.lead.findMany({ where: { organizationId: session.organizationId }, orderBy: { leadScore: "desc" }, take: 200 }),
    prisma.user.findMany({ where: { organizationId: session.organizationId }, orderBy: { name: "asc" }, take: 50 }),
    prisma.leadMessage.findMany({ where: { organizationId: session.organizationId }, orderBy: { createdAt: "desc" }, take: 300 }),
    prisma.tourismPackage.findMany({ where: { organizationId: session.organizationId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.leadFollowUp.findMany({ where: { organizationId: session.organizationId }, orderBy: { nextRunAt: "asc" }, take: 100 })
  ]);

  const filtered = leads.filter((lead) => {
    const query = searchParams.q?.toLowerCase().trim();
    if (query && !`${lead.fullName} ${lead.phone ?? ""} ${lead.email ?? ""} ${lead.country} ${lead.interestedTreatment}`.toLowerCase().includes(query)) return false;
    if (searchParams.source && lead.sourceChannel !== searchParams.source) return false;
    if (searchParams.status && lead.leadStatus !== searchParams.status) return false;
    if (searchParams.country && lead.country !== searchParams.country) return false;
    if (searchParams.treatment && lead.interestedTreatment !== searchParams.treatment) return false;
    return true;
  });
  const countries = [...new Set(leads.map((lead) => lead.country))];
  const treatments = [...new Set(leads.map((lead) => lead.interestedTreatment))];

  return (
    <div className="space-y-6">
      <ModuleHeader icon={Handshake} title="Lead Havuzu" description="Instagram, WhatsApp, web form, n8n ve manuel lead’leri skorlayıp satış temsilcisine görünür kılar." />
      {searchParams.success ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{searchParams.success}</div> : null}
      {searchParams.error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{searchParams.error}</div> : null}

      <Card>
        <CardHeader><CardTitle>Manuel Lead Ekle</CardTitle><CardDescription>Instagram/WhatsApp görüşmesinden gelen kişiyi hızlıca havuza düşür.</CardDescription></CardHeader>
        <CardContent>
          <form action={createLeadAction} className="grid gap-4 lg:grid-cols-4">
            <div className="space-y-2"><Label>Kaynak</Label><Select name="sourceChannel" defaultValue="MANUAL"><option value="MANUAL">Manuel</option><option value="WHATSAPP">WhatsApp</option><option value="INSTAGRAM_DM">Instagram DM</option><option value="WEB_FORM">Web Form</option><option value="N8N_WEBHOOK">n8n Webhook</option><option value="AIRTABLE">Airtable</option></Select></div>
            <div className="space-y-2"><Label>Ad Soyad</Label><Input name="fullName" placeholder="John Smith" required /></div>
            <div className="space-y-2"><Label>Telefon</Label><Input name="phone" placeholder="+44..." /></div>
            <div className="space-y-2"><Label>E-posta</Label><Input name="email" type="email" placeholder="john@example.com" /></div>
            <div className="space-y-2"><Label>Ülke</Label><Input name="country" placeholder="United Kingdom" required /></div>
            <div className="space-y-2"><Label>Şehir</Label><Input name="city" placeholder="London" /></div>
            <div className="space-y-2"><Label>Dil</Label><Select name="language" defaultValue="EN"><option value="EN">EN</option><option value="TR">TR</option></Select></div>
            <div className="space-y-2"><Label>Tedavi</Label><Input name="interestedTreatment" placeholder="Dental Implant" required /></div>
            <div className="space-y-2"><Label>Bütçe</Label><Input name="estimatedBudget" placeholder="5000-8000 EUR" /></div>
            <div className="space-y-2"><Label>Seyahat tarihi</Label><Input name="travelDate" type="date" /></div>
            <div className="space-y-2 lg:col-span-2"><Label>Mesaj</Label><Textarea name="message" placeholder="How much for full mouth implant?" required /></div>
            <label className="flex items-center gap-2 text-sm lg:col-span-4"><input name="gdprConsent" type="checkbox" value="true" /> KVKK/GDPR iletişim onayı alındı</label>
            <Button className="w-fit lg:col-span-4" type="submit"><Handshake className="h-4 w-4" />Lead Ekle</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Filtreler</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-5">
            <div className="relative md:col-span-2"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" name="q" placeholder="Ad, telefon, ülke, tedavi ara" defaultValue={searchParams.q} /></div>
            <Select name="source" defaultValue={searchParams.source ?? ""}><option value="">Tüm kaynaklar</option>{Object.values(TourismLeadSourceChannel).map((item) => <option key={item} value={item}>{sourceLabel(item, locale)}</option>)}</Select>
            <Select name="status" defaultValue={searchParams.status ?? ""}><option value="">Tüm durumlar</option>{Object.values(TourismLeadStatus).map((item) => <option key={item} value={item}>{leadStatusLabel(item, locale)}</option>)}</Select>
            <Button variant="outline" type="submit">Filtrele</Button>
            <Select name="country" defaultValue={searchParams.country ?? ""}><option value="">Tüm ülkeler</option>{countries.map((item) => <option key={item} value={item}>{item}</option>)}</Select>
            <Select name="treatment" defaultValue={searchParams.treatment ?? ""}><option value="">Tüm tedaviler</option>{treatments.map((item) => <option key={item} value={item}>{item}</option>)}</Select>
            <Link href="/dashboard/tourism/leads" className={cn(buttonVariants({ variant: "ghost" }), "w-fit")}><XCircle className="h-4 w-4" />Temizle</Link>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Lead</TableHead><TableHead>Kaynak</TableHead><TableHead>Tedavi</TableHead><TableHead>Durum</TableHead><TableHead>Skor</TableHead><TableHead>Sonraki Takip</TableHead><TableHead>Geçmiş</TableHead><TableHead>Aksiyon</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map((lead) => {
                const leadMessages = messages.filter((message) => message.leadId === lead.id);
                const leadPackages = packages.filter((item) => item.leadId === lead.id);
                const followUp = followUps.find((item) => item.leadId === lead.id);
                const assignedUser = users.find((user) => user.id === lead.assignedToUserId);
                return (
                  <TableRow key={lead.id}>
                    <TableCell><div className="font-medium">{lead.fullName}</div><div className="text-xs text-muted-foreground">{lead.country} · {assignedUser?.name ?? "Atanmamış"}</div></TableCell>
                    <TableCell>{sourceLabel(lead.sourceChannel, locale)}</TableCell>
                    <TableCell>{lead.interestedTreatment}</TableCell>
                    <TableCell><Badge variant={statusTone(lead.leadStatus)}>{leadStatusLabel(lead.leadStatus, locale)}</Badge></TableCell>
                    <TableCell className="font-semibold">{lead.leadScore}</TableCell>
                    <TableCell>{formatDate(lead.nextFollowUpAt ?? followUp?.nextRunAt ?? lead.createdAt, locale)}</TableCell>
                    <TableCell><div className="text-xs text-muted-foreground">{leadMessages.length} mesaj · {leadPackages.length} paket</div></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/dashboard/tourism/package-builder?leadId=${lead.id}`}><PackagePlus className="h-4 w-4" />Paket</Link>
                        <form action={startFollowUpAction.bind(null, lead.id)}><Button size="sm" variant="outline"><Repeat className="h-4 w-4" />Takip</Button></form>
                        <form action={setLeadStatusAction.bind(null, lead.id, TourismLeadStatus.BOOKED)}><Button size="sm" variant="outline">{leadStatusLabel(TourismLeadStatus.BOOKED, locale)}</Button></form>
                        <form action={setLeadStatusAction.bind(null, lead.id, TourismLeadStatus.LOST)}><Button size="sm" variant="ghost">{leadStatusLabel(TourismLeadStatus.LOST, locale)}</Button></form>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Lead Detay Görünürlüğü</CardTitle><CardDescription>Detay drawer yerine MVP’de satış temsilcisinin ihtiyaç duyduğu bilgiler tablo altında özetlenir.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.slice(0, 6).map((lead) => (
            <div key={lead.id} className="rounded-md border bg-background p-4">
              <div className="flex items-start justify-between gap-3">
                <div><p className="font-medium">{lead.fullName}</p><p className="text-sm text-muted-foreground">{lead.phone ?? lead.email ?? "-"}</p></div>
                <Badge variant={lead.gdprConsent ? "success" : "warning"}>{lead.gdprConsent ? "Onay var" : "Onay eksik"}</Badge>
              </div>
              <p className="mt-3 text-sm">{lead.message}</p>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><MessageSquare className="h-4 w-4" />{messages.filter((message) => message.leadId === lead.id)[0]?.message ?? "Mesaj geçmişi yok"}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
