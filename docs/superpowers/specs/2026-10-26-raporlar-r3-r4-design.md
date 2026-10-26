# Raporlar 2.0 · R3 + R4 — kalan her şey + test verisi

**Durum:** Onaylandı. Kullanıcı 2026-10-26'da şunu istedi: "Tüm eksikleri tamamlat. agy 10 alt ajanla çalışsın, tüm yazılım işini bitirsin. Test öğrencilerinde her şey tam olsun, Eda neleri yapabileceğini bilsin."
**Uygulama:** agy (alt ajanlarla paralel). **Kontrol ve görsellik:** Opus.
**Tasarım referansı:** https://claude.ai/artifact/SnhPEnMiaUgVY7idHoKn7W (B8, B9, C, D, R4).
**Önceki fazlar:** R1, R2 canlıda. Sınav tarihleri girildi: YKS 2027-06-19, LGS 2027-06-06.

## Kararlar (önceden verilmiş, değişmez)
- Görev sonucunu **koç** girer. Öğrenci portalda yalnız "bitti" işaretler.
- Hedef neti koç girer.
- Öneri motoru **önce liste (A), sonra günlere dağıtılmış taslak (B)**. Taslak koç onaylamadan öğrenciye gitmez. B, veri eşiği dolana kadar "veri birikiyor" der. Koç isterse "Yine de taslak üret" ile çalıştırabilir.
- WhatsApp gönderiminde dürüst damgalama: "gönderildi" değil, **"WhatsApp açıldı"** (Devamsızlık'taki desen).
- LGS'te katsayılı net; "LGS puanı değildir".

## Paketler

### R3-0 · Şema (tek SQL, kullanıcı bir kez çalıştırır)
`supabase/schema.sql`, idempotent; alter'lar önce, constraint/policy sonra. SQL'de fonksiyon gövdeleri **`$fn$`** ile.
1. `weekly_tasks.duration_min smallint null`: çalışma süresi (R4).
2. `parent_summary_log(id uuid pk, student_id → students on delete cascade, week_start date, opened_at timestamptz default now(), opened_by uuid default auth.uid(), channel text default 'whatsapp')`.
   - RLS: öğrenciyi görebilen koç okur ve ekler (students RLS'iyle aynı kural, `exists` alt sorgusu).
3. `topic_weights(id serial pk, exam_type text check in ('TYT','AYT','LGS'), exam_topic_id int → exam_topics, avg_questions numeric(5,2) not null, source text not null, year_from int, year_to int, unique(exam_type, exam_topic_id, source))`.
   - RLS: authenticated okur, `curriculum.manage` yazar.
   - **Veri uydurulmaz.** Tablo boşsa raporlar R2'deki "kendi denemelerimizden ortalama"ya düşer. ÖSYM/MEB dağılımı CSV ile koç tarafından yüklenir (R4-1).
4. `portal_dashboard` dönüşüne öğrencinin **"Haftam"** verisi eklenir (R3-5 için): bu hafta görev sayısı/tamamlanan, hedef net, son net, sınava kalan gün, koçun son notu. **D/Y/B öğrenciye dönmez** (karar 1).
5. Opus doğrular: Docker'da eski → yeni → yeni; `verify:schema` ✓.

### R3-1 · B8 Tekrar zamanı (360 Rapor'a yeni kart)
- Konu "yeterli" ise ve en son ölçüm ya da görev ≥ 3 hafta önceyse "tekrar zamanı".
- Aralıklar: 1 hafta → 3 hafta → 6 hafta. Konunun kaçıncı tekrarı olduğu `task_type='tekrar'` görev sayısıyla bulunur.
- Tablo: konu, ders, son ölçüm %, kaç haftadır çalışılmadı (rozet), "Tekrar ekle" (popover `tekrar`, `origin_kind 'oneri'`).
- Saf hesap `report360Core`'a. Self-test.

### R3-2 · B9 Müdahale etkisi
- `origin_kind ≠ 'elle'` görevler (rapordan/öneriden doğanlar). Her biri için: görevden **önceki** son deneme ölçümü ve görev tamamlandıktan **sonraki** ilk ölçüm (`topic_exam_measurements` + `topic_measurements`).
- Eğim grafiği (önce → sonra). Yükselen yeşil, düşen kırmızı.
- Başlık: "Programa eklenen N konudan M'si sonraki ölçümde yükseldi".
- Yükselmeyenlere "Farklı yöntem dene" rozeti.
- Veri yoksa açıklamalı boş durum.

### R3-3 · Öneri motoru A: öncelik listesi
- `src/lib/recommendCore.ts` (saf) + self-test.
- Girdi: B3 öncelik puanı, B8 tekrar zamanı, kritik koç kararları, son 4 haftanın gerçek temposu (haftalık soru).
- Çıktı: gelecek hafta için sıralı **konu listesi**. Her satırda önerilen soru sayısı, tür (konu / tekrar / süreli test) ve tek cümlelik "neden".
- Haftalık toplam, son 4 haftanın ortalamasının en fazla %10 üstü.
- Yer:
  - Program sayfasında öğrenci seçiliyken sağda açılır "Öneriler" paneli
  - Haftalık Görüşme sayfası
  - Her satır: "Programa ekle" (popover, `origin_kind 'oneri'`)

### R3-4 · Öneri motoru B: haftalık taslak
- Liste A'dan günlere dağıtım. Kurallar (tasarımdaki 6 kural):
  - kritik konu 2 oturuma bölünür
  - tekrar kısa (10–15 soru)
  - rutin ve deneme günleri koçun mevcut görevlerinden korunur
  - öğrencinin bitirmediği günlere daha az yük
  - her öneri kaynağını saklar
- Program panosunda **kesikli çerçeveli taslak görevler**. "Neden?" ipucu, tek tek sil/düzenle, "N öneriyi onayla" toplu insert (`origin_kind 'oneri'`). Taslak DB'ye **onaydan önce yazılmaz** (istemci durumu).
- Veri eşiği: son 4 haftada ≥ 2 haftalık görev sonucu yoksa "Veri birikiyor" + "Yine de taslak üret".

### R3-5 · Öğrenci "Haftam" (portal)
- `/ogrenci` portalında yeni ilk sekme "Haftam". Tasarımdaki telefon taslağı:
  - X/Y görev bitti
  - hedefe yolculuk çubuğu (hedef varsa)
  - bu hafta kazandıkların (koçun girdiği sonuçlardan yükselenler; öğrenciye D/Y/B değil, yalnız "↑ gelişti" etiketi)
  - sıradaki odak (bu haftanın görev konuları)
  - müfredat şeridi
- Renkler `portalTheme.ts` (öğrenci indigo, sabit hex; portal kuralı). Veri yalnız `portal_dashboard`'dan (anon tablo okumaz).

### R3-6 · Veli haftalık özeti + WhatsApp
- Haftalık Görüşme'de ve öğrenci profilinde "Veliye haftalık özet" düğmesi. Önizleme penceresi:
  - Kısaca: görev X/Y, devamsızlık, son deneme
  - Hedefe göre
  - "Evde nasıl destek olabilirsiniz?": kural tabanlı, suçlamasız, en çok 2 madde. Kurallar tasarımda: tamamlama düşük → sabit saat; deneme düşüşü → dinlenme/uyku; devamsızlık → nedenini sor.
  - Koçun notu: düzenlenebilir metin
- "WhatsApp'ta aç" → `openWhatsAppChat` + `parent_summary_log`'a kayıt. Ekranda "WhatsApp açıldı · 26 Eki 14:05" damgası.
- Veli portalı (`/veli`) aynı özeti salt okunur gösterir.

### R4-1 · Konu ağırlığı içe aktarma
- Müfredat sayfasında (yalnız `curriculum.manage`) "Konu ağırlıkları" kartı. CSV yükle (`exam_type, karne konu adı, ortalama soru, kaynak, yıl aralığı`). Önizleme + eşleşmeyen satır raporu. `topic_weights`'e upsert.
- `report360` ağırlık önceliği: `topic_weights` (varsa) > kendi denemelerimiz. Kartta kaynağı yaz.
- **Veri dosyası üretme veya uydurma.** Örnek CSV şablonu `data/topic-weights-ornek.csv` yalnız başlık + 2 açıkça "ÖRNEK" satır.

### R4-2 · Kurum içi anonim karşılaştırma
- 360 Rapor üst şeridine "Kurum içi sıra": aynı `exam_type`'ta, koçun görebildiği öğrencilerin son 30 gündeki en iyi netine göre yüzdelik dilim.
- **Öğrenci adı gösterilmez.** 5'ten az öğrenci varsa gösterilmez ("Karşılaştırma için en az 5 öğrenci gerekli").

### R4-3 · Çalışma süresi
- Program'da görev ekleme/düzenleme ve sonuç penceresine "Süre (dk)" alanı (`duration_min`, isteğe bağlı).
- 360 Rapor'a "Soru başına süre" mini-metrik (sonuç ve süre girilmiş görevlerden). Yoksa gösterilmez.

### R4-4 · Yanlış nedeni
- Mevcut ama kullanılmayan `error_basket_items` tablosu: deneme analizinde konu satırına "Yanlış nedeni ekle" (bilgi eksikliği / işlem hatası / dikkat hatası / süre yetmedi).
- 360 Rapor'a "Yanlış nedenleri" halka grafiği (son 6 deneme). Veri yoksa açıklamalı boş durum.

### T-1 · Test verisi (Eda'nın her şeyi dolu görmesi için)
`scripts/seedTestData.ts` + `npm run seed:test`:
- **Varsayılan kuru çalışma**, `--yaz` ile yazar, `--sil` ile yalnız kendi yazdıklarını siler.
- **Yalnız** şu 3 öğrenci id'sine dokunur, başka id'ye yazma girişimi hata verir:
  - Test Test `5bc47392-c8f0-4249-83b5-1800a1eed0ce`
  - Test YKS `8dd1fd87-b0ab-48c3-bf64-7c0f520908d9`
  - Test LGS `7da01119-c538-4b19-b6f3-e0d733450136`
- Her kayıtta işaret: deneme adı `TEST …`, görev `source = 'TEST veri'`, devamsızlık notu `TEST`. Silme bu işaretlerle yapılır. Test Test'in mevcut 10 denemesine dokunulmaz.
- **Tutarlılık:** bölüm = alt ders = konu toplamları (S/D/Y/B). Net formülü DB'de (LGS ceza 3, YKS 4). Tarihler 2026-08-31'den bugüne. Rastgelelik sabit tohumlu (her koşu aynı veri).
- **İçerik:**

| Öğrenci | Denemeler | Program | Diğer |
|---|---|---|---|
| Test YKS | 8 TYT + 4 AYT (SAY), konu sonuçlarıyla | son 8 hafta + bu hafta + gelecek hafta; 5 türün hepsi; %60–90 tamamlama; tamamlananların ~%70'inde D/Y/B ve süre; bir kısmı `origin_kind` deneme_analizi/oneri | hedef TYT 100 / AYT 60; 10 koç kararı (yeterli/gelişiyor/kritik, farklı tarihler); 3 devamsızlık (1'i "WhatsApp açıldı"); 4 yanlış nedeni; 1 veli özeti kaydı |
| Test LGS | 6 LGS denemesi (8. sınıf konuları), konu sonuçlarıyla | aynı desen, LGS konuları | hedef LGS 75 (katsayılı); 8 koç kararı; 2 devamsızlık |
| Test Test | mevcut 10 TYT (dokunma) | son 6 hafta görevleri + sonuçlar | hedef TYT 105; 6 koç kararı |

- Çıktı: yazılan kayıtların id listesi `data/test-seed/olusturulan.json` (repo dışı değilse `.gitignore`).
- **Opus kontrolü ve kullanıcı onayı olmadan `--yaz` koşulmaz.**

### G-1 · Eda için "Neler yapabilirim?" rehberi (Opus)
Test öğrencileri dolunca Opus, ekran görüntülü, düz HTML ve capability'siz bir rehber sayfası hazırlar. Her ekranda ne yapılır, hangi test öğrencisinde görülür. Uygulamadaki Yardım sayfası da güncellenir (v0.29).

## Paralel çalışma (agy alt ajanları için dosya sahipliği)
| Ajan | Paket | Dokunduğu dosyalar |
|---|---|---|
| 1 | R3-0 şema + tipler | `supabase/schema.sql`, `src/types/*` |
| 2 | R3-1 B8 + R3-2 B9 | `report360Core.ts`, yeni `components/reports/*Card.tsx` |
| 3 | R3-3 öneri A | yeni `recommendCore.ts`, `components/reports/RecommendList.tsx` |
| 4 | R3-4 öneri B | `ProgramPage.tsx` (taslak katmanı) |
| 5 | R3-5 Haftam | `OgrenciPortalPage.tsx`, `portal.ts` |
| 6 | R3-6 veli özeti | yeni `components/reports/ParentSummary*.tsx`, `VeliPortalPage.tsx` |
| 7 | R4-1 ağırlık CSV | `MufredatPage.tsx`, yeni import bileşeni |
| 8 | R4-2 + R4-3 | `Report360View.tsx` (şerit), `ProgramPage.tsx` (süre alanı, Ajan 4 ile sıralı) |
| 9 | R4-4 yanlış nedeni | `StudentExamAnalysisView.tsx`, yeni kart |
| 10 | T-1 test verisi | `scripts/seedTestData.ts` |

- **Sıra:** R3-0 önce (tipler ortak). Diğerleri tipler commit'lenince paralel.
- `ProgramPage.tsx`'e iki ajan dokunuyor (4 ve 8). Önce 4, sonra 8.
- **Ana Sayfa, Sidebar, tema dosyaları Opus'ta** (`PanelPage`, `Sidebar`, `AppShell`, `home.css`, `global.css` sidebar bölümü, `tokens.css`).

## Kabul (her paket)
- `npm run test:types`, `npm run build`, `npm run lint` (≤ 28), ilgili self-test.
- Canlı doğrulama **giriş yapmış koç istemcisiyle** (RLS sessiz 0 satır tuzağı).
- Görsel: koyu tema, mobil, token renk, Türkçe metin, teknik ad yok.
- Her commit'ten sonra günlüğe bir satır.
