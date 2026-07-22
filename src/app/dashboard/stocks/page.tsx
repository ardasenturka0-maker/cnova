import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Boxes, ExternalLink, PackagePlus, ShoppingCart, Trash2, Workflow } from "lucide-react";
import Link from "next/link";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canManageTrash, requireModuleAccess } from "@/lib/auth";
import { statusLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { takeRateLimit } from "@/lib/rate-limit";
import { publicErrorMessage } from "@/lib/public-error";
import { createStockItem, createStockMovement, createStockRecipe, deleteStockRecipe, getStockRecipes, getStocks, softDeleteStockItem } from "@/lib/services/stockService";
import { getWritableBranchId } from "@/lib/services/tenantService";
import { refreshProductOffers } from "@/lib/services/productSearchService";
import { stockItemSchema, stockMovementSchema, stockRecipeSchema } from "@/lib/validations/stock";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

function resultUrl(type: "success" | "error", message: string) {
  return `/dashboard/stocks?${type}=${encodeURIComponent(message)}`;
}

function errorMessage(error: unknown) {
  return publicErrorMessage(error, "İşlem tamamlanamadı.");
}

async function createStockAction(formData: FormData) {
  "use server";
  const session = await requireModuleAccess("stocks");
  const branchId = await getWritableBranchId(session);
  try { await createStockItem(session.organizationId, branchId, stockItemSchema.parse(Object.fromEntries(formData))); }
  catch (error) { redirect(resultUrl("error", errorMessage(error))); }
  revalidatePath("/dashboard/stocks");
  redirect(resultUrl("success", "Yeni ürün stok listesine eklendi."));
}

async function createMovementAction(formData: FormData) {
  "use server";
  const session = await requireModuleAccess("stocks");
  const branchId = await getWritableBranchId(session);
  try { await createStockMovement(session.organizationId, branchId, stockMovementSchema.parse(Object.fromEntries(formData))); }
  catch (error) { redirect(resultUrl("error", errorMessage(error))); }
  revalidatePath("/dashboard/stocks");
  redirect(resultUrl("success", "Stok miktarı güncellendi."));
}

async function refreshOffersAction(formData: FormData) {
  "use server";
  const session = await requireModuleAccess("stocks");
  let seller = "";
  try {
    const rateLimit = takeRateLimit({ key: `web-product-page:${session.userId}`, limit: 20, windowMs: 60 * 60 * 1000 });
    if (!rateLimit.allowed) throw new Error("Saatlik fiyat okuma sınırına ulaşıldı.");
    const result = await refreshProductOffers(session.organizationId, String(formData.get("itemId") || ""), String(formData.get("productUrl") || ""), session.branchId);
    seller = result.seller;
  }
  catch (error) { redirect(resultUrl("error", errorMessage(error))); }
  revalidatePath("/dashboard/stocks");
  redirect(resultUrl("success", `${seller} sayfasındaki canlı fiyat kaydedildi.`));
}

async function createRecipeAction(formData: FormData) {
  "use server";
  const session = await requireModuleAccess("stocks");
  const branchId = await getWritableBranchId(session);
  try { await createStockRecipe(session.organizationId, branchId, stockRecipeSchema.parse(Object.fromEntries(formData))); }
  catch (error) { redirect(resultUrl("error", errorMessage(error))); }
  revalidatePath("/dashboard/stocks");
  redirect(resultUrl("success", "Tedavi malzeme reçetesi kaydedildi."));
}

async function deleteRecipeAction(recipeId: string) {
  "use server";
  const session = await requireModuleAccess("stocks");
  try { await deleteStockRecipe(session.organizationId, recipeId, session.branchId); }
  catch (error) { redirect(resultUrl("error", errorMessage(error))); }
  revalidatePath("/dashboard/stocks");
  redirect(resultUrl("success", "Malzeme reçetesi kaldırıldı."));
}

async function deleteStockItemAction(itemId: string) {
  "use server";
  const session = await requireModuleAccess("stocks");
  if (!canManageTrash(session.role)) redirect("/dashboard?error=forbidden");
  try { await softDeleteStockItem(session.organizationId, itemId, session.userId, session.branchId); }
  catch (error) { redirect(resultUrl("error", errorMessage(error))); }
  revalidatePath("/dashboard/stocks");
  revalidatePath("/dashboard/patients/trash");
  redirect(resultUrl("success", "Stok kalemi çöp kutusuna taşındı; 30 gün içinde geri yüklenebilir."));
}

export default async function StocksPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const query = await searchParams;
  const session = await requireModuleAccess("stocks");
  const locale = await getLocale();
  const [stocks, recipes] = await Promise.all([
    getStocks(session.organizationId, session.branchId),
    getStockRecipes(session.organizationId, session.branchId)
  ]);

  return (
    <div className="space-y-6">
      <ModuleHeader icon={Boxes} title="Stok Modülü" description="Minimum stok uyarıları, tedavi reçeteleri, otomatik sarf, tedarikçi ve hareket geçmişi." />
      {canManageTrash(session.role) ? <Link href="/dashboard/patients/trash" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit")}><Trash2 className="h-4 w-4" />Çöp kutusunu aç</Link> : null}
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
              <div className="space-y-2"><Label>Miktar / yeni seviye</Label><Input name="quantity" type="number" min="0" defaultValue="1" /><p className="text-xs text-muted-foreground">Düzeltmede girilen değer yeni stok seviyesi olur; 0 kullanılabilir.</p></div>
              <div className="space-y-2 md:col-span-2"><Label>Not</Label><Input name="note" /></div>
              <Button className="w-fit md:col-span-2" type="submit">Hareket Kaydet</Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Workflow className="h-5 w-5" />Tedavi malzeme reçeteleri</CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">Bir tedavi tamamlandığında burada tanımlanan miktarlar ilgili şubenin stokundan otomatik düşer. Aynı tedavi adı randevu ve tedavi kaydında birebir kullanılmalıdır.</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <form action={createRecipeAction} className="grid gap-4 md:grid-cols-[1fr_1fr_160px_auto] md:items-end">
            <div className="space-y-2"><Label>Tedavi adı</Label><Input name="treatmentType" placeholder="Kompozit dolgu" required /></div>
            <div className="space-y-2"><Label>Kullanılan malzeme</Label><Select name="itemId" required><option value="">Seçin</option>{stocks.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.currentQuantity} {item.unit}</option>)}</Select></div>
            <div className="space-y-2"><Label>Tüketim miktarı</Label><Input name="quantity" type="number" min="1" defaultValue="1" required /></div>
            <Button type="submit">Reçeteye Ekle</Button>
          </form>
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead>Tedavi</TableHead><TableHead>Şube</TableHead><TableHead>Malzeme</TableHead><TableHead>Miktar</TableHead><TableHead className="w-20" /></TableRow></TableHeader>
              <TableBody>
                {recipes.map((recipe) => <TableRow key={recipe.id}>
                  <TableCell className="font-medium">{recipe.treatmentType}</TableCell><TableCell>{recipe.branch.name}</TableCell><TableCell>{recipe.item.name}</TableCell><TableCell>{recipe.quantity} {recipe.item.unit}</TableCell>
                  <TableCell><form action={deleteRecipeAction.bind(null, recipe.id)}><Button type="submit" size="icon" variant="ghost" aria-label={`${recipe.item.name} reçetesini kaldır`}><Trash2 className="h-4 w-4" /></Button></form></TableCell>
                </TableRow>)}
                {!recipes.length ? <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">Henüz tedavi reçetesi tanımlanmadı.</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" />Ürün satın alma ve fiyat karşılaştırma</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <form action={refreshOffersAction} className="grid gap-4 lg:grid-cols-[minmax(180px,1fr)_minmax(320px,3fr)_auto] lg:items-end">
            <div className="space-y-2"><Label>Ürün</Label><Select name="itemId" required><option value="">Seçin</option>{stocks.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></div>
            <div className="space-y-2"><Label>Satın alma sayfası</Label><Input name="productUrl" type="url" placeholder="https://magaza.com/urun/..." required /><p className="text-xs text-muted-foreground">Mağazadaki ürün sayfasını yapıştırın; güncel fiyat otomatik okunur.</p></div>
            <Button type="submit">Fiyatı Getir</Button>
          </form>
          <div className="space-y-4">
            {stocks.filter((item) => item.offers.length > 0).map((item) => (
              <div key={item.id} className="rounded-md border">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3"><span className="font-medium">{item.name} — satın alma sayfaları</span><span className="text-xs text-muted-foreground">Güncel fiyat için sayfayı yukarıdan yeniden ekleyin</span></div>
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
            <TableHeader><TableRow><TableHead>Ürün</TableHead><TableHead>Kategori</TableHead><TableHead>Miktar</TableHead><TableHead>Minimum</TableHead><TableHead>Tedarikçi</TableHead><TableHead>Alış</TableHead><TableHead>Son hareket</TableHead>{canManageTrash(session.role) ? <TableHead className="w-14" /> : null}</TableRow></TableHeader>
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
                  {canManageTrash(session.role) ? <TableCell className="text-right"><form action={deleteStockItemAction.bind(null, item.id)}><ConfirmSubmitButton type="submit" size="icon" variant="ghost" confirmation={`${item.name} çöp kutusuna taşınsın mı?`} aria-label={`${item.name} stok kalemini sil`}><Trash2 className="h-4 w-4 text-destructive" /></ConfirmSubmitButton></form></TableCell> : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
