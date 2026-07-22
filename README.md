# ClinicNova 1.15.6

ClinicNova; diş klinikleri için çok kiracılı hasta, randevu, tedavi, finans, iletişim ve stok yönetimi platformudur. Next.js 15, TypeScript, Prisma ve PostgreSQL üzerinde çalışır; web, Android, iOS, Windows ve macOS istemcileri aynı klinik verisini kullanır.

## Başlıca yetenekler

- Klinik ve şube bazlı kullanıcı/rol ayrımı, güvenli oturum ve audit log
- Hasta, randevu, tedavi, tahsilat, stok, personel, rapor ve hasta portalı
- Takip/recall, hasta iletişimi, dijital onam ve memnuniyet anketleri
- CSV/veri dışa aktarma, yazdırılabilir raporlar ve zaman damgalı elektronik onam
- İmzalı n8n çıkışı ile WhatsApp, SMS, e-posta, ödeme ve e-belge sağlayıcı adaptörleri
- Üretim hazırlık kontrolü, health/readiness uçları, migration, Docker ve GitHub Actions
- Ayrı üretim/demo mobil paketleri; üretim paketi yerel örnek hasta verisi içermez

Canlı sağlayıcı yapılandırılmamışsa dış işlem başarı gibi gösterilmez. İlgili kayıt `FAILED` veya `DRAFT` kalır ve kullanıcı açık hata görür.

## Yerel geliştirme

```bash
npm ci
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Demo bellek verisiyle çalışmak için yalnızca yerel/test ortamında `DEMO_MODE=true` kullanın. Demo kullanıcıları:

- `owner@clinicnova.test / password123`
- `doctor@clinicnova.test / password123`
- `receptionist@clinicnova.test / password123`

## Doğrulama

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm audit
```

## Üretim dağıtımı

`.env.production.example` dosyasını temel alın; örnek değerleri gerçek secret, PostgreSQL, HTTPS alan adı ve sağlayıcı adresleriyle değiştirin.

```bash
npm ci
npm run production:check
npm run prisma:deploy
npm run build
npm run start:production
```

- Canlılık: `GET /api/health`
- Trafik hazırlığı: `GET /api/ready`
- Üretim kılavuzu: [`docs/PRODUCTION.md`](docs/PRODUCTION.md)
- Android kılavuzu: [`mobile/README.md`](mobile/README.md)
- Windows/macOS kılavuzu: [`desktop/README.md`](desktop/README.md)
- Klinik kurulum kontrol listesi: [`docs/CLINIC-INSTALL.md`](docs/CLINIC-INSTALL.md)
- 1.15.6 platform denetim raporu: [`docs/PLATFORM-AUDIT-1.15.6.md`](docs/PLATFORM-AUDIT-1.15.6.md)
- Tek sunuculuk kurulum otomasyonu: [`ops/deploy/README.md`](ops/deploy/README.md)

## Android

Sabit canlı sunuculu kurumsal APK:

```bash
MOBILE_MODE=production MOBILE_SERVER_URL=https://app.example.com npm run android:build
npm run android:verify
```

Üretim APK’sı sunucu olmadan boş yerel klinik alanıyla çalışır. HTTPS ClinicNova adresi bağlanıp hesap girişi tamamlanınca bekleyen hasta, randevu ve tahsilat işlemleri idempotent biçimde sunucuya eşitlenir. Demo paketi yalnız test/gösterim için ayrı üretilir: `MOBILE_MODE=demo npm run android:build`.

## Ticari kullanım sınırı

Kaynak kodu gerçek işlem akışlarına ve üretim kontrollerine hazırdır. Gerçek mesajlaşma, ödeme, e-Fatura/e-Arşiv, nitelikli e-imza ve sağlık sistemi işlemlerinin aktif olması için işletme adına sağlayıcı sözleşmeleri, hukuki metinler ve üretim kimlik bilgileri gerekir. Secret değerleri depoya yazılmaz.
