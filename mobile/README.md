# ClinicNova Android

ClinicNova Android, API 24 ve üzeri cihazlarda çalışan imzalı bir WebView uygulamasıdır. Üretim paketi gerçek hasta verisini APK içindeki yerel demo alana yazmaz; ilk açılışta veya derleme sırasında tanımlanan HTTPS ClinicNova sunucusunu açar.

Demo modu yalnızca satış gösterimi ve otomatik test içindir. Demo hasta, randevu ve tahsilat kayıtları cihazdaki WebView depolamasında tutulur ve gerçek hasta verisiyle kullanılmamalıdır.

## Derleme

Gereksinimler:

- Java 21+
- Android API 34 `android.jar`
- ARM64 uyumlu `aapt2`, `zipalign` ve `apksigner`
- Google Maven üzerinden R8/D8 9.1.31

İmzalama ayarları `.android-signing/keystore.properties` içinde tutulur ve Git'e dahil edilmez.

```bash
MOBILE_MODE=production MOBILE_SERVER_URL=https://app.example.com npm run android:build
npm run android:verify
```

Sunucu adresi verilmezse üretim APK'sı ilk açılışta kullanıcıdan HTTPS adresini ister. Demo paketi için `MOBILE_MODE=demo npm run android:build` kullanılır.

Çıktı: `releases/ClinicNova-1.1.2.apk`
