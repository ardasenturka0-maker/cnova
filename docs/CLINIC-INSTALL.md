# ClinicNova 1.15.7 — klinik kurulum kontrol listesi

## Gitmeden önce alınacak bilgiler

- Klinik adı, kısa klinik kodu, şube adı, şehir, adres ve telefon
- Klinik sahibinin adı ve yalnız ona ait e-posta adresi
- HTTPS alan adı (ör. `app.klinikadi.com`)
- Sunucu erişimi, PostgreSQL parolası ve uzak yedek hedefi
- Klinikte kurulacak Android cihazlar ve bilgisayarlardaki güncel tarayıcılar

## Sunucu kurulumu

1. Repodaki `.env.production.example` (teslim paketinde `env.production.example`) dosyasını `.env.production` olarak kopyalayın; hiçbir `REPLACE_` veya `example.com` değeri bırakmayın.
2. `npm run clinic:secrets` ile anahtarları üretin ve parola kasasına kaydedin. Çıktıyı mesaja veya Git deposuna koymayın.
3. PostgreSQL 16+, ClamAV, TLS sertifikası, ayrı hasta dosyası volume'u ve uzak immutable yedek hedefini hazırlayın.
4. `npm ci`, `npm run production:check`, `npm run prisma:deploy` ve `npm run build` çalıştırın.
5. Aşağıdaki değişkenlerle ilk kliniği yalnız bir kez oluşturun:

```bash
CLINIC_NAME="Klinik Adı" \
CLINIC_SLUG="klinik-kodu" \
BRANCH_NAME="Merkez" \
BRANCH_CITY="İstanbul" \
BRANCH_ADDRESS="Açık adres" \
BRANCH_PHONE="+90 ..." \
OWNER_NAME="Klinik Sahibi" \
OWNER_EMAIL="sahip@klinik.com" \
OWNER_PASSWORD="Güçlü ve benzersiz parola" \
npm run clinic:bootstrap
```

6. Uygulamayı servis olarak başlatın; `/api/health` ve `/api/ready` yanıtlarının başarılı olduğunu doğrulayın.
7. Günlük yedek, haftalık gerçek geri yükleme testi, çöp kutusu temizliği ve operasyon alarmı zamanlayıcılarını etkinleştirin.

## Klinik içindeki kurulum

1. Yönetici hesabıyla web uygulamasına giriş yapın ve hemen 2FA'yı etkinleştirin.
2. Ayarlar bölümünde klinik/şube bilgilerini doğrulayın; her çalışan için kişisel hesap ve doğru rol oluşturun. Ortak parola kullanmayın.
3. Bir test hastası, randevu, tedavi planı, peşinat ve hasta dosyası oluşturup webde tekrar açın.
4. `ClinicNova-1.15.7.apk` dosyasını Android cihazlara kurun. iOS paketini Xcode ile imzalayıp yükleyin; Windows'ta `.exe`, macOS'ta `.dmg` paketini açın. İlk açılışta yerel yönetici hesabını ve kurtarma kodunu oluşturun; ardından gerekirse HTTPS sunucuya bağlanıp test kaydının eşitlendiğini doğrulayın.
5. Dağıttığınız APK'nın SHA-256 değerini yayın dosyasından yeniden hesaplayın ve `MOBILE_APK_SHA256` ile birebir eşleştiğini doğrulayın; eski sürümlere ait sabit hash kullanmayın.
6. Bilgisayarlarda HTTPS adresini ana ekrana/masaüstüne ekleyin; kamera ve dosya yükleme izinlerini test edin.

## Canlı veri girmeden önce son kapı

- Health ve readiness başarılı
- Demo modu kapalı ve veritabanı boş/gerçek kliniğe ait
- Yönetici 2FA açık; çalışan rolleri en az yetkiyle tanımlı
- Hasta dosyası şifreleme ve ClamAV testi başarılı
- Uzak yedek alınmış ve geri yükleme testi geçmiş
- Android/web aynı sunucuya bağlı, örnek kayıt iki yönde doğrulanmış
- Klinik KVKK aydınlatma/açık rıza metinleri ve sağlayıcı sözleşmeleri hazır

Bu maddelerden biri başarısızsa gerçek hasta verisi girmeyin.
