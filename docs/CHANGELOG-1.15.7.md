# ClinicNova 1.15.7

Bu sürüm klinik günlük akışını, tedavi takibini ve geri dönüşüm davranışını sadeleştirir.

## Arayüz

- Native hasta, randevu, finans, stok, onam ve diğer silinebilir kayıtlardaki görünür sil düğmeleri kaldırıldı. Kayıt sola kaydırılıp bırakıldığında silme/çöpe taşıma işlemi başlar; klavye kullananlar aynı satırda `Delete` tuşunu kullanabilir.
- Ana sayfadaki bugünkü randevu, aylık tahsilat, aktif hasta ve bekleyen ödeme kartları ayrıntılı özet açar.
- Klinik durumuna göre her gün yeniden oluşturulan yapılacaklar listesi eklendi. `Yapıldı` seçilen görev o günün listesinden kaybolur.
- Peşinat, kalan bakiye, taksit tutarı, ödeme durumu ve tarihleri ayrı gösteren tahsilat planı arayüzü eklendi.
- Anketler ve Recall bölümleri ile Diğer menüsündeki İletişim ve Tam web paneli kısayolları kaldırıldı. Eski kayıtların veri uyumluluğu korunur.

## Tedavi ve raporlar

- Tedaviyi aşamalar arasında ilerletme, ilerleme notu ekleme ve açık bir `Tedaviyi bitir` akışı eklendi.
- Bitirilen tedaviler hasta profilindeki geçmiş tedavilere ve kişi bazlı raporlara otomatik, mükerrersiz olarak düşer.
- Tedavi tamamlamaya bağlı stok sarfı ve durum geri alma işlemleri tek transaction içinde, idempotent çalışır.

## Stok ve çöp kutusu

- Stok silme 30 günlük soft-delete akışına taşındı.
- Silinen stoklar ilişkili hareket, reçete ve teklifleriyle çöp kutusunda görünür; aynı kayıt geri yüklenebilir.
- Süresi dolan stok kayıtları audit kaydıyla kalıcı temizlenir.

## Veri tabanı

Dağıtımdan önce `20260722120000_stock_trash_and_daily_tasks` migration'ı uygulanmalıdır. Migration, stok çöp metadata alanlarını ve günlük otomatik görevleri benzersizleştiren `Task.sourceKey` alanını ekler.
