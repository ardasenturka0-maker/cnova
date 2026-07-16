# ClinicNova Android

ClinicNova Android, API 24 ve üzeri cihazlarda çalışan imzalı, yerel öncelikli bir WebView uygulamasıdır. Üretim paketi boş klinik verisiyle başlar; hasta, randevu ve tahsilat kayıtlarını bağlantı olmasa da cihazın uygulama alanında saklar.

HTTPS ClinicNova sunucusu bağlanıp klinik hesabıyla giriş yapıldığında bekleyen yerel işlemler sunucuya otomatik gönderilir. İşlem kimlikleri sunucuda kalıcı tutulduğu için bağlantı kesilip tekrar denendiğinde çift kayıt oluşmaz. Demo modu yalnızca otomatik test ve ayrı satış gösterimi içindir.

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

Sunucu adresi verilmezse üretim APK'sı doğrudan yerel çalışma seçeneği sunar; adres daha sonra ayarlardan bağlanabilir. Demo paketi yalnızca test/gösterim için `MOBILE_MODE=demo npm run android:build` ile ayrı üretilir.

Çıktı: `releases/ClinicNova-1.7.0.apk`

İlk üretim açılışında klinik/yönetici bilgileriyle çevrimdışı hesap oluşturulur. Parola yerine PBKDF2-SHA-256 özeti tutulur, kurtarma kodu yalnız bir kez gösterilir ve uygulama yeniden açıldığında yerel giriş istenir. İnternetli kullanım için yerel girişten sonra HTTPS ClinicNova sunucusu bağlanır.
