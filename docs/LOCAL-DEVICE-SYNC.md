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

## Otomatik randevu mesajları

Hasta takibi ekranında 1 hafta ve 1 gün hatırlatmaları ayrı ayrı açılabilir. Klinik, HTTPS mesaj sağlayıcı webhook adresini ve anahtarını girer; anahtar cihazın şifreli kasasında tutulur ve yalnız eşleştirilmiş klinik cihazlarına şifreli eşitlemeyle aktarılır.

- Aynı anda yalnız seçilen gönderici cihaz kuyruğu çalıştırır.
- Her randevu/zaman çifti sabit bir `Idempotency-Key` ile gönderilir. Sağlayıcı bu anahtarı tekrar işleme almamalıdır.
- Başarısız teslimatlar aynı kimlikle yeniden denenir; başarılı teslimat ikinci kez gönderilmez.
- Hasta mesajının ulaşması internet ve klinik tarafından yapılandırılmış WhatsApp/SMS sağlayıcısı gerektirir. Merkezi ClinicNova veri sunucusu gerekmez.
- iOS arka plan çalışmasını işletim sistemi sınırlar. Yalnız telefon kullanılan kliniklerde gönderici iPhone uygulaması düzenli açılmalıdır; kesintisiz otomasyon için açık kalan Windows veya macOS cihazı gönderici seçilmelidir.

## Tedavi before/after fotoğrafları

Gerçekleşen tedavi formunda before ve after fotoğrafları kameradan veya dosyalardan eklenebilir. Görseller en fazla 1280 piksele ve güvenli eşitleme boyutuna otomatik küçültülür, cihazda şifreli saklanır ve tedavi kaydıyla birlikte klinik ağına aktarılır.
