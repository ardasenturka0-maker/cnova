# Sunucusuz yerel cihaz eşitlemesi

ClinicNova Android/iOS uygulamaları ve kurulu Windows/macOS uygulamaları, merkezi sunucu olmadan aynı klinik verisini paylaşabilir. Kayıtlar her cihazda yerel kalır; cihazlar aynı Wi-Fi/LAN üzerindeyken birbirlerini otomatik bulur ve çift yönlü eşitler. Android ↔ iPhone, iPhone ↔ Windows, Android ↔ Mac ve aynı platformdaki cihazlar dahil bütün ikililer aynı protokolü kullanır.

## Kurulum

1. İlk cihazda **Diğer → Klinik yönetimi → Cihaz eşitleme** bölümünü açın.
2. **Bu cihazda klinik ağı oluştur** düğmesine basın.
3. Gösterilen `CN1.` eşleştirme kodunu yalnızca kliniğe ait güvenilir ikinci cihaza aktarın.
4. İkinci cihazda aynı bölümü açıp kodu **Mevcut klinik ağına katıl** alanına girin.
5. Cihazları aynı yerel ağa bağlayın. Windows güvenlik duvarı sorarsa ClinicNova'ya yalnızca özel ağlarda erişim verin.

Tarayıcı güvenlik modeli yerel TCP/UDP keşfine izin vermediği için bilgisayarda normal web sekmesi değil, ClinicNova Windows veya macOS uygulaması kullanılmalıdır. iPhone/iPad tarafında da tek dosyalık HTML demo yerine ClinicNova iOS uygulaması gerekir.

## Veri ve güvenlik modeli

- Her cihaz tam yerel kopyayı tutar ve internet olmadan çalışır.
- Aktarım AES-256-GCM ile şifrelenir; keşif mesajları klinik anahtarıyla HMAC-SHA256 doğrulamasından geçer.
- Klinik anahtarı Android'de Android KeyStore, iPhone/iPad'de Keychain, Windows/macOS'ta işletim sisteminin güvenli kasası ile korunur.
- Değişiklikler cihaz ve işlem kimliği, sürüm vektörü, karma zinciri ve silme mezar taşıyla saklanır.
- Tekrar gelen paketler idempotenttir. Kesilen aktarım daha sonra yeniden denenir.
- Eşzamanlı ve birbiriyle çelişen düzenlemeler kaybedilmez; **Cihaz eşitleme** ekranında doğru sürüm seçilerek bütün cihazlara yeni bir karar işlemi olarak yayılır.

## Doğal sınırlar

- Merkezi sunucu bulunmadığı için aynı anda veya daha sonra aynı yerel ağda buluşmayan iki cihaz eşitlenemez.
- Misafir izolasyonu kullanan Wi-Fi ağları cihazların birbirini görmesini engelleyebilir. Bu durumda klinik personeli ağı veya aynı LAN kullanılmalıdır.
- Eşleştirme kodu şifreleme anahtarını içerir. Hasta bilgisinden ayrı, güvenli biçimde paylaşılmalı ve mesajlaşma grubunda tutulmamalıdır.

## Randevu mesajı hatırlatmaları

Hasta takibi ekranında 1 hafta ve 1 gün hatırlatmaları ayrı ayrı açılabilir. Zamanı geldiğinde ClinicNova hazır mesaj metnini yerel olarak oluşturur ve uygulamanın bildirim merkezinde gösterir.

- Personel **Metni kopyala** ile mesajı panoya alabilir veya **WhatsApp'ta aç** ile hastanın numarasına hazırlanmış WhatsApp konuşmasını açabilir.
- WhatsApp gönderme düğmesine son kez personel basar; uygulama izinsiz veya arka planda mesaj göndermez.
- Personel gönderimden sonra **Gönderildi** seçeneğini işaretler ve işlem iletişim geçmişine eklenir.
- Her randevu/zaman çifti sabit kimliğe sahiptir; aynı klinik cihazlarında birden fazla mesaj taslağı oluşmaz.
- Randevu iptal edilir, tamamlanır, silinir veya tarihi değişirse bekleyen eski taslak temizlenir.
- API anahtarı, webhook, ücretli mesaj sağlayıcısı ya da WhatsApp Business hesabı gerekmez. Veriler ve mesaj taslakları eşleştirilmiş cihazlar arasında şifreli eşitlenir.
- İşletim sistemi uygulamayı tamamen durdurduğunda kontrol yapılamaz. ClinicNova açıldığında gecikmeden yeniden kontrol eder; açık Windows/macOS uygulaması veya düzenli kullanılan telefon yeterlidir.

## Tedavi before/after fotoğrafları

Gerçekleşen tedavi formunda before ve after fotoğrafları kameradan veya dosyalardan eklenebilir. Görseller en fazla 1280 piksele ve güvenli eşitleme boyutuna otomatik küçültülür, cihazda şifreli saklanır ve tedavi kaydıyla birlikte klinik ağına aktarılır.
