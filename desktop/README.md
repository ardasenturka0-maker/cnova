# ClinicNova Desktop

Windows ve macOS istemcileri aynı `mobile/assets` arayüzünden paketlenir. Böylece kaydol/giriş yap, yerel hasta ve randevu kayıtları, tedavi/finans/stok akışları, randevu bildirimleri, HTTPS sunucu eşitlemesi, internet fiyatı araması ve şifreli yerel mesh davranışı iki işletim sisteminde de aynı kalır. `npm run desktop:prepare`, her paketlemede canonical mobil varlıkları yeniden kopyalar.

İlk açılışta internet gerektirmeyen bir yerel yönetici hesabı ve tek kullanımlık kurtarma kodu oluşturulur. Parolanın kendisi tutulmaz; PBKDF2-SHA-256 özeti saklanır. Beş hatalı deneme hesabı geçici kilitler. Yerel girişten sonra sunucu bağlantısı ayrıca kurulabilir.

## Derleme

Node.js 22 veya üzeri ve kök bağımlılıkların kurulmuş olması gerekir.

- Windows x64: `npm run desktop:win` → `releases/desktop` altında NSIS `.exe`
- macOS Intel + Apple Silicon: `npm run desktop:mac` → `releases/desktop` altında universal `.dmg`
- Yerel web penceresi (Windows/macOS): `npm run webview`

Staging paketi yalnız gerekli uygulama dosyalarını ve `bonjour-service` çalışma zamanı bağımlılık ağacını içerir. Electron fuses; `ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS` ve CLI inspector girişlerini kapatır, yalnız bütünlüğü doğrulanmış ASAR'ı yükler ve oturum çerezlerini işletim sistemi anahtarıyla şifreler.

## Veri ve güvenlik modeli

Kayıtlar uygulamanın özel profilinde Electron `safeStorage` ile şifrelenir: Windows'ta DPAPI, macOS'ta Keychain kullanılır. Anahtarlık kullanılamıyorsa yazma başarılı gösterilmez. Renderer; Node.js erişimi kapalı, context isolation ve sandbox açık çalışır. Yalnız ana frame'deki `clinicnova://app` içeriği sınırlı yerel köprüye erişebilir; uzak HTTPS giriş/panel sayfaları bu köprüyü alamaz.

Paketli sürümde DevTools ve uzaktan hata ayıklama girişleri kapalıdır; geliştirme modunda DevTools kullanılabilir. Hassas uzak sayfalar Chromium disk HTTP önbelleğine yazılmaz, ancak oturum çerezleri girişin korunabilmesi için işletim sistemi anahtarıyla şifreli biçimde saklanır.

Senkronizasyon ve ürün arama istekleri yalnız kullanıcının şifreli depoya kaydettiği HTTPS sunucu origin'ine gönderilir. Yönlendirmeler otomatik izlenmez; böylece POST gövdesindeki klinik verisi farklı bir domaine taşınamaz. Portal yolu `/dashboard` ağacıyla sınırlıdır. Harici HTTPS bağlantıları sistem tarayıcısında açılır.

Uygulama tek instance çalışır. Windows'ta son pencere kapandığında süreç ve mesh kapanır. macOS'ta standart uygulama davranışı gereği pencere kapanınca süreç Dock'ta açık kalır; `ClinicNova → Quit` mesh soketlerini de kapatır. İkinci başlatma mevcut pencereyi öne getirir.

## Dağıtım

Gerçek klinik dağıtımında Windows code-signing sertifikası ile Apple Developer ID imzası/notarization zorunlu operasyonel gereksinimdir. Yapılandırma, uygun ortam değişkenleri sağlandığında electron-builder'ın imza ve notarization akışını kullanır. İmzasız paketler yalnız kontrollü geliştirme testi içindir.
