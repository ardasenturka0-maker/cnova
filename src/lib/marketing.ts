import { BarChart3, BellRing, Boxes, Building2, CalendarDays, ClipboardCheck, CreditCard, DatabaseZap, FileText, MessageSquare, Repeat, ShieldCheck, Sparkles, Stethoscope, Users } from "lucide-react";

export const features = [
  { title: "Randevu Yönetimi", description: "Günlük, haftalık ve liste görünümleriyle çakışma kontrollü planlama.", icon: CalendarDays },
  { title: "Hasta Takibi", description: "Medikal notlar, etiketler, ziyaret geçmişi ve iletişim kayıtları.", icon: Users },
  { title: "Tedavi Planlama", description: "Diş numarası, hekim, durum, ücret ve klinik notlarıyla plan akışı.", icon: Stethoscope },
  { title: "Finans ve Tahsilat", description: "Gelir, gider, ödeme, fatura ve sağlayıcı bağımsız sanal POS katmanı.", icon: CreditCard },
  { title: "Stok Yönetimi", description: "Minimum stok uyarıları, hareket geçmişi ve tedarikçi takibi.", icon: Boxes },
  { title: "Personel ve Hekim", description: "Çalışma saatleri, hakediş, performans ve rol bazlı erişim.", icon: Building2 },
  { title: "Dijital Onam", description: "Şablon, imza gönderimi, kayıt ve zaman damgası için izlenebilir onam akışı.", icon: ClipboardCheck },
  { title: "WhatsApp / SMS / E-posta", description: "Sağlayıcıdan bağımsız mesajlaşma katmanı ve iletişim geçmişi.", icon: MessageSquare },
  { title: "Çoklu Şube", description: "Organization, branch ve tenant filtreli veri mimarisi.", icon: DatabaseZap },
  { title: "Raporlama", description: "Gelir, doluluk, doktor performansı ve şube karşılaştırması.", icon: BarChart3 },
  { title: "Veri Aktarımı", description: "Eski sistemlerden geçiş için import yaklaşımına hazır mimari.", icon: Repeat }
];

export const reasons = [
  "Tek sistemde tüm klinik operasyonları",
  "Mobil uyumlu kullanım",
  "Bulut altyapısına uygun mimari",
  "Rol bazlı yetkilendirme ve güvenlik",
  "Otomatik yedekleme mantığına hazır veri katmanı",
  "KVKK/GDPR hazırlığı için audit ve onam kayıtları",
  "Kolay geçiş ve veri import yaklaşımı"
];

export const integrations = [
  "E-Fatura",
  "E-Arşiv",
  "E-Reçete",
  "E-Nabız",
  "MBYS / USS",
  "WhatsApp Business",
  "SMS servisleri",
  "Sanal POS",
  "CRM sistemleri",
  "WordPress online randevu"
];

export const plans = [
  {
    name: "Başlangıç",
    price: "₺1.490",
    description: "Yeni başlayan tek şubeli klinikler için.",
    limits: ["3 kullanıcı", "2 doktor", "1 şube", "Hasta ve randevu modülü", "Temel finans", "E-posta destek"]
  },
  {
    name: "Klinik",
    price: "₺3.490",
    description: "Operasyonunu tek panelden büyüten klinikler için.",
    limits: ["12 kullanıcı", "8 doktor", "3 şube", "Finans ve stok", "Dijital onam", "Mesajlaşma entegrasyon katmanı", "Gelişmiş raporlar"],
    highlighted: true
  },
  {
    name: "Kurumsal",
    price: "Özel",
    description: "Çoklu şube ve entegrasyon ihtiyacı olan gruplar için.",
    limits: ["Sınırsız kullanıcı", "Sınırsız doktor", "Çoklu şube", "Gelişmiş entegrasyonlar", "Veri aktarımı", "Özel destek"]
  }
];

export const faqs = [
  ["Sistem kurulumu gerekiyor mu?", "Kullanım biçimine göre değişir. ClinicNova Windows, macOS ve Android'e kurulabilir; çevrimdışı yerel kullanımın yanında HTTPS sunucuya bağlanıp eşitleme de desteklenir."],
  ["İnternet kesilirse kayıtlar kaybolur mu?", "Hayır. Hasta, randevu, tedavi, ödeme ve stok işlemleri cihazda kalıcı tutulur. Sunucu bağlantısı varsa bekleyen değişiklikler bağlantı geri geldiğinde eşitlenir."],
  ["Çevrimdışı kullanımda giriş güvenliği var mı?", "Evet. İlk kurulumda yerel yönetici hesabı ve parola oluşturulur; sonraki açılışlarda internet olmasa da giriş istenir. Parolanın kendisi düz metin olarak saklanmaz."],
  ["Veriler güvenli mi?", "Yerel giriş koruması, rol bazlı erişim, organizasyon filtresi, güvenlik başlıkları ve denetim kaydı kontrolleri uygulanır. Cihaz kaybına karşı ayrıca düzenli yedek önerilir."],
  ["Eski yazılımdan veri aktarılır mı?", "Aktarım biçimi mevcut sistemin dışa aktardığı dosyalara göre planlanır. Klinik verisi incelenmeden otomatik ve eksiksiz aktarım sözü verilmez."],
  ["Mobilde çalışır mı?", "Evet. Android uygulaması ve telefon ekranlarına uyumlu arayüz vardır. iPhone tarafında kurulum yöntemi ayrıca değerlendirilir."],
  ["Çoklu şube desteklenir mi?", "Evet. Organizasyon ve şube bazlı veri ayrımı ile yetkilendirme altyapısı bulunur."],
  ["Modüller nasıl yönetilir?", "Modüller ortak bir katalog ve rol yetkileri üzerinden sunulur. Klinik görevine göre yalnız gerekli alanlar gösterilerek menü sade tutulabilir."]
];

export const highlightCards = [
  { label: "Günlük akış", value: "Tek ekranda öncelikler", icon: Sparkles },
  { label: "Güvenlik", value: "Rol bazlı erişim", icon: ShieldCheck },
  { label: "Uyarılar", value: "Stok, ödeme, günlük görev", icon: BellRing },
  { label: "Raporlama", value: "CSV + yönetim özeti", icon: FileText }
];
