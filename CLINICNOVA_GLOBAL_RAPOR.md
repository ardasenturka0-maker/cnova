# ClinicNova Global Strateji ve Rakip Analizi

Tarih: 2026-07-09  
Kapsam: ClinicNova MVP, Mikrodent, DoktorTakvimi/DocPlanner, global dental PMS ve dental AI rakipleri.

## 1. Kisa Sonuc

ClinicNova'nin dogrudan rakibi tek basina Mikrodent ya da DoktorTakvimi degil. Mikrodent bir klinik/marka deneyimi, DoktorTakvimi bir hasta edinim ve randevu pazaryeri, CareStack/Dentrix/Dentally gibi urunler ise agir klinik operasyon yazilimlari. ClinicNova'nin firsati bunlari kopyalamak degil; dis klinikleri icin hasta ediniminden tedavi teklifine, odemeden tedavi sonrasi yoruma kadar tum geliri yoneten "Dental Growth OS" olmak.

Onerilen ana konumlandirma:

> ClinicNova, yuksek tutarli dis tedavileri ve saglik turizmi yapan klinikler icin lead, teklif, tedavi, finans, stok, hasta deneyimi ve yorum surecini tek panelde yoneten global dental buyume platformudur.

## 2. Mevcut Proje Durumu

Repo incelemesine gore ClinicNova zaten klasik randevu yaziliminin otesine gecmis durumda:

- Multi-tenant mimari: Organization, Branch, User, rol bazli erisim ve audit log.
- Klinik operasyonlari: hasta, randevu, tedavi, tedavi plani, odeme, fatura, stok, personel, onam, anket, recall ve raporlar.
- Hasta portali: randevu, tedavi ve odeme yuzeyleri.
- Entegrasyon hazirligi: SMS, WhatsApp, e-posta, sanal POS, e-fatura, e-recete, saglik sistemi adapterlari.
- Saglik turizmi modulu: lead havuzu, lead skoru, paket olusturma, otel/transfer partnerleri, n8n/Airtable mock entegrasyonlari, takip akislari, post-treatment, review, survey, before/after galeri ve chatbot.

Bu temel, ClinicNova'yi "sadece klinik yonetimi" yerine "klinik gelir ve hasta yolculugu yonetimi" tarafina tasimak icin iyi bir zemin.

## 3. Rakip Analizi

### Mikrodent

Konum: Premium dis klinigi/markasi. Resmi sitesi yazilim degil, klinik deneyimi sunuyor.

Guclu noktalar:

- Premium ve modern marka algisi.
- Kisisellestirilmis tedavi yolculugu vurgusu.
- Dijital planlama, mikroskop destekli hassasiyet, Invisalign, estetik/fonksiyon dengesi gibi guven veren tedavi basliklari.
- Online randevu formu, WhatsApp/hizli arama, KVKK ve aydinlatma metni gibi temel guven unsurlari.
- "Bekleme suresi yok, kisisellestirilmis hizmet" gibi hasta deneyimi odakli net mesajlar.

Zayif noktalar:

- Operasyonel surec hasta tarafinda gorunur degil: tedavi plani, teklif, onam, odeme, takip ve garanti pasaportu gibi dijital deneyim yok.
- Saglik turizmi icin otel, transfer, cok dilli teklif, ulke bazli takip ve yorum akisi gorunmuyor.
- Klinik markasi guclu olsa da bu deneyimi olcecek veya tekrar edilebilir hale getirecek SaaS katmani yok.

ClinicNova icin ders:

- Kliniklere "Mikrodent gibi premium deneyim sunmanin yazilim altyapisi" satilabilir.
- Dijital vaka odasi, tedavi yolculugu, premium teklif sayfasi ve hasta pasaportu bu boslugu doldurur.

### DoktorTakvimi / DocPlanner

Konum: Hasta edinimi, online randevu, profil, yorum ve profesyonel gorunurluk platformu.

Guclu noktalar:

- Ana sayfada 181.000+ doktor/uzman vurgusu.
- Hasta tarafinda doktor bulma, yorum okuma, soru sorma, online/yuz yuze randevu alma.
- Hekim/uzman tarafinda profil, 7/24 online randevu, randevu hatirlaticilari, bekleme listesi, raporlama merkezi, cagri merkezi destegi, online gorusme, chat ve Noa Notes AI.
- DocPlanner agi ile 13 ulke vurgusu: Turkiye, Polonya, Ispanya, Italya, Almanya, Cek Cumhuriyeti, Portekiz, Meksika, Kolombiya, Brezilya, Arjantin, Peru, Sili.
- Pazaryeri gucu ve SEO/guven etkisi cok yuksek.

Zayif noktalar:

- Klinik kendi talep kanalini tamamen sahiplenemez; platforma bagimlilik olusur.
- Dis hekimligine ozel tedavi paketi, implant/protez/laboratuvar, stok, finans, onam ve dental turizm surecleri ana urun degil.
- Hasta edinimi kuvvetli ama tekliften tedavi kapanisina kadar "gelir operasyonu" eksik.
- Tum saglik branslarina yayildigi icin dis kliniginin gunluk is akisi yeterince derinlesmez.

ClinicNova icin ders:

- DoktorTakvimi ile rekabet etmek yerine ondan gelen lead/randevu verisini ClinicNova'ya akitmak mantikli.
- ClinicNova, "pazaryerinden gelen hastayi kaybetmeden tedaviye ve odemeye donusturen sistem" diye konumlanabilir.

### CareStack

Konum: ABD/UK odakli all-in-one cloud dental practice management software.

Guclu noktalar:

- Cloud, SaaS, web tabanli dental PMS.
- Zengin feature set: randevu, charting, klinik notlar, imaging, sigorta, online formlar, online odemeler, patient portal, pay-by-text, payment plans, reputation, RCM, teledentistry, analytics.
- DSO ve multi-location segmentine uygun.
- AI/growth eklentileri: VoiceStack, Aeka, CareRevenue, CS Membership, VirtualAssistant gibi buyume ve operasyon urunleri.

Zayif noktalar:

- ABD/UK sigorta ve RCM mantigina yogun; Turkiye, MENA, AB lokal mevzuat ve dental turizm ihtiyacina dogrudan uymayabilir.
- Gucunun bedeli komplekslik olabilir.
- Tedavi + otel + transfer + cok dilli satis paketi ClinicNova kadar merkezi bir odak degil.

### Dentrix Ascend

Konum: Henry Schein One tarafindan sunulan cloud dental PMS.

Guclu noktalar:

- Guclu kurumsal marka ve dental ekosistem.
- Scheduling, billing, imaging, patient communication ve analytics'i tek platformda topluyor.
- Charting, cloud imaging, embedded AI, hands-free documentation ve x-ray kalite kontrolu vurgusu.
- Insurance, billing, collections, online scheduling, automated reminders, reputation tools, multi-location dashboard ve Ascend API Exchange.

Zayif noktalar:

- ABD tipi sigorta, claims ve kurumsal dental altyapiya gore tasarlanmis.
- Lokal pazarlara giriste mevzuat, dil, odeme ve devlet entegrasyonlari yuksek maliyetli.
- Dental turizm, WhatsApp lead satisi, uluslararasi hasta paketi ve post-travel care ana farklilastirma degil.

### Dentally

Konum: UK merkezli cloud dental software.

Guclu noktalar:

- Cloud dental practice management, clinical, practice admin ve patient experience modulleri.
- Dentally Portal ile booking, forms ve payments.
- Appointment reminders, online booking, feedback, recalls, patient education, multi-site ve NHS/HSC entegrasyonlari.
- Modern, kullanici dostu ve support/community vurgusu guclu.

Zayif noktalar:

- UK/NHS/HSC merkezli.
- Saglik turizmi, cok ulkeli lead satisi, otel/transfer/tedavi paketi ve yerel e-fatura/e-recete gibi ihtiyaclar ana odak degil.

### Open Dental

Konum: Uygun fiyatli, esnek, genis ozellikli dental PMS.

Guclu noktalar:

- Kapsamli ve ozellestirilebilir dental PMS.
- Uygun fiyat algisi.
- 200+ dental PMS'den conversion vurgusu.
- eServices ve aktif surum guncellemeleri.

Zayif noktalar:

- Modern cloud/patient experience algisi CareStack/Dentally kadar guclu degil.
- Daha teknik ve geleneksel duruyor.
- Growth, AI, dental turizm, premium hasta yolculugu gibi yeni beklentilerde bosluk var.

### Pearl

Konum: Dental AI, radyografi ve klinik/pratik zeka.

Guclu noktalar:

- FDA-cleared dental AI iddiasi.
- Radyografilerde hastalik tespiti, practice intelligence, RCM, Second Opinion ve DSO/university odagi.
- 29.000+ dental practice iddiasi.

Zayif noktalar:

- Tam klinik operasyon sistemi degil; imaging ve AI katmanina odakli.
- Regule medikal cihaz iddialari nedeniyle pazara giris ve sorumluluk yuku agir.

### DentalMonitoring

Konum: AI destekli ortodontik uzaktan takip.

Guclu noktalar:

- Uzaktan ortodontik tedavi izleme.
- FDA De Novo approved ve MDR certified iddiasi.
- Evden tarama, treatment monitoring, DM Engage, DM Insights ve SmartSTL.
- HIPAA/GDPR ve medikal cihaz mesajlari guclu.

Zayif noktalar:

- Daha cok ortodonti ve monitoring odakli.
- Klinik PMS, finans, stok, turizm, satis teklifi ve genel dental operasyon sistemi degil.

## 4. Pazardaki Bosluklar

1. Hasta edinimi ile klinik operasyonu kopuk. Pazaryerinden gelen hasta WhatsApp, Excel, manuel fiyat teklifi ve resepsiyon takibi arasinda kayboluyor.
2. Tedavi teklifleri profesyonel degil. Implant, veneer, ortodonti gibi yuksek tutarli islemlerde klinikler fiyat, sure, garanti, onam, otel/transfer ve odeme planini tek guvenli sayfada sunamiyor.
3. Dental turizm hala daginik. Lead, dil, ulke, vize, otel, transfer, tedavi takvimi, post-care ve review sureci tek sistemde degil.
4. AI urunleri cogunlukla klinik goruntu veya not tarafinda. Dis hekiminin gelir, takip, vaka kabul ve operasyon riskini yoneten AI boslugu var.
5. Stok ve tedavi takvimi baglantisi zayif. Planlanan tedavilere gore implant, sarf malzeme, lab ve doktor koltuk ihtiyaci onceden hesaplanmiyor.
6. Hasta guveni dijital olarak kapatilmiyor. Onam, once/sonra izinleri, garanti sertifikasi, tedavi sonrasi talimatlar ve global takip pasaportu daginik.

## 5. Onerilen Farkli Fikirler

### 5.1 SmileQuote AI

Hasta web/WhatsApp uzerinden fotograf, sikayet, ulke, butce ve seyahat tarihini girer. Sistem tani koymadan, "hekim onayli on teklif" akisi olusturur: olasi tedavi kategorisi, tahmini sure, fiyat araligi, uygun doktor, otel/transfer opsiyonu ve eksik bilgi listesi.

Dis hekime faydasi: Satis temsilcisi tek tek fiyat yazmaz; hekim onayli, duzenli, cok dilli teklif cikar.

### 5.2 Chairside Case Acceptance Room

Muayene sonrasi hasta icin tek ekranda tedavi plani, dis/bolge semasi, once/sonra benzer vaka, fiyat, taksit, garanti, onam ve ilk randevu secimi gosterilir.

Dis hekime faydasi: Hasta "dusuneyim" deyip kaybolmadan tedavi kabul oranini artirir.

### 5.3 Dental Tourism Mission Control

Uluslararasi lead'ler icin ulke/dil/tedavi/butce skoru, WhatsApp takip senaryolari, paket sayfasi, otel/transfer partner havuzu, ucus/takvim, tedavi sonrasi care plan ve review istegi tek akista calisir.

Dis hekime faydasi: Turizm hastasi resepsiyonun hafizasina bagli kalmaz; her adim takip edilir.

### 5.4 Missed Revenue Radar

Sistem kayip geliri yakalar: cevaplanmamis lead, gonderilmemis teklif, acilmamis paket, odemesi geciken hasta, iptal riski, no-show riski, stok eksigi yuzunden ertelenebilecek tedavi.

Dis hekime faydasi: "Bugun para kaybettiren 10 sey" tek ekranda gorulur.

### 5.5 Implant ve Lab Tracker

Implant/protez/vener gibi islemler icin lab siparisi, renk, STL/dosya, teslim tarihi, doktor koltuk planlamasi, hasta randevusu ve stok malzemesi baglanir.

Dis hekime faydasi: Laboratuvar gecikmesi ve eksik materyal yuzunden koltuk bos kalmaz.

### 5.6 Recall ve Warranty Passport

Hastaya dijital garanti/tedavi pasaportu verilir: implant seri bilgisi, materyal, hekim, tarih, bakim talimatlari, kontrol randevulari, ulkesine donunce post-care check-in.

Dis hekime faydasi: Hem guven artar hem tekrar randevu ve review ihtimali yukselir.

### 5.7 Review & Proof Engine

Memnuniyet skoru yuksek hastadan otomatik Google/Trustpilot yorumu istenir; dusuk skorda once klinik ici telafi gorevi acilir. Before/after yayin onami varsa vaka galeriye hazirlanir.

Dis hekime faydasi: Kotu yorum krize donmeden yakalanir, iyi vaka pazarlama varligina donusur.

### 5.8 Smart Stock by Calendar

Gelecek 14-30 gundeki tedavilere gore sarf, implant, anestezi, sutur, olcu materyali ve lab ihtiyaci hesaplanir.

Dis hekime faydasi: Stok modulu sadece sayim degil, gelir koruma aracina donusur.

### 5.9 Dentist Copilot

Tani koymayan, klinik karar yerine gecmeyen operasyon asistanidir: hasta ozeti, gecmis tedaviler, bekleyen odeme, onam metni, hasta diliyle tedavi aciklamasi, takip mesaji, teklif metni ve gunluk oncelik listesi uretir.

Dis hekime faydasi: Hekim evrak ve tekrar eden aciklama isinden kurtulur.

## 6. Global Buyume Stratejisi

### Faz 1: 0-60 Gun

Odak: "Lead'den paket kabulune kadar kayipsiz akis".

- Saglik turizmi lead pipeline'i netlestir.
- Paket olusturucuyu premium public teklif sayfasina donustur.
- WhatsApp/e-posta bildirimlerini gercek provider'a bagla.
- Paket goruldu, kabul edildi, odeme linki tiklandi, takip gerekiyor gibi event'leri olc.
- Dashboard'a Missed Revenue Radar ekle.
- TR/EN cok dil destegini urun akislari icin tamamla.

### Faz 2: 60-120 Gun

Odak: "Klinik icinde vazgecilmez olmak".

- Tedavi planlama ve dis semasi deneyimini guclendir.
- Lab tracker ve stok-takvim tahminini baslat.
- Dijital onam ve PDF/portal imza akisini gerceklestir.
- Odeme linki, e-fatura/e-arsiv ve finans raporlarini gercek entegrasyonlara yaklastir.
- Google/Meta lead import, DoktorTakvimi randevu/lead import ve Excel import sihirbazi ekle.

### Faz 3: 4-9 Ay

Odak: "Dental turizm dikeyinde liderlik".

- Istanbul, Antalya, Izmir, Ankara gibi turizm kliniklerinde 20 pilot musteri.
- Implant, zirkonyum/veneer, Invisalign/ortodonti ve smile design paket sablonlari.
- Ulke bazli takip sablonlari: UK, Almanya, Fransa, Hollanda, Orta Dogu.
- Hotel/transfer partner paneli ve operasyon SLA takibi.
- Case acceptance analytics: kaynak, ulke, doktor, tedavi, teklif goruntulenme, kabul, tahsilat.

### Faz 4: 9-18 Ay

Odak: "Global SaaS guveni".

- Country pack yapisi: dil, para birimi, vergi/fatura, onam sablonu, veri saklama, yerel entegrasyonlar.
- GDPR/KVKK/HIPAA uyumluluk yol haritasi.
- ISO 27001/SOC 2 hazirlik checklist'i.
- Public API ve entegrasyon marketplace.
- Partner kanali: dental marketing ajanslari, dental tourism acenteleri, lablar, otel/transfer aglari, implant markalari.

## 7. GTM ve Paketleme

Ideal ilk musteri profili:

- 3+ koltuklu dis klinigi.
- Implant, veneer, ortodonti veya estetik dis hekimligi yapan.
- WhatsApp/Instagram/DoktorTakvimi/Google'dan ciddi lead alan.
- Saglik turizmi yapmak isteyen veya zaten yapan.
- Excel, WhatsApp ve manuel takip yuzunden lead kaybeden.

Paket onerisi:

- Clinic Core: hasta, randevu, tedavi, finans, stok, onam, rapor.
- Growth: lead pipeline, teklif, takip, review, channel ROI.
- Tourism: cok dilli paket, otel/transfer, post-care, ulke bazli analytics.
- Enterprise: coklu sube, API, ozel entegrasyonlar, veri import, SLA.

Satis mesaji:

- "Randevu yazilimi" deme.
- "Kliniginizin kayip lead, kayip teklif ve kayip tahsilatini yakalayan dental buyume sistemi" de.
- En guclu metrikler: lead-to-package, package-to-booked, treatment acceptance, no-show, same-day collection, review conversion.

## 8. Onaydan Sonra Gelistirme Yol Haritasi

Onay verirsen ilk gelistirme sprintini su sirayla baslatmayi oneriyorum:

1. Revenue Cockpit: lead pipeline, sicak leadler, kayip gelir uyarilari, teklif durumu.
2. Premium Package Page v2: hasta icin cok dilli tedavi + otel + transfer + odeme + kabul sayfasi.
3. WhatsApp/Email Provider: mock yerine gercek adapter ve event log.
4. Case Acceptance Room: tedavi plani, fiyat, taksit, onam ve randevu kapatma ekrani.
5. Lab & Stock Tracker: planlanan tedaviye gore materyal/lab gorevleri.
6. Care Passport: tedavi sonrasi talimat, garanti, kontrol ve review akisi.
7. Dentist Copilot: tani koymayan operasyon AI'i.

## 9. Kaynaklar

- Mikrodent resmi site: https://www.mikrodent.com.tr
- DoktorTakvimi ana site: https://www.doktortakvimi.com
- DoktorTakvimi hekim/uzman cozumleri: https://pro.doktortakvimi.com/cozumlerimiz/hekim-ve-uzmanlar
- DoktorTakvimi kurum cozumleri: https://pro.doktortakvimi.com/cozumlerimiz/kurumlar
- CareStack: https://www.carestack.com
- Dentrix Ascend: https://www.dentrixascend.com
- Dentally: https://www.dentally.com
- Open Dental: https://www.opendental.com
- Pearl: https://www.hellopearl.com
- DentalMonitoring: https://www.dentalmonitoring.com

## 10. Onay Bekleyen Karar

Benim onerim: ClinicNova'yi "Dental Tourism + High-Ticket Dental Revenue OS" olarak konumlandiralim ve ilk sprintte Revenue Cockpit + Premium Package Page v2 + gercek WhatsApp/e-posta akisini gelistirelim.

Onay verirsen kod gelistirmeye bu siradan baslayacagim.
