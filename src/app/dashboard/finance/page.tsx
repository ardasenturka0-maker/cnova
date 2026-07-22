import { CreditCard, FileText, WalletCards } from "lucide-react";
import Link from "next/link";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireModuleAccess } from "@/lib/auth";
import { statusLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { getFinanceOverview } from "@/lib/services/financeService";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

export default async function FinancePage() {
  const session = await requireModuleAccess("finance");
  const locale = await getLocale();
  const finance = await getFinanceOverview(session.organizationId);

  return (
    <div className="space-y-6">
      <ModuleHeader icon={CreditCard} title="Finans Modülü" description="Gelir/gider, hasta borç/alacak, tahsilat, taksit ve fatura süreçleri." />
      <div className="flex flex-wrap gap-2">
        <Link className={buttonVariants()} href="/dashboard/payments">Ödeme Ekle</Link>
        <Link className={cn(buttonVariants({ variant: "outline" }), "gap-2")} href="/dashboard/invoices"><FileText className="h-4 w-4" />Faturalar</Link>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Gelir" value={formatCurrency(finance.income, locale)} icon={WalletCards} tone="success" />
        <StatCard title="Gider" value={formatCurrency(finance.expenses, locale)} icon={CreditCard} tone="warning" />
        <StatCard title="Net" value={formatCurrency(finance.net, locale)} icon={WalletCards} />
        <StatCard title="Bekleyen" value={formatCurrency(finance.pending, locale)} icon={CreditCard} tone="accent" />
      </div>
      <Card>
        <CardHeader><CardTitle>Son finans hareketleri</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Tarih</TableHead><TableHead>Hasta</TableHead><TableHead>Tip</TableHead><TableHead>Yöntem</TableHead><TableHead>Tutar</TableHead><TableHead>Durum</TableHead></TableRow></TableHeader>
            <TableBody>
              {finance.payments.slice(0, 30).map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>{formatDate(payment.paidAt, locale)}</TableCell>
                  <TableCell>{payment.patient ? `${payment.patient.firstName} ${payment.patient.lastName}` : "Klinik"}</TableCell>
                  <TableCell>{statusLabel(payment.type, locale)}</TableCell>
                  <TableCell>{statusLabel(payment.method, locale)}</TableCell>
                  <TableCell>{formatCurrency(payment.amount, locale)}</TableCell>
                  <TableCell><Badge variant={payment.status === "PAID" ? "success" : "warning"}>{statusLabel(payment.status, locale)}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
