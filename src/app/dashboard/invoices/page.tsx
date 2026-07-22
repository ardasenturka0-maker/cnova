import { revalidatePath } from "next/cache";
import { FileText, Send } from "lucide-react";
import { InvoiceStatus } from "@prisma/client";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { sendEInvoice } from "@/lib/integrations/eInvoiceProvider";
import { requireModuleAccess } from "@/lib/auth";
import { statusLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";

async function sendInvoiceAction(invoiceId: string) {
  "use server";
  const session = await requireModuleAccess("finance");
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, organizationId: session.organizationId, OR: [{ patientId: null }, { patient: { deletedAt: null } }] } });
  if (!invoice) throw new Error("Fatura bulunamadi.");
  const result = await sendEInvoice(invoice.number);
  if (!result.ok) throw new Error(result.message || "Fatura sağlayıcıya teslim edilemedi.");
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { status: InvoiceStatus.SENT, providerRef: result.reference, issuedAt: new Date() }
  });
  revalidatePath("/dashboard/invoices");
}

export default async function InvoicesPage() {
  const session = await requireModuleAccess("finance");
  const locale = await getLocale();
  const invoices = await prisma.invoice.findMany({
    where: { organizationId: session.organizationId, OR: [{ patientId: null }, { patient: { deletedAt: null } }] },
    include: { patient: true },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return (
    <div className="space-y-6">
      <ModuleHeader icon={FileText} title="Faturalar" description="Fatura durumu, e-Fatura/e-Arşiv sağlayıcı gönderimi ve doğrulanabilir referans takibi." />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>No</TableHead><TableHead>Hasta</TableHead><TableHead>Tutar</TableHead><TableHead>Durum</TableHead><TableHead>Tarih</TableHead><TableHead>Provider</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>{invoice.number}</TableCell>
                  <TableCell>{invoice.patient ? `${invoice.patient.firstName} ${invoice.patient.lastName}` : "Klinik"}</TableCell>
                  <TableCell>{formatCurrency(invoice.total, locale)}</TableCell>
                  <TableCell><Badge variant={invoice.status === "PAID" ? "success" : "muted"}>{statusLabel(invoice.status, locale)}</Badge></TableCell>
                  <TableCell>{invoice.issuedAt ? formatDate(invoice.issuedAt, locale) : "-"}</TableCell>
                  <TableCell>{invoice.providerRef ?? "-"}</TableCell>
                  <TableCell className="text-right">
                    <form action={sendInvoiceAction.bind(null, invoice.id)}>
                      <Button type="submit" variant="outline" size="sm">
                        <Send className="h-4 w-4" />
                        Sağlayıcıya gönder
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
