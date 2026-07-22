# ClinicNova 1.15.6 platform ve işlev denetimi

Tarih: 22 Temmuz 2026

Kapsam: Web, API/PostgreSQL, iOS, Android, macOS ve Windows
Temel sürüm: `1.15.6`

## Sonuç

ClinicNova'nın kaynak kodu, ortak çevrimdışı istemci paketi, native köprüleri, sunucu API'leri, veritabanı geçişleri ve üretim paketleri işlev, veri bütünlüğü, tenant/rol sınırları, eşzamanlılık, tarih/saat, çevrimdışı çalışma ve güvenlik açısından incelendi. Bulunan uygulanabilir kaynak hataları düzeltildi. Son durumda lint ve TypeScript denetimi temiz; 101 birim/güvenlik testi, gerçek PostgreSQL entegrasyonu, 71 rotalı üretim web derlemesi, iOS simülatör ve fiziksel iPhone çalıştırması, Android APK derlemesi ve macOS paket çalışma testi başarılıdır. Tam Playwright sonucu bu raporun son doğrulama bölümünde kayıtlıdır.

Bu çalışma bir kaynak kodu ve yerel paket kabul testidir; bağımsız penetrasyon testi, tıbbi cihaz sertifikasyonu, KVKK/GDPR hukuk görüşü veya üretim altyapısı denetimi değildir.

## Platform eşitliği

iOS, Android, macOS ve Windows aynı canonical `mobile/assets` uygulamasını kullanır. `index.html`, `app.css`, `app.js` ve `mesh-sync.js` dört native hedefte byte düzeyinde aynıdır. Yalnız `runtime-config.js`, platform adı ve dağıtım sunucu adresini bildirmek için bilinçli olarak farklıdır. Native kabuklar aynı JavaScript köprü sözleşmesini uygular.

Web paneli aynı HTML kabuğunun kopyası değildir: Next.js üzerinde daha geniş yönetim, hasta portalı, MFA, dosya kasası ve entegrasyon yüzeyleri sunar. Native istemciler aynı çevrimdışı çekirdek işlevleri yerel olarak verir ve **Tam web paneli** üzerinden bu gelişmiş web işlevlerine erişir. Bu nedenle doğrulanan eşitlik, dört native hedefte aynı yerel deneyim ve bütün hedeflerde aynı sunucu verisi/işlev erişimidir; her pikselin web ile aynı olması değildir.

| İşlev | Web | iOS | Android | macOS | Windows |
|---|---|---|---|---|---|
| Klinik/yönetici kaydı ve giriş | Sunucu hesabı | Yerel hesap + HTTPS sunucu girişi | Aynı | Aynı | Aynı |
| Hasta CRUD, arama, sağlık notları | Tam | Yerel + sync | Aynı | Aynı | Aynı |
| Randevu, doktor/koltuk ve çakışma kontrolü | Tam | Yerel + sync | Aynı | Aynı | Aynı |
| Tedavi planı ve gerçekleşen tedavi | Tam | Yerel + sync | Aynı | Aynı | Aynı |
| Tedavi öncesi/sonrası fotoğraf | Şifreli dosya kasası | Sıkıştırılmış yerel kayıt | Aynı | Aynı | Aynı |
| Tahsilat, peşinat, gider, taksit | Tam | Yerel + sync | Aynı | Aynı | Aynı |
| Stok, hareket, reçete, ürün fiyatı | Tam | Yerel + güvenli HTTPS | Aynı | Aynı | Aynı |
| Doktor, koltuk ve personel | Tam | Yetkiye bağlı yerel + web | Aynı | Aynı | Aynı |
| İletişim, recall ve manuel hatırlatma | Sağlayıcı adaptörlü | Yerel taslak/bildirim | Aynı | Aynı | Aynı |
| Anket, rapor ve çöp kutusu | Tam | Yerel + sync | Aynı | Aynı | Aynı |
| Dijital onam | Kimlik doğrulamalı sunucu kaydı | Yerel kayıt + web'e geçiş | Aynı | Aynı | Aynı |
| Hasta portalı, MFA, parola sıfırlama, dışa aktarma | Tam web | Sabitlenmiş HTTPS web paneli | Aynı | Aynı | Aynı |
| Bulut eşitleme | Kaynak sistem | İdempotent push/pull | Aynı | Aynı | Aynı |
| Şifreli yerel ağ mesh | Yönetim sunucusu değil | Bonjour/LAN | NSD/LAN | Bonjour/LAN | Bonjour/LAN |
| Çevrimdışı şifreli saklama | Tarayıcı hedefi değil | Keychain korumalı | Android Keystore | Keychain/safeStorage | DPAPI/safeStorage |

## Bulunan hatalar, nedenleri ve düzeltmeler

| Önem | Bulgu ve kök neden | Uygulanan düzeltme | Doğrulama |
|---|---|---|---|
| Yüksek | WebView/native köprüleri URL metni ve custom-scheme `origin` değerine güveniyordu; WHATWG'a göre bu origin `null` olabildiği için masaüstü köprüsü kırılıyor, gevşek kontroller de uzak içeriğe yetki riski yaratıyordu. | Ortak exact-document/path/origin politikası eklendi; yalnız paketli ana frame köprü alıyor. | Desktop policy ve paket testleri |
| Yüksek | Android/iOS uzak giriş sayfasına geçerken native köprü ve oturum çerezi sınırları yeterince kesin değildi. | Uzak sayfalarda köprüler kaldırıldı, çerezler native cookie store'a kopyalandı, API/portal yalnız kaydedilmiş çıplak HTTPS origin'ine sabitlendi. | Köprü parite ve yönlendirme testleri |
| Yüksek | Sunucu POST isteklerinde ortak CSRF/origin kapısı ve stream düzeyinde gövde sınırı her rotada yoktu. | Mutation guard ile bounded JSON/multipart okuyucuları eklendi; 400/403/413/415 yanıtları standartlaştırıldı. | API güvenlik regresyon testleri |
| Yüksek | JWT geçerli kaldığı sürece devre dışı kullanıcı, değişen rol veya değişen parola eski yetkiyle işlem yapabiliyordu. | Her oturum aktif kullanıcıyla yeniden doğrulanıyor; parola hash'inden credential version üretilerek parola değişiminde eski token iptal ediliyor. | Oturum/rol regresyon testi + PostgreSQL |
| Yüksek | Randevu çakışma kontrolü read-then-write yaptığı için eşzamanlı iki istek aynı doktoru veya koltuğu rezerve edebiliyordu. | Serializable transaction, retry ve doktor/şube/koltuk kapsamlı overlap denetimi eklendi; son retry'da ham Prisma hatası yerine alan hatası dönüyor. | Gerçek PostgreSQL yarış testi |
| Yüksek | Tedavi durum değişikliği, portal iptali ve stok tüketimi eşzamanlı güncellemelerde lost-update/çift tüketim üretebiliyordu. | Compare-and-set güncellemeleri, serializable retry ve idempotent stok hareketleri eklendi. | PostgreSQL yarış ve rollback testleri |
| Yüksek | Stok çıkışı read-modify-write ile hesaplanıyordu; paralel çıkışlar negatif veya yanlış stok üretebilirdi. | Koşullu atomik decrement ve hareket tablosunda idempotency kontrolü uygulandı. | Birim + PostgreSQL entegrasyonu |
| Yüksek | Mobil sync eski başarısız CREATE kaydını yenisiyle birlikte gönderebiliyor, bazı entity kimliklerini sınırsız kabul ediyor ve bazı yarışlarda ham altyapı hatası sızdırıyordu. | Supersede zinciri, kararlı operation ID, batch/alan sınırları, CAS/serializable yolları ve güvenli hata maskeleme eklendi. | Sync, retry ve idempotency testleri |
| Yüksek | LAN mesh payload'larında boyut, derinlik, collection ve prototype anahtar kontrolleri eksik/dağınıktı; bellek tüketimi ve prototype pollution riski vardı. | Kimlik doğrulamalı şifreli envelope, 47 MiB plaintext sınırı, frame sınırı, izinli collection/anahtar/depth denetimi ve zincir bütünlüğü uygulandı. | 3-peer convergence, tamper ve exhaustion testleri |
| Yüksek | `sharp 0.34.5`, `brace-expansion 1.1.15` ve `fast-uri 3.1.3` güncel güvenlik danışmanlıklarında etkileniyordu. | `sharp 0.35.3` Next için override ile sabitlendi; transitive paketler `1.1.16` ve `3.1.4` sürümlerine yükseltildi. | `npm audit`: 0 açık; web build geçti |
| Orta | Klinik tarihleri host timezone ile `new Date(...)` üzerinden yorumlanıyor, UTC gece sınırı ve ay sonlarında bir gün kayma olabiliyordu. | Europe/Istanbul parser/formatter katmanı, geçerli takvim kontrolü ve ay-sonu clamp eklendi; üretim TZ'si belgelendi. | TZ ve ödeme planı testleri |
| Orta | Mobil uygulamada `todayIso` uzun açık oturumda gece yarısından sonra eski kalıyordu. | Klinik saati yeniden hesaplayan lifecycle yenilemesi eklendi. | Kaynak regresyon testi |
| Orta | Finans raporu ve hasta toplamı `PENDING` tahsilatları gerçekleşmiş gelir gibi sayıyordu. | Tahsil edilen/toplam ödenen metrikleri yalnız `PAID` kayıtlarına indirildi; bekleyen bakiye ayrı tutuldu. | Mobil E2E ve birim testleri |
| Orta | Mobil iletişim `IN_APP` ve `DELIVERED` değerleri Prisma enum'larında yoktu; gerçek PostgreSQL sync'i hata verebilirdi. | Enum migration'ı eklendi ve canlı test veritabanına uygulandı. | 10 migration + entegrasyon testi |
| Orta | Silinmiş hastaya bağlı randevu, ödeme, tedavi, onam ve iletişim snapshot'larda görünmeye devam edebiliyordu. | Tüm operasyonel sorgu ve mobil snapshot'lara soft-delete ilişki filtresi eklendi. | Regresyon testi |
| Orta | Doktor düzenleme yolu klinik sahibinin rolünü yanlışlıkla `DOCTOR` yapabiliyordu. | Doktor mutation'ları role/tenant/branch açısından sınırlandı; owner read-only doktor seçeneği olarak taşınıyor. | Rol clobber testi |
| Orta | Ürün sayfası denetimi özel IP'lere, credential içeren URL'lere veya yönlendirme ile başka origine gidebiliyordu. | HTTPS şema, DNS/IP SSRF politikası, bounded response ve yönlendirme/origin kontrolü eklendi. | IPv4/IPv6 SSRF testleri |
| Orta | Hasta dosyalarında istemci MIME türüne güvenme, cache ve bütünlük sınırları tutarlı değildi. | Magic-byte algılama, boyut sınırı, metadata stripping, authenticated encryption/checksum, key rotation ve `no-store` eklendi. | Güvenli dosya kasası testleri |
| Orta | Yerel hesap parolası ve fallback hash sözleşmesi platformlar arasında tutarsızlaşabiliyordu. | PBKDF2-SHA-256 sözleşmesi tüm native hedeflerde eşitlendi; düz parola saklanmıyor, recovery code bir kez gösteriliyor, brute-force kilidi uygulanıyor. | Cross-platform PBKDF2 testleri |
| Orta | Şifreli depoya yazma başarısız olduğunda UI bazı işlemleri başarılı gösterebiliyordu. | Kritik native storage çağrıları senkron ACK/fail-closed oldu; bozuk şekiller geri yüklenmiyor. | Storage failure testleri |
| Orta | iOS prompt köprüsünde async callback varsayımı yazma sonucunu yanlış sırada işleyebiliyordu. | `window.prompt` ACK sözleşmesi Swift/JS tarafında eşitlendi. | Apple bridge testi + cihaz çalıştırması |
| Orta | Kamera geçici dosyaları ve izinleri yaşam döngüsü sonunda temizlenmiyordu. | Geçici dosya cleanup ve yalnız gerekli kamera/fotoğraf izinleri uygulandı. | Native kaynak/paket incelemesi |
| Orta | Desktop production'da DevTools, inspector, `NODE_OPTIONS` ve ASAR dışı çalıştırma yüzeyleri yeterince kapalı değildi. | Sandbox/context isolation, exact IPC, Electron fuses, ASAR integrity, only-load-ASAR ve remote-debug engelleri uygulandı. | Mac/Windows fuse incelemesi |
| Orta | Desktop plist'te kullanılmayan mikrofon/Bluetooth ve localhost ATS istisnaları vardı. | After-pack sanitization ile gereksiz izinler kaldırıldı; yalnız kamera, LAN ve Bonjour bırakıldı. | Paket plist güvenlik testi |
| Orta | Android hedef SDK/izin bildirimi eskiydi; Android 16 LAN izin davranışıyla uyumsuzluk riski vardı. | compile/target SDK 36, min 26; cleartext/backup kapalı, `NEARBY_WIFI_DEVICES` `neverForLocation` ve güvenli manifest uygulandı. | `aapt2`, `apksigner`, `zipalign` |
| Orta | iOS uygulama ikonu/URL scheme/yerel ağ açıklamaları eksik veya paketle doğrulanmıyordu. | AppIcon asset catalog, `clinicnova://` deep link, Bonjour/LAN/camera açıklamaları ve ATS deny-by-default eklendi. | Xcode simulator + fiziksel cihaz build |
| Düşük | Üretim başlangıcı standalone Next çıktısı yerine `next start` kullanıyor ve container çıktısıyla çelişiyordu. | `scripts/start-standalone.mjs` ve üretim script zinciri eklendi. | Build ve başlangıç regresyon testi |
| Düşük | Eski README/kurulum dosyaları 1.6.1, Java 21/API 34 ve eski APK hash'lerini söylüyordu. | Belgeler 1.15.6, Java 17/API 36 ve yeniden hesaplanan hash akışına getirildi. | Doküman/statik inceleme |

## Son doğrulama kayıtları

| Kontrol | Sonuç |
|---|---|
| ESLint | Başarılı, 0 warning |
| TypeScript `tsc --noEmit` | Başarılı |
| Node birim/güvenlik testleri | 101/101 başarılı |
| Playwright tam E2E | 52/52 başarılı (26 desktop Chromium + 26 Android Chrome) |
| Next.js üretim derlemesi | Başarılı, 71 rota |
| `npm audit` | 0 açık |
| Prisma validate/status | Geçerli; 10 migration güncel |
| Migration→schema ve canlı DB→schema diff | Fark yok |
| Gerçek PostgreSQL entegrasyonu | Başarılı; soft-delete/restore/purge/audit/dosya kasası ve yarış testleri |
| Ortak native asset paritesi | Dört hedefte byte düzeyinde eşit |
| iOS Simulator 26.5 | Build/install/launch başarılı |
| Fiziksel iPhone 17 Pro Max, iOS 26.5.1 | İmzalı build/install/launch başarılı; `1.15.6 (11506)` |
| Android APK | Build, manifest, alignment ve v2/v3 imza doğrulaması başarılı |
| macOS universal | DMG bütünlüğü, code signature ve gerçek GUI süreç testi başarılı |
| Windows x64 | Unpacked PE/ASAR/fuse/ASLR/DEP/CFG incelemesi başarılı; runtime yapılmadı |

## Artefact ve ortak dosya hash'leri

Build artefact'ları ve geçici imza anahtarları Git'e dahil edilmez. Aşağıdaki değerler bu denetim koşusuna aittir.

| Artefact | SHA-256 |
|---|---|
| Android `ClinicNova-1.15.6.apk` | `8119f2b7e1665d4799bcdee30459699fc3a93e5d57d54f647d19ebd07c8bd725` |
| iOS arm64 executable | `b401ebcd76082ca46480f7a8f9be9e3e4cfdce3ad2860ec851ff00e1fb96b254` |
| macOS universal DMG | `877718577fe06bf9996e33f031b6d01434cd55494cf29cb2c169d5400f5b5964` |
| Windows unpacked `ClinicNova.exe` | `590562689e59d6dd9b1cc36ace61f3c14bc031fed8e928c01d6aba5730d4ad5d` |
| Canonical `index.html` | `7a9c2d2afb084797146682ea208dc3b1b3474525c7b6ccb8c440e3dd9be46ff8` |
| Canonical `app.css` | `f5037502c67c61e3b33ea4793384164ce69a3b8633b780b64920b5670956cf7b` |
| Canonical `app.js` | `0ce8923e12f8ec2c6f28b9e587f1cebac72ecf4f0fcb836095b441f0df5a2b2f` |
| Canonical `mesh-sync.js` | `208d8ecfc6c2284dbbdc0ad68751f3d88d8e3cf7493044e5caa7d1d1f26b7c53` |

## Bilinen dağıtım ve mimari sınırlar

1. Android APK geçici denetim anahtarıyla imzalandı. Play dağıtımı için kalıcı, yedeklenmiş upload key ve AAB üretilmelidir; bu APK gelecekteki upgrade zincirinin anahtarı olarak kullanılmamalıdır.
2. iPhone kurulumu Apple Development profiliyle yapıldı. App Store/TestFlight yayını için dağıtım profili ve mağaza süreci gerekir.
3. macOS paketi Apple Development ile imzalıdır; Developer ID ile imzalanıp notarize edilmediği için genel internet dağıtımında Gatekeeper kabulü beklenmez.
4. Windows PE bu Mac'te üretildi ama çalıştırılamadı ve imzasızdır. Apple Silicon host'ta Rosetta olmadığı için final NSIS wrapper oluşmadı; Windows GitHub Actions runner'ı final `.exe` üretmek üzere yapılandırılmıştır. Ticari dağıtımda Authenticode sertifikası gerekir.
5. ClamAV, ödeme/e-belge/mesaj sağlayıcıları, yedek/PITR remote'u ve gerçek üretim secret'ları yerel testte etkin değildi; readiness kapıları bunlar olmadan canlı başarı bildirmez.
6. Rate limit tek süreç içi bellektedir. Birden çok web instance'ında Redis benzeri merkezi sayaç ve yalnız güvenilir proxy'den istemci IP'si gerekir.
7. Hasta portalında klinik kodu + telefon + doğum tarihi akışı vardır. Yüksek güvence gereken kliniklerde OTP veya davet token'ı eklenmelidir.
8. Offline onam kaydı nitelikli elektronik imza değildir. Hukuken bağlayıcı akış için kimlik doğrulamalı web onamı, zaman damgası ve kurumun hukuk metinleri kullanılmalıdır.
9. LAN mesh operasyon günlüğü ve bulut mobil sync ayrı taşıma katmanlarıdır. Bir peer'dan alınan değişikliğin küresel cloud outbox'a otomatik yeniden yazılması için ileride origin-aware global entity kimliği/migration tasarımı gerekir; bugün kaynak cihazın sunucuya sync etmesi beklenir.
10. Tedavi planı taksitleri JSON plan olarak korunur; tüm ödeme kayıtlarını tek tek plan taksitlerine bağlayan ayrı muhasebe defteri/uzlaştırma modeli henüz yoktur.

## Dağıtım öncesi zorunlu kapılar

- Üretim secret'larını yalnız secret manager'da oluşturun; örnek `.env` değerlerini kullanmayın.
- PostgreSQL migration ve geri yükleme provasını staging'de yeniden çalıştırın.
- Harici sağlayıcı sözleşmelerini, webhook imzalarını, antivirüsü ve PITR remote'unu doğrulayın.
- Android kalıcı signing/AAB, iOS distribution, macOS Developer ID/notarization ve Windows Authenticode işlemlerini tamamlayın.
- Gerçek Android ve Windows cihazlarında kamera, bildirim, LAN discovery, uyku/uyanma ve upgrade testlerini tamamlayın.
- Klinik rolleri, KVKK aydınlatma/onam metinleri, veri saklama politikası ve çalışan eğitimini kurum özelinde onaylayın.

## İlgili kılavuzlar

- [Üretim dağıtımı](PRODUCTION.md)
- [Klinik kurulum kontrol listesi](CLINIC-INSTALL.md)
- [Android](../mobile/README.md)
- [Windows/macOS](../desktop/README.md)
