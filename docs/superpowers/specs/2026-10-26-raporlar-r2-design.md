# Raporlar 2.0 · R2 — Koç 360 raporu (grafikler)

**Durum:** Onaylandı. Kullanıcı 2026-10-26'da "R2 spec'ini yaz, agy'ye ver" dedi. Uygulama agy, kontrol Opus.
**Öneri sayfası (görsel referans):** https://claude.ai/artifact/SnhPEnMiaUgVY7idHoKn7W (B · Koç raporu bölümü).
**Bağımlılık:** R1 (görev sonucu, hedef net, sınav tarihi), K1–K6 (karne verisi, `exam_topic_links`).

## Amaç
Tek bir öğrencinin durumunu, koçun görüşmeye 5 dakikada hazırlanacağı biçimde anlatmak. Rapor sırası: durum → hedefe mesafe → nereye odaklanmalı → ne yaptık ve tutuyor mu.

Her kartın başında **tek cümlelik bir başlık-özet** var (ör. "5 konu, toplam kaybın %62'si"). Zayıf satırlarda R1'in `AddToProgramPopover`'ı açılır (`origin_kind: 'gorusme'`).

## Yer
- **Öğrenci profiline yeni sekme: "360 Rapor"** (`OgrencilerPage`, `ActiveTab`'a `report`; URL `?tab=report`). Sekme sırası: Genel Bakış, **360 Rapor**, Deneme Geçmişi, Deneme Analizi…
- **Haftalık Görüşme (`/raporlar`):** "Görüşmede konuşulacaklar" kartının altına "360 raporu aç" bağlantısı (`/ogrenciler/:id?tab=report`).
- Ana Sayfa'daki "ilgi bekleyenler" satırına dokunulmaz (Opus'un dosyası).

## Sınav türü seçimi
- Rapor tek bir sınav türü için çizilir: YKS öğrencisinde **TYT** (varsayılan) / **AYT**; LGS öğrencisinde **LGS**.
- Üstte küçük bir bölmeli düğme. Tür listesi `gradeCurriculum()`'dan gelir, kopyalanmaz.
- **LGS:** net yerine mevcut `weightedNet()`. Her LGS sayısının yanında "LGS puanı değildir" ipucu durur (CLAUDE.md kuralı).

## Veri kaynakları (yeni tablo YOK, şema değişikliği YOK)
| Ne | Kaynak |
|---|---|
| Deneme netleri | `mock_exams` + `mock_exam_sections` (toplam net) |
| Bölüm/ders D/Y/B | `mock_exam_sections` (ders seviyesi), `mock_exam_subject_results` (alt ders) |
| Konu D/Y/B | `mock_exam_topic_results` + `exam_topics` |
| Karne konu → müfredat | `exam_topic_links` (**yalnız `is_primary`**) |
| Konu durumu | `coach_decisions.state` (KonularPage `getTopicStatus` ile aynı kural), ölçüm `topic_measurements` + `topic_exam_measurements` |
| Görev | `weekly_tasks` (R1: `task_type`, D/Y/B, `completed_at`, `topic_id`) |
| Hedef / tarih | `students.target_net_*`, `exam_calendar` |

## Saf motor: `src/lib/report360Core.ts`
- Supabase import etmez; `homeSummaryCore` deseni.
- Yükleyici `src/lib/report360.ts`. Sayfalı + `.order('id')` + 200'lük ID parçaları; mevcut yardımcı varsa onu kullan.
- Self-test `scripts/report360.selftest.ts` → `npm run test:report360`. Her metrik için sabit girdi + beklenen çıktı assert'i; tarih için `referenceDate`.

### K0 · KPI şeridi
| KPI | Tanım |
|---|---|
| Son net | Son deneme toplam neti + bir öncekine göre Δ |
| Hedefe kalan | `hedef − son net`. Hedef yoksa "Hedef belirle" bağlantısı. Sınav tarihi varsa "N hafta · haftada +x gerekli" (`kalan / hafta`) |
| Ödev tamamlama · 4 hafta | Tamamlanan / planlanan; önceki 4 haftaya göre Δ |
| Ödev doğruluğu · 4 hafta | Σ D / Σ (D+Y+B), yalnız sonucu girilmiş görevler. Yoksa "Sonuç girilmedi" |
| Müfredat | Yeterli konu / öğrencinin müfredatındaki konu (`topicAppliesTo`) |

### B2 · Hedef yolu
- Çizgi: deneme netleri, kronolojik.
- Tahmin: son en çok 6 denemeye **doğrusal regresyon** (x = gün). Sınav tarihine uzatılır.
- Belirsizlik bandı: ± regresyon artıklarının standart sapması × √(1 + 1/n), alt sınırı ±3 net.
- **3 denemeden azsa tahmin çizilmez.** Yerine "Tahmin için en az 3 deneme gerekli" yazar. Sınav tarihi yoksa tahmin son denemeden +12 haftaya uzar ve "sınav tarihi girilmedi" etiketi alır.
- Hedef çizgisi: `target_net_*` varsa kesikli.
- Başlık-özet: "Bu hızla sınav gününde ~X net: hedefin Y altında/üstünde".

### B3 · Öncelik matrisi
Bir nokta = bir karne konusu (`exam_topics`).
- **x = başarı:** Σ D / Σ S, öğrencinin son 6 denemesi.
- **y = ağırlık:** konunun bir denemede ortalama soru sayısı. Öğrencinin kendi denemelerinden değil, **koçun görebildiği tüm denemelerden** (aynı `exam_type`, aynı `exam_topic_id`, ortalama S) hesaplanır. Böylece kararlıdır.

Öncelik puanı: `öncelik = ağırlık × (1 − başarı)`. En yüksek 6 konunun adı yazılır. Bölgeler (eşik: başarı %70, ağırlık = medyan):
- sol üst **HEMEN ÇALIŞ**
- sağ üst **KORU**
- sol alt **HIZLI KAZANIM**
- sağ alt **SONRA**

Nokta rengi ders rengi (`--c-*`). Noktaya tıklayınca `AddToProgramPopover` açılır.

### B4 · Net kaybı Pareto
- Konu başına kayıp = `S − (D − Y/ceza)`. Toplam son 6 deneme; ceza `wrong_penalty` (YKS 4, LGS 3).
- Azalan sıralı çubuklar + birikimli % çizgisi. En çok 10 çubuk, kalanı "Diğer N konu".
- Toplam kaybın %60'ına ulaşan ilk konular kırmızı.
- Başlık: "N konu, toplam kaybın %X'i".
- Mevcut `LossBarChart` uyuyorsa genişlet, yeni bileşen açma.

### B5 · Hata profili
- Bir nokta = ders, son 3 deneme. x = yanlış oranı (Y/S), y = boş oranı (B/S).
- Bölgeler (eşik %15 / %15):
  - **SAĞLAM:** ikisi düşük
  - **RİSKLİ İŞARETLEME:** yanlış yüksek
  - **SÜRE / STRATEJİ:** boş yüksek
  - **KONU EKSİĞİ:** ikisi yüksek
- Her bölgenin altında tek cümlelik öneri. Örnek: "emin değilsen boş bırak", "süreli test".

### B6 · Ödev ↔ deneme tutarlılığı
- Müfredat konusu başına:
  - ödev doğruluğu: son 4 hafta, ≥ 20 soru sonuç girilmiş
  - deneme başarısı: aynı konuya **birincil** bağlı karne konularından, son 6 deneme
- Fark ≥ 15 puan olanlar dambıl grafikte.
  - **Ödev > deneme** ise öneri "Süreli test ekle" (popover `sureli_test`).
  - **Deneme > ödev** ise "Kaynağı zorlaştır".
- **Veri yoksa** boş kart çizilmez. Yerine: "Görev sonuçları birikiyor: N görevde sonuç var, karşılaştırma için konu başına 20 soru gerekli."

### B7 · Müfredat ilerlemesi + yetişme tahmini
**Konu durumu** (öğrencinin müfredatı, `topicAppliesTo`):
- **yeterli:** `coach_decisions.state = 'yeterli'`
- **gelişiyor:** state `gelisiyor` ya da `kritik`
- **çalışıldı:** state yok ama en az bir `weekly_tasks` (bu `topic_id`) var
- **başlanmadı:** hiçbiri

KonularPage `getTopicStatus` ile aynı kaynak. Ortak bir fonksiyon yoksa `report360Core`'a koy, KonularPage'i ona bağlama (kapsam dışı; not düş).

**Sol grafik:** ders başına yatay yığılı çubuk (yeterli → gelişiyor → çalışıldı → başlanmadı) + "yeterli/toplam".

**Sağ grafik — yetişme:** "yeterli olmayan konu sayısı"nın haftalara göre değişimi.
- Geçmiş: her konunun ilk `yeterli` kararının tarihi (`coach_decisions.decided_at`). Yalnız güncel karar tutuluyorsa güncel `yeterli`lerin `decided_at`'i kullanılır, sınırlama başlıkta yazar.
- Hız: son 6 haftada haftada kaç konu yeterliye geçmiş.
- Bitiş tahmini = `kalan / hız`. Hız 0 ya da 3'ten az veri haftası varsa tahmin yok.
- Sınav tarihinden sonraya düşüyorsa kırmızı uyarı: "Bu tempoyla müfredat sınavdan N hafta sonra bitiyor".

## Görsel kurallar
- Bütün renkler token. Ders renkleri `--c-*`, durum `--success/--warning/--critical/--measured`, ana renk `--indigo-*` (petrol).
- Koyu temada okunur. Sabit hex yok (portal hariç).
- Grafikler mevcut desende, saf SVG. Etiketler tema token'ından. Her nokta/çubuk için `<title>` ipucu.
- Mobil: kartlar tek sütun. Matris ve dambıl `overflow-x: auto` kabında.
- `prefers-reduced-motion`'da animasyon yok.
- Tüm metin Türkçe. Kullanıcıya teknik ad gösterilmez.

## Kapsam dışı (R3+)
Öneri listesi/taslağı, tekrar zamanı tablosu (B8), müdahale etkisi (B9), ÖSYM ağırlıkları, kurum karşılaştırması, yazdırma.

## İş paketleri (agy; her paketten sonra Opus kontrolü)
| Paket | Ne | Kabul |
|---|---|---|
| **R2-1** | `report360Core.ts` + `report360.ts` + self-test (K0, B2–B7 hepsinin hesapları) | test:report360 ✓, types ✓, lint ≤ 28, build ✓ |
| **R2-2** | "360 Rapor" sekmesi iskeleti + sınav türü seçici + K0 şeridi + B2 hedef yolu + B4 Pareto | Test Test'te (10 TYT) çizim; <3 denemeli öğrencide tahmin yok mesajı |
| **R2-3** | B3 öncelik matrisi + B5 hata profili + popover bağlantısı | Noktadan görev ekle → `origin_kind = 'gorusme'` (canlı test, Test Test, sonra sil) |
| **R2-4** | B7 müfredat ilerlemesi + yetişme + B6 tutarlılık (boş durum dahil) | LGS öğrencisinde yalnız LGS konuları |
| **R2-5** | `/raporlar` bağlantısı, Yardım kartı, sürüm notu v0.28 | — |

**Doğrulama kuralı (R1'den ders):** her yeni sorgu canlıda **giriş yapmış koç istemcisiyle** sayılarak doğrulanır. Servis anahtarıyla doğrulamak yetmez; RLS hatası "0 satır" diye sessiz döner.
