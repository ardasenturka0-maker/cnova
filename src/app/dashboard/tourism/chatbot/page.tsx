import { redirect } from "next/navigation";
import { Bot, Send } from "lucide-react";
import { ChatConversationChannel } from "@prisma/client";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { requireSession } from "@/lib/auth";
import { statusLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { getWritableBranchId } from "@/lib/services/tenantService";
import { runChatbotTest } from "@/lib/services/ai/tourismChatbotService";
import { chatbotTestSchema } from "@/lib/validations/tourism";
import { formatDateTime } from "@/lib/utils";
import { statusTone } from "@/lib/tourism";

async function chatTestAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  const parsed = chatbotTestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/dashboard/tourism/chatbot?error=Mesaj geçersiz");
  const branchId = await getWritableBranchId(session);
  const result = await runChatbotTest({
    organizationId: session.organizationId,
    branchId,
    message: parsed.data.message,
    channel: parsed.data.channel as ChatConversationChannel,
    userId: session.userId
  });
  redirect(`/dashboard/tourism/chatbot?answer=${encodeURIComponent(result.answer)}&escalate=${result.escalate ? "1" : "0"}${result.lead ? `&lead=${encodeURIComponent(result.lead.id)}` : ""}`);
}

export default async function ChatbotPage({ searchParams }: { searchParams: { answer?: string; escalate?: string; lead?: string; error?: string } }) {
  const session = await requireSession();
  const locale = getLocale();
  const [knowledge, conversations, messages, leads] = await Promise.all([
    prisma.chatbotKnowledgeBase.findMany({ where: { organizationId: session.organizationId }, orderBy: { category: "asc" }, take: 100 }),
    prisma.chatConversation.findMany({ where: { organizationId: session.organizationId }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.chatMessage.findMany({ where: { organizationId: session.organizationId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.lead.findMany({ where: { organizationId: session.organizationId }, take: 100 })
  ]);

  return (
    <div className="space-y-6">
      <ModuleHeader icon={Bot} title="AI Chatbot Mock" description="TR/EN sık soruları cevaplar, ciddi lead’i insana devreder ve lead kaydı oluşturur." />
      {searchParams.error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{searchParams.error}</div> : null}
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader><CardTitle>Test Chat</CardTitle><CardDescription>Fiyat, otel, transfer veya tıbbi sorun sorularını deneyebilirsin.</CardDescription></CardHeader>
          <CardContent>
            <form action={chatTestAction} className="space-y-4">
              <div className="space-y-2"><Label>Kanal</Label><Select name="channel" defaultValue="WEBSITE"><option value="WEBSITE">Website</option><option value="WHATSAPP">WhatsApp</option><option value="INSTAGRAM">Instagram</option></Select></div>
              <div className="space-y-2"><Label>Hasta mesajı</Label><Textarea name="message" defaultValue="Hi, I am from United Kingdom. How much for implant with hotel? My email is john@example.com and travel date is 2026-09-15." /></div>
              <Button type="submit"><Send className="h-4 w-4" />Botu Çalıştır</Button>
            </form>
            {searchParams.answer ? (
              <div className="mt-4 rounded-md border bg-background p-4">
                <div className="flex items-center justify-between"><strong>Bot cevabı</strong><Badge variant={searchParams.escalate === "1" ? "warning" : "success"}>{searchParams.escalate === "1" ? "İnsana devret" : "Bot çözdü"}</Badge></div>
                <p className="mt-2 text-sm text-muted-foreground">{searchParams.answer}</p>
                {searchParams.lead ? <p className="mt-2 text-xs text-muted-foreground">Lead oluşturuldu/güncellendi: {searchParams.lead}</p> : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Bilgi Bankası</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {knowledge.map((item) => (
              <div key={item.id} className="rounded-md border bg-background p-3">
                <div className="flex items-center gap-2"><Badge>{item.language}</Badge><Badge variant="muted">{item.category}</Badge></div>
                <p className="mt-2 text-sm font-medium">{item.question}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.answer}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Konuşmalar</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Tarih</TableHead><TableHead>Kanal</TableHead><TableHead>Dil</TableHead><TableHead>Durum</TableHead><TableHead>Lead</TableHead><TableHead>Son Mesaj</TableHead></TableRow></TableHeader>
            <TableBody>
              {conversations.map((conversation) => {
                const lead = leads.find((item) => item.id === conversation.leadId);
                const lastMessage = messages.find((item) => item.conversationId === conversation.id);
                return (
                  <TableRow key={conversation.id}>
                    <TableCell>{formatDateTime(conversation.createdAt, locale)}</TableCell>
                    <TableCell>{statusLabel(conversation.channel, locale)}</TableCell>
                    <TableCell>{conversation.language}</TableCell>
                    <TableCell><Badge variant={statusTone(conversation.status)}>{statusLabel(conversation.status, locale)}</Badge></TableCell>
                    <TableCell>{lead?.fullName ?? "-"}</TableCell>
                    <TableCell className="max-w-[420px] truncate">{lastMessage?.message ?? "-"}</TableCell>
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
