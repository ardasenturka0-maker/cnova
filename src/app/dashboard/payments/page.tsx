import { revalidatePath } from "next/cache";
import { CreditCard } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { requireSession } from "@/lib/auth";
import { statusLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { createPayment, getFinanceOverview } from "@/lib/services/financeService";
import { getWritableBranchId } from "@/lib/services/tenantService";
import { paymentSchema } from "@/lib/validations/finance";
import { formatCurrency, formatDate } from "@/lib/utils";

async function createPaymentAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  const branchId = await getWritableBranchId(session);
  const payload = paymentSchema.parse(Object.fromEntries(formData));
  await createPayment(session.organizationId, branchId, payload);
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard/finance");
}

export default async function PaymentsPage() {
  const session = await requireSession();
  const locale = getLocale();
  const finance = await getFinanceOverview(session.organizationId);

  return (
    <div className="space-y-6">
      <ModuleHeader icon={CreditCard} title="Ödemeler" description="Hasta bazlı tahsilat, gider kaydı ve sanal POS mock akışı." />
      <Card>
        <CardHeader><CardTitle>Ödeme / gider ekle</CardTitle></CardHeader>
        <CardContent>
          <form action={createPaymentAction} className="grid gap-4 lg:grid-cols-4">
            <div className="space-y-2"><Label>Hasta</Label><Select name="patientId"><option value="">Klinik / genel</option>{finance.patients.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}</Select></div>
            <div className="space-y-2"><Label>İşlem tipi</Label><Select name="type" defaultValue="INCOME"><option value="INCOME">Gelir</option><option value="EXPENSE">Gider</option></Select></div>
            <div className="space-y-2"><Label>Tutar</Label><Input name="amount" type="number" min="0" step="0.01" required /></div>
            <div className="space-y-2"><Label>Yöntem</Label><Select name="method" defaultValue="CARD"><option value="CASH">Nakit</option><option value="CARD">Kart</option><option value="TRANSFER">Havale</option><option value="ONLINE">Online</option></Select></div>
            <div className="space-y-2"><Label>Durum</Label><Select name="status" defaultValue="PAID"><option value="PAID">Ödendi</option><option value="PENDING">Bekliyor</option><option value="CANCELLED">İptal</option></Select></div>
            <div className="space-y-2"><Label>Tarih</Label><Input name="paidAt" type="date" /></div>
            <div className="space-y-2 lg:col-span-4"><Label>Açıklama</Label><Textarea name="description" /></div>
            <Button className="w-fit lg:col-span-4" type="submit">Kaydet</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Tarih</TableHead><TableHead>Hasta</TableHead><TableHead>Tip</TableHead><TableHead>Yöntem</TableHead><TableHead>Tutar</TableHead><TableHead>Durum</TableHead></TableRow></TableHeader>
            <TableBody>
              {finance.payments.map((payment) => (
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
