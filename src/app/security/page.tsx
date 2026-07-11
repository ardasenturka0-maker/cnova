import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { LegalPage } from "@/components/landing/legal-page";

export const metadata: Metadata = { title: "Güvenlik" };

const controls = [
  "Organizasyon bazlı veri izolasyonu ve rol tabanlı erişim",
  "HttpOnly oturum çerezleri, imzalı ve süreli oturum belirteçleri",
  "Güvenlik başlıkları, hız sınırlama ve denetim kayıtları",
  "Girdi doğrulama, dosya türü/boyutu sınırları ve gizli webhook anahtarları",
  "Bağımlılık güvenlik taraması ve otomatik kalite kontrolleri"
];

export default function SecurityPage() {
  return (
    <LegalPage title="Güvenlik yaklaşımı" updatedAt="11 Temmuz 2026">
      <section>
        <h2>Katmanlı koruma</h2>
        <div className="mt-4 grid gap-3">
          {controls.map((control) => (
            <div key={control} className="flex items-start gap-3 rounded-lg border bg-card p-4 text-foreground">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <span>{control}</span>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2>Üretim sorumlulukları</h2>
        <p>Canlı ortamda güçlü ve benzersiz gizli anahtarlar, TLS, yönetilen PostgreSQL, şifreli yedekler, erişim izleme, olay müdahale planı ve düzenli geri yükleme tatbikatı zorunlu kabul edilir. Sağlık verileri gerçek entegrasyonlara açılmadan önce KVKK/GDPR hukuki ve teknik değerlendirmesi tamamlanmalıdır.</p>
      </section>
      <section>
        <h2>Açık bildirim</h2>
        <p>Bir güvenlik sorunu fark ederseniz ayrıntıları herkese açık paylaşmadan iletişim kanalımız üzerinden bildirin. Bildirim doğrulandıktan sonra etki azaltma ve düzeltme süreci başlatılır.</p>
      </section>
    </LegalPage>
  );
}
