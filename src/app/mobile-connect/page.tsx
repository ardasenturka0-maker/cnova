import { CheckCircle2 } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { MobileSyncReturn } from "@/components/mobile-sync-return";

export default async function MobileConnectPage() {
  await requireSession();
  return <main className="grid min-h-screen place-items-center bg-muted/30 p-6">
    <section className="w-full max-w-md space-y-5 rounded-2xl border bg-background p-7 text-center shadow-sm">
      <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
      <div className="space-y-2"><h1 className="text-2xl font-semibold">Sunucu bağlantısı hazır</h1><p className="text-sm text-muted-foreground">Yerel uygulamaya dönülüyor. Bekleyen cihaz kayıtları bu klinik hesabına güvenli biçimde eşitlenecek.</p></div>
      <MobileSyncReturn />
    </section>
  </main>;
}
