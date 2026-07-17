# Sunucusuz yerel cihaz eşitlemesi

ClinicNova Android uygulaması ve kurulu masaüstü uygulaması, merkezi sunucu olmadan aynı klinik verisini paylaşabilir. Kayıtlar her cihazda yerel kalır; cihazlar aynı Wi-Fi/LAN üzerindeyken birbirlerini otomatik bulur ve çift yönlü eşitler.

## Kurulum

1. İlk cihazda **Diğer → Klinik yönetimi → Cihaz eşitleme** bölümünü açın.
2. **Bu cihazda klinik ağı oluştur** düğmesine basın.
3. Gösterilen `CN1.` eşleştirme kodunu yalnızca kliniğe ait güvenilir ikinci cihaza aktarın.
4. İkinci cihazda aynı bölümü açıp kodu **Mevcut klinik ağına katıl** alanına girin.
5. Cihazları aynı yerel ağa bağlayın. Windows güvenlik duvarı sorarsa ClinicNova'ya yalnızca özel ağlarda erişim verin.

Tarayıcı güvenlik modeli yerel TCP/UDP keşfine izin vermediği için bilgisayarda normal web sekmesi değil, ClinicNova masaüstü uygulaması kullanılmalıdır.

## Veri ve güvenlik modeli

- Her cihaz tam yerel kopyayı tutar ve internet olmadan çalışır.
- Aktarım AES-256-GCM ile şifrelenir; keşif mesajları klinik anahtarıyla HMAC-SHA256 doğrulamasından geçer.
- Klinik anahtarı Android'de Android KeyStore, masaüstünde işletim sisteminin güvenli kasası ile korunur.
- Değişiklikler cihaz ve işlem kimliği, sürüm vektörü, karma zinciri ve silme mezar taşıyla saklanır.
- Tekrar gelen paketler idempotenttir. Kesilen aktarım daha sonra yeniden denenir.
- Eşzamanlı ve birbiriyle çelişen düzenlemeler kaybedilmez; **Cihaz eşitleme** ekranında doğru sürüm seçilerek bütün cihazlara yeni bir karar işlemi olarak yayılır.

## Doğal sınırlar

- Merkezi sunucu bulunmadığı için aynı anda veya daha sonra aynı yerel ağda buluşmayan iki cihaz eşitlenemez.
- Misafir izolasyonu kullanan Wi-Fi ağları cihazların birbirini görmesini engelleyebilir. Bu durumda klinik personeli ağı veya aynı LAN kullanılmalıdır.
- Eşleştirme kodu şifreleme anahtarını içerir. Hasta bilgisinden ayrı, güvenli biçimde paylaşılmalı ve mesajlaşma grubunda tutulmamalıdır.
