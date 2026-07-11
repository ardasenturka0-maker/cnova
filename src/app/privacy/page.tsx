import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/landing/legal-page";

export const metadata: Metadata = { title: "Gizlilik ve Kişisel Veriler" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Gizlilik ve kişisel veriler" updatedAt="11 Temmuz 2026">
      <section>
        <h2>Roller ve kapsam</h2>
        <p>ClinicNova, abone kliniklerin hasta ve operasyon verilerini yönetmesine yardımcı olan bir yazılım platformudur. Klinik, kendi hasta verileri bakımından veri sorumlusu; ClinicNova ise sözleşme ve yürürlükteki mevzuat kapsamına göre veri işleyen rolünde olabilir.</p>
      </section>
      <section>
        <h2>İşlenen veri kategorileri</h2>
        <p>Hesap ve iletişim bilgileri, randevu ve tedavi kayıtları, ödeme/operasyon kayıtları, onamlar, hasta tarafından sağlanan sağlık bilgileri, dosyalar, güvenlik ve denetim kayıtları işlenebilir. Her klinik yalnızca gerekli verileri toplamalı ve kendi aydınlatma metnini sunmalıdır.</p>
      </section>
      <section>
        <h2>Amaç, saklama ve paylaşım</h2>
        <p>Veriler hizmetin sunulması, güvenliğin sağlanması, destek ve yasal yükümlülükler için işlenir. Saklama süreleri klinik yapılandırmasına ve yasal gerekliliklere göre belirlenir. Entegrasyon sağlayıcılarına aktarım yalnızca yapılandırılan hizmet, yetki ve hukuki dayanak kapsamında yapılmalıdır.</p>
      </section>
      <section>
        <h2>Haklar ve iletişim</h2>
        <p>Erişim, düzeltme, silme veya diğer veri sahibi talepleri öncelikle hizmet alınan kliniğe yöneltilmelidir. Platformla ilgili talepler için <Link className="text-primary underline" href="/contact">iletişim formunu</Link> kullanabilirsiniz.</p>
      </section>
    </LegalPage>
  );
}
