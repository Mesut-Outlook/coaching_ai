# Coordination — Coching_AI

Bu dosya kimin ne üzerinde çalıştığını takip eder. Yeni iş eklerken doğru bölüme yaz; bir iş bittiğinde durumunu güncelle (Yapılacak → Devam Ediyor → Bitti).

## Roller
| Kim | Kapsam |
|---|---|
| **Fable** | Planlama ve tasarım — ürün kararları, UX akışları, ekran/komponent tasarımı. Kod yazmaz. |
| **Sonnet** | Tüm yazılım işleri — frontend, backend, veri modeli, entegrasyon, test, deploy. |
| **Antigravity (agy)** | Ana koddan bağımsız, izole çalışabilecek küçük modüller (script'ler, tekil entegrasyonlar) — ana uygulama akışına dokunmayan işler. |

---

## Fable — Planlama & Tasarım
- [x] Koç paneli ilk tasarım turu — 5 ekran (Panel, Öğrenci Profili, Konu Yeterlilik Haritası, Deneme Girişi, Haftalık Görüşme).
- [x] Konu takip derinleştirme — resmi 2022 TYT konu listesinden (141 konu, 10 ders) gerçek taksonomi işlendi; konu bazlı test+deneme birleşik geçmişi ve "Koç Kararı" onay mekanizması (otomatik durum önerisi + koç override) eklendi; 6. ekran "Haftalık Program" (gün gün konu planlama, ekle/çıkar + sürükle-bırak taşıma) eklendi. Güncel artifact: https://claude.ai/code/artifact/04e9bd11-0c63-4c43-b126-6fe457d037e8
- [ ] Mobil (öğrenci tarafı) akış tasarımı — kapsam henüz tanımlanmadı
- [ ] Bilgi mimarisi: öğrenci verisi, deneme verisi, konu verisi arasındaki ilişkiler (ürün/veri modeli taslağı, kod değil)

## Sonnet — Yazılım
- [x] Proje iskeleti kurulumu (Vite + React + TS ve Git entegrasyonu tamamlandı)
- [x] Backend kararı: **Supabase** (auth + Postgres). Şema: `supabase/schema.sql` — kendi Supabase projenin SQL Editor'ünde tek seferde çalıştır. RLS açık: her koç sadece kendi öğrencilerini görür; `subjects`/`topics` ortak müfredat, herkese açık okuma.
- [x] Kimlik doğrulama — Supabase Auth (email/şifre). `src/contexts/AuthContext.tsx`, `src/pages/LoginPage.tsx`, `src/components/routing/ProtectedRoute.tsx`. Supabase henüz bağlanmadıysa (`.env.local` yoksa) login ekranı atlanır, ekranlar boş durumla görünür — geliştirmeye devam edilebilir.
- [x] Tasarım sistemi taşındı — `src/styles/tokens.css` (renkler, ışık/karanlık tema) + `src/styles/global.css`. Archivo fontu artık base64 değil, gerçek dosya: `public/fonts/*.woff2`.
- [x] AppShell + routing — `src/components/layout/{Sidebar,AppShell,PageHeader}.tsx`, `react-router-dom` ile 6 route (`/panel`, `/ogrenciler/:studentId?`, `/denemeler`, `/konular`, `/program`, `/raporlar`).
- [x] **Koç Paneli (Panel) ekranı gerçek Supabase sorgusuna bağlı** — `src/pages/PanelPage.tsx`. Referans implementasyon: veri çekme deseni, boş/hata durumları, filtre/arama, `ProgressRing`/`Sparkline` komponentleri (`src/components/charts/`) buradan örnek alınabilir.
- [ ] Kalan 5 ekran şu an sadece routed placeholder (`src/pages/{Ogrenciler,Denemeler,Konular,Program,Raporlar}Page.tsx`) — aşağıda **Antigravity — Büyük Görev** olarak tanımlandı.
- [ ] Kaynak: `/home/mesuto/Downloads/07093256_2022-TYT-Konulari.pdf` — resmi TYT konu listesi (141 konu / 10 ders). Antigravity'nin bağımsız olarak ayrıştırdığı `src/tytSubjects.json` ile örtüşüyor, aşağıdaki seed görevinde o kullanılacak.

**Önemli tip notu:** Supabase `Database` tipindeki (`src/types/database.ts`) satır tipleri `interface` DEĞİL `type` olarak tanımlanmalı — `interface` kullanılırsa postgrest-js'in sorgu sonucu tip çıkarımı sessizce `never`'a düşüyor (saatlerce debug edildi, kök neden bu). Yeni tablo/tip eklerken bu deseni koru.

**Mimari not — iki paralel tip sistemi var, birleştirilmesi gerekiyor:** Bu tur sırasında ben (Sonnet) Supabase şemasını (`supabase/schema.sql` + `src/types/database.ts`) kurarken, Antigravity paralelde kendi tip sistemini (`src/types/coaching.ts`) ve mock veri katmanını (`src/mockData.json`, `scripts/generateMockData.cjs`) yazmış — ikisi aynı alanı farklı isimlerle modelliyor (örn. `track: 'SÖZ'` vs `'SOZ'`, `grade: 'Mezun'` vs `'MEZUN'`). **Kalıcı veri katmanı artık `src/types/database.ts` + Supabase'dir** — `coaching.ts`/`mockData.json` siliniyor değil ama uygulama ekranları onları kullanmamalı. `yksCalculator.ts`'deki `calculateNet(doğru, yanlış)` fonksiyonu şemadan bağımsız, saf matematik — o doğrudan kullanılabilir.

## Antigravity — Bağımsız Küçük Modüller (tamamlanan)
- [x] TypeScript tip tanımlamaları (`src/types/coaching.ts`) — yukarıdaki mimari nota bkz., ekranlarda `src/types/database.ts` kullanılıyor artık
- [x] YKS Net ve İstatistik Hesaplayıcı yardımcı modülü (`src/utils/yksCalculator.ts`) — `calculateNet` doğrudan kullanılabilir
- [x] Gerçekçi test verisi üretici script (`scripts/generateMockData.cjs`) ve veri dosyası (`src/mockData.json`)
- [x] Resmi TYT konu listesi PDF ayrıştırıcı script (`scripts/parse_subjects.py`) ve veritabanı dosyası (`src/tytSubjects.json`) (141 konu / 10 ders) — aşağıdaki seed görevinde doğrudan kullanılacak

## Antigravity — Büyük Görev 1: Kalan 5 ekranı React'e dönüştür
Kapsam: `Öğrenci Profili`, `Deneme Girişi`, `Konu Yeterlilik Haritası`, `Haftalık Program`, `Haftalık Görüşme`.

- **Görsel/etkileşim referansı**: https://claude.ai/code/artifact/04e9bd11-0c63-4c43-b126-6fe457d037e8 — çalışan HTML maketi, tüm etkileşimler (konu picker, sürükle-bırak, koç kararı, hafta gezinme) orada birebir çalışıyor durumda. Aynı davranışı React'te yeniden üret.
- **Deseni takip et**: `src/pages/PanelPage.tsx` referans implementasyon — Supabase sorgu şekli, boş/hata durumu ele alma, `useEffect`+`useState` veri çekme deseni oradaki gibi olsun. Yeni tekrar kullanılabilir parça gerekiyorsa `src/components/` altına ekle (örn. `charts/LineChart.tsx`, `layout/TopicDrawer.tsx`).
- **Tipler**: `src/types/database.ts` — şemadaki tüm tablo tiplerini kullan, yeni tip eklersen `interface` değil `type` kullanmayı unutma (yukarıdaki not).
- **Hafta hesapları**: `src/lib/weeks.ts` içinde `mondayOf`/`weekKey`/`fmtWeekRange`/`DAYS`/`DAY_ABBR` hazır, Haftalık Program ekranında bunları kullan, tekrar yazma.
- **Net hesabı**: Deneme Girişi'nde `src/utils/yksCalculator.ts`'deki `calculateNet(doğru, yanlış)` kullan.
- **Route'lar zaten tanımlı** (`src/App.tsx`) — sadece `src/pages/*.tsx` dosyalarının içini doldur, route yapısına dokunma.
- Bitirince bu maddeyi `[x]` yap ve kısa bir not düş (hangi ekranlar tamam, hangi etkileşim eksik kaldıysa).

## Antigravity — Büyük Görev 2: Supabase seed script'i
- `scripts/` altına `seedSupabase.ts` (veya `.cjs`) ekle: `@supabase/supabase-js` ile bağlanıp
  1. `src/tytSubjects.json`'daki 10 ders + 141 konuyu `subjects`+`topics` tablolarına yaz (renk/soru sayısı için `supabase/schema.sql`'deki `subjects` tablosunun yorumlarına bak, yoksa `Netlik` artifact'indeki `SUBJECTS` objesinden renk paleti alınabilir).
  2. `src/mockData.json`'daki (veya yeniden üretilecek) birkaç örnek öğrenciyi `students` tablosuna, ilgili deneme/konu verisini de kendi tablolarına yaz.
- Script `.env.local`'daki `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` yerine bir **service-role key** ile çalışmalı (RLS'yi bypass etmesi lazım) — bunun için ayrı bir `SUPABASE_SERVICE_ROLE_KEY` ortam değişkeni bekle, `.env.local`'a ekleme (service key asla client'a sızmamalı, sadece bu script'te kullanılsın).
- `package.json`'a `"seed": "tsx scripts/seedSupabase.ts"` gibi bir script ekle.

---

## Açık kararlar (kullanıcıdan netleşmesi gereken)
- Mobil mi, web mi, ikisi birden mi — öncelik sırası
- Kullanıcının kendi Supabase projesini oluşturup `.env.local`'a URL/anon key girmesi bekleniyor (bkz. `.env.example`) — bu olmadan uygulama gerçek veriyle çalışmaz
