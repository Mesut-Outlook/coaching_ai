# Raporlar 2.0 · R1 — Veri + tek tık aksiyon

**Durum:** Onaylandı — kullanıcı 2026-10-26 sabah "raporlar en öncelikli" dedi. Uygulama agy, kontrol Opus.
**Öneri sayfası:** https://claude.ai/artifact/SnhPEnMiaUgVY7idHoKn7W (B1, C2, C3 bölümleri).
**Bağımlılık:** Deneme Karnesi K1–K6 (canlıda).

## Kullanıcı kararları (2026-10-25)
1. **Görev sonucunu koç (Eda) girer.** Öğrenci portaldan D/Y/B girmez; portalda yalnız "bitti" işareti kalır.
2. **Hedef net koç ile öğrenci birlikte belirler, sisteme koç girer.** Taban puandan otomatik öneri yok.
3. **Öneri motoru önce liste (A), veri birikince günlere dağıtılmış taslak (B).** R1'i etkilemez, R3'e gider.

## R1'in amacı
Eda'nın bugünkü işini değiştirmeden üç şeyi mümkün kılmak:
- Görevin **sonucunu** (D/Y/B) ve **türünü/kaynağını** kaydetmek. R2 grafiklerinin hammaddesi bu.
- Rapordaki zayıf konudan **3 tıkta görev** oluşturmak ("Programa ekle").
- Görüşmeye **kural tabanlı maddelerle** hazırlanmak ("Görüşmede konuşulacaklar").

## 1. Veri modeli (`supabase/schema.sql`, idempotent)

### 1.1 `weekly_tasks`: yeni kolonlar
Var olan tablo. **Hepsi `alter table … add column if not exists`**. İndeks ve constraint'ler bu satırların ALTINDA.

| Kolon | Tip | Not |
|---|---|---|
| `correct_count` | `smallint` null | Koç girer |
| `wrong_count` | `smallint` null | Koç girer |
| `blank_count` | `smallint` null | Koç girer |
| `completed_at` | `timestamptz` null | Trigger yönetir (aşağıda) |
| `task_type` | `text not null default 'konu'` | check: `konu`, `tekrar`, `rutin`, `sureli_test`, `deneme` |
| `source` | `text` null | Kitap/kaynak adı, serbest metin |
| `origin_kind` | `text not null default 'elle'` | check: `elle`, `deneme_analizi`, `konu_haritasi`, `gorusme`, `oneri` |
| `origin_exam_topic_id` | `int` null → `exam_topics(id) on delete set null` | Görev bir karne konusundan doğduysa |

- **Constraint** `weekly_tasks_result_ck`:
  - `coalesce(correct_count,0) + coalesce(wrong_count,0) + coalesce(blank_count,0) <= question_count`
  - üçü de `>= 0`
  - `drop constraint if exists` + `add constraint` ile idempotent.
- **Mevcut `is_exam` kalır.** Geriye dönük doldurma: `update … set task_type = 'deneme' where is_exam and task_type = 'konu'`. Bu yalnız bir kez anlamlı ama tekrar koşmak zararsız.
- **Trigger** `weekly_tasks_completed_at` (before update/insert):
  - `completed` false→true olunca `completed_at = now()`
  - true→false olunca `null`
  - `portal_set_task_completed` de tabloyu güncellediği için kendiliğinden kapsanır.
  - Eski tamamlanmış görevlerde `completed_at` null kalır; raporlar "tarih bilinmiyor" sayar.
- **Portal:** `portal_set_task_completed` D/Y/B kolonlarına dokunmaz. `portal_dashboard` bunları **döndürmez**: öğrenci sonucu görmez, koç girer (karar 1).

### 1.2 Hedef net: `students` kolonları
- `target_net_tyt numeric(5,2)`, `target_net_ayt numeric(5,2)`, `target_net_lgs numeric(5,2)`, hepsi null.
- `target_set_at timestamptz`: hedef değişince istemci yazar.
- Neden kolon, neden ayrı tablo değil: RLS `students`'tan miras kalır, geçmiş tutma ihtiyacı yok (YAGNI).
- LGS hedefi **katsayılı net** cinsindendir, puan değildir. Arayüzde "LGS puanı değildir" etiketi aynen kalır.

### 1.3 Sınav tarihleri: `exam_calendar`
- `exam_calendar(exam text primary key check (exam in ('YKS','LGS')), exam_date date not null, updated_at timestamptz not null default now())`.
- **Ulusal veri, kurum ayarı değil.** RLS: `authenticated` okur, yalnız `is_system_admin()` yazar.
- Tohum yok. Tarihi ÖSYM/MEB açıklayınca sistem yöneticisi bir kez girer. Tarih yoksa sayaçlar hiç çizilmez (boş kart yok).

### 1.4 Tipler
- `src/types/database.ts`: `WeeklyTask` + 8 alan; `Student` + 4 alan; `ExamCalendar` + `Tables['exam_calendar']`; `TaskType`, `TaskOriginKind` birlikleri.
- `database.test-d.ts` ve `npm run test:types` güncellenir.

### Doğrulama (Opus kapısı)
Docker `postgres:16` üzerinde sırasıyla:
1. **canlı şemanın kopyası** (bugünkü `schema.sql` @ `main`),
2. yeni `schema.sql`,
3. yeni `schema.sql` **bir kez daha**.

Trigger için iki durum denenir: false→true, `completed_at` dolu; true→false, null. `portal_set_task_completed` çağrısı sonrası da `completed_at` doluyor olmalı. Kullanıcı SQL Editor'de çalıştırır.

## 2. Ekranlar

### 2.1 Program: görev türü, kaynak, sonuç (C3, koç tarafı)
- Görev ekleme/düzenleme formu:
  - **Tür** bölmeli düğme: Konu · Tekrar · Rutin · Süreli test · Deneme. Varsayılan Konu.
  - **Kaynak** metin alanı. Öğrencinin son kullandığı 5 kaynak öneri olarak çıkar (`distinct source` sorgusu, istemcide).
- Görev kartı:
  - Tamamlanan görevde küçük **"Sonuç gir"** bağlantısı açılır. Doğru/Yanlış/Boş alanları, Kaydet.
  - Girilince kartta `27D · 9Y · 4B · %68` satırı görünür.
  - Boş geçmek serbest. Rapor "sonuç girilmedi" diye ayrı sayar.
- Türün kartta küçük bir çipi olur. `tekrar` ve `sureli_test` görsel olarak ayrışır.

### 2.2 Öğrenci: hedef net
- Öğrenci düzenleme modalında **Hedef net** alanları. Müfredata göre görünür (`gradeCurriculum()`): YKS ⇒ TYT + (Alan varsa) AYT, LGS ⇒ LGS.
- Profil başlığı: "Son TYT 95,00 · Hedef 105 · kalan 10,0". Sınav tarihi varsa "34 hafta · haftada +0,29 gerekli". Hedef yoksa "Hedef belirle" bağlantısı.

### 2.3 Sınav tarihleri
- Sistem yöneticisi için `/yonetim/kurumlar` sayfasının altında küçük bir "Sınav tarihleri" kartı (iki tarih alanı).
- Başka yerde düzenleme yok.

### 2.4 "Programa ekle" penceresi (C2), ortak bileşen
`src/components/program/AddToProgramPopover.tsx`
- **Girdi:** `studentId`, opsiyonel `examTopicId` ya da `topicId`, `originKind`, önerilen tür.
- **Alanlar:**
  - Bağlanacak müfredat konusu. `exam_topic_links`'ten gelir, **birincil seçili**.
  - Gün seçimi (çoklu; her gün = bir görev).
  - Soru/oturum.
  - Kaynak.
  - Tür.
  - Hafta: bu hafta / gelecek hafta.
- **Alt satır:** "Bu hafta <konu>'ya toplam N soru ekleniyor".
- **Yazma:**
  - `weekly_tasks` toplu insert. **Tüm satırlara aynı alanlar yazılır** (supabase-js null tuzağı).
  - `origin_kind`/`origin_exam_topic_id` doldurulur.
- **Giriş noktaları (R1'de üç):**
  1. Deneme analizi konu tablosu (K4): her zayıf satır.
  2. Konu Yeterlilik Haritası: kritik/gelişiyor satırı.
  3. "Görüşmede konuşulacaklar" maddeleri (2.5).

### 2.5 "Görüşmede konuşulacaklar" (B1)
- **Saf motor:** `src/lib/talkingPoints.ts`. `buildTalkingPoints(input) → TalkingPoint[]`.
  - `TalkingPoint = { kind, severity, text, action? }`.
  - Self-test: `scripts/talkingPoints.selftest.ts` + `npm run test:talking-points`.
- **Kurallar** (en fazla 5 madde, en az 1 olumlu; olumlu yoksa "veri az" notu):
  - **KRİTİK:**
    - Konu: son 4 denemede birikimli başarı < %50 ve en az 8 soru ölçülmüş.
    - Ya da `coach_decisions.state = 'kritik'`.
    - Metin: "Problemler: 4 denemede 52 sorudan 25 doğru (%48)".
    - Aksiyon: Programa ekle.
  - **ÖDEV:**
    - Bu haftanın tamamlama oranı < %70, hafta yarılanmışsa.
    - Bitmeyenlerin yoğunlaştığı günler gösterilir (`day_index`).
    - Aksiyon: Programı aç.
  - **TUTARSIZLIK:**
    - Aynı müfredat konusunda görev doğruluğu (D/(D+Y+B), son 4 hafta, ≥20 soru) − deneme başarısı ≥ 20 puan.
    - Aksiyon: Süreli test ekle (`task_type = sureli_test`).
    - *Sonuç verisi birikene kadar seyrek çıkar; bu beklenen davranış.*
  - **TEKRAR:**
    - Son ölçümü yeterli (≥ %75) olan bir konuya 4+ haftadır görev verilmemiş.
    - Aksiyon: Tekrar ekle.
  - **İLERLEME:**
    - Bir ders son 3 denemede monoton artış gösteriyor.
    - Ya da bir konu kritik/gelişiyor → yeterli olmuş.
    - Aksiyon yok.
- **Yer:**
  - Haftalık Görüşme sayfasında (`/raporlar`) seçili öğrencinin üstünde bir kart.
  - Öğrenci profilinde "Özet" sekmesinin başında aynı kart.
- **Dil:** Raporlar 2.0 rozetleri (KRİTİK / ÖDEV / TUTARSIZLIK / TEKRAR / İLERLEME). Satır sonunda aksiyon düğmesi var.

## 3. Kapsam dışı (R2+)
- Grafikler (B2–B7): hedef yolu, öncelik matrisi, Pareto, hata profili, tutarlılık, müfredat ilerlemesi.
- Konu ağırlığı.
- Öneri listesi (R3-A) ve haftalık taslak (R3-B).
- Tekrar zamanı tablosu (B8), müdahale etkisi (B9).
- Öğrenci "Haftam", veli haftalık özeti.

## 4. İş paketleri (agy; her paketten sonra Opus kontrolü)

| Paket | Ne | Bağımlılık | Tahmin |
|---|---|---|---|
| **R1-1** | Şema (1.1–1.3) + tipler + test:types. Docker'da 3 aşamalı doğrulama raporu. **SQL'i kullanıcı çalıştırır.** | — | 2 sa |
| **R1-2** | Program: tür, kaynak, koç sonuç girişi, kart gösterimi | R1-1 canlıda | 3 sa |
| **R1-3** | Hedef net (modal + profil başlığı) + sınav tarihleri kartı | R1-1 canlıda | 2 sa |
| **R1-4** | `AddToProgramPopover` + 2 giriş noktası (deneme analizi, konu haritası) | R1-1 canlıda | 3 sa |
| **R1-5** | `talkingPoints` motoru + self-test + kart (Haftalık Görüşme + profil) + 3. giriş noktası | R1-4 | 3 sa |
| **R1-6** | Yardım kartları + Sürüm Geçmişi notu | R1-2…R1-5 | 1 sa |

Her paket kabulü: `npm run build`, `npm run test:types`, `npm run lint` (yeni uyarı yok), ilgili self-test. Ek olarak canlıda Opus'un tıklayarak doğrulaması: yalnız onaylı test öğrencisi (Test Test), değerler önceden bildirilir, bitince silinir.

## 5. Açık sorular (kullanıcıya sabah)
- Yok. Kararlar 1–3 verildi.
- Sınav tarihleri ulusal veri olarak tek yerde tutulacak (Opus kararı). Kurum bazlı farklı tarih gerekirse söylenmeli.
