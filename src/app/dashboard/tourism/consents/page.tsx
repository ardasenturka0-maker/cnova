import { FileSignature } from "lucide-react";
import Link from "next/link";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireSession } from "@/lib/auth";
import { statusLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatDateTime } from "@/lib/utils";
import { gdprNotice, statusTone } from "@/lib/tourism";

export default async function TourismConsentsPage() {
  const session = await requireSession();
  const locale = await getLocale();
  const [templates, consents, leads, patients] = await Promise.all([
    prisma.consentTemplate.findMany({ where: { organizationId: session.organizationId }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.digitalConsent.findMany({ where: { organizationId: session.organizationId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.lead.findMany({ where: { organizationId: session.organizationId }, take: 100 }),
    prisma.patient.findMany({ where: { organizationId: session.organizationId }, take: 100 })
  ]);

  return (
    <div className="space-y-6">
      <ModuleHeader icon={FileSignature} title="Turizm Dijital Onamları" description="Yurt dışı hasta için TR/EN demo onam, veri paylaşımı ve zaman damgası akışı." />
      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{gdprNotice} Gerçek hukuki e-imza entegrasyonu sonradan eklenebilir.</div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Onam Şablonları</CardTitle><CardDescription>TR/EN tedavi ve sağlık turizmi rıza metinleri.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {templates.map((template) => (
              <div key={template.id} className="rounded-md border bg-background p-3">
                <div className="flex items-center justify-between"><strong>{template.title}</strong><Badge variant={template.active ? "success" : "muted"}>{template.language}</Badge></div>
                <p className="mt-1 text-sm text-muted-foreground">{template.treatmentType ?? "Genel"} · {template.content.slice(0, 140)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Durum Özeti</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {["DRAFT", "SENT", "VIEWED", "SIGNED"].map((status) => (
              <div key={status} className="rounded-md border bg-background p-4">
                <p className="text-sm text-muted-foreground">{statusLabel(status, locale)}</p>
                <p className="mt-1 text-2xl font-semibold">{consents.filter((item) => item.status === status).length}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Gönderilen Onamlar</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Hasta / Lead</TableHead><TableHead>Başlık</TableHead><TableHead>Dil</TableHead><TableHead>Durum</TableHead><TableHead>İmza</TableHead><TableHead>Public Link</TableHead></TableRow></TableHeader>
            <TableBody>
              {consents.map((consent) => {
                const lead = leads.find((item) => item.id === consent.leadId);
                const patient = patients.find((item) => item.id === consent.patientId);
                return (
                  <TableRow key={consent.id}>
                    <TableCell>{lead?.fullName ?? (patient ? `${patient.firstName} ${patient.lastName}` : "-")}</TableCell>
                    <TableCell>{consent.title}</TableCell>
                    <TableCell>{consent.language}</TableCell>
                    <TableCell><Badge variant={statusTone(consent.status)}>{statusLabel(consent.status, locale)}</Badge></TableCell>
                    <TableCell>{consent.signedAt ? formatDateTime(consent.signedAt, locale) : "-"}</TableCell>
                    <TableCell><Link className={cn(buttonVariants({ variant: "outline", size: "sm" }))} href={`/consent/${consent.publicToken}`}>Aç</Link></TableCell>
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
