# 2026 Ek Yerleştirme Kılavuzu Doğrulama Raporu

**Üretim Tarihi:** 2026-10-24 09:23:05

## 1. Satır ve Kapsam İstatistikleri
- **Toplam Program Sayısı:** 16715 (Beklenen: ~16.715)
  - **Tablo 3 (Ön Lisans):** 8407 (Beklenen: ~8.400)
  - **Tablo 4 (Lisans):** 8308 (Beklenen: ~8.300)
- **Tekil Program Kodu:** 16715 (Mükerrer: 0)
- **Toplam Koşul Sayısı:** 195 (1. Kısım: 35, 2. Kısım: 160)
- **Vakıf Ücret Kayıtları:** 2610

## 2. Puan Türü Dağılımı
| Puan Türü | Program Sayısı |
|---|---|
| TYT | 8407 |
| SAY | 3312 |
| EA | 2955 |
| SÖZ | 1491 |
| DİL | 550 |

## 3. Doğrulama ve Tutarlılık Denetimleri
- **Mükerrer Program Kodu:** YOK (Başarılı)
- **Eksik/Tanımsız Koşul Kodu:** YOK (Tüm program koşulları tanımlı)
- **YÖK Atlas (`university_rankings`) Eşleşme Oranı:** 13476 / 16715 (%80.6)
- **Merkezi Yerleştirme Taban Puanı Çapraz Eşleşmesi:** 11158 / 11158 birebir eşleşme.

## 4. Örnek Veri Regresyon Testi (2026-ornek.json - 26 Satır)
✅ **Tüm 26 örnek program parser çıktısıyla birebir eşleşti (0 hata).**

## 5. Üniversite Adı Denetimi
- **Tekil üniversite adı:** 226 (226 farklı 4 haneli önek)
- **Boş üniversite adı:** 0 (beklenen 0)
- **4 haneli önekten doldurulan satır (güvenlik ağı):** 0
- **Birden çok adı olan önek:** 2 — kampüs/yerleşke alt başlıkları, kasıtlı ayrı tutuldu:
  - `1109`: `ANKARA SOSYAL BİLİMLER ÜNİVERSİTESİ` / `ASBÜ-KUZEY KIBRIS YERLEŞKESİ`
  - `1084`: `ODTÜ KUZEY KIBRIS KAMPUSU` / `ORTA DOĞU TEKNİK ÜNİVERSİTESİ`
- **Şüpheli ad (ÜNİVERSİTESİ/YÜKSEKOKULU/ENSTİTÜSÜ/AKADEMİSİ/YERLEŞKESİ/KAMPUSU/CERRAHPAŞA ile bitmeyen veya parantez/rakam/küçük harf/yıldız içeren):** 2
  - `KİLİS 7 ARALIK ÜNİVERSİTESİ` — adın parçası olan rakam (meşru)
  - `İSTANBUL 29 MAYIS ÜNİVERSİTESİ` — adın parçası olan rakam (meşru)

## Eşlenemeyen ücret satırı: 72

- **Programı olmayan kurum (beklenen, ücret satırı yine de saklanır):** 72 satır, kurumlar: `İBN HALDUN ÜNİVERSİTESİ`, `İSTANBUL ŞİŞLİ MESLEK YÜKSEKOKULU`, `İZMİR KONAK MESLEK YÜKSEKOKULU`
- **Gerçek eşleşme hatası şüphesi:** 0 satır

### Programı olmayan kurum

- `İBN HALDUN ÜNİVERSİTESİ` | Hazırlık Programı | İngilizce Hazırlık Programı (İngilizce, Arapça, Türkçe) | 1000000
- `İBN HALDUN ÜNİVERSİTESİ` | Lisans | Felsefe ve Yapay Zeka | 1000000
- `İBN HALDUN ÜNİVERSİTESİ` | Lisans | Karşılaştırmalı Edebiyat | 1000000
- `İBN HALDUN ÜNİVERSİTESİ` | Lisans | Hukuk | 1300000
- `İBN HALDUN ÜNİVERSİTESİ` | Lisans | İktisat | 1000000
- `İBN HALDUN ÜNİVERSİTESİ` | Lisans | İslami İlimler | 1000000
- `İBN HALDUN ÜNİVERSİTESİ` | Lisans | İşletme | 1000000
- `İBN HALDUN ÜNİVERSİTESİ` | Lisans | Psikoloji | 1300000
- `İBN HALDUN ÜNİVERSİTESİ` | Lisans | Rehberlik ve Psikolojik Danışmanlık | 1000000
- `İBN HALDUN ÜNİVERSİTESİ` | Lisans | Siyaset Bilimi ve Uluslararası İlişkiler | 1000000
- `İBN HALDUN ÜNİVERSİTESİ` | Lisans | Sosyoloji | 1000000
- `İBN HALDUN ÜNİVERSİTESİ` | Lisans | Tarih | 1000000
- `İBN HALDUN ÜNİVERSİTESİ` | Lisans | Yeni Medya ve İletişim | 1000000
- `İSTANBUL ŞİŞLİ MESLEK YÜKSEKOKULU` | Önlisans | Ağız ve Diş Sağlığı | 525000
- `İSTANBUL ŞİŞLİ MESLEK YÜKSEKOKULU` | Önlisans | Ameliyathane Hizmetleri | 525000
- `İSTANBUL ŞİŞLİ MESLEK YÜKSEKOKULU` | Önlisans | Anestezi | 600000
- `İSTANBUL ŞİŞLİ MESLEK YÜKSEKOKULU` | Önlisans | Aşçılık | 500000
- `İSTANBUL ŞİŞLİ MESLEK YÜKSEKOKULU` | Önlisans | Bankacılık ve Sigortacılık | 320000
- `İSTANBUL ŞİŞLİ MESLEK YÜKSEKOKULU` | Önlisans | Çocuk Gelişimi | 420000
- `İSTANBUL ŞİŞLİ MESLEK YÜKSEKOKULU` | Önlisans | Dış Ticaret | 320000
- `İSTANBUL ŞİŞLİ MESLEK YÜKSEKOKULU` | Önlisans | Elektronörofizyoloji | 400000
- `İSTANBUL ŞİŞLİ MESLEK YÜKSEKOKULU` | Önlisans | E-Ticaret ve Pazarlama | 380000
- `İSTANBUL ŞİŞLİ MESLEK YÜKSEKOKULU` | Önlisans | Fizyoterapi | 525000
- `İSTANBUL ŞİŞLİ MESLEK YÜKSEKOKULU` | Önlisans | Grafik Tasarımı | 400000
- `İSTANBUL ŞİŞLİ MESLEK YÜKSEKOKULU` | Önlisans | İç Mekan Tasarımı | 380000
- `İSTANBUL ŞİŞLİ MESLEK YÜKSEKOKULU` | Önlisans | İlk ve Acil Yardım | 600000
- `İSTANBUL ŞİŞLİ MESLEK YÜKSEKOKULU` | Önlisans | Mahkeme Büro Hizmetleri | 380000
- `İSTANBUL ŞİŞLİ MESLEK YÜKSEKOKULU` | Önlisans | Medya ve İletişim | 380000
- `İSTANBUL ŞİŞLİ MESLEK YÜKSEKOKULU` | Önlisans | Odyometri | 420000
- `İSTANBUL ŞİŞLİ MESLEK YÜKSEKOKULU` | Önlisans | Radyoterapi | 420000
- `İSTANBUL ŞİŞLİ MESLEK YÜKSEKOKULU` | Önlisans | Saç Bakımı ve Güzellik Hizmetleri | 400000
- `İSTANBUL ŞİŞLİ MESLEK YÜKSEKOKULU` | Önlisans | Sivil Havacılık Kabin Hizmetleri | 450000
- `İSTANBUL ŞİŞLİ MESLEK YÜKSEKOKULU` | Önlisans | Tıbbi Dokümantasyon ve Sekreterlik | 400000
- `İSTANBUL ŞİŞLİ MESLEK YÜKSEKOKULU` | Önlisans | Tıbbi Görüntüleme Teknikleri | 530000
- `İSTANBUL ŞİŞLİ MESLEK YÜKSEKOKULU` | Önlisans | Turizm ve Otel İşletmeciliği | 320000
- `İSTANBUL ŞİŞLİ MESLEK YÜKSEKOKULU` | Önlisans | Yaşlı Bakımı | 330000
- `İZMİR KONAK MESLEK YÜKSEKOKULU` | Önlisans | Ağız ve Diş Sağlığı | 821872
- `İZMİR KONAK MESLEK YÜKSEKOKULU` | Önlisans | Ameliyathane Hizmetleri | 821872
- `İZMİR KONAK MESLEK YÜKSEKOKULU` | Önlisans | Anestezi | 853977
- `İZMİR KONAK MESLEK YÜKSEKOKULU` | Önlisans | Aşçılık | 743642
- `İZMİR KONAK MESLEK YÜKSEKOKULU` | Önlisans | Bankacılık ve Sigortacılık | 542732
- `İZMİR KONAK MESLEK YÜKSEKOKULU` | Önlisans | Bilgisayar Programcılığı | 648786
- `İZMİR KONAK MESLEK YÜKSEKOKULU` | Önlisans | Bilişim Güvenliği Teknolojisi | 538991
- `İZMİR KONAK MESLEK YÜKSEKOKULU` | Önlisans | Çevre Sağlığı ve Çevresel Risk Yönetimi Teknikerliği | 538991
- `İZMİR KONAK MESLEK YÜKSEKOKULU` | Önlisans | Çocuk Gelişimi | 739036
- `İZMİR KONAK MESLEK YÜKSEKOKULU` | Önlisans | Dış Ticaret | 613572
- `İZMİR KONAK MESLEK YÜKSEKOKULU` | Önlisans | Diyaliz | 802610
- `İZMİR KONAK MESLEK YÜKSEKOKULU` | Önlisans | Elektrik | 538991
- `İZMİR KONAK MESLEK YÜKSEKOKULU` | Önlisans | Fizyoterapi | 866819
- `İZMİR KONAK MESLEK YÜKSEKOKULU` | Önlisans | Fotoğrafçılık ve Kameramanlık | 515001
- `İZMİR KONAK MESLEK YÜKSEKOKULU` | Önlisans | Grafik Tasarımı | 515001
- `İZMİR KONAK MESLEK YÜKSEKOKULU` | Önlisans | Halkla İlişkiler ve Tanıtım | 437579
- `İZMİR KONAK MESLEK YÜKSEKOKULU` | Önlisans | İç Mekan Tasarımı | 588898
- `İZMİR KONAK MESLEK YÜKSEKOKULU` | Önlisans | İlk ve Acil Yardım | 860398
- `İZMİR KONAK MESLEK YÜKSEKOKULU` | Önlisans | İnsan Kaynakları Yönetimi | 599732
- `İZMİR KONAK MESLEK YÜKSEKOKULU` | Önlisans | İnşaat Teknolojisi | 588199
- `İZMİR KONAK MESLEK YÜKSEKOKULU` | Önlisans | Kaynak Teknolojisi | 538991
- `İZMİR KONAK MESLEK YÜKSEKOKULU` | Önlisans | Lojistik | 565563
- `İZMİR KONAK MESLEK YÜKSEKOKULU` | Önlisans | Mahkeme Büro Hizmetleri | 663758
- `İZMİR KONAK MESLEK YÜKSEKOKULU` | Önlisans | Makine | 663758
- `İZMİR KONAK MESLEK YÜKSEKOKULU` | Önlisans | Mimari Restorasyon | 498239
- `İZMİR KONAK MESLEK YÜKSEKOKULU` | Önlisans | Optisyenlik | 721241
- `İZMİR KONAK MESLEK YÜKSEKOKULU` | Önlisans | Otonom Sistemler Teknikerliği | 648786
- `İZMİR KONAK MESLEK YÜKSEKOKULU` | Önlisans | Robotik ve Yapay Zeka | 658767
- `İZMİR KONAK MESLEK YÜKSEKOKULU` | Önlisans | Saç Bakımı ve Güzellik Hizmetleri | 633814
- `İZMİR KONAK MESLEK YÜKSEKOKULU` | Önlisans | Sağlık Kurumları İşletmeciliği | 576666
- `İZMİR KONAK MESLEK YÜKSEKOKULU` | Önlisans | Sivil Havacılık Kabin Hizmetleri | 792461
- `İZMİR KONAK MESLEK YÜKSEKOKULU` | Önlisans | Sosyal Hizmetler | 515001
- `İZMİR KONAK MESLEK YÜKSEKOKULU` | Önlisans | Tıbbi Dokümantasyon ve Sekreterlik | 477663
- `İZMİR KONAK MESLEK YÜKSEKOKULU` | Önlisans | Tıbbi Görüntüleme Teknikleri | 853977
- `İZMİR KONAK MESLEK YÜKSEKOKULU` | Önlisans | Tıbbi Laboratuvar Teknikleri | 853977
- `İZMİR KONAK MESLEK YÜKSEKOKULU` | Önlisans | Yenilenebilir Enerji Teknikerliği | 538991

### Gerçek eşleşme hatası şüphesi

