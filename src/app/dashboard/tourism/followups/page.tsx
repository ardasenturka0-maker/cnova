import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Repeat, Send } from "lucide-react";
import { LeadFollowUpStatus } from "@prisma/client";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireSession } from "@/lib/auth";
import { statusLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { runDueFollowUps, startFollowUpForLead } from "@/lib/services/tourismService";
import { formatDateTime } from "@/lib/utils";
import { leadStatusLabel, statusTone } from "@/lib/tourism";

function resultUrl(message: string) {
  return `/dashboard/tourism/followups?success=${encodeURIComponent(message)}`;
}

async function runNowAction() {
  "use server";
  const session = await requireSession();
  const result = await runDueFollowUps(session.organizationId);
  revalidatePath("/dashboard/tourism/followups");
  redirect(resultUrl(`${result.processed} takip işlendi, ${result.sent} mesaj mock gönderildi.`));
}

async function startLeadFollowUpAction(leadId: string) {
  "use server";
  const session = await requireSession();
  await startFollowUpForLead(leadId, session.organizationId);
  revalidatePath("/dashboard/tourism/followups");
  redirect(resultUrl("Lead için satış kurtarma dizisi başlatıldı."));
}

export default async function FollowUpsPage({ searchParams }: { searchParams: { success?: string } }) {
  const session = await requireSession();
  const locale = getLocale();
  const [sequences, followUps, leads, messages] = await Promise.all([
    prisma.followUpSequence.findMany({ where: { organizationId: session.organizationId }, orderBy: { createdAt: "asc" }, take: 20 }),
    prisma.leadFollowUp.findMany({ where: { organizationId: session.organizationId }, orderBy: { nextRunAt: "asc" }, take: 100 }),
    prisma.lead.findMany({ where: { organizationId: session.organizationId }, orderBy: { leadScore: "desc" }, take: 100 }),
    prisma.leadMessage.findMany({ where: { organizationId: session.organizationId, source: "auto-followup" }, orderBy: { createdAt: "desc" }, take: 50 })
  ]);
  const due = followUps.filter((item) => item.status === LeadFollowUpStatus.ACTIVE && item.nextRunAt <= new Date());
  const noFollowUpLeads = leads.filter((lead) => !followUps.some((item) => item.leadId === lead.id)).slice(0, 8);

  return (
    <div className="space-y-6">
      <ModuleHeader icon={Repeat} title="Otomatik Takipler" description="Cevap vermeyen lead’lere 3, 7 ve 14. gün otomatik satış kurtarma mesajları." />
      {searchParams.success ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{searchParams.success}</div> : null}
      <Card>
        <CardHeader><CardTitle>Bugün Gönderilecek Takipler</CardTitle><CardDescription>Gerçek cron yerine `/api/cron/followups` ve bu manuel buton zamanı gelenleri işler.</CardDescription></CardHeader>
        <CardContent>
          <form action={runNowAction}><Button type="submit"><Send className="h-4 w-4" />Zamanı Gelenleri Şimdi Gönder</Button></form>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {due.map((followUp) => {
              const lead = leads.find((item) => item.id === followUp.leadId);
              return (
                <div key={followUp.id} className="rounded-md border bg-background p-3">
                  <div className="flex items-center justify-between"><strong>{lead?.fullName ?? followUp.leadId}</strong><Badge variant="warning">Step {followUp.currentStep + 1}</Badge></div>
                  <p className="mt-1 text-sm text-muted-foreground">{lead?.interestedTreatment ?? "-"} · {formatDateTime(followUp.nextRunAt, locale)}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Takip Dizileri</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {sequences.map((sequence) => (
              <div key={sequence.id} className="rounded-md border bg-background p-4">
                <div className="flex items-center justify-between"><strong>{sequence.name}</strong><Badge variant={sequence.active ? "success" : "muted"}>{sequence.active ? "Aktif" : "Pasif"}</Badge></div>
                <p className="mt-1 text-sm text-muted-foreground">{sequence.description}</p>
                <div className="mt-3 space-y-2">
                  {(Array.isArray(sequence.stepsJson) ? sequence.stepsJson : []).map((step: any, index: number) => (
                    <div key={`${sequence.id}-${index}`} className="rounded-md bg-muted p-2 text-xs">
                      {step.dayOffset}. gün · {step.channel} · {step.language}: {step.messageTemplate}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Takip Başlatılmamış Sıcak Lead’ler</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {noFollowUpLeads.map((lead) => (
              <div key={lead.id} className="flex items-center justify-between rounded-md border bg-background p-3">
                <div><p className="text-sm font-medium">{lead.fullName}</p><p className="text-xs text-muted-foreground">{lead.interestedTreatment} · {leadStatusLabel(lead.leadStatus, locale)}</p></div>
                <form action={startLeadFollowUpAction.bind(null, lead.id)}><Button size="sm" variant="outline">Başlat</Button></form>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Aktif Follow-up Listesi</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Lead</TableHead><TableHead>Durum</TableHead><TableHead>Step</TableHead><TableHead>Son Mesaj</TableHead><TableHead>Sonraki Çalışma</TableHead></TableRow></TableHeader>
            <TableBody>
              {followUps.map((followUp) => {
                const lead = leads.find((item) => item.id === followUp.leadId);
                return (
                  <TableRow key={followUp.id}>
                    <TableCell>{lead?.fullName ?? followUp.leadId}</TableCell>
                    <TableCell><Badge variant={statusTone(followUp.status)}>{statusLabel(followUp.status, locale)}</Badge></TableCell>
                    <TableCell>{followUp.currentStep + 1}</TableCell>
                    <TableCell>{followUp.lastMessageAt ? formatDateTime(followUp.lastMessageAt, locale) : "-"}</TableCell>
                    <TableCell>{formatDateTime(followUp.nextRunAt, locale)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Gönderilen Otomatik Mesajlar</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {messages.slice(0, 8).map((message) => (
            <div key={message.id} className="rounded-md border bg-background p-3 text-sm">
              <div className="font-medium">{message.subject ?? "Follow-up"}</div>
              <p className="mt-1 text-muted-foreground">{message.message}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
