import { BarChart3, BellRing, Boxes, Building2, CalendarDays, ClipboardCheck, CreditCard, DatabaseZap, FileText, HeartPulse, MessageSquare, Repeat, ShieldCheck, Sparkles, Stethoscope, Users } from "lucide-react";

export const features = [
  { title: "Randevu Yönetimi", description: "Günlük, haftalık ve liste görünümleriyle çakışma kontrollü planlama.", icon: CalendarDays },
  { title: "Hasta Takibi", description: "Medikal notlar, etiketler, ziyaret geçmişi ve iletişim kayıtları.", icon: Users },
  { title: "Tedavi Planlama", description: "Diş numarası, hekim, durum, ücret ve klinik notlarıyla plan akışı.", icon: Stethoscope },
  { title: "Finans ve Tahsilat", description: "Gelir, gider, ödeme, fatura ve sağlayıcı bağımsız sanal POS katmanı.", icon: CreditCard },
  { title: "Stok Yönetimi", description: "Minimum stok uyarıları, hareket geçmişi ve tedarikçi takibi.", icon: Boxes },
  { title: "Personel ve Hekim", description: "Çalışma saatleri, hakediş, performans ve rol bazlı erişim.", icon: Building2 },
  { title: "Dijital Onam", description: "Şablon, imza gönderimi, kayıt ve zaman damgası için izlenebilir onam akışı.", icon: ClipboardCheck },
  { title: "Memnuniyet Anketleri", description: "1-5 puanlama, yorum ve düşük skorlar için takip listesi.", icon: HeartPulse },
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
  ["Sistem kurulumu gerekiyor mu?", "Hayır. ClinicNova bulut mimarisine uygun tasarlanır; yerel kurulum gerektirmez."],
  ["Veriler güvenli mi?", "Şifre hashleme, rol bazlı erişim, organizasyon filtresi, güvenlik başlıkları ve audit log yaklaşımı uygulanır."],
  ["Eski yazılımdan veri aktarılır mı?", "Evet. Veri import katmanı için mimari hazırlandı; gerçek import sonraki fazda genişletilebilir."],
  ["Mobilde çalışır mı?", "Evet. Landing ve dashboard responsive tasarıma sahiptir."],
  ["Çoklu şube desteklenir mi?", "Evet. Organization ve Branch modelleriyle çoklu şube yapısı kuruludur."],
  ["Eğitim ve destek var mı?", "Demo ve iletişim formları destek sürecine bağlanacak şekilde database’e kaydedilir."]
];

export const highlightCards = [
  { label: "Operasyon AI", value: "Akıllı öncelikler", icon: Sparkles },
  { label: "Güvenlik", value: "RBAC + Audit", icon: ShieldCheck },
  { label: "Uyarılar", value: "Stok, ödeme, recall", icon: BellRing },
  { label: "Raporlama", value: "CSV + yönetim özeti", icon: FileText }
];
