# Program Hatırlatma Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Geçmiş günlerdeki işaretlenmemiş program görevleri için koç panelinde tek tıkla WhatsApp hatırlatması ve öğrenci portalında giriş uyarısı.

**Architecture:** Geciken görev kuralı ve mesaj metni tek saf modülde (`src/lib/overdueTasks.ts`). Panel bunu `homeSummaryCore` içinde yeni bir ilgi nedeni (`program_geciken`) olarak kullanır; portal ise `portal_dashboard`'dan zaten gelen bu haftanın görevleri üzerinde çağırır. Şema/RPC değişikliği yok.

**Tech Stack:** Vite + React + TypeScript, Supabase JS, `tsx` + `node:assert` öz-testleri.

**Spec:** `docs/superpowers/specs/2026-11-23-program-hatirlatma-design.md`

## Global Constraints

- Şema değişikliği yok; `supabase/schema.sql` ve `src/types/database.ts`'e dokunulmaz.
- Geciken görev = bu haftanın görevi, `block_kind` boş veya `'ders'`, `day_index < bugünün ISO gün indeksi` (0 = Pazartesi), `completed = false`.
- Mesajda "yapmadı" denmez; sistem yalnız "işaretlenmedi"yi bilir. Düğme/etiket "Gönderildi" demez.
- İmza `WHATSAPP_SIGNATURE` (`src/lib/brand.ts`) — elle "Konsept Akademi" yazma.
- Portal sayfasında `var(--token)` değil `PORTAL_THEME.ogrenci` sabit hex'leri; metin `accentStrong`.
- Tailwind yok; `className` utility'leri çalışmaz. Var olmayan CSS token'ı kullanma.
- Tüm UI metni Türkçe.

## Review Focus

1. **Pazartesi** (bugün indeksi 0): geciken liste boş olmalı, panelde neden/portalda kart çıkmamalı → Task 1 testi.
2. **Geçmiş hafta portalda görüntüleniyorsa** (`is_current_week = false`): kart gösterilmemeli → Task 3, adım 2 koşulu.
3. **Mola/serbest blokları** sayılmamalı → Task 1 testi.
4. **Öğrenci telefonu yok**: düğme sessizce hiçbir şey yapmamalı değil; kopyalanabilir mesajla `alert` göstermeli (mevcut `sendPortalLink` davranışı) → Task 2, adım 5.
5. **Erişim kodu yok**: `ensureStudentAccessCodes` üretir; hata dönerse `alert(error)` ve dur → Task 2, adım 5.

---

### Task 1: Geciken görev kuralı + mesaj (saf modül)

**Files:**
- Create: `src/lib/overdueTasks.ts`
- Create: `scripts/overdueTasks.selftest.ts`
- Modify: `package.json` (scripts: `"test:overdue": "tsx scripts/overdueTasks.selftest.ts"`)

**Interfaces:**
- Produces:
  - `overdueTasks<T extends { day_index: number; completed: boolean; block_kind?: string | null }>(tasks: T[], todayIndex: number): T[]` — çağıran zaten bu haftaya süzmüş görevleri verir.
  - `buildTaskReminderMessage(name: string, count: number, portalLink: string): string`

- [ ] **Step 1: Failing testi yaz** (`scripts/overdueTasks.selftest.ts`, mevcut `homeSummary.selftest.ts` gibi `node:assert/strict`)

```ts
const t = (day_index: number, completed = false, block_kind: string | null = 'ders') => ({ day_index, completed, block_kind })
// Çarşamba (2): Pzt+Sal işaretsiz ders görevleri geciken
assert.equal(overdueTasks([t(0), t(1), t(2), t(3)], 2).length, 2)
// tamamlanan sayılmaz
assert.equal(overdueTasks([t(0, true), t(1)], 2).length, 1)
// mola/serbest sayılmaz; block_kind null/undefined ders sayılır
assert.equal(overdueTasks([t(0, false, 'mola'), t(0, false, 'serbest'), t(0, false, null)], 2).length, 1)
// Pazartesi: hiçbiri geciken değil
assert.equal(overdueTasks([t(0), t(3)], 0).length, 0)
// mesaj
const m = buildTaskReminderMessage('Ali', 3, 'https://x/portal?code=ABC')
assert.ok(m.startsWith('Merhaba Ali,'))
assert.ok(m.includes('3 görev işaretlenmemiş'))
assert.ok(m.includes('https://x/portal?code=ABC'))
assert.ok(m.includes(WHATSAPP_SIGNATURE))
assert.ok(!/yapmadın/i.test(m))
```

- [ ] **Step 2: Koş, FAIL bekle** — `npm run test:overdue` → modül bulunamadı.

- [ ] **Step 3: Uygula.** Mesaj metni tam olarak:
  `Merhaba ${name}, programında geçmiş günlerden ${count} görev işaretlenmemiş görünüyor. Yaptıysan portaldan işaretlemeyi unutma, yapmadıysan bugün telafi edelim 💪\n${portalLink}\n\n— ${WHATSAPP_SIGNATURE}`

- [ ] **Step 4: Koş, PASS bekle** — `npm run test:overdue`.

- [ ] **Step 5: Commit** — `feat(program): geciken gorev kurali ve hatirlatma mesaji`

---

### Task 2: Koç paneli — `program_geciken` nedeni + "Öğrenciye hatırlat"

**Files:**
- Modify: `src/lib/homeSummaryCore.ts` (`AttentionReasonKind` :25, `REASON_WEIGHTS` :198, neden üretimi "4. Program" bloğu ~:450)
- Modify: `src/pages/PanelPage.tsx` (`FILTERS` :102, `SEVERITY` :111, `reasonText` :120, `AttentionCard` satırı ~:217)
- Modify: `scripts/homeSummary.selftest.ts`

**Interfaces:**
- Consumes: `overdueTasks`, `buildTaskReminderMessage` (Task 1); `ensureStudentAccessCodes` (`src/lib/accessCode.ts`); `openWhatsAppChat` (`src/lib/whatsapp.ts`).
- Produces: `AttentionReasonKind` içinde `'program_geciken'`, detail tipi `AttentionReasonGecikenDetail = { count: number }`.

- [ ] **Step 1: Failing test** (`homeSummary.selftest.ts`'e yeni blok): referans tarih Perşembe; öğrencinin bu haftası Pzt/Sal'de 3 işaretsiz ders görevi + Çar'da 1 tamamlanmış görev → o öğrencinin `reasons`'ında `{ kind: 'program_geciken', detail: { count: 3 } }` var. Aynı veriyle referans Pazartesi → `program_geciken` yok. Görevi olmayan öğrencide `program_yok` var, `program_geciken` yok.

- [ ] **Step 2: Koş, FAIL bekle** — `npm run test:home-summary`.

- [ ] **Step 3: `homeSummaryCore.ts`.** `sTasks.length > 0` dalında, `weekHalfway` kontrolünden **bağımsız** olarak `overdueTasks(sTasks, currentDayIndex)` > 0 ise neden ekle: `label: \`Geçmiş günlerden ${n} görev işaretlenmedi\``, `detail: { count: n }`. `REASON_WEIGHTS.program_geciken = 10`. `program_dusuk` olduğu gibi kalır.

- [ ] **Step 4: Koş, PASS bekle** — `npm run test:home-summary`.

- [ ] **Step 5: `PanelPage.tsx`.**
  - `FILTERS` 'prog' kinds'a `'program_geciken'`; `SEVERITY.program_geciken = 'warn'`; `reasonText`: `{ tag: 'GECİKEN', text: \`${count} görev işaretlenmedi\` }`.
  - Satırda, `reasons` içinde `program_geciken` varsa mevcut sonraki-adım bağlantısının yanına `MessageCircle` ikonlu **"Öğrenciye hatırlat"** düğmesi (`type="button"`, mevcut buton sınıflarından biri).
  - Tıklama: `supabase.from('students').select('*').eq('id', studentId).single()` → `ensureStudentAccessCodes(student)` (hata → `alert(error)` ve dur) → link `${window.location.origin}/portal?code=${student_access_code}` → `buildTaskReminderMessage(student.full_name, count, link)` → telefon varsa `openWhatsAppChat(student.phone_number, msg)`, yoksa `OgrencilerPage.sendPortalLink`'teki gibi "Öğrenci telefonu kayıtlı değil" + mesaj metnini içeren `alert`. İstek sürerken düğme `disabled`.

- [ ] **Step 6: Doğrula** — `npm run build` ve `npm run lint` (yeni uyarı yok).

- [ ] **Step 7: Commit** — `feat(panel): geciken program gorevleri icin ogrenciye WhatsApp hatirlatma`

---

### Task 3: Öğrenci portalı — giriş uyarısı kartı + sürüm notu

**Files:**
- Modify: `src/pages/mobile/OgrenciPortalPage.tsx` (render ~:214–:240 değişkenleri, gün listesi ~:623)
- Modify: `src/components/help/VersionHistory.tsx` (en üste v0.37)

**Interfaces:**
- Consumes: `overdueTasks` (Task 1), sayfadaki `tasks`, `is_current_week`, `today` (`todayDayIndex()`), `DAY_NAMES`, `PORTAL_THEME.ogrenci`.

- [ ] **Step 1: Gün bloklarına çapa.** `days.map` içindeki `<div key={dayIndex}>`'e `id={\`gun-${dayIndex}\`}`.

- [ ] **Step 2: Kart.** `const overdue = is_current_week ? overdueTasks(tasks, today) : []`. `overdue.length > 0` ise "Haftam" sekmesinin en üstünde kart: başlık **"Geçmiş günlerden {n} görevin kaldı"**, alt satır "Yaptıysan işaretlemeyi unutma." ve geciken görevlerin benzersiz günleri için birer çip (`DAY_NAMES[d]` + o gündeki sayı); çipe tıklayınca `document.getElementById(\`gun-${d}\`)?.scrollIntoView({ behavior: 'smooth' })`. Renkler yalnız `PORTAL_THEME.ogrenci` (`tint` zemin, `accentStrong` metin/çip). Görev işaretlenince `tasks` state'i zaten güncellendiği için kart kendiliğinden küçülür/kaybolur.

- [ ] **Step 3: Sürüm notu.** `HISTORY` başına `date: '23 Kasım 2026'`, `version: 'v0.37'`, başlık "Program hatırlatma", maddeler: panelde "Geçmiş günlerden N görev işaretlenmedi" nedeni ve "Öğrenciye hatırlat" düğmesi (WhatsApp hazır mesajla açılır, gönderen koç); öğrenci portalında giriş kartı; Pazartesi önceki haftanın görevleri sayılmaz.

- [ ] **Step 4: Doğrula** — `npm run build`, `npm run lint`, `npm run test:overdue`, `npm run test:home-summary`. Yerelde `npm run dev` ile `/ogrenci` (test öğrencisinin PIN'i) ve `/` panelinde kartı/düğmeyi gözle; canlı veriye yazma yapma (canlı test kuralı).

- [ ] **Step 5: Commit** — `feat(portal): ogrenci portalinda geciken gorev uyarisi; v0.37 surum notu`

---

## Teslim

- `coordination.md`'ye görev satırı ekle/kapat; CLAUDE.md "Öne çıkan özellikler"e bir satır (Program hatırlatma) ve "v0.37'ye kadar" güncellemesi.
- `main`'e push = canlı deploy; push kullanıcı onayıyla.
