# ClinicNova Android

ClinicNova Android 1.0.1, API 24 ve üzeri cihazlarda çalışan imzalı bir WebView uygulamasıdır. APK içinde ağ bağlantısı olmadan açılan mobil bir ClinicNova arayüzü bulunur. Demo hasta, randevu ve tahsilat kayıtları yalnızca cihazdaki WebView depolamasında tutulur.

`Diğer > Canlı sisteme bağlan` ekranına HTTPS üretim adresi girildiğinde uygulama yayınlanmış ClinicNova web paneline geçebilir. Gerçek hasta verisi için sunucu, PostgreSQL, güçlü `AUTH_SECRET`, TLS, yedekleme ve klinik KVKK/GDPR süreçleri ayrıca yapılandırılmalıdır.

## Derleme

Gereksinimler:

- Java 21+
- Android API 34 `android.jar`
- ARM64 uyumlu `aapt2`, `zipalign` ve `apksigner`
- Google Maven üzerinden R8/D8 9.1.31

İmzalama ayarları `.android-signing/keystore.properties` içinde tutulur ve Git'e dahil edilmez.

```bash
npm run android:build
npm run android:verify
```

Çıktı: `releases/ClinicNova-1.0.1.apk`
