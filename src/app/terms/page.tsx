import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/landing/legal-page";

export const metadata: Metadata = { title: "Kullanım Koşulları" };

export default function TermsPage() {
  return (
    <LegalPage title="Kullanım koşulları" updatedAt="11 Temmuz 2026">
      <section>
        <h2>Hizmetin amacı</h2>
        <p>ClinicNova klinik operasyonlarını düzenleyen bir yazılım hizmetidir. Teşhis, tedavi önerisi veya acil sağlık hizmeti vermez. Klinik kararların ve hasta güvenliğinin sorumluluğu yetkili sağlık profesyonellerindedir.</p>
      </section>
      <section>
        <h2>Hesap güvenliği ve yetkili kullanım</h2>
        <p>Kullanıcılar hesap bilgilerini korumalı, rol ve erişim yetkilerini en az ayrıcalık ilkesine göre düzenlemeli ve hukuka aykırı veri yüklememelidir. Şüpheli erişimler gecikmeden klinik yöneticisine bildirilmelidir.</p>
      </section>
      <section>
        <h2>Demo ve entegrasyonlar</h2>
        <p>Demo ortamındaki örnek veriler gerçek hasta verisi değildir. Harici mesajlaşma, ödeme, e-belge ve otomasyon servisleri ancak ilgili sağlayıcı hesabı, sözleşme ve canlı kimlik bilgileri yapılandırıldığında üretim hizmeti sayılır.</p>
      </section>
      <section>
        <h2>Destek</h2>
        <p>Hizmet, sözleşme ve kullanılabilirlik soruları için <Link className="text-primary underline" href="/contact">iletişime geçin</Link>.</p>
      </section>
    </LegalPage>
  );
}
