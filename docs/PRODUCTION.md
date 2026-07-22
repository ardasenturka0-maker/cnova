# ClinicNova production runbook

## Seçilen düşük maliyetli altyapı

- Tek Radore sanal sunucuda uygulama + PostgreSQL 16 (ilk aşama)
- Ayrı disk/volume üzerinde şifreli hasta dosyaları ve PostgreSQL WAL arşivi
- Sunucudan bağımsız, immutable/retention kilitli uzak yedek hedefi
- TLS sonlandıran gerçek alan adı
- En az iki uygulama örneği kullanılıyorsa paylaşımlı rate-limit deposu/WAF
- n8n veya eşdeğer otomasyon katmanı; WhatsApp, SMS, e-posta, e-Fatura ve ödeme sağlayıcı hesapları
- Merkezi log, hata izleme, uptime alarmı ve gizli anahtar kasası

Bu seçim “yönetilen PostgreSQL zorunlu” ifadesinin yerini alır. Aynı sunucudaki PostgreSQL daha ucuzdur fakat tek hata alanı oluşturur; bu nedenle uzak kopya ve haftalık geri yükleme testi canlıya geçiş kapısıdır. Yönetilen PostgreSQL daha sonra kesintisizlik ihtiyacı arttığında tercih edilebilir.

## Hasta dosyaları

Yeni yüklemeler MIME başlığıyla doğrulanır, zorunlu ClamAV taramasından geçirilir, görseller en fazla 2560 px olacak şekilde küçültülür ve metadata temizlenir. Gövdeler `FILE_STORAGE_ROOT` altında AES-256-GCM ile şifrelenir; PostgreSQL yalnız `storageKey`, tür, boyut ve SHA-256 bütünlük değerini tutar.

Geçiş sırası:

```bash
npm run prisma:deploy
npm run files:migrate
```

İkinci komut eski `BYTEA` gövdelerini şifreli dosya alanına taşır ve başarılı her kayıt için veritabanındaki gövdeyi temizler. Taşıma bitmeden eski volume kaldırılmamalıdır.

## 30 günlük çöp kutusu

Hasta ve hasta dosyası silme işlemleri fiziksel silme yapmaz; `deletedAt`, `purgeAt` ve silen kullanıcı yazılır. Geri yükleme de kullanıcı/zaman ve `AuditLog` kaydı üretir. Her gece şu korumalı endpoint çalıştırılmalıdır:

```bash
curl --fail -H "Authorization: Bearer $CRON_SECRET" https://app.example.com/api/cron/purge-trash
```

Süresi dolan dosyalar şifreli alandan, hastalar ise ilişkili kayıtlarıyla PostgreSQL'den kalıcı olarak kaldırılır.

## WAL/PITR, günlük yedek ve geri yükleme testi

- `ops/postgres/postgresql-pitr.conf` WAL arşivini etkinleştirir.
- `ops/postgres/backup.sh` günlük fiziksel tam yedek + mantıksal dump alır, SHA-256 manifesti üretir ve `rclone` ile ayrı lokasyona kopyalar.
- `ops/postgres/restore-test.sh` izole socket/port üzerinde gerçek PostgreSQL başlatıp migration tablosunu sorgular.
- `ops/postgres/clinicnova-backup.cron` günlük yedek ve haftalık restore testi örneğidir.

Uzak sağlayıcıda versioning/immutability ve en az 30 günlük retention ayrıca açılmalıdır. Aynı sunucudaki ikinci klasör “ayrı lokasyon” sayılmaz.
Restore işi gerçek veritabanı adını `RESTORE_TEST_DATABASE` ile alır ve PostgreSQL'i başlatmadan önce `SHA256SUMS` manifestinin tamamını doğrular.

`.env.production.example` dosyasını kopyalayın; örnek değer bırakmayın. Dağıtımdan önce:

```bash
npm ci
npm run production:check
npm run prisma:deploy
npm run build
npm run start:production
```

`GET /api/health` uygulama/veritabanı sağlığını, `GET /api/ready` ise yapılandırma hazırlığını döndürür. Trafik yalnızca ikisi de başarılı olduğunda yönlendirilmelidir.

## Personel 2FA

`MFA_ENCRYPTION_KEY`, dosya anahtarından ayrı üretilmiş 32 baytlık base64 anahtar olmalıdır. Personel Ayarlar ekranından Authenticator QR kodunu tarar, ilk TOTP koduyla kurulumu tamamlar ve yalnızca bir kez gösterilen kurtarma kodlarını parola kasasına kaydeder. Etkin hesaplarda parola tek başına oturum açamaz; TOTP kodları yeniden kullanılamaz ve kurtarma kodları tüketildiğinde veritabanından atomik olarak kaldırılır.

## Şifreleme anahtarı rotasyonu

Yeni dosyalar anahtar kimliği taşıyan `CNV2` biçimindedir. Rotasyonda eski ve yeni anahtarı aynı halkaya koyun, aktif kimliği yeni anahtara alın ve dosyaları yeniden şifreleyin:

```bash
export FILE_ENCRYPTION_KEYS='{"2026-01":"OLD_BASE64","2026-07":"NEW_BASE64"}'
export FILE_ENCRYPTION_ACTIVE_KEY_ID='2026-07'
npm run files:rotate-key
```

Rotasyon ve örnek dosya okuma doğrulaması bitmeden eski anahtarı kasadan kaldırmayın. `FILE_ENCRYPTION_KEY` yalnız `CNV1` kayıtlarını okuyabilmek için geçiş süresince tutulur.

MFA sırları da anahtar kimlikli `MFA2` biçimindedir. `MFA_ENCRYPTION_KEYS` halkasına eski+yeni anahtarı koyup `MFA_ENCRYPTION_ACTIVE_KEY_ID` değerini yeni kimliğe alın; ardından `npm run mfa:rotate-key` çalıştırın. Kullanıcıların 2FA girişini doğrulamadan eski anahtarı kaldırmayın. `AUTH_SECRET` değişimi tüm mevcut oturumları ve kurtarma kodu hashlerini geçersiz kılacağından planlı yeniden giriş penceresinde yapılmalıdır.

## Audit bütünlüğü ve operasyon alarmları

Audit kayıtları PostgreSQL trigger'ı ile tenant bazında SHA-256 zincirine eklenir ve update/delete işlemleri veritabanı düzeyinde reddedilir. `ops/audit/export-anchor.sh` zincir başlarını HMAC ile imzalayıp hasta verisi içermeden uzak immutable hedefe gönderir. `ops/clinicnova-operations.cron` günlük sabitleme örneğini içerir.

`npm run ops:check`; health/readiness, son yedek yaşı ve dosya diski doluluğunu denetler. Sorunda yalnız teknik kontrol sonuçlarını `OPS_ALERT_WEBHOOK_URL` adresine imzalı olarak yollar; hasta verisi göndermez. Aynı arıza `OPS_ALERT_COOLDOWN_MINUTES` süresince tekrar tekrar bildirilmez; durum düzelince tek bir recovery bildirimi gönderilir. `OPS_ALERT_STATE_FILE` kalıcı ve yalnız servis kullanıcısına açık bir dizinde olmalıdır.

## Staging ve yük/felaket provası

Gerçek üretim adresinde yanlışlıkla yük testi çalışmaması için betik varsayılan olarak yalnız staging/localhost adreslerini kabul eder:

```bash
LOAD_TEST_URL=https://staging.example.com npm run test:load
STAGING_APP_URL=https://staging.example.com bash ops/staging/disaster-drill.sh
```

Felaket provası health/readiness kontrolünü, gerçek PostgreSQL geri yükleme testini ve eşzamanlı yük eşiğini birlikte doğrular.

## Docker

Uygulama ve migration imajlarını ayrı üretin:

```bash
docker build --target migrator -t clinicnova-migrator:1.15.6 .
docker build --target file-migrator -t clinicnova-file-migrator:1.15.6 .
docker build --target runner -t clinicnova:1.15.6 .
docker run --rm --env-file .env.production clinicnova-migrator:1.15.6
docker run --rm --env-file .env.production -v clinicnova-files:/var/lib/clinicnova/patient-files clinicnova-file-migrator:1.15.6
docker run --env-file .env.production -v clinicnova-files:/var/lib/clinicnova/patient-files -p 3000:3000 clinicnova:1.15.6
```

Migration işi başarıyla tamamlanmadan yeni uygulama imajına trafik vermeyin.
ClamAV imzaları host veya ayrı bakım container'ı tarafından `freshclam` ile düzenli güncellenmelidir; eski imza veritabanıyla canlı trafik açılmamalıdır.

## Entegrasyon sözleşmesi

ClinicNova tüm dış olayları `N8N_OUTBOUND_WEBHOOK_URL` adresine POST eder. İstek başlıkları:

- `X-ClinicNova-Event`: olay adı
- `X-ClinicNova-Timestamp`: milisaniye Unix zamanı
- `X-ClinicNova-Signature`: `sha256=<hex>`

İmza girdisi `<timestamp>.<raw-body>` ve anahtar `N8N_OUTBOUND_SECRET` değeridir. n8n isteği işlemeden önce imzayı ve en fazla beş dakikalık zaman farkını doğrulamalıdır.

Gelen tenant webhook'ları `Authorization: Bearer <N8N_WEBHOOK_SECRET>` ve `X-ClinicNova-Organization: <tenant-slug>` başlıklarını taşır.

### İnternet ürün fiyatı sağlayıcısı

Web ve Android stok ekranında dişçi, mağazadaki satın alma sayfasını girer. ClinicNova'nın yerleşik fiyat okuyucusu `/api/integrations/product-page-price` yolundadır. Üretimde `PRODUCT_SEARCH_API_URL=/api/integrations/product-page-price` ve en az 24 karakterlik rastgele `PRODUCT_SEARCH_API_KEY` tanımlanır; göreli yol `NEXT_PUBLIC_APP_URL` ile aynı ClinicNova sunucusuna bağlanır. ClinicNova bu adrese `Authorization: Bearer <PRODUCT_SEARCH_API_KEY>` başlığıyla HTTPS GET isteği gönderir; girilen sayfa `url` parametresidir. API JSON-LD veya ürün fiyatı meta etiketini okuyup aşağıdaki sözleşmede teklif döndürür. Yerel/özel ağ adresleri, HTTP, standart dışı portlar, aşırı yönlendirme ve büyük/HTML olmayan yanıtlar reddedilir. “Satın al” düğmesi dişçinin girdiği sayfaya bağlanır:

```json
{"offers":[{"seller":"Dental Market","unitPrice":100,"shippingPrice":10,"productUrl":"https://shop.example/product","inStock":true}]}
```

Yalnız HTTPS bağlantılar, pozitif ürün fiyatları ve satıştaki teklifler kabul edilir; sonuçlar kargo dahil toplam tutara göre sıralanır. Android çağrıları oturum ve stok yetkisi gerektirir ve kullanıcı başına saatte 20 aramayla sınırlıdır.

## Mobil üretim paketi

Gerçek APK demo verisi içermez; ilk açılışta HTTPS ClinicNova adresi ister. Sabit sunucu adresiyle kurumsal paket:

`/api/mobile/version`, Android WebView kullanıcı aracındaki sürümü karşılaştırmak için minimum/güncel sürüm, HTTPS APK adresi ve SHA-256 yayınlar. Android işletim sistemi mevcut uygulamanın yalnız aynı imzalama anahtarıyla üretilmiş APK ile yükseltilmesine izin verir. Her sürümde `MOBILE_APK_URL`, `MOBILE_APK_SHA256` ve gerekiyorsa `MOBILE_MIN_VERSION` güncellenmelidir.

```bash
MOBILE_MODE=production MOBILE_SERVER_URL=https://app.example.com npm run android:build
```

Demo APK yalnızca satış gösterimi/test içindir:

```bash
MOBILE_MODE=demo npm run android:build
```

## Operasyon kontrolleri

- Her gün: `/api/health`, `/api/ready`, başarısız `IntegrationLog` ve yedek durumu
- Her hafta: örnek geri yükleme, kullanıcı/rol denetimi, geciken veri silme talepleri
- Her sürüm: `npm run check`, `npm run test:e2e`, dependency audit, APK imza ve SHA-256 doğrulaması
- Her anahtar değişiminde: eski anahtarı iptal et, gizli anahtar kasasını güncelle, servisleri kontrollü yeniden başlat

## Ticari canlıya geçişte dış bağımlılıklar

Kod tarafı sağlayıcı hatalarında başarısızlığı saklamaz. Ancak gerçek mesaj, ödeme ve e-Fatura işlemleri için klinik adına açılmış sağlayıcı sözleşmeleri ve üretim kimlik bilgileri gereklidir; bunlar kaynak kod deposuna yazılmaz.

## Radore satın alma kapısı

Sipariş vermeden teklif/panel üzerinde şu maddeler yazılı doğrulanmalıdır: 2 vCPU, 4 GB RAM, en az 100 GB SSD/NVMe, Türkiye veri merkezi, ek disk/volume imkânı, trafik ve statik IP, DDoS kapsamı, snapshot ücret ve saklama süresi, KVKK kapsamında sağlık verisi için sözleşme/DPA, veri silme ve olay bildirimi şartları. Sağlayıcı snapshot'ı uygulamanın uzak PostgreSQL/dosya yedeğinin yerine geçmez. Bu değerler doğrulanmadan fiyat veya paket için kesin satın alma onayı verilmemelidir.
