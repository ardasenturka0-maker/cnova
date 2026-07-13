import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Boxes, ExternalLink, PackagePlus, ShoppingCart } from "lucide-react";
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
import { createStockItem, createStockMovement, createStockOffer, getStocks } from "@/lib/services/stockService";
import { getWritableBranchId } from "@/lib/services/tenantService";
import { refreshProductOffers } from "@/lib/services/productSearchService";
import { stockItemSchema, stockMovementSchema, stockOfferSchema } from "@/lib/validations/stock";
import { formatCurrency, formatDate } from "@/lib/utils";

function resultUrl(type: "success" | "error", message: string) {
  return `/dashboard/stocks?${type}=${encodeURIComponent(message)}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : "İşlem tamamlanamadı.";
}

async function createStockAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  const branchId = await getWritableBranchId(session);
  try { await createStockItem(session.organizationId, branchId, stockItemSchema.parse(Object.fromEntries(formData))); }
  catch (error) { redirect(resultUrl("error", errorMessage(error))); }
  revalidatePath("/dashboard/stocks");
  redirect(resultUrl("success", "Yeni ürün stok listesine eklendi."));
}

async function createMovementAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  const branchId = await getWritableBranchId(session);
  try { await createStockMovement(session.organizationId, branchId, stockMovementSchema.parse(Object.fromEntries(formData))); }
  catch (error) { redirect(resultUrl("error", errorMessage(error))); }
  revalidatePath("/dashboard/stocks");
  redirect(resultUrl("success", "Stok miktarı güncellendi."));
}

async function createOfferAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  const branchId = await getWritableBranchId(session);
  try { await createStockOffer(session.organizationId, branchId, stockOfferSchema.parse(Object.fromEntries(formData))); }
  catch (error) { redirect(resultUrl("error", errorMessage(error))); }
  revalidatePath("/dashboard/stocks");
  redirect(resultUrl("success", "Tedarikçi fiyatı kaydedildi."));
}

async function refreshOffersAction(itemId: string) {
  "use server";
  const session = await requireSession();
  let count = 0;
  try { count = await refreshProductOffers(session.organizationId, itemId); }
  catch (error) { redirect(resultUrl("error", errorMessage(error))); }
  revalidatePath("/dashboard/stocks");
  redirect(resultUrl("success", `${count} canlı fiyat güncellendi.`));
}

export default async function StocksPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const query = await searchParams;
  const session = await requireSession();
  const locale = await getLocale();
  const stocks = await getStocks(session.organizationId);

  return (
    <div className="space-y-6">
      <ModuleHeader icon={Boxes} title="Stok Modülü" description="Minimum stok uyarıları, tedarikçi bilgisi ve hareket geçmişi." />
      {query.success ? <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700">{query.success}</div> : null}
      {query.error ? <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{query.error}</div> : null}
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
        <CardHeader><CardTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" />Ürün satın alma ve fiyat karşılaştırma</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <form action={createOfferAction} className="grid gap-4 lg:grid-cols-6">
            <div className="space-y-2"><Label>Ürün</Label><Select name="itemId" required><option value="">Seçin</option>{stocks.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></div>
            <div className="space-y-2"><Label>Satıcı</Label><Input name="seller" required /></div>
            <div className="space-y-2"><Label>Ürün fiyatı</Label><Input name="unitPrice" type="number" min="0.01" step="0.01" required /></div>
            <div className="space-y-2"><Label>Kargo</Label><Input name="shippingPrice" type="number" min="0" step="0.01" defaultValue="0" /></div>
            <div className="space-y-2 lg:col-span-2"><Label>Güvenli ürün adresi</Label><Input name="productUrl" type="url" placeholder="https://..." required /></div>
            <label className="flex items-center gap-2 text-sm"><input name="inStock" type="checkbox" defaultChecked /> Satışta</label>
            <Button className="w-fit lg:col-span-5" type="submit">Fiyatı Kaydet</Button>
          </form>
          <div className="space-y-4">
            {stocks.filter((item) => item.offers.length > 0).map((item) => (
              <div key={item.id} className="rounded-md border">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3"><span className="font-medium">{item.name} — kargo dahil ucuzdan pahalıya</span><form action={refreshOffersAction.bind(null, item.id)}><Button type="submit" size="sm" variant="outline">Canlı fiyatları yenile</Button></form></div>
                <Table><TableHeader><TableRow><TableHead>Satıcı</TableHead><TableHead>Ürün</TableHead><TableHead>Kargo</TableHead><TableHead>Toplam</TableHead><TableHead /></TableRow></TableHeader>
                  <TableBody>{item.offers.map((offer) => {
                    const total = Number(offer.unitPrice) + Number(offer.shippingPrice);
                    return <TableRow key={offer.id}><TableCell>{offer.seller}</TableCell><TableCell>{formatCurrency(offer.unitPrice, locale)}</TableCell><TableCell>{formatCurrency(offer.shippingPrice, locale)}</TableCell><TableCell className="font-semibold">{formatCurrency(total, locale)}</TableCell><TableCell className="text-right">{offer.inStock ? <a className="inline-flex items-center gap-1 text-sm font-medium text-primary" href={offer.productUrl} target="_blank" rel="noopener noreferrer">Satın al<ExternalLink className="h-4 w-4" /></a> : <Badge variant="muted">Tükendi</Badge>}</TableCell></TableRow>;
                  })}</TableBody>
                </Table>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
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
