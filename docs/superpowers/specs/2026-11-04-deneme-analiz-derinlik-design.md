# Deneme Analizi: Derinlemesine İniş (Drill-down) — Tasarım

Tarih: 2026-11-04 · Durum: onaylı (kullanıcı: "geliştirmeleri planladığımız gibi yap")
Tıklanabilir taslak (örnek veri): https://claude.ai/artifact/XEpm78Br9LoMGanGr4fFGY
Taslak kaynağı (referans, kod değil): `docs/superpowers/specs/2026-11-04-deneme-analiz-taslak.html` — tarayıcıda açılır; davranış ve metinler için birebir referans alınabilir. Verisi uydurmadır.

## 1. Neden

Kullanıcının sözü: "Sınavlardaki detayları, gelişim grafiklerini, konulardaki durumunu derinlemesine analiz yapamıyorum."

Bugünkü Deneme analizi (`src/components/exams/StudentExamAnalysisView.tsx`) üç sekme gösteriyor (Genel / Ders / Konu) ama:

- Ders seviyesinde **zaman içindeki değişimi gösteren grafik yok**; yalnız renkli ısı tablosu ve "son deneme" çubukları var.
- Konu seviyesinde değişim yalnız eksensiz mini grafik (sparkline).
- **Tek bir denemenin dökümüne** inilemiyor ("D5'te Türkçe'de ne düştü?").
- Ekranlar birbirine bağlı değil: bir şeye tıklayıp "neden?" diye aşağı inilmiyor.
- Karne konusundan **müfredat konusuna** (Konu Yeterlilik Haritası'ndaki konu) ve oradaki ödev sonuçlarına geçiş yok.

## 2. Hedefler

1. Beş seviyeli, tıklayarak inilen analiz: **Genel → Deneme → Ders → Karne konusu → Müfredat konusu**. Kırıntı (breadcrumb) ile istenen seviyeye geri dönülür.
2. Her seviyede değişimi gösteren gerçek grafik (eksenli, ölçekli, hover'da ayrıntı).
3. **Koç, öğrenci ve veli** aynı iniş zincirini görür (kullanıcı kararı 2026-11-04). Fark yalnız metin ve işlem düğmelerinde.
4. Mobil portalda (≈400px) da çalışır.

## 3. Hedef olmayanlar / kapsam dışı

- Yeni veri girişi yok; Deneme Girişi ekranı değişmez.
- Yeni tablo yok. Tek şema değişikliği portal RPC'sinin genişlemesi (§7).
- 360 Rapor, Konu Yeterlilik Haritası ve diğer ekranlar değişmez (yalnız müfredat seviyesinden haritaya bağlantı verilebilir, bkz. §9).
- Gerçek 500'lük LGS puanı üretilmez (proje kuralı); LGS'te "puan" denmez.
- Yeni grafik kütüphanesi eklenmez; mevcut el yazımı SVG bileşenleri genişletilir.

**Anti-hedefler (çalışsa bile başarısızlık sayılır):**
- Konu detayı girilmemiş denemede konu değerini **uydurmak** (0 göstermek ya da ders değerinden türetmek). O nokta boş kalır, "konu girilmedi" yazar.
- Ders değerini konu toplamından türetmek ya da ezmek (ders-önce kuralı, 2026-10-24).
- 1→N eşlemede deneme sonucunu birincil olmayan müfredat konusuna yansıtmak.
- Portal sayfalarında `supabase.from(...)` kullanmak (anon rolü sessizce boş döner).

## 3b. Mevcut ekrandan korunacaklar (kullanıcı kararı 2026-11-04: "kaybımız olmasın")

Bugünkü ekranda olan **hiçbir bilgi kaybolmaz**. Taslak sürüm 2 bunları gösteriyor:

| Mevcut ekrandaki | Yeni yeri |
|---|---|
| Ders Isı Tablosu (ders × deneme, net + %, ortalama, son net) | Genel → "Derslerin gelişimi" kartında **Kartlar / Isı tablosu** geçişi. Satır → Ders; hücre → Ders + o deneme vurgulu |
| Konu sekmesindeki "Tümü" + ders filtreli birikimli kayıp listesi (ilk 10) | Genel → "Tüm denemelerde en çok net kaybettiren konular", ders filtre çipleriyle (Tümü + her alt ders). Tıkla → Karne konusu |
| Son deneme kartındaki puan, yüzdelik, sıralar (`ranks`), koç notu | Deneme seviyesinde "Karne bilgileri" kartı (girilmişse; boş alan gösterilmez). Genel'de son deneme için tek satır özet |
| "Nasıl hesaplandı?" formül kutusu | Her seviyenin başında aynı düğme (net formülü, LGS cezası 3, bantlar, "son 3" ve eğilim tanımı) |
| Sekme başındaki tek cümlelik özetler (`general.headline`, `top_loss_headline`, `high_low_headline`, `TopicLevelData.headline`) | Her seviyenin başında özet cümlesi. Genel ve Ders için mevcut motor cümleleri kullanılır, diğer seviyeler için yeni cümle |
| Grafik / Tablo geçişi | Genel → toplam net kartında (tablo satırı → Deneme) |
| "Son denemede en çok net kaybettiren dersler" | Son denemenin Deneme seviyesinde (ders D/Y/B + değişim). Ayrıca kayıp sıralaması isteğe bağlı |
| Programa ekle, Yanlış nedeni, karne→müfredat açılır satırı | Karne konusu seviyesi (koç) + müfredat kartı |
| Konusu girilmemiş deneme bilgisi | Grafiklerde "konu girilmedi" boşluğu + Deneme seviyesinde boş durum metni |

## 4. Seviyeler ve içerikleri

Taslaktaki düzen birebir hedeflenir. Tüm yüzdeler ve bantlar mevcut `getMasteryBand` (≥75 Yeterli/good, ≥50 Gelişiyor/medium, altı Kritik/weak) ile.

### 4.1 Genel (tüm denemeler, seçili sınav türü)
- Özet kutuları: son deneme neti, ortalama, ilk → son farkı, hedef net (varsa; R1'de koçun girdiği hedef — kaynak bkz. §6.4).
- **Toplam net çizgisi** (mevcut, genişletilmiş): hedef ve ortalama kesikli çizgileri; noktaya tıklayınca → Deneme seviyesi.
- **"Net hangi dersten geliyor"**: her deneme bir sütun, sütun ders gruplarına (section_name: Türkçe / Sosyal / Matematik / Fen; LGS'te kendi bölümleri) göre yığılmış net. Sütuna tıklayınca → Deneme.
- **Derslerin gelişimi**: her alt ders (exam_subject) için bir kart: son net / soru sayısı, durum rozeti (son 3 deneme başarısı), ilk 2 → son 2 deneme başarı farkı oku, 0..soru sayısı ölçekli mini grafik. Karta tıklayınca → Ders.
- İçgörüler: mevcut `extractInsights` + `formatRoleInsights` çıktısı korunur. Konu adı geçen içgörü tıklanabilir olursa iyi olur (inşacının kararı).

### 4.2 Deneme (tek deneme)
- Başlık: deneme adı, tarih; önceki/sonraki deneme düğmeleri.
- Özet: net, önceki denemeye göre fark, başarı %, toplam D/Y/B.
- **Önceki denemeye göre ders değişimi**: alt ders başına sapmalı (diverging) çubuk, yeşil sağa / kırmızı sola, sayı yanında. İlk denemede boş durum metni.
- **Ders bazında D/Y/B**: alt ders başına yatay %100 yığılmış çubuk + net. Tıklayınca → Ders (bu deneme vurgulu).
- **Bu denemede en çok net kaybettiren konular** (ilk 8; kayıp = `calcLossNet`). Tıklayınca → Karne konusu. Konu detayı girilmemiş denemede boş durum: "Bu denemede yalnız ders sonuçları girildi, konu detayı yok."

### 4.3 Ders (bir alt ders, örn. Türkçe, Matematik-1)
- Özet: son net / soru, ortalama, ilk → son, son 3 başarı %.
- **Gelişim çizgisi**, Net / Başarı % geçişli. Başarı %'de Yeterli/Gelişiyor/Kritik bantları. Noktaya tıklamak denemeyi **vurgular** (seviye değişmez; kırıntıya deneme eklenir), tekrar tıklamak kaldırır.
- **D/Y/B sütunları** (deneme başına, mutlak sayı).
- **Konu × deneme tablosu** (mevcut konu ısı tablosunun yerini alır): hücre = başarı %, renk bandı + sayı (renk tek başına bilgi taşımaz); sütunlar: soru, son 3, eğilim mini grafiği, durum. Sıralama: Karne sırası / En zayıf / En çok düşen. Satıra tıkla → Karne konusu; hücreye tıkla → Karne konusu + o deneme vurgulu.
- **Toplamda en çok net kaybettiren konular** (bu ders).
- Koçta mevcut "Programa ekle" ve "Yanlış nedeni" (ErrorReasonModal) işlemleri bu tabloda ya da konu seviyesinde erişilebilir kalır — kaybolmamalı.

### 4.4 Karne konusu (örn. Paragraf Yorumu)
- Başlık: konu, ders, denemede soru sayısı, durum rozeti.
- Özet: son 3 başarı, eğilim (son 3 ölçüm − öncekiler, puan), toplam D/Y/B, toplam soru / ölçülen deneme sayısı.
- Konunun deneme başına soru sayısı ≤ 1 ise uyarı: "Bu konu denemede 1 soru çıkıyor; tek denemede %0 ya da %100 görmek normal…" (mevcut `min_questions_reached` / `az_veri` mantığıyla uyumlu olmalı).
- **Başarı çizgisi** (0–100, bantlı); konu girilmemiş denemede çizgi kopar, noktada "konu girilmedi" yazar.
- **Soru soru D/Y/B sütunları**; girilmemiş denemede "yok".
- **Müfredatta karşılığı**: `exam_topic_links` satırları. Birincil olan "deneme sonucu buraya yansır" + durum rozeti; diğerleri "bağlı · yansımaz". Tıkla → Müfredat konusu.
- Koç: "Programa ekle" (mevcut `AddToProgramPopover`, `examTopicId` ile) ve "Yanlış nedeni" (mevcut modal). Öğrenci/veli: duruma göre tek paragraflık "sıradaki adım" / "bu ne anlama geliyor" metni.

### 4.5 Müfredat konusu (örn. Paragraf)
- Başlık: konu adı, müfredat dersi adı (`subjects.name`), durum rozeti (son 3 deneme ölçümü; etiket "son 3 deneme").
- **Deneme ve ödev sonuçları** tek grafikte, tarih sırasıyla (ortak zaman ekseni): deneme = daire, ödev/test = kare + ayrı renk, lejant var. Deneme değeri = bu müfredat konusuna **birincil** bağlı karne konularının o denemedeki toplamı (Σdoğru / Σsoru). Ödev verisi yoksa açıklama metni.
- **Bu konuyu besleyen karne konuları** (birincil): her biri son 3 başarı çubuğuyla; tıkla → Karne konusu. Birincil olmayan bağlılar ayrıca "sonuç yansımaz" diye listelenir.
- Ödev ve deneme arasındaki fark için tek cümlelik rol metni (taslaktaki gibi).

## 5. Gezinme

- Durum bileşen içinde: `{ level, examId?, examSubjectId?, examTopicId?, curriculumTopicId? }`. URL'ye yazılmaz (inşacının kararıyla eklenebilir, zorunlu değil).
- Üstte seviye göstergesi (1 · Genel … 5 · Müfredat) ve kırıntı. Kırıntı: Tüm denemeler › [Deneme] › [Ders] › [Karne konusu] › [Müfredat konusu]; son öğe tıklanmaz.
- Sınav türü seçici (TYT/AYT/LGS) mevcut haliyle kalır; tür değişince seviye Genel'e döner.
- Mevcut "Grafik / Tablo" geçişi Genel seviyede kalır.
- Seviye değişince görünüm kırıntıya kaydırılır (mobilde kullanıcı sayfanın altında kalmasın).

## 6. Veri

### 6.1 Mevcut motor yeterli, küçük ek gerekli
`generateExamReport` zaten her alt ders ve karne konusu için deneme başına hücre üretiyor (`SubjectRowData.cells`, `TopicRowData.cells`, `entered` bayrağıyla). Deneme seviyesi bu hücrelerden `exam_id` ile türetilir; yeni bir rapor motoru yazılmaz.

Eklenecek saf fonksiyonlar (yeni dosya `src/lib/examDrilldown.ts`, React'siz, test edilebilir):
- `examDetail(report, examId)` → ders değişimleri (önceki *girilmiş* denemeye göre), ders D/Y/B, konu kayıpları (ilk 8), `hasTopics`.
- `groupNetsByExam(report)` → deneme başına section_name grubu netleri (Genel'deki yığılmış sütun için).
- `topicTrend(row)` → son 3 başarı, eğilim (son 3 ölçüm − öncekiler; < 4 ölçümde `null`).
- `curriculumSeries(report, links, examId[])` → müfredat konusu başına deneme başına toplam (yalnız `is_primary` bağlar, yalnız `entered` hücreler).
- `homeworkPoints(homework, curriculumTopicId)` → ödev/test noktaları.

Bunlar için `scripts/examDrilldown.selftest.ts` + `npm run test:exam-drilldown` (mevcut selftest kalıbında). Asgari durumlar: konu girilmemiş deneme boş kalır; 1→N'de yalnız birincil toplanır; ilk denemede değişim `null`; < 4 ölçümde eğilim `null`.

### 6.2 Katalog genişlemesi
`ExamReportCatalog`'a isteğe bağlı alanlar eklenir:
- `links: { exam_topic_id, topic_id, is_primary }[]`
- `curriculumTopics: { id, name, subject_name }[]` (yalnız bağlı konular yeterli)
- `homework: { topic_id, date, label, question_count, correct_count, wrong_count, blank_count|null, kind: 'odev'|'konu_testi' }[]`

Bileşendeki ayrı `topicLinks` / `topicNames` durumları bu alanlarla değiştirilir. **`topicNames` (konu adıyla bulanık eşleme) kaldırılır**: eşleme yalnız `exam_topic_links` üzerinden yapılır (koda gömülü ad eşleştirme yasağının ruhuyla).

### 6.3 Koç tarafı (giriş yapmış kullanıcı)
Bileşen kendi verisini yüklerken (mevcut `loadData`) ek olarak:
- `exam_topic_links`: **tümü**, birincil olmayanlar dahil. Bugünkü kod yalnız `is_primary = true` çekiyor; "bağlı · yansımaz" listesi için hepsi gerekir. Bir karne konusunun en fazla bir birincili olabilir (`exam_topic_links_one_primary` benzersiz indeksi).
- `topics` (id, name, subject_id) + `subjects` (id, name): bağlarda geçen **bütün** müfredat konuları (birincil ve birincil olmayan).
- ödev: `weekly_tasks` satırları, şu koşullarla:
  - `student_id` eşleşir, `block_kind = 'ders'`, `topic_id is not null`, `correct_count is not null`, `question_count > 0`.
  - `task_type` süzülmez; D/Y girilmişse her tür ölçümdür.
  - `completed = true` aranmaz, çünkü D/Y'nin girilmiş olması yeterli kanıt.
  - `topic_id`'si olmayan, yalnız `custom_label` taşıyan görevler bilerek dışarıda kalır (müfredat konusuna bağlanamazlar).
  - Tarih: `week_start + day_index` (planlanan gün). Bu değer sabittir. `completed_at` portal işaretlemesiyle sonradan değişebildiği için kullanılmaz.
  - Etiket: `custom_label`, yoksa "<konu adı> · <soru> soru".
  - Üst sınır: son 365 gün, en fazla 300 satır (tarih azalan).
- konu testi: `topic_measurements` where `source = 'konu_testi'`. `accuracy_pct` ve varsa sayılarla, tarih = `measured_at`. Bunlar Konu Yeterlilik panelinden elle girilir (`TopicProgressPanel`). Görevlerden otomatik türemezler, bu yüzden ödevle çift sayım riski yoktur. Üst sınır ödevle aynı.
Supabase 1000 satır sınırına dikkat (mevcut `fetchByExamIds` kalıbı ya da `.range` sayfalaması).

### 6.4 Hedef net
Kaynak: `students.target_net_tyt`, `target_net_ayt`, `target_net_lgs` (koç girer). Seçili sınav türüne göre ilgili kolon kullanılır (TYT → `target_net_tyt` …). Değer `null` ise hedef çizgisi ve kutusu **gösterilmez** (uydurulmaz). Koç tarafında bileşen bu üç kolonu `students`'tan okur (bugün yalnız `studentId` alıyor). Portalda `portal_exam_report`'un `student` nesnesine bu üç kolon eklenir (§7).

### 6.6 Tanımlar (tek kaynak, bütün seviyelerde aynı)
- **Son 3 başarı** (karne konusu ve müfredat konusu): konu verisi *girilmiş* son 3 denemenin Σdoğru / Σsoru'su. Ortalamaların ortalaması değil. Σsoru < 3 ise rozet "Az veri" (`az_veri`, mevcut eşikle aynı sayı). Hiç ölçüm yoksa "Ölçülmedi".
- **Eğilim**: son 3 girilmiş ölçümün Σ başarısı − öncekilerin Σ başarısı (puan). 4'ten az ölçümde `null` ("—").
- Mevcut `TopicRowData.status_badge` (tüm zamanlar toplamı) **değiştirilmez**. İçgörüler onu kullanmaya devam eder. Yeni ekranlar yukarıdaki "son 3" tanımını kullanır ve etiketinde "son 3 deneme" yazar.
- **Sınav türü**: rapor zaten seçili türe göre süzülüyor (`generateExamReport(…, selectedExamType)`). Müfredat konusu grafiği de yalnız seçili türdeki denemelerden beslenir. Örneğin hem TYT hem AYT karne konusundan bağlanan bir müfredat konusu, TYT seçiliyken yalnız TYT denemelerini gösterir. Ödev noktaları sınav türünden bağımsızdır, her zaman gösterilir.

### 6.5 Portal tarafı (öğrenci/veli)
Bugün portal modunda (`initialCatalog && initialExams` dalı, `StudentExamAnalysisView.tsx` ≈ satır 133–160; portal sayfaları bu dala girer) bileşen `error_basket_items`, `exam_topic_links` ve `topics` için `supabase.from` çağırıyor. Anon olduğu için bu sorgular **sessizce boş** dönüyor; bu mevcut bir hata ve bu iş onu düzeltir. Portal modunda bileşen hiçbir tabloya sorgu atmaz, her şey `initialCatalog` ile gelir. Yanlış nedeni (error basket) koça özel olduğu için portalda gösterilmez.

## 7. Şema değişikliği: `portal_exam_report` genişlemesi

Yalnız bu RPC değişir. Eklenenler (mevcut anahtarlar aynen kalır, geriye uyumlu):
- `catalog.links`: aktif karne konularına ait **tüm** `exam_topic_links` (birincil olmayanlar dahil).
- `catalog.curriculum_topics`: `links`'te geçen bütün `topic_id`'ler için `topics.id, topics.name, subjects.name as subject_name`.
- `catalog.homework`: o öğrencinin §6.3'teki ödev ve konu testi satırları, aynı süzgeç ve üst sınırlarla.
- `student`: mevcut alanlara `target_net_tyt, target_net_ayt, target_net_lgs` eklenir (§6.4).

Kurallar (CLAUDE.md tuzakları):
- `json_agg(distinct …)` kullanma (json'da eşitlik yok).
- `revoke all … from public, anon, authenticated;` + `grant execute … to anon, authenticated;` korunur.
- `supabase/schema.sql` idempotent kalır; değişiklik dosyada fonksiyonun mevcut yerinde yapılır.
- `supabase/test/portal_test.sql` yeni anahtarları **dolu veriyle** denetleyecek şekilde genişletilir ve Docker'da (`postgres:16`) eski şema → yeni şema → bir kez daha sırasıyla koşulur.
- SQL'i **kullanıcı** Supabase SQL Editor'de çalıştırır. Frontend, yeni anahtarlar yokken (SQL henüz çalışmamışken) çökmez: müfredat seviyesi "bağlantı bilgisi yok" boş durumuna düşer.
- `src/types/database.ts` RPC dönüş tipi güncellenirse `npm run test:types` koşulur.

## 8. Grafik bileşenleri

Yeni kütüphane yok. Mevcutlar genişletilir, eksikler eklenir (`src/components/charts/`):
- `ExamLineChart` → isteğe bağlı: `yMin/yMax/ticks`, `bands` (Yeterli/Gelişiyor/Kritik), `refs` (hedef/ortalama kesikli çizgileri), `highlightIndex`, `onPointClick`, `null` değer (çizgi kopar), ikinci seri (kare işaretli, ödev), `connectNulls` (müfredat grafiğinde seri içi). Mevcut çağrılar aynı davranır. `data.length < 3` eşiği konu/müfredat grafiklerinde engel olmamalı (inşacı eşiği isteğe bağlı yapar).
- Yeni `StackedColumnChart` (zaman ekseni boyunca dikey yığılmış sütun: D/Y/B ya da ders grupları; vurgulu sütun; tıklama).
- Yeni `DivergingBarList` (ders değişimi). Basit HTML/CSS yeterli.
- Mevcut `StackedBarChart` (yatay D/Y/B) ve `LossBarChart` tıklanabilir satır desteğiyle (isteğe bağlı `onItemClick`) yeniden kullanılır.
- Genişlik `ResizeObserver` ile ölçülür; mobilde etiketler seyreltilir (taslaktaki gibi tarih alt satırı geniş ekranda).
- Renkler token'dan; portalda `PORTAL_STUDENT_PALETTE` / `PORTAL_PARENT_PALETTE` (sabit hex — portal zemini sabit açık). Ders grubu renkleri `--c-turkce`, `--c-sosyal`, `--c-math`, `--c-fen` sırasıyla **Türkçe, Sosyal, Matematik, Fen** (bu sıra renk körlüğü denetiminden geçti; Fen ile Sosyal'i yan yana koyma). Portal paletine bu dört renk sabit hex olarak eklenir.
- Her çok serili grafikte lejant; değer metni mürekkep renginde, seri renginde değil; hover tooltip.

## 9. Roller

| | Koç | Öğrenci | Veli |
|---|---|---|---|
| Seviyeler | 5 | 5 | 5 |
| Dil | nötr / koç ("Görüşmede konuş…") | "sen" | "çocuğunuz", sade |
| Grafik altı açıklama | yok | yok | her grafikte tek cümle (taslaktaki metinler) |
| Programa ekle / Yanlış nedeni / Görüşme notu | var | yok | yok |
| İçgörüler | `formatRoleInsights().coach` | `.student` | `.parent` |

Koç müfredat seviyesinde Konu Yeterlilik Haritası'na bağlantı görebilir (inşacının kararı; zorunlu değil).

## 10. Kısıtlar ve tuzaklar

- Ders adı listesi koda gömülmez; her şey `exam_subject_id` / `section_name` / bağ üzerinden.
- Tailwind yok; var olmayan token (`--accent`, `--surface-elevated`) kullanılmaz. Yeni sınıflar `global.css`'te tanımlanır ya da inline stil.
- Bileşen bugün 1206 satır. Seviyeler ayrı dosyalara bölünmeli (`src/components/exams/drilldown/` altında seviye başına bir bileşen) — tek dosyada büyütme.
- Teslim öncesi: `npm run build`, `npm run test:types`, `npm run test:exam-report`, yeni `test:exam-drilldown`, `npm run lint` (yeni uyarı yok).
- Canlı test verisi yalnız onaylı test öğrencisine (Test Test; 10 TYT test denemesi zaten var).

## 11. İnşacıya bırakılanlar

- Dosya bölümlemesi, bileşen adları, durum yönetiminin ayrıntısı.
- Kırıntının URL'ye yazılıp yazılmayacağı.
- İçgörülerin tıklanabilirliği, haritaya bağlantı.
- Mevcut Grafik/Tablo geçişinin diğer seviyelere yayılıp yayılmayacağı.

## 12. Benim verdiğim kararlar (kullanıcının onayına sunuluyor)

- Üç sekme (Genel/Ders/Konu) yerine beş seviyeli iniş + kırıntı.
- Yeni ekranlarda konu durumu = son 3 girilmiş denemenin Σ başarısı (§6.6). Mevcut tüm zamanlar rozeti içgörüler için aynen kalır.
- Koçun Konu Yeterlilik Haritası'ndaki elle kararı (`coach_decisions`) müfredat seviyesinde gösterilmez.
- Ödev serisi: D/Y girilmiş program görevleri ve `konu_testi` ölçümleri tek seride ("Ödev / test"). Tarih planlanan gün; son 365 gün, en fazla 300 satır.
- Veli de ödev noktalarını ve hedef neti görür (hedef zaten `portal_dashboard` ile portala açık).
- Genel'deki ders kartlarında ok = ilk 2 → son 2 deneme başarı farkı.
- Müfredat grafiğinde denemeler seçili sınav türüyle süzülür; ödevler süzülmez.
