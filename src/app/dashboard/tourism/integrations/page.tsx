import { Building2, Webhook } from "lucide-react";
import { IntegrationProvider } from "@prisma/client";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireSession } from "@/lib/auth";
import { statusLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { statusTone } from "@/lib/tourism";

const endpoints = [
  { title: "n8n Lead Webhook", method: "POST", path: "/api/webhooks/n8n/leads" },
  { title: "n8n Rezervasyon Paylaşımı", method: "POST", path: "/api/webhooks/n8n/reservation-share" },
  { title: "Follow-up Cron", method: "GET/POST", path: "/api/cron/followups" }
];

export default async function TourismIntegrationsPage() {
  const session = await requireSession();
  const locale = await getLocale();
  const logs = await prisma.integrationLog.findMany({ where: { organizationId: session.organizationId }, orderBy: { createdAt: "desc" }, take: 120 });

  return (
    <div className="space-y-6">
      <ModuleHeader icon={Building2} title="Entegrasyon Ayarları" description="Gerçek API yerine interface/adapter mimarisiyle çalışan mock n8n, Airtable, WhatsApp, Instagram ve yorum logları." />

      <div className="grid gap-4 md:grid-cols-3">
        {endpoints.map((endpoint) => (
          <Card key={endpoint.path}>
            <CardContent className="p-5">
              <div className="flex items-center gap-2"><Webhook className="h-4 w-4 text-primary" /><strong>{endpoint.title}</strong></div>
              <p className="mt-2 text-sm text-muted-foreground">{endpoint.method} {endpoint.path}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Provider Durumu</CardTitle><CardDescription>Her mock çağrı IntegrationLog üretir.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          {Object.values(IntegrationProvider).map((provider) => (
            <div key={provider} className="rounded-md border bg-background p-3">
              <p className="text-sm text-muted-foreground">{statusLabel(provider, locale)}</p>
              <p className="mt-1 text-2xl font-semibold">{logs.filter((log) => log.provider === provider).length}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>IntegrationLog</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Tarih</TableHead><TableHead>Provider</TableHead><TableHead>Event</TableHead><TableHead>Durum</TableHead><TableHead>Payload</TableHead></TableRow></TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{formatDateTime(log.createdAt, locale)}</TableCell>
                  <TableCell>{statusLabel(log.provider, locale)}</TableCell>
                  <TableCell>{log.eventType}</TableCell>
                  <TableCell><Badge variant={statusTone(log.status)}>{statusLabel(log.status, locale)}</Badge></TableCell>
                  <TableCell className="max-w-[420px] truncate">{JSON.stringify(log.payloadJson)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
