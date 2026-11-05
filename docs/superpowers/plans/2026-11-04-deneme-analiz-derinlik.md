# Deneme Analizi Derinlemesine İniş — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deneme analizini Genel → Deneme → Ders → Karne konusu → Müfredat konusu seviyelerinde tıklayarak inilen grafiklere çevirmek. Koç, öğrenci ve veli aynı zinciri görür. Mevcut ekrandaki hiçbir bilgi kaybolmaz.

**Architecture:** Mevcut `generateExamReport` çıktısı (her ders ve konu için deneme başına hücreler) tek veri kaynağıdır. Yeni saf modül `examDrilldown.ts` bu çıktıdan deneme dökümünü, grup netlerini, "son 3"/eğilim değerlerini ve müfredat serilerini türetir. `StudentExamAnalysisView` bir kabuğa dönüşür: veriyi yükler, sınav türünü ve seviye durumunu tutar, seviyeleri `src/components/exams/drilldown/` altındaki bileşenlere çizdirir. Portal verisi tek RPC'den gelir (`portal_exam_report` genişler).

**Tech Stack:** React 19 + TypeScript + Vite, Supabase (PostgREST + plpgsql RPC), el yazımı SVG grafikleri (kütüphane yok), `tsx` ile assert tabanlı öz-testler.

**Spec:** `docs/superpowers/specs/2026-11-04-deneme-analiz-derinlik-design.md`. Davranış ve metin referansı: `docs/superpowers/specs/2026-11-04-deneme-analiz-taslak.html` (tarayıcıda aç; verisi uydurma).

## Global Constraints

- Tüm UI metni Türkçe. LGS katsayılı toplam için "puan" denmez.
- Yeni npm bağımlılığı yok. Tailwind yok (utility sınıfları çalışmaz).
- Var olmayan CSS token kullanma: `--accent`, `--surface-elevated`, `--ink-muted`, `--indigo-50`, `--indigo-100`, `--surface-sunken`, `--border-subtle` YOK. Var olanlar: `--ink`, `--ink-soft`, `--ink-faint`, `--surface`, `--surface-alt`, `--border`, `--border-soft`, `--indigo-600`, `--indigo-050`, `--success*`, `--warning*`, `--critical*`, `--measured*`, `--c-turkce`, `--c-math`, `--c-fen`, `--c-sosyal`, `--on-primary`.
- Portal (öğrenci/veli) yolunda `supabase.from(...)` YASAK. Veri yalnız `initialCatalog`/`initialExams` ile gelir.
- Portal grafik renkleri `PORTAL_STUDENT_PALETTE` / `PORTAL_PARENT_PALETTE` sabit hex'leriyle (portal zemini sabit açık).
- Bantlar: `getMasteryBand` (≥75 good "Yeterli", ≥50 medium "Gelişiyor", altı weak "Kritik"). Hücrede renk + sayı birlikte (renk tek başına bilgi taşımaz).
- Ders grubu renk sırası: Türkçe `--c-turkce`, Sosyal `--c-sosyal`, Matematik `--c-math`, Fen `--c-fen`. Fen ile Sosyal yan yana konmaz.
- Ders değeri konu toplamından türetilmez ve ezilmez. Konu girilmemiş denemede konu değeri `null` (çizgi kopar, "konu girilmedi"). 0 gösterilmez.
- 1→N eşlemede deneme sonucu yalnız `is_primary` müfredat konusuna yansır.
- "Son 3" = konu verisi girilmiş son 3 denemenin Σdoğru/Σsoru'su. Σsoru < 3 ⇒ `az_veri`. Eğilim = son 3 Σ başarı − öncekilerin Σ başarısı. 4'ten az ölçümde `null`.
- Ders adı listesi koda gömülmez; gruplama `exam_subject_id` / `section_name` üzerinden.
- Netler `formatNetTr` ile gösterilir (en fazla 2 hane, sondaki sıfır yok) — `src/lib/homeSummaryCore.ts`'te var, yeniden yazma.
- Teslim kapısı (her görev): `npm run build`, `npm run test:types`, `npm run test:exam-report`, `npm run test:exam-drilldown` (Görev 1'den sonra), `npm run lint` uyarı sayısı artmaz (şu an 28).
- Seed script'lerini ÇALIŞTIRMA (`.env.local`'i kendileri okuyup canlıya bağlanıyorlar).

## Review Focus

1. **Konu detayı hiç girilmemiş öğrenci** (yalnız ders sonuçları): Karne konusu ve Müfredat seviyeleri çökmeden boş durum gösterir; Genel'deki konu kayıp listesi "Konu detayı girilmiş deneme yok" der. → Görev 1 testi `curriculumSeries` boş giriş; Görev 6 boş durum.
2. **Tek deneme**: Deneme seviyesinde "önceki deneme yok" metni, Genel çizgisi mevcut `< 3` eşiğinde mesaj, eğilim `null`. → Görev 1 `examDetail` ilk deneme testi.
3. **SQL henüz canlıda çalışmamışken portal**: `catalog.links` yok ⇒ müfredat kartı "Bağlantı bilgisi yok" der, sayfa çökmez. → Görev 4 adımı.
4. **LGS öğrencisi**: grup sütunlarında LGS `section_name`'leri çıkar, ceza 3, "puan" kelimesi yok, hedef `target_net_lgs`. → Görev 1 LGS testi; Görev 5 metin denetimi.
5. **Dar ekran (≈360–400px)**: grafikler taşmaz, ısı tabloları kendi kabında yatay kayar, kırıntı satır kırar. → Görev 3 `ResizeObserver`; Görev 5/6 kabul kontrolü.

---

### Task 1: Saf iniş motoru (`examDrilldown.ts`) + katalog tipleri + öz-test

**Files:**
- Modify: `src/lib/examReport.ts` (yalnız `ExamReportCatalog` tipine isteğe bağlı alanlar + yeni tipler)
- Create: `src/lib/examDrilldown.ts`
- Create: `scripts/examDrilldown.selftest.ts`
- Modify: `package.json` (script `"test:exam-drilldown": "tsx scripts/examDrilldown.selftest.ts"`)

**Interfaces:**
- Produces (in `examReport.ts`):
  ```ts
  export type ExamTopicLinkInfo = { exam_topic_id: number; topic_id: number; is_primary: boolean }
  export type CurriculumTopicInfo = { id: number; name: string; subject_name: string }
  export type HomeworkItem = { topic_id: number; date: string; label: string; question_count: number;
    correct_count: number | null; wrong_count: number | null; blank_count: number | null;
    accuracy_pct: number; kind: 'odev' | 'konu_testi' }
  // ExamReportCatalog'a eklenir (hepsi isteğe bağlı):
  links?: ExamTopicLinkInfo[]; curriculumTopics?: CurriculumTopicInfo[]; homework?: HomeworkItem[]
  ```
- Produces (in `examDrilldown.ts`):
  ```ts
  export type RecentStat = { acc: number | null; band: MasteryBand | 'az_veri'; questions: number }
  export function recentStat(cells: Array<Pick<TopicCell,'entered'|'question_count'|'correct_count'>>): RecentStat
  export function trendPoints(cells: Array<Pick<TopicCell,'entered'|'question_count'|'correct_count'>>): number | null
  export type ExamDetail = {
    exam_id: string; index: number; prev_exam_id: string | null; hasTopics: boolean
    subjectDeltas: Array<{ exam_subject_id: number; label: string; delta: number | null }>
    subjectDyb: Array<{ exam_subject_id: number; label: string; question_count: number; correct: number; wrong: number; blank: number; net: number }>
    topicLosses: Array<{ exam_topic_id: number; exam_subject_id: number; name: string; subject_label: string; loss_net: number; accuracy_pct: number | null }>
  }
  export function examDetail(report: ExamReportResult, examId: string): ExamDetail | null
  export function groupNetsByExam(report: ExamReportResult): Array<{ exam_id: string; groups: Array<{ section_name: string; net: number }> }>
  export type CurriculumPoint = { exam_id: string; exam_date: string; exam_name: string; question_count: number; correct: number; accuracy_pct: number } | null
  export function curriculumSeries(report: ExamReportResult, links: ExamTopicLinkInfo[], topicId: number): CurriculumPoint[]
  export function curriculumFeeders(links: ExamTopicLinkInfo[], topicId: number): { primary: number[]; linked: number[] }
  export function homeworkPoints(homework: HomeworkItem[] | undefined, topicId: number): HomeworkItem[]   // tarih artan
  export function allTopicLosses(report: ExamReportResult, examSubjectId: number | 'ALL', limit?: number): ExamReportResult['all_top_loss_topics']
  ```

- [ ] **Step 1: Write the failing test** `scripts/examDrilldown.selftest.ts` (kalıp: `scripts/examReport.selftest.ts` — `node:assert/strict`, `console.log('✓ …')`, sonda özet). Test verisi: el ile kurulmuş küçük `ExamReportCatalog` (2 alt ders: "Türkçe" 40 soru section "Türkçe", "Matematik-1" 30 soru section "Matematik"; Türkçe'de 3 konu: Paragrafın Yapısı (id 1), Anlatım Teknikleri (id 2), Paragraf Yorumu (id 3)) ve 5 TYT `RawExamRecord`; 3. deneme yalnız `subject_results` taşır, `topic_results` boş. `generateExamReport(raw, catalog, 'TYT')` ile rapor üret. Assertion'lar:
  - `recentStat` girilmiş son 3 hücrenin Σ'sini kullanır: hücreler (girilen) [4/2, 4/3, 0-girilmemiş, 4/4, 4/1] → son 3 = 3+4+1 / 12 → `acc` 66.67 (±0.01), `band 'medium'`, `questions 12`.
  - `recentStat` Σsoru 2 ⇒ `band 'az_veri'`; hiç girilmemiş ⇒ `acc null`, `band 'none'`, `questions 0`.
  - `trendPoints` 3 ölçümde `null`; 4 ölçümde [2/4,3/4,4/4,1/4] → son3 (8/12=66.67) − önceki (2/4=50) = 16.67.
  - `examDetail(report, exam1Id).subjectDeltas` hepsi `delta === null`; `prev_exam_id === null`.
  - `examDetail(report, exam3Id).hasTopics === false` ve `topicLosses.length === 0`; `subjectDeltas[Türkçe].delta` = net3 − net2 (ders sonuçlarından).
  - `examDetail(report, exam4Id).prev_exam_id === exam3Id` (önceki deneme konu girilmemiş olsa da ders değişimi ona göre).
  - `topicLosses` azalan `loss_net`, en fazla 8.
  - `groupNetsByExam` deneme başına `section_name` grupları (Türkçe, Matematik) ve net toplamları ders netlerinin toplamına eşit.
  - Links: TR konu 1,2,3 → müfredat 100 birincil; konu 1 ayrıca 101'e bağlı (birincil değil). `curriculumFeeders(links,100)` → `{primary:[1,2,3], linked:[]}`; `curriculumFeeders(links,101)` → `{primary:[], linked:[1]}`.
  - `curriculumSeries(report, links, 100)` uzunluğu deneme sayısı; 3. eleman `null`; diğerleri Σ(birincil konu doğru)/Σ(soru). `curriculumSeries(report, links, 101)` her eleman `null` (birincil değil ⇒ yansımaz).
  - `curriculumSeries(report, [], 100)` her eleman `null`, çökmez.
  - `homeworkPoints` yalnız ilgili `topic_id`, tarih artan; `undefined` girişte `[]`.
  - `allTopicLosses(report,'ALL',10)` mevcut `report.all_top_loss_topics` sırasıyla aynı ilk elemanı verir; ders filtresiyle yalnız o derse ait konular.
  - LGS: 1 LGS denemesi (ceza 3) ile `groupNetsByExam` net = D − Y/3.

- [ ] **Step 2: Run** `npm run test:exam-drilldown` → FAIL (modül yok).
- [ ] **Step 3: Implement** tipleri `examReport.ts`'e, fonksiyonları `examDrilldown.ts`'e ekle. Rapordaki hücreler `general.time_series` sırasıyla hizalı; deneme kimliği `cells[i].exam_id`. `recentStat` bandı `getMasteryBand` ile. Yeni hesap formülü yazma: `calcNet`, `calcLossNet`, `calcTopicAccuracy`, `round2` kullan.
- [ ] **Step 4: Run** `npm run test:exam-drilldown` → PASS; `npm run test:exam-report` → PASS; `npm run build` → hatasız.
- [ ] **Step 5: Commit** `feat(deneme): inis motoru examDrilldown + oz-test`

---

### Task 2: Portal RPC genişlemesi (SQL) + portal istemcisi

**Files:**
- Modify: `supabase/schema.sql` (`portal_exam_report`, ≈ satır 1705–1819, yerinde)
- Create: `supabase/2026-11-04-portal-exam-report-derinlik.sql` (yalnız `create or replace function portal_exam_report` + revoke/grant; başında tek satır Türkçe açıklama, `supabase/2026-11-02-portal-dashboard-fix.sql` kalıbı)
- Modify: `supabase/test/portal_test.sql`
- Modify: `src/lib/portal.ts` (`portalExamReport`, `PortalExamReportData`)

**Interfaces:**
- Consumes: Task 1 tipleri (`ExamTopicLinkInfo`, `CurriculumTopicInfo`, `HomeworkItem`).
- Produces: RPC çıktısında `catalog.links`, `catalog.curriculum_topics`, `catalog.homework`, `student.target_net_tyt|ayt|lgs`. İstemcide `PortalExamReportData = { role; student: PortalStudent & { target_net_tyt: number|null; target_net_ayt: number|null; target_net_lgs: number|null }; catalog: ExamReportCatalog (links/curriculumTopics/homework dolu ya da undefined); exams }`. `curriculum_topics` → `curriculumTopics` eşlemesi `portal.ts`'te yapılır.

SQL kuralları:
- `links`: `exam_topic_links` ⋈ `exam_topics where is_active` — `exam_topic_id, topic_id, is_primary`.
- `curriculum_topics`: links'teki bütün `topic_id`'ler için `t.id, t.name, s.name as subject_name` (`topics t join subjects s on s.id = t.subject_id`). Tekilleştirme `where t.id in (select topic_id …)` ile; **`json_agg(distinct …)` kullanma.**
- `homework`: iki kaynağın `union all`'ı, `order by date desc limit 300`, `date >= current_date - 365`:
  - ödev: `weekly_tasks where student_id = v_student_id and block_kind = 'ders' and topic_id is not null and correct_count is not null and question_count > 0` → `date = week_start + day_index`, `label = coalesce(nullif(custom_label,''), <topics.name> || ' · ' || question_count || ' soru')`, `accuracy_pct = round(correct_count*100.0/question_count, 1)`, `kind 'odev'`.
  - konu testi: `topic_measurements where student_id = v_student_id and source = 'konu_testi'` → `date = measured_at`, `label = source_label`, `question_count = coalesce(correct_count,0)+coalesce(wrong_count,0)+coalesce(blank_count,0)`, `kind 'konu_testi'`.
- `student` nesnesine `target_net_tyt, target_net_ayt, target_net_lgs`.
- `revoke all on function portal_exam_report(text) from public, anon, authenticated; grant execute … to anon, authenticated;` korunur.

- [ ] **Step 1: Write the failing test** — `portal_test.sql`'e veri ekle (rol değişiminden önce): bir `exam_subjects` + iki `exam_topics` (aktif), `exam_topic_links` (konu A → `v_topic` birincil; konu B → `v_topic` birincil değil), bir `mock_exam_topic_results`, öğrenciye `target_net_tyt = 90`, bir `topic_measurements (source 'konu_testi', accuracy_pct 70, measured_at current_date)`. Mevcut iki `weekly_tasks` satırı `correct_count` taşıyor ve `block_kind` varsayılanı 'ders'. `portal_exam_report` döngüsünde assert'ler:
  - `json_array_length(v_res->'catalog'->'links') = 2`
  - `json_array_length(v_res->'catalog'->'curriculum_topics') = 1` ve `->0->>'name' = 'Portal Konusu'`
  - `json_array_length(v_res->'catalog'->'homework') = 3` (2 ödev + 1 test)
  - `(v_res->'student'->>'target_net_tyt')::numeric = 90`
- [ ] **Step 2: Run** `npm run verify:schema` → FAIL (anahtarlar yok).
- [ ] **Step 3: Implement** RPC'yi `schema.sql`'de değiştir; aynı fonksiyonu patch dosyasına kopyala.
- [ ] **Step 4: Run** `npm run verify:schema` → PASS (şema iki kez + portal testi). Ardından eski şema → yeni şema testi: `git show main:supabase/schema.sql > /tmp/.../eski.sql`, Docker'da önce `stub.sql` + `eski.sql`, sonra patch dosyası, sonra patch bir kez daha, sonra `portal_test.sql` → hatasız (komutlar `scripts/verifySchema.sh` içindeki `docker exec … psql` kalıbıyla). Çıktıyı commit mesajına özetle.
- [ ] **Step 5: Implement** `portal.ts` eşlemesi: `catalog: { ...res.catalog, curriculumTopics: res.catalog.curriculum_topics }`; alanlar yoksa `undefined` kalır.
- [ ] **Step 6: Run** `npm run build`, `npm run test:types` → PASS.
- [ ] **Step 7: Commit** `feat(portal): portal_exam_report baglar, odev ve hedef net`

---

### Task 3: Grafik bileşenleri

**Files:**
- Modify: `src/components/charts/chartPalette.ts`
- Modify: `src/components/charts/ExamLineChart.tsx`
- Create: `src/components/charts/StackedColumnChart.tsx`
- Create: `src/components/charts/DivergingBarList.tsx`
- Modify: `src/components/charts/LossBarChart.tsx`
- Create: `src/components/charts/useElementWidth.ts`

**Interfaces:**
- Produces:
  ```ts
  // chartPalette.ts — ChartPalette'e eklenir:
  blank: string                       // DEFAULT 'var(--measured)', portal '#A6A3BB'
  bandBg: { good: string; medium: string; weak: string }   // DEFAULT var(--success-bg)/…; portal sabit hex (tokens.css açık tema)
  groups: string[]                    // sıra: Türkçe, Sosyal, Matematik, Fen → DEFAULT ['var(--c-turkce)','var(--c-sosyal)','var(--c-math)','var(--c-fen)'], portal ['#D6495A','#E2932E','#3B6FE0','#2E9F63']
  export function groupColor(pal: ChartPalette, sectionName: string, index: number): string
  // ExamLineChart: mevcut props aynen + hepsi isteğe bağlı:
  values: Array<number|null> ve ExamLinePoint.value: number | null
  yMin?: number; yMax?: number; ticks?: number[]; tickFormat?: (v:number)=>string
  bands?: boolean; refs?: Array<{ value: number; label: string }>
  highlightIndex?: number | null; onPointClick?: (index: number) => void
  secondSeries?: { label: string; values: Array<number|null>; color?: string }   // kare işaret
  connectNulls?: boolean; minPoints?: number   // varsayılan 3 (mevcut davranış)
  tooltip?: (index: number) => React.ReactNode
  // StackedColumnChart
  export interface StackedColumn { label: string; subLabel?: string; parts: Array<{ value: number; color: string; name: string }> | null; topLabel?: string }
  props: { columns: StackedColumn[]; yMax: number; ticks?: number[]; height?: number; highlightIndex?: number|null; onColumnClick?: (i:number)=>void; tooltip?: (i:number)=>React.ReactNode; palette?: Partial<ChartPalette>; ariaLabel: string }
  // DivergingBarList
  props: { items: Array<{ key: string|number; label: string; value: number|null }>; onItemClick?: (key)=>void; emptyText: string; palette?: Partial<ChartPalette> }
  // LossBarChart: isteğe bağlı onItemClick?: (index: number) => void — verilirse satırlar <button>
  // useElementWidth
  export function useElementWidth<T extends HTMLElement>(): [React.RefObject<T|null>, number]   // ResizeObserver
  ```
Davranış referansı: taslaktaki `lineChart` ve `stackCols` fonksiyonları (bant dolguları, vurgulu sütun zemini, x etiketi geniş ekranda iki satır / dar ekranda seyreltilmiş, crosshair, `null` = "yok"/"konu girilmedi"). İşaretler: 2px çizgi, 4px nokta (vurgulu 5.5), son nokta dolu; segmentler arası 2px boşluk; değer etiketi yalnız son ve vurgulu sütunda.

- [ ] **Step 1:** `chartPalette.ts` alanları + `groupColor` (bilinmeyen `section_name` ⇒ `groups[index % 4]`; eşleme `Türkçe→0, Sosyal→1, Matematik→2, Fen→3`, büyük/küçük harf ve "Bilimleri" eki duyarsız). Mevcut iki portal paletine yeni alanlar.
- [ ] **Step 2:** `useElementWidth` ve `ExamLineChart` genişlemesi. Mevcut çağrı (`StudentExamAnalysisView` Genel çizgisi) hiçbir yeni prop vermeden önceki gibi çizmeli.
- [ ] **Step 3:** `StackedColumnChart`, `DivergingBarList` (sağa yeşil/sola kırmızı, değer metni mürekkep renginde, `+`/`−` işaretli, `formatNetTr`), `LossBarChart.onItemClick`.
- [ ] **Step 4: Run** `npm run build`, `npm run lint` → hatasız, uyarı sayısı ≤ 28.
- [ ] **Step 5: Commit** `feat(grafik): cizgi grafigi bant/vurgu/ikinci seri, yigilmis sutun, sapmali liste`

---

### Task 4: Veri yükleme kabuğu (koç + portal)

**Files:**
- Modify: `src/components/exams/StudentExamAnalysisView.tsx` (yalnız veri yükleme ve proplar; görünüm Task 5'te)
- Modify: `src/pages/mobile/OgrenciPortalPage.tsx`, `src/pages/mobile/VeliPortalPage.tsx` (yeni `targets` propu)

**Interfaces:**
- Consumes: Task 1 tipleri, Task 2 `PortalExamReportData.student.target_net_*`.
- Produces: bileşen içinde `catalog: ExamReportCatalog` (links / curriculumTopics / homework dolu ya da undefined), `targets: { TYT: number|null; AYT: number|null; LGS: number|null }`, `errorBasketItems` (yalnız koç). Yeni prop: `targets?: { TYT?: number|null; AYT?: number|null; LGS?: number|null }`.

- [ ] **Step 1:** Portal dalından (`initialCatalog && initialExams`) bütün `supabase.from` çağrılarını kaldır. `topicLinks`/`topicNames` durumlarını sil; birincil eşleme `catalog.links` üzerinden. `topicNames` (adla bulanık eşleme) kalmaz.
- [ ] **Step 2:** Koç dalı `loadData`'ya ekle: `exam_topic_links` (tümü), bağlardaki topic id'ler için `topics(id,name,subject_id)` + `subjects(id,name)`, `students(target_net_tyt,target_net_ayt,target_net_lgs)` (`eq id`), ödev ve konu testi (Task 2'deki SQL kurallarının aynısı, PostgREST ile: `weekly_tasks` `.eq('block_kind','ders').not('topic_id','is',null).not('correct_count','is',null).gt('question_count',0).gte('week_start', <365 gün önce>)`, tarih `week_start + day_index` istemcide; `topic_measurements` `.eq('source','konu_testi')`; ikisi birleşik tarih azalan ilk 300). 1000 satır sınırı: links ≈ 406 satır, şimdilik tek sorgu yeterli ama `.range(0, 1999)` ver.
- [ ] **Step 3:** Portal sayfaları `targets={{ TYT: d.student.target_net_tyt, AYT: …, LGS: … }}` geçer.
- [ ] **Step 4:** Koşullu davranış: `catalog.links` undefined ⇒ müfredat ile ilgili her şey "Bağlantı bilgisi yok" boş durumuna düşecek (Task 6 kullanır); bu görevde yalnız veri `undefined` olarak akar, hata fırlatılmaz.
- [ ] **Step 5: Run** `npm run build`, `npm run test:types`, `npm run lint`.
- [ ] **Step 6: Commit** `refactor(deneme): analiz verisi baglar, odev ve hedefle yuklenir; portalda tablo sorgusu yok`

---

### Task 5: İniş kabuğu + Genel ve Deneme seviyeleri

**Files:**
- Create: `src/components/exams/drilldown/types.ts` — `DrillState = { level: 'general'|'exam'|'subject'|'topic'|'curriculum'; examId: string|null; examSubjectId: number|null; examTopicId: number|null; curriculumTopicId: number|null }`, `DrillRole = 'coach'|'student'|'parent'`, `DrillProps` (report, catalog, role, palette, targets, state, go(patch), ve koç işlemleri için `onAddToProgram(examTopicId, name)`, `onErrorReason(row)`)
- Create: `src/components/exams/drilldown/DrillNav.tsx` (seviye göstergesi 1·Genel … 5·Müfredat + kırıntı; son öğe tıklanmaz; değişimde kırıntıya `scrollIntoView({block:'nearest'})`)
- Create: `src/components/exams/drilldown/LevelHeader.tsx` (özet cümlesi + "Nasıl hesaplandı?" düğmesi + formül kutusu; formül metni taslaktaki `FORMULA` ile aynı, LGS cezası 3 dahil)
- Create: `src/components/exams/drilldown/copy.ts` (`roleText(role, {coach, student, parent})`, veli açıklama metinleri — taslaktaki `explain(...)` cümleleri birebir)
- Create: `src/components/exams/drilldown/LevelGeneral.tsx`
- Create: `src/components/exams/drilldown/LevelExam.tsx`
- Modify: `src/components/exams/StudentExamAnalysisView.tsx` (Genel/Ders/Konu sekme düğmeleri ve üç seviye JSX'i kaldırılır; yerine DrillNav + seviye anahtarı; sınav türü seçici kalır, tür değişince `level='general'`)

**Interfaces:**
- Consumes: Task 1 (`examDetail`, `groupNetsByExam`, `recentStat`, `allTopicLosses`), Task 3 bileşenleri, Task 4 verisi.
- Produces: `DrillState`, `go`, `DrillProps` (Task 6 aynı tipleri kullanır).

İçerik (spec §3b, §4.1, §4.2; taslak sürüm 2):
- Genel: özet cümlesi `report.general.headline`; özet kutuları (son net, ortalama, ilk→son, hedef yalnız `targets[exam_type] != null`); son deneme tek satırı (puan / yüzdelik / kurum sırası / koç notu — yalnız dolu olanlar); toplam net kartı Grafik/Tablo geçişli (tablo satırı → Deneme); "Net hangi dersten geliyor" yığılmış sütun (lejant, `groupColor`); "Derslerin gelişimi" Kartlar/Isı tablosu geçişi (kart: son net/soru, `recentStat` rozeti, ilk 2→son 2 başarı farkı oku, 0..soru ölçekli `Sparkline`; ısı tablosu = mevcut Ders Isı Tablosu, hücre → Ders + vurgu); "Tüm denemelerde en çok net kaybettiren konular" ders filtre çipleriyle (`allTopicLosses`, ilk 10); içgörüler (`formatRoleInsights()[role]`, mevcut kart).
- Deneme: başlık + önceki/sonraki; özet (net, önceki denemeye göre fark, başarı, D/Y/B); "Karne bilgileri" kartı (puan, yüzdelik, `ranks` her anahtar, koç notu — boş alan gösterilmez, hepsi boşsa kart yok); `DivergingBarList` (ilk denemede `emptyText`); ders D/Y/B mevcut `StackedBarChart` (tıklanabilir); konu kayıpları `LossBarChart` + `onItemClick` (konu girilmemişse spec'teki boş durum metni). Özet cümlesi: "Önceki denemeye göre ±X net; en çok artış A (+a), en çok düşüş B (−b)."

- [ ] **Step 1:** Kabuk + DrillNav + LevelHeader + copy; Genel ve Deneme bileşenleri. Ders/Konu/Müfredat seviyeleri bu görevde geçici olarak "Yakında" yerine **eski Ders ve Konu JSX'ini** gösterir (Task 6 değiştirir) — böylece görev sonunda bilgi kaybı olmaz.
- [ ] **Step 2: Run** `npm run build`, `npm run test:types`, `npm run test:exam-report`, `npm run test:exam-drilldown`, `npm run lint`.
- [ ] **Step 3: Görsel kontrol (Opus yapar, implementer değil)** — giriş bilgisi gerektiği için Opus tarayıcıda Test YKS üzerinde Genel → Deneme → kırıntıyla geri; ısı tablosu ve konu kaybı listesi; 400px'te yatay kaydırma yok.
- [ ] **Step 4: Commit** `feat(deneme): inis kabugu, Genel ve Deneme seviyeleri`

---

### Task 6: Ders, Karne konusu ve Müfredat seviyeleri

**Files:**
- Create: `src/components/exams/drilldown/LevelSubject.tsx`
- Create: `src/components/exams/drilldown/LevelTopic.tsx`
- Create: `src/components/exams/drilldown/LevelCurriculum.tsx`
- Modify: `src/components/exams/StudentExamAnalysisView.tsx` (eski Ders/Konu JSX'i ve kullanılmayan durumlar silinir; `AddToProgramPopover` ve `ErrorReasonModal` kabukta kalır, seviyeler `onAddToProgram`/`onErrorReason` ile açar)

**Interfaces:**
- Consumes: Task 1 (`recentStat`, `trendPoints`, `curriculumSeries`, `curriculumFeeders`, `homeworkPoints`), Task 3, Task 5 `DrillProps`.

İçerik (spec §4.3–4.5, taslak):
- Ders: özet cümlesi (mevcut `report.subjects.top_loss_headline` / `topicsBySubject[id].headline` önce; yoksa "En zayıf konu …"); özet kutuları; Net / Başarı % geçişli `ExamLineChart` (başarıda `bands`), noktaya tık = deneme vurgula/kaldır; D/Y/B `StackedColumnChart`; konu × deneme tablosu (hücre = başarı %, `title` D/Y/B; sütunlar Soru, Son 3, Eğilim `Sparkline`, Durum rozeti; sıralama Karne sırası / En zayıf / En çok düşen; satır → Konu, hücre → Konu + vurgu; koçta satırda "Programa ekle" ve "Neden ekle/düzenle" düğmeleri mevcut koşullarıyla); dersin birikimli konu kaybı listesi.
- Karne konusu: özet cümlesi; özet kutuları (`recentStat`, `trendPoints`, toplam D/Y/B, ölçülen deneme sayısı); soru sayısı ≤ 1 uyarısı (taslak metni); bantlı başarı çizgisi (`null` = "konu girilmedi"); D/Y/B sütunları; "Müfredatta karşılığı" (`catalog.links` ile: birincil "Birincil · deneme sonucu buraya yansır" + `recentStat` rozeti; diğerleri "Bağlı · sonuç yansımaz"; `links` undefined ⇒ "Bağlantı bilgisi yok"); koçta Programa ekle + Neden; öğrenci/veli duruma göre tek paragraf.
- Müfredat konusu: başlık (`curriculumTopics` adı + `subject_name`), rozet; tarih sıralı tek eksende deneme (daire) + ödev/test (kare, `secondSeries`, `connectNulls`); ödev yoksa açıklama; besleyen karne konuları (birincil) son 3 çubukla + bağlı olanlar; rol cümlesi (taslak metinleri).

- [ ] **Step 1:** Üç seviye bileşeni + kabuk temizliği.
- [ ] **Step 2: Run** `npm run build`, `npm run test:types`, `npm run test:exam-report`, `npm run test:exam-drilldown`, `npm run lint`.
- [ ] **Step 3: Görsel kontrol (Opus yapar)** — Test YKS: Genel → Türkçe → Paragraf Yorumu → Paragraf; Programa ekle penceresi açılır (kaydetmeden); 400px; spec §3b listesi tek tek.
- [ ] **Step 4: Commit** `feat(deneme): Ders, Karne konusu ve Mufredat seviyeleri`

---

### Task 7: Belgeler

**Files:**
- Modify: `src/components/help/VersionHistory.tsx` (v0.33: "Deneme analizi derinlemesine: tıklayarak deneme, ders, konu ve müfredat konusuna inme; ödev sonuçları denemeyle yan yana; öğrenci ve veli portalında da." — kullanıcı "modal" bilmiyor, "pencere" de)
- Modify: `src/pages/YardimPage.tsx` (Deneme analizi bölümüne iniş zinciri paragrafı)
- Modify: `coordination.md` (günlük satırı), `CLAUDE.md` ("Deneme Karnesi" maddesinin sonuna tek cümle + "Sürüm Geçmişi … v0.33'e kadar")

- [ ] **Step 1:** Metinler. **Step 2:** `npm run build`. **Step 3: Commit** `docs: deneme analizi derinlik, v0.33`

---

## Canlıya alma (Opus, kullanıcıyla)

1. Kullanıcı `supabase/2026-11-04-portal-exam-report-derinlik.sql`'i Supabase SQL Editor'de çalıştırır. Frontend SQL'den önce canlıya çıksa da çökmez (Review Focus 3).
2. `deneme-derinlik` → `main` merge, push (Vercel otomatik deploy). Doğrulama: GitHub durumu + tarayıcıda bundle hash.
3. Canlıda Test YKS koç görünümü ve öğrenci portal koduyla kontrol. Test verisi yazılmaz.
4. Worktree kaldırılır (önce ignored dosya kontrolü).
