import { revalidatePath } from "next/cache";
import { Boxes, PackagePlus } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireSession } from "@/lib/auth";
import { statusLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { createStockItem, createStockMovement, getStocks } from "@/lib/services/stockService";
import { getWritableBranchId } from "@/lib/services/tenantService";
import { stockItemSchema, stockMovementSchema } from "@/lib/validations/stock";
import { formatCurrency, formatDate } from "@/lib/utils";

async function createStockAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  const branchId = await getWritableBranchId(session);
  const payload = stockItemSchema.parse(Object.fromEntries(formData));
  await createStockItem(session.organizationId, branchId, payload);
  revalidatePath("/dashboard/stocks");
}

async function createMovementAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  const branchId = await getWritableBranchId(session);
  const payload = stockMovementSchema.parse(Object.fromEntries(formData));
  await createStockMovement(session.organizationId, branchId, payload);
  revalidatePath("/dashboard/stocks");
}

export default async function StocksPage() {
  const session = await requireSession();
  const locale = await getLocale();
  const stocks = await getStocks(session.organizationId);

  return (
    <div className="space-y-6">
      <ModuleHeader icon={Boxes} title="Stok Modülü" description="Minimum stok uyarıları, tedarikçi bilgisi ve hareket geçmişi." />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Ürün ekle</CardTitle></CardHeader>
          <CardContent>
            <form action={createStockAction} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>Ürün adı</Label><Input name="name" required /></div>
              <div className="space-y-2"><Label>Kategori</Label><Input name="category" required /></div>
              <div className="space-y-2"><Label>Mevcut miktar</Label><Input name="currentQuantity" type="number" min="0" defaultValue="0" /></div>
              <div className="space-y-2"><Label>Minimum seviye</Label><Input name="minimumQuantity" type="number" min="0" defaultValue="0" /></div>
              <div className="space-y-2"><Label>Birim</Label><Input name="unit" placeholder="adet" required /></div>
              <div className="space-y-2"><Label>Tedarikçi</Label><Input name="supplier" /></div>
              <div className="space-y-2"><Label>Alış fiyatı</Label><Input name="purchasePrice" type="number" min="0" defaultValue="0" /></div>
              <Button className="w-fit self-end" type="submit"><PackagePlus className="h-4 w-4" />Ürün Kaydet</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Stok hareketi</CardTitle></CardHeader>
          <CardContent>
            <form action={createMovementAction} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2"><Label>Ürün</Label><Select name="itemId" required><option value="">Seçin</option>{stocks.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></div>
              <div className="space-y-2"><Label>Tip</Label><Select name="type" defaultValue="IN"><option value="IN">Giriş</option><option value="OUT">Çıkış</option><option value="ADJUSTMENT">Düzeltme</option></Select></div>
              <div className="space-y-2"><Label>Miktar</Label><Input name="quantity" type="number" min="1" defaultValue="1" /></div>
              <div className="space-y-2 md:col-span-2"><Label>Not</Label><Input name="note" /></div>
              <Button className="w-fit md:col-span-2" type="submit">Hareket Kaydet</Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Ürün</TableHead><TableHead>Kategori</TableHead><TableHead>Miktar</TableHead><TableHead>Minimum</TableHead><TableHead>Tedarikçi</TableHead><TableHead>Alış</TableHead><TableHead>Son hareket</TableHead></TableRow></TableHeader>
            <TableBody>
              {stocks.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell><Badge variant={item.currentQuantity <= item.minimumQuantity ? "danger" : "success"}>{item.currentQuantity} {item.unit}</Badge></TableCell>
                  <TableCell>{item.minimumQuantity} {item.unit}</TableCell>
                  <TableCell>{item.supplier ?? "-"}</TableCell>
                  <TableCell>{formatCurrency(item.purchasePrice, locale)}</TableCell>
                  <TableCell>{item.movements[0] ? `${statusLabel(item.movements[0].type, locale)} · ${formatDate(item.movements[0].movedAt, locale)}` : "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
