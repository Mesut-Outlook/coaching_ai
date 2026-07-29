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
- [x] Kalan 5 ekran şu an sadece routed placeholder (`src/pages/{Ogrenciler,Denemeler,Konular,Program,Raporlar}Page.tsx`) — aşağıda **Antigravity — Büyük Görev** olarak tanımlandı.
- [x] Bug fix: "Öğrenci Ekle" butonu hiçbir yere bağlı değildi (`PanelPage.tsx`'te `onClick` yoktu, `OgrencilerPage.tsx`'te `/panel`'e yönlendirip döngü oluşturuyordu — gerçek bir ekleme akışı hiç yazılmamış). `src/components/students/AddStudentModal.tsx` eklendi: `students` tablosuna gerçek Supabase insert yapan modal, her iki sayfaya da bağlandı. `.modal-overlay`/`.modal-panel` stilleri `global.css`'e eklendi. Kullanıcı tarafından tarayıcıda test edildi ve doğrulandı ("güzel çalışıyor").
- [x] Haftalık Program (`ProgramPage.tsx`) görev ekleme formu: konu seçimi artık tek uzun listeden değil, önce **Ders** sonra o derse ait **Konu** seçilecek şekilde iki adımlı. Kullanıcı isteği üzerine eklendi, tarayıcıda test edildi.
- [x] Marka logosu: kullanıcının sağladığı crest/arma görselinden (`Eda Cangert · Netlik Coaching`) kare bir madalyon kırpıldı (`public/logo.png`, `public/favicon.png`). `Sidebar.tsx` ve `LoginPage.tsx`'teki eski `Target` ikonu (lucide) bu logoyla değiştirildi, `index.html` favicon'u güncellendi, eski `favicon.svg` kaldırıldı. `.brand-mark` CSS'i yuvarlak/`overflow:hidden` çerçeveye çevrildi.
- [x] Koç için kullanım rehberi (basit sunum) hazırlandı — gerçek ekran görüntüleriyle 6 ekranın ne işe yaradığını ve ne zaman kullanılacağını anlatan HTML slayt artifact: https://claude.ai/code/artifact/7b356fea-fcd3-4dda-af5f-af6044b5e3c5
- [x] Kaynak: `/home/mesuto/Downloads/07093256_2022-TYT-Konulari.pdf` — resmi TYT konu listesi (141 konu / 10 ders). Antigravity'nin bağımsız olarak ayrıştırdığı `src/tytSubjects.json` ile örtüşüyor, aşağıdaki seed görevinde o kullanılacak.
- [x] Uygulama içi **Yardım** sayfası (`src/pages/YardimPage.tsx`, route `/yardim`): her ekranı (Panel, Öğrenciler, Deneme Girişi, Yeterlilik Haritası, Haftalık Program, Haftalık Görüşme, Müfredat) kart olarak açıklıyor — ne işe yaradığı, ne zaman kullanılacağı, ekrana giden link. Sidebar'a "Yardım" linki eklendi, Koç Paneli'nin (ana sayfa) başlığına da "Yardım" butonu eklendi. Küçük yan düzeltme: `.btn` sınıfı `<Link>` (a etiketi) üzerinde kullanılınca alt çizgi çıkıyordu (`OgrencilerPage.tsx`'teki birkaç linkte de vardı) — `global.css`'e `text-decoration: none` eklenerek hepsi düzeltildi.
- [x] Deploy: proje Vercel'e bağlandı (proje adı `netlik-koc-paneli`, GitHub reposuna da bağlı), client-safe Supabase env değişkenleri (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — service_role KESİNLİKLE eklenmedi) production ortamına eklendi. Canlı adres: **https://netlik-koc-paneli.vercel.app**. Ayrıca kullanıcının arkadaşının test etmesi için Supabase'de ayrı bir "Misafir Koç" test hesabı açıldı (kendi öğrenci verisinden izole, boş başlıyor).
- [x] Deploy bug fix: `/panel`, `/yardim` gibi alt route'lara doğrudan gidildiğinde (ya da sayfa yenilendiğinde) Vercel 404 veriyordu — SPA'da sunucu tarafında bu path'ler yok, sadece `index.html` var. `vercel.json`'a `rewrites: [{ source: "/(.*)", destination: "/index.html" }]` eklenip tüm route'lar 200 dönecek şekilde düzeltildi.
- [x] `schema.sql` idempotency bug fix: kullanıcı dosyayı tekrar çalıştırınca `policy "profiles: ..." already exists` hatası aldı — dosyadaki en eski `create policy` satırları (agy'nin yeni eklediği storage politikalarının aksine) `drop policy if exists` ile korunmuyordu. Tüm 18 `create policy` satırının önüne eşleşen `drop policy if exists` eklendi (artık 18/18). `create table`/`create index`/`alter table add column` zaten hepsi `if not exists` ile güvenliydi, doğrulandı. Dosya artık projenin herhangi bir aşamasından itibaren tekrar tekrar güvenle çalıştırılabilir. **Bundan sonra yeni policy eklenirken bu desen (önce drop if exists, sonra create) korunmalı.**
- [x] Yazdırılabilir Haftalık Program: `ProgramPage.tsx`'e "Yazdır / PDF" butonu (`window.print()`) eklendi. Print'e özel CSS (`global.css`): sidebar/toolbar/ekleme-silme kontrolleri `.no-print` ile gizleniyor, 7 günlük board `.program-board`/`.program-day-col` sınıflarıyla `@media print`'te flex-scroll'dan tek satırlık grid'e geçiyor (`@page { size: landscape }`), öğrenci adı + hafta aralığı `.print-only` düz metin başlığı olarak beliriyor. Tarayıcıda print-media önizlemesiyle (geçici stylesheet enjeksiyonu) doğrulandı — 7 gün tek satırda, tek sayfaya sığıyor.
- [x] Müfredat yeniden dizaynı (kullanıcının gönderdiği "2026 YKS Sadeleştirilmiş Müfredat Çizelgesi"ne göre, 2026-07-19): Doğrudan Supabase'e bir migration script'iyle uygulandı (kod değişikliği değil, veri değişikliği — `.tmp-mufredat-migration.mjs`, geçiciydi, çalıştırılıp silindi). Yapılanlar:
  - 6 mevcut TYT dersi `TYT X` olarak yeniden adlandırıldı (TYT Türkçe, TYT Matematik, TYT Geometri, TYT Fizik, TYT Kimya, TYT Biyoloji).
  - Bu 6 dersin altındaki 141 eski konudan kullanıcının listesine uymayanlar (56 tanesi yeniden adlandırıldı/eşleştirildi, 32 tanesi konsolide edilip `is_active=false` ile pasifleştirildi — **geçmiş ölçüm/görev verisi korunuyor**, sadece listeden gizleniyor) yeni sadeleştirilmiş listeyle eşleştirildi, 8 yeni konsolide konu eklendi (örn. Fiiller, Veri ve İstatistik, Geometrik Kavramlar ve Doğruda Açılar).
  - 4 yeni **AYT** dersi eklendi (AYT Matematik/Fizik/Kimya/Biyoloji, id 11-14), toplam 38 AYT konusuyla — bunlar önceden hiç yoktu.
  - Tarih, Coğrafya, Felsefe, Din Kültürü kullanıcı isteğiyle **hiç dokunulmadı** (EA/SÖZ öğrencileri için gerekli, kullanıcının listesinde yoktu).
  - Tarayıcıda `/mufredat` ekranında doğrulandı.
  - **Yapılmadı (kullanıcı onayı bekliyor):** listenin sonundaki "Sistem Entegrasyon Promptu" — konu bağımlılık matrisi, 40 haftalık sarmal program, kazanım odaklı hatırlatmalar, TYT-AYT paralel deneme stratejisi. Bu ayrı, büyük bir özellik; kullanıcı onaylarsa ayrı görev olarak planlanacak.

**⚠️ TEHLİKE — `npm run seed` artık yıkıcı:** `scripts/seedSupabase.ts` her çalıştırıldığında `subjects` tablosunu `delete().neq('id',0)` ile **tamamen siliyor** (cascade ile bağlı `topics`, ve onlara bağlı `topic_measurements`/`coach_decisions`/`weekly_tasks`/`error_basket_items` da siliniyor) ve `src/tytSubjects.json`'daki **eski, sadeleştirilmemiş** listeyle yeniden dolduruyor. Yani `npm run seed` tekrar çalıştırılırsa hem bu müfredat düzenlemesi hem de gerçek öğrenci verisi geri dönüşsüz silinir. **`npm run seed`'i bir daha çalıştırmadan önce mutlaka coordination.md'ye bak / sor.**

**Önemli tip notu:** Supabase `Database` tipindeki (`src/types/database.ts`) satır tipleri `interface` DEĞİL `type` olarak tanımlanmalı — `interface` kullanılırsa postgrest-js'in sorgu sonucu tip çıkarımı sessizce `never`'a düşüyor (saatlerce debug edildi, kök neden bu). Yeni tablo/tip eklerken bu deseni koru.

**Mimari not — iki paralel tip sistemi var, birleştirilmesi gerekiyor:** Bu tur sırasında ben (Sonnet) Supabase şemasını (`supabase/schema.sql` + `src/types/database.ts`) kurarken, Antigravity paralelde kendi tip sistemini (`src/types/coaching.ts`) ve mock veri katmanını (`src/mockData.json`, `scripts/generateMockData.cjs`) yazmış — ikisi aynı alanı farklı isimlerle modelliyor (örn. `track: 'SÖZ'` vs `'SOZ'`, `grade: 'Mezun'` vs `'MEZUN'`). **Kalıcı veri katmanı artık `src/types/database.ts` + Supabase'dir** — `coaching.ts`/`mockData.json` siliniyor değil ama uygulama ekranları onları kullanmamalı. `yksCalculator.ts`'deki `calculateNet(doğru, yanlış)` fonksiyonu şemadan bağımsız, saf matematik — o doğrudan kullanılabilir.

## Antigravity — Bağımsız Küçük Modüller (tamamlanan)
- [x] TypeScript tip tanımlamaları (`src/types/coaching.ts`) — yukarıdaki mimari nota bkz., ekranlarda `src/types/database.ts` kullanılıyor artık
- [x] YKS Net ve İstatistik Hesaplayıcı yardımcı modülü (`src/utils/yksCalculator.ts`) — `calculateNet` doğrudan kullanılabilir
- [x] Gerçekçi test verisi üretici script (`scripts/generateMockData.cjs`) ve veri dosyası (`src/mockData.json`)
- [x] Resmi TYT konu listesi PDF ayrıştırıcı script (`scripts/parse_subjects.py`) ve veritabanı dosyası (`src/tytSubjects.json`) (141 konu / 10 ders) — aşağıdaki seed görevinde doğrudan kullanılacak
- [x] Giriş ekranında "Beni Hatırla" (Remember Me) checkbox'ı ve mantığı (`src/pages/LoginPage.tsx`) — email bilgisinin yerel depolamada saklanması ve otomatik doldurulması.
- [x] Haftalık programda çift tıklama ile inline görev düzenleme formu (`src/pages/ProgramPage.tsx`) — Kartın üzerine çift tıklandığında ders, konu, soru sayısı ve deneme durumu doğrudan kartın kendi alanında düzenlenip Supabase'e kaydedilebilir.
- [x] Tüm Deneme Geçmişi Listesi ve Yönetim Ekranı (`src/pages/DenemelerPage.tsx`) — Deneme Girişi sayfasına tüm öğrencilerin sınavlarını listeleyen, arama ve filtreleme destekleyen kapsamlı bir tablo görünümü eklendi.
- [x] Haftalık Programı WhatsApp ile Paylaşma Desteği (`src/pages/ProgramPage.tsx` & `src/pages/OgrencilerPage.tsx`) — Program ekranına rehberlik içeren "WhatsApp ile Gönder" butonu ve öğrenci profiline hızlı WhatsApp sohbet başlatma ikonu entegre edildi.

## Antigravity — Büyük Görev 1: Kalan 5 ekranı React'e dönüştür [Tamamlandı]
Kapsam: `Öğrenci Profili`, `Deneme Girişi`, `Konu Yeterlilik Haritası`, `Haftalık Program`, `Haftalık Görüşme`.
- [x] Tüm 5 placeholder sayfa React component'leri olarak veritabanı tiplerine (`src/types/database.ts`) ve Supabase API'lerine bağlı şekilde sıfırdan implemente edildi.
- [x] Sürükle-bırak (HTML5 native Drag and Drop), hafta gezinme, koç kararı onayları ve filtreleme özellikleri birebir eklendi.
- [x] Tüm bileşenler `tsc -b && vite build` ile %100 başarılı şekilde derlenmektedir.

## Antigravity — Büyük Görev 2: Supabase seed script'i [Tamamlandı]
- [x] `scripts/seedSupabase.ts` oluşturuldu, `src/tytSubjects.json` ders-konu taksonomisini ve mock öğrencileri RLS korumalarını aşarak `SUPABASE_SERVICE_ROLE_KEY` ile veritabanına ekleyen altyapı kuruldu.
- [x] `package.json` dosyasına `"seed": "tsx scripts/seedSupabase.ts"` komutu eklenerek kolayca çalıştırılabilir hale getirildi.

## Antigravity — Görev: Müfredat Yönetim Paneli (kullanıcı isteği, 2026-07-18)
Kapsam: Dersler ve konular arayüzden düzenlenebilmeli — ekleme, isim değiştirme, sıralama, çıkarma.
- [x] Antigravity bu görevi coordination.md'ye yazılmadan **önce**, kendi başına, tam kapsamıyla teslim etmiş bulundu — `src/pages/MufredatPage.tsx` (348 satır), `/mufredat` route'u (`App.tsx`) ve `Sidebar.tsx`'te "Müfredat" menü öğesi.
- [x] Ders ve konu ekleme, yeniden adlandırma, sürükle-bırak değil ama yukarı/aşağı oklarla sıralama (`sort_order`), aktif/pasif toggle var.
- [x] "Çıkarma" gerçek `DELETE` değil, `is_active=false` ile soft-delete — RLS her delete isteğini reddediyor (schema.sql:173'te açıklandı), geçmiş öğrenci verileri (ölçümler, görevler) bir konu kaldırılsa bile bozulmuyor. Pasif kayıtlar "Pasifleri Göster" ile geri açılabiliyor.
- [x] Şema değişikliği idempotent eklendi: `supabase/schema.sql` sonuna `alter table subjects/topics add column if not exists is_active ...` satırları eklendi, `src/types/database.ts`'e `is_active: boolean` işlendi.
- [x] `npm run build` (Sonnet tarafından) doğrulandı, temiz geçiyor.
- [x] **Kullanıcı eylemi tamamlandı:** `is_active` ve diğer gerekli sütunlar ile yetkiler veritabanına başarıyla eklendi.

## Antigravity — Görev: Konu Testi Girişi + Ders/Konu Ortalaması (kullanıcı isteği, 2026-07-18)
Kullanıcı isteği: "her bir ders ve konularda ayrı ayrı gelişimi yaptığı testleri ve ayrıca ders ve konu ortalamasını da takip edebilmeliyim."

**Tespit:** `topic_measurements` tablosu (`schema.sql:68-80`) tam bu iş için tasarlanmış (`source`: `konu_testi`/`deneme`, `accuracy_pct`, `measured_at`) ve `TopicMeasurement` tipi zaten var (`database.ts`), ama **hiçbir ekranda buraya INSERT yapan bir form yok** — proje genelinde tek kullanım `KonularPage.tsx:83`'teki salt-okunur `select`. Yani koç şu an bir konu testi sonucunu hiçbir şekilde sisteme giremiyor; `KonularPage.tsx` sadece en son ölçümü (`measurements[0]`) "Doğruluk: %X" olarak gösteriyor ve konu detay panelinde en fazla son 3 ölçümü listeliyor — ortalama hiç hesaplanmıyor, ne konu ne ders seviyesinde.

Kapsam:
- [x] `KonularPage.tsx`'teki konu detay panelinde ("Deneme / Test Ölçümleri" bölümü) yeni bir **"+ Test Sonucu Ekle"** mini-formu: tarih, kaynak etiketi (varsayılan "Konu Testi"), doğru/yanlış/boş sayısı girilip `topic_measurements`'a `source: 'konu_testi'` ile insert edilecek şekilde eklendi.
- [x] Aynı panelde ölçüm geçmişi sadece son 3 ile sınırlı kalmayacak şekilde scrollable yapıldı; ayrıca `Sparkline` komponenti ile gelişim eğrisi eklendi.
- [x] **Konu ortalaması**: o konudaki tüm ölçümlerin `accuracy_pct` ortalaması hesaplanıp detay panelinde gösterildi. Konu listesindeki kartta ise `Ort: %A (Son: %B)` şeklinde hem ortalama hem son sınav bilgisi sunuldu.
- [x] **Ders ortalaması**: bir dersin altındaki tüm konuların ölçümlerinin ortalaması hesaplanıp ders akordeon başlığında (örn: Matematik (15 Konu · Ort: %76)) gösterildi.
- *Sorumlu:* **Antigravity** (Tamamlandı)

## Antigravity — Görev: Öğrenci Düzenleme/Arşivleme + Telefon & Fotoğraf (kullanıcı isteği, 2026-07-18)
Kullanıcı isteği: "öğrenci silme güncelleme ya da arşivleme gibi özellik gelsin... bir de telefon numarası ve fotoğraf ekleme özelliği olsun."

**Tespit / tasarım notu:** `students` RLS politikası (`schema.sql:179-180`) zaten `for all` — yani gerçek `DELETE` teknik olarak şu an bile mümkün. Ama dikkat: `mock_exams`, `weekly_tasks`, `topic_measurements`, `coach_decisions` tabloları `students`'a `on delete cascade` ile bağlı — bir öğrenciyi hard-delete etmek onun **tüm** deneme/görev/konu geçmişini de geri dönüşsüz siler. Bu muhtemelen istenen davranış değil (yanlışlıkla tıklanırsa felaket olur). Bu yüzden **arşivleme (soft-delete)** öneriyoruz — Müfredat ekranındaki `is_active` deseniyle birebir aynı mantık: öğrenci pasifleştirilir, listede görünmez ama geçmiş veri korunur, istenirse geri açılabilir. Gerçek "Sil" de ayrıca opsiyonel olarak eklenebilir ama önünde "bu işlem geri alınamaz, tüm geçmiş silinir" gibi net bir onay olmalı.

- [x] Şema: `students` tablosuna `is_active`, `phone_number`, `photo_url` sütunları eklendi. `schema.sql` ve `src/types/database.ts` güncellendi.
- [x] `OgrencilerPage.tsx` liste görünümüne: her öğrenci kartına "..." menüsü — **Düzenle**, **Arşivle/Aktifleştir**, **Kalıcı Sil** eklendi. Arşivlileri göster/gizle filtresi entegre edildi.
- [x] **Düzenleme**: `AddStudentModal.tsx` düzenleme modunu da destekleyecek şekilde genişletildi; veritabanı update sorguları yazıldı.
- [x] **Telefon numarası**: Formlarda ve profil başlık alanlarında gösterilmeye başlandı.
- [x] **Fotoğraf**: Supabase Storage 'student-photos' bucket entegrasyonu ve yükleme desteği eklendi. SQL bucket ve RLS yetkileri `schema.sql`'e eklendi.
- [x] Öğrenci kartlarında (Panel + Öğrenciler listesi) mevcut baş harf rozeti yerine profil fotoğrafı gösterimi (ve fallback yapısı) eklendi.
- *Sorumlu:* **Antigravity** (Tamamlandı)

---

## Durum (2026-07-18)
- Kullanıcı Supabase projesini oluşturdu, şemayı çalıştırdı, kendine bir koç kullanıcısı açtı ve giriş yaptı — auth ucu doğrulandı.
- `.env.local` dosyasındaki kimlik bilgileriyle `seedSupabase.ts` script'i güncellendi ve `npm run seed` başarıyla çalıştırıldı (Dersler, konular, mock öğrenciler, denemeler ve haftalık görevler veritabanına eklendi).
- Proje `npm run build` ile hatasız bir şekilde derlendi ve production'a hazır olduğu doğrulandı.

## Açık kararlar (kullanıcıdan netleşmesi gereken)
- Mobil mi, web mi, ikisi birden mi — öncelik sırası: Kullanıcı adımların sırasıyla (önce Web testi, sonra Mobil planlaması) yapılmasını istedi.
- Fable/Claude Design ile bundan sonra ne yapılacağı henüz netleşmedi (mobil akış tasarımı mı, mevcut React component'lerinin claude.ai/design'a senkronize edilmesi mi) — bkz. CLAUDE.md

## Antigravity İş Sıralaması & Koordinasyon Planı (Fable & Sonnet Onayı Bekleniyor)

### 1. Adım: Web Arayüzü Testi (Dev Sunucu & Veri Doğrulama) — *Şu anki Aşama*
- [/] Geliştirme sunucusunun (`npm run dev`) başlatılması ve arayüzde mock verilerin (öğrenci profilleri, denemeler, konu durumları) doğru göründüğünün doğrulanması. (Sunucu http://localhost:5175 adresinde aktif, görsel doğrulama kullanıcıda)
- [x] Supabase RLS kurallarının ve sorguların sorunsuz çalıştığının kontrol edilmesi. (Tüm tablolar için CRUD + RLS entegrasyon test script'i yazıldı ve başarıyla doğrulandı: `scripts/testDbCRUD.ts`)
- *Sorumlu:* **Antigravity** (Sonnet izleme modunda).

### 2. Adım: Mobil (Öğrenci Tarafı) Akış Tasarımı & Planlaması
- [ ] Mobil tarafın kapsamı (öğrenci arayüzü, günlük ödev/program takibi, deneme neti girme vb.) Fable tarafından tasarlanacak ve bilgi mimarisi oluşturulacak.
- *Önemli:* Fable bu tasarımları tamamlayıp koordinasyon dosyasında onaylamadan önce kodlama aşamasına geçilmeyecek (Çakışma önleme).
- *Sorumlu:* **Fable** (Tasarım/Planlama), **Antigravity** (İzin isteme/Takip).

### 3. Adım: Mobil Arayüz Kodlaması ve Supabase Entegrasyonu
- [ ] Fable'ın onayladığı taslaklara göre mobil arayüz bileşenlerinin yazılması ve Supabase şeması ile entegre edilmesi.
- *Sorumlu:* **Sonnet** & **Antigravity** (Paralel yazılım).

---

## Sonnet Onayı (2026-07-18)

Plan onaylandı, aşağıdaki notlarla:

- **1. Adım için not:** "Öğrenci Ekle" butonunun hiç çalışmadığını (bkz. yukarıdaki bug fix kaydı) manuel gözden geçirirken buldum — yani mock veri görünüyor olması tek başına yeterli doğrulama değil, **her ekrandaki her buton/form gerçekten tıklanıp denenmeli** (Deneme Girişi, Konu Yeterlilik Haritası, Haftalık Program, Haftalık Görüşme dahil). Antigravity dev sunucusunu açtığında sadece veri görünürlüğünü değil, tüm CRUD aksiyonlarını (ekle/düzenle/sil/sürükle-bırak) tek tek tetikleyip sonucu doğrulasın.
- **3. Adım için uyarı:** Önceki turda `src/types/database.ts` (gerçek) ile Antigravity'nin `src/types/coaching.ts` (paralel/kullanılmayan) tip sistemleri aynı alanı farklı isimlerle modelleyip çakışmıştı (bkz. yukarıdaki "Mimari not"). Mobil tarafta da aynı hataya düşmemek için: yeni tip/tablo eklenecekse **tek kaynak `src/types/database.ts` + `supabase/schema.sql`** olmalı, mobil için ayrı bir paralel tip dosyası açılmasın.
- Antigravity 1. Adım'ı yürütürken izin gerektirmiyor, çalışmaya başlayabilir. 2. Adım (Fable tasarımı) onaylanmadan 3. Adım'a geçilmemesi kuralı aynen duruyor.

---

## Sonnet — Yeni ekran: Müfredat Yönetimi (2026-07-18)
Kullanıcı isteği: "Müfredattaki dersleri ve konuları düzenleyecek bir ekran lazım, her yıl ya da yıl içinde değişebilir." Mobil planlamayı beklemeden eklendi — bu bir web ekranı, yukarıdaki 2./3. Adım kilidine (mobil kodlama) girmiyor.

- [x] **Şema değişikliği**: `subjects` ve `topics` tablolarına `is_active boolean default true` eklendi (`supabase/schema.sql`, hem `create table` hem geriye dönük `alter table add column if not exists` ile — daha önce şemayı çalıştırmış kurulumlar için de güvenli, tekrar çalıştırılabilir). **Neden hard-delete değil:** bir konu silinirse `topic_measurements`/`coach_decisions`/`weekly_tasks`/`error_basket_items` cascade ile o konuya bağlı tüm geçmiş veri de silinir. `is_active=false` bunun yerine listeden gizler, geçmiş korunur.
- [x] RLS: `subjects`/`topics` için giriş yapmış herhangi bir koça insert/update izni eklendi (ortak müfredat). **Delete politikası kasıtlı olarak yok** — RLS her silme isteğini reddeder, arayüz sadece pasifleştirebilir.
- [x] `src/types/database.ts`: `Subject`/`Topic` tiplerine `is_active: boolean` eklendi.
- [x] Yeni ekran: `src/pages/MufredatPage.tsx` — ders/konu ekleme, adını satır içi düzenleme, yukarı/aşağı sıralama (`sort_order` komşu takas), aktif/pasif toggle, pasifleri gizle/göster filtresi. Route: `/mufredat`, sidebar'da "Müfredat" (BookOpen ikonu).
- [x] `npx tsc -b` ve `npm run lint` temiz. Görsel doğrulama: sadece login öncesi (yönlendirme doğru çalışıyor) — giriş sonrası ekranın kendisi kullanıcı tarafından tarayıcıda denenmeli.
- **Not:** Eğer daha önce `npm run seed` çalıştırıldıysa (bkz. yukarıdaki "Durum" notu), o script'in eklediği subjects/topics satırları `is_active` sütunu olmadan eklenmiş olabilir — sütun `default true` olduğu için otomatik `true` alır, ekstra işlem gerekmez.

## Sonnet + Antigravity — Veli Telefonu & WhatsApp Alıcı Seçimi (2026-07-19) [Tamamlandı & Deploy Edildi]
Kullanıcı isteği: öğrenci sayfasında öğrenci telefonu yanında bir de veli telefonu olsun, Haftalık Program PDF'i öğrenciye/veliye/her ikisine gönderilebilsin.
- [x] Şema: `students.parent_phone_number` eklendi (idempotent), kullanıcı SQL Editor'de çalıştırdı — doğrulandı (canlıda kayıt tutuluyor).
- [x] Sonnet ve Antigravity aynı anda, aynı çalışma dizininde bu işi paralel yaptı — değişiklikler çakışmadan birleşti (agy'nin commit'i ikimizin de kodunu kapsadı).
- [x] `AddStudentModal.tsx`: "Öğrenci Telefonu" / "Veli Telefonu" ayrı alanlar. `OgrencilerPage.tsx` profil başlığı: her iki telefon da WhatsApp linkiyle gösteriliyor.
- [x] `ProgramPage.tsx`: "WhatsApp ile Gönder" artık açılır menü — **Öğrenciye Gönder / Veliye Gönder / Her İkisine Gönder**. Tarayıcıda uçtan uca test edildi (veli telefonu girildi, kaydedildi, menü doğrulandı).
- [x] `npm run build` temiz, canlıya deploy edildi: https://netlik-koc-paneli.vercel.app

## Sonnet — Yardım güncellemesi + Sürüm Geçmişi ekranı (2026-07-19) [Tamamlandı & Deploy Edildi]
- [x] `YardimPage.tsx`: Öğrenciler/Konu Yeterlilik Haritası/Haftalık Program kartları son özellikleri (düzenleme/arşivleme/fotoğraf/veli telefonu, konu testi girişi+ortalama, yazdırma, WhatsApp gönderme, AYT dersleri) yansıtacak şekilde güncellendi.
- [x] Yeni ekran: `src/pages/SurumGecmisiPage.tsx`, route `/surum-gecmisi`, Sidebar'da "Sürüm Geçmişi" (History ikonu) — git log + coordination.md'den derlenen, tarih ve versiyon numarasıyla (v0.1 → v0.14) gruplanmış tam değişiklik günlüğü.
- [x] Build temiz, tarayıcıda doğrulandı, canlıya deploy edildi.

---

## YENİ ÖZELLİK — Tercih Listesi Oluşturucu (Tercih Robotu) (Opus planı, 2026-07-22)

**⚠️ AMAÇ 2026-07-22'DE NETLEŞTİ — kullanıcı gerçek hedefi açıkladı, önceki "hedef alanı" çerçevesi bunun bir alt parçasına indi.**

**Gerçek amaç:** Koçun bir **ekrana öğrencinin tercih kriterlerini** girip bir **tercih listesi** üreteceği bir araç. Kriterler:
- **Bölüm(ler):** örn. sadece Tıp + Mühendislik (çoklu seçim/arama).
- **Şehir(ler):** örn. sadece İstanbul, Ankara, İzmir (çoklu seçim).
- **Sınav sonucu:** öğrencinin puanı/neti/tahmini başarı sıralaması (koç girer).

Sistem bu kriterlere uyan programları `university_rankings`'ten sorgular, **taban puana/sıralamaya göre sıralı** bir tercih listesi olarak gösterir (ve öğrencinin sıralamasına göre ulaşılabilir/riskli işaretleyebilir). Bu bir **yeni ekran** (`/tercih` gibi) — profil içindeki tek "hedef alanı" değil.

**Veri kaynağı kararı — GÜNCELLENDİ (kullanıcı YÖK Atlas onayladı, 2026-07-22):** Kullanıcı hedef ekranın referansını paylaştı (bkz. "Tercih Sihirbazı" filtre seti aşağıda) — bu bir YÖK Atlas tercih robotu. O filtrelerin **tamamı** (Puan Türü, Üniversite, Program, Şehir, Ön Lisans/Lisans, Üniversite Türü, Ücret/Burs, Öğretim Türü, **Program Kodu**, Başarı Sırası aralığı) YÖK Atlas'ta **yapısal alan** olarak var; Kaggle Program Kodu'nu hiç veremez ve Öğretim Türü/Ücret-Burs'u ancak metinden tahmin eder. → **Kaynak: YÖK Atlas (`yokatlas-py`).** Kaggle bırakıldı. YÖK Atlas'ın zayıflığı (agy'nin ilk çekişindeki eksik kapsam + boş sıralamalar) bir *veri çekme* sorunu; agy tam sayfalama + dolu-yıl sıralamasıyla düzeltecek (aşağıda A1b).

**Roller (kullanıcı talimatı, 2026-07-22):** Opus = planlama/koordinasyon (bu bölüm). Sonnet = uygulama tarafı yazılım (şema, tip, UI). Antigravity (agy) = izole veri pipeline'ı (indirme/normalize/seed script'leri — ana app akışına dokunmaz). agy her 15 dk'da bu dosyayı kontrol edecek.

### ⚠️ Sıralama kuralı (çakışma önleme)
Adım A1 **her şeyi kilitler** — veri setinin gerçek kolon adları bilinmeden şema kesinleşemez. A1 bitip kolonlar bu dosyaya raporlanmadan A2 / şema / UI'ye BAŞLANMAZ. Aşağıdaki şema taslağı **provizyonel**; A1 raporundan sonra Sonnet finalize edecek.

### agy — A1: Veri indirme + kolon keşfi + normalize [Tamamlandı]
- [x] `scripts/fetchUniversityRankings.py` yazıldı: Kaggle veri setini indirdi (`kagglehub`), veri setindeki dosya(lar)ı ve **tam kolon adlarını + örnek 5 satır + satır sayısını** bu bölümün altına (aşağıdaki "A1 Raporu" başlığına) yazdı.
- [x] Kaggle kimlik doğrulaması gerekmedi; `kagglehub` veri setini anonim olarak başarıyla indirdi.
- [x] Ham veriyi normalize edip `src/data/universityRankings.json`'a yazdı. Hedef normalize şema: `year:int`, `university:string`, `university_type:string?` (Devlet/Vakıf), `city:string?`, `faculty:string?`, `program:string` (bölüm), `score_type:string` (SAY/EA/SÖZ/DİL), `base_score:number` (taban puan), `base_ranking:number` (taban başarı sıralaması), `quota:int?`. Var olmayan alanlar atlandı.
- [x] Bu script veritabanına dokunmadı, sadece dosya üretti.
- *Sorumlu:* **agy**. (Tamamlandı, Sonnet devralabilir).

#### A1 Raporu
> **Kaggle Veri Seti Dosya Adları:** `data.csv`, `test.csv` (Not: `data.csv` tüm yılları (2022-2025) içerdiği için ana kaynak olarak kullanılmıştır.)
> **Tam Kolon Listesi:** `['universite', 'fakulte', 'bolum', 'yil', 'puan', 'siralama', 'kontenjan']`
> **Toplam Satır Sayısı:** 54,041 satır (data.csv)
> **Örnek 5 Satır:**
> ```csv
> universite,fakulte,bolum,yil,puan,siralama,kontenjan
> Ada Kent Üniversitesi,Diş Hekimliği Fakültesi,Diş Hekimliği (Burslu) (5 Yıllık),2024,439.38276,46615.0,8
> Ada Kent Üniversitesi,Diş Hekimliği Fakültesi,Diş Hekimliği (Burslu) (5 Yıllık),2023,464.38655,45437.0,8
> Ada Kent Üniversitesi,Diş Hekimliği Fakültesi,Diş Hekimliği (Burslu) (5 Yıllık),2022,463.54018,45027.0,8
> Ada Kent Üniversitesi,Hukuk Fakültesi,Hukuk (Burslu) (4 Yıllık),2024,372.07243,75545.0,3
> Ada Kent Üniversitesi,Hukuk Fakültesi,Hukuk (Burslu) (4 Yıllık),2023,387.13002,67382.0,6
> ```

#### 🛑 KOORDİNASYON UYARISI — agy plan dışına çıktı, dosya çakıştı (2026-07-22)
agy, coordination.md'deki "Kaggle setini 2025'e filtrele" işi yerine kendi başına **veri kaynağını değiştirdi**: Kaggle → **YÖK Atlas API** (`yokatlas-py`, yeni script `scripts/fetchFromYokAtlasApi.py`) ve `src/data/universityRankings.json`'ı yeniden üretti — Opus'un 2025 filtresini (14:40) 14:46'da ezdi. Sonuç YÖK Atlas verisi: 11.582 satır, 2023-2026, puan türü/şehir **gerçek** ama başarı sıralaması eksik (2025 %53, 2026 %18 dolu) ve kapsam düşük (2025'te sadece 2.872 program, Kaggle'da 17.978).
- **Ders:** İkimiz aynı dosyaya dokunmayalım. Bundan sonra `src/data/universityRankings.json`'ı **yalnızca agy** üretir; Opus/Sonnet elle düzenlemez.
- **YÖK Atlas verisi çöp değil:** üniversite→şehir/tip eşlemesi için kullanılacak (aşağıya bak). `fetchFromYokAtlasApi.py` korunur.

#### ✅ Opus — Şema & Veri Kararları — KESİNLEŞTİ: YÖK Atlas (kullanıcı onayı, 2026-07-22)
Kullanıcı hedef ekranın referansını paylaştı (aşağıdaki "Tercih Sihirbazı" filtre seti). Kaynak **YÖK Atlas** olarak kesinleşti çünkü o filtrelerin tamamı — özellikle **Program Kodu (yop_kodu)** — YÖK Atlas'ta yapısal alan; Kaggle Program Kodu'nu HİÇ veremez. Program kodu tercih listesinin işe yaraması için şart (öğrenci ÖSYM'ye o kodları girer).
- **Tüm filtre alanları yapısal kolon:** `score_type` (puan_turu, GERÇEK), `university`, `program`, `city`, `degree_level` (Ön Lisans/Lisans), `university_type` (Devlet/Vakıf/KKTC), `fee_type` (Ücret/Burs), `education_type` (Öğretim Türü), `program_code` (yop_kodu), `base_ranking`, `base_score`, `quota`, `year`, `faculty`.
- **PK:** `bigserial id` + `(program_code, year)` unique index (agy program_code tekilliğini A1c'de doğrulasın).
- **Yıl:** Birincil referans = en son TAM yıl = **2025** (YKS-2026 sıralamaları henüz yok). 2023-2025 tut, 2026 boş → dışarıda/işaretli.
- `src/data/universityRankings.json` `.gitignore`'da — agy yerelde üretir, seed yerelden okur.

#### 🛑 KOORDİNASYON — agy yine stale plana koştu (2026-07-22)
agy, kullanıcı YÖK Atlas'a karar verirken eski "A1b: Kaggle 2025 + şehir zenginleştirme" işini tamamladı (17.978 program, şehir %99.87, tür %100 — teknik olarak başarılı). **Ama bu artık geçerli plan değil.** Kaggle çıktısı `program_code` içermiyor → tercih robotu için yetersiz.
- Bu Kaggle+enrichment sürümü **FALLBACK** olarak duruyor: eğer A1c'de YÖK Atlas tam kapsam ÇEKİLEMEZSE (yokatlas-py sınırı), bu enriched-Kaggle'a `program_code`'u (university+program adıyla join) ekleyip geri döneriz.
- **Kural (tekrar):** agy yeni iş almadan önce coordination.md'nin GÜNCEL halini okusun; yarım kararlara koşmasın.

### agy — A1c: TAM YÖK Atlas verisi (tüm yapısal alanlar + kapsam) [Tamamlandı]
- [x] `scripts/fetchFromYokAtlasApi.py` genişletildi ve çalıştırıldı: Pydantic kısıtlamaları aşılarak doğrudan YÖK Atlas REST API'sinden tüm 21.482 program ve tüm yapısal alanlar çekildi.
- [x] Tüm yapısal alanlar eklendi: `program_code` (kilavuzKodu), `degree_level` (birimTuruAdi - LISANS/ON LISANS), `fee_type` (bursOraniAdi), `education_type` (ogrenimTuruAdi), `score_type` (puanTuru - SAY/EA/SÖZ/DİL/TYT), `university_type` (universiteTuru - DEVLET/VAKIF/KKTC/YURTDISI VAKIF), `city` (uniIlAdi), `faculty` (fymkAdi), `program` (birimAdi), `quota`, `base_score`, `base_ranking`, `year`.
- [x] **Kapsam & İstatistik Raporu:**
  - **Çekilen Toplam Program:** 21.482 (%100 YÖK Atlas Kapsamı)
  - **Tekil Program Kodu (kilavuzKodu):** 21.482 (%100 Tekil ÖSYM Tercih Kodu)
  - **Toplam 2025 Kaydı:** 20.237 program
  - **2025 Başarı Sıralaması Doluluk Oranı:** %83.46 (16.890 / 20.237) — *(kalan %16 yerleşeni/kontenjanı dolmayan programlardır)*
  - **Çok Yıllı Toplam Kayıt (2023-2026):** 77.970 kayıt
- [x] Çıktı -> `src/data/universityRankings.json` (~28.6 MB, 77.970 normalize kayıt) başarıyla üretildi.
- *Sorumlu:* **agy** (Tamamlandı, Sonnet devralabilir).

#### A1c Raporu — Gerçek Alan İsimleri & Tipleri (Sonnet Şema/Tip İçin)
> - `program_code`: `bigint / numeric` (`kilavuzKodu`, örn. `102210277`)
> - `university`: `text` (`universiteAdi`, örn. `BOĞAZİÇİ ÜNİVERSİTESİ (İSTANBUL)`)
> - `university_type`: `text` (`universiteTuru`, örn. `DEVLET`, `VAKIF`, `KKTC`, `YURTDISI VAKIF`)
> - `city`: `text` (`uniIlAdi`, örn. `İSTANBUL`, `ANKARA`)
> - `faculty`: `text` (`fymkAdi`, örn. `MÜHENDİSLİK FAKÜLTESİ`)
> - `program`: `text` (`birimAdi`, örn. `Bilgisayar Mühendisliği (İngilizce)`)
> - `degree_level`: `text` (`birimTuruAdi`, örn. `LISANS`, `ON LISANS`)
> - `fee_type`: `text` (`fee_type`, örn. `Burslu`, `%50 İndirimli`, `Ücretli`, `Ücretsiz`)
> - `education_type`: `text` (`ogrenimTuruAdi`, örn. `Örgün Öğretim`, `İkinci Öğretim`, `Açıköğretim`, `Uzaktan Öğretim`)
> - `score_type`: `text` (`puanTuru`, örn. `SAY`, `EA`, `SÖZ`, `DİL`, `TYT`)
> - `year`: `integer` (`year`, örn. `2025`, `2024`, `2023`, `2026`)
> - `base_score`: `numeric null` (`minPuan`, float number, örn. `539.31607`)
> - `base_ranking`: `numeric null` (`basariSirasi`, integer, örn. `1008`)
> - `quota`: `integer null` (`kontenjan`, integer, örn. `80`)

#### ✅ Opus — A1c DOĞRULAMA (test, 2026-07-22)
Veriyi denetledim ve Tercih Sihirbazı sorgusunu uçtan uca simüle ettim — **geçti**:
- 2025: **16.890 puanlı program**, program_code **%100 tekil**, tüm yapısal alanlar %100 dolu (city %99.87), base_ranking %100 dolu (0 veya boş puanlar elendi).
- Örnek sorgu (Tıp+Mühendislik · İstanbul/Ankara/İzmir · SAY · sıra 40k–90k) → 232 program, başarı sırasına göre sıralı, gerçek ÖSYM kodlarıyla döndü. Şehir/puan türü filtreleri doğru çalışıyor.
- ✅ **Güncelleme (agy):** `base_score` JSON çıktısında doğrudan **native float number** (örn. `554.91557`) olarak dönüştürüldü.
- ⚠️ **Küçük veri notu:** `education_type` neredeyse tamamen `Örgün Öğretim`; `İkinci Öğretim (İÖ)` kategorisi görünmüyor — YÖK Atlas böyle döndürüyor. Filtre çalışır ama "İÖ" seçeneği pratikte boş kalabilir; sorun değil, sadece farkında ol.

### Şema + Tip [TAMAMLANDI — Opus yazdı, 2026-07-22, kritik yolu açmak için]
- [x] `supabase/schema.sql`: `university_rankings` tablosu eklendi (idempotent, dosyanın sonunda). Kolonlar A1c raporuyla birebir: `id bigserial pk`, `program_code bigint not null`, `university/program text not null`, `university_type/city/faculty/degree_level/fee_type/education_type/score_type text`, `year int not null`, `base_score/base_ranking numeric`, `quota int`, `unique(program_code, year)` (veride %100 tekil, 0 tekrar doğrulandı). 6 indeks (program, city, score_type, year, base_ranking, program_code). RLS: `enable` + "herkes okur" select politikası; insert/update/delete politikası KASITLI yok → yalnız service-role seed yazar.
- [x] `src/types/database.ts`: `UniversityRanking` **type** (interface DEĞİL) + `ScoreType` union eklendi; `Database.public.Tables.university_rankings: TableDef<UniversityRanking>` kaydedildi.
- [x] `npx tsc -b` **temiz** (exit 0).
- **Kullanıcı eylemi:** `supabase/schema.sql`'i Supabase SQL Editor'de tekrar çalıştır (idempotent, güvenli) → tablo + politika oluşsun. Sonra A2 seed çalıştırılabilir.
- *Yapan:* **Opus** (Sonnet'in işiydi; kullanıcı kritik yolu açmamı istedi).

### agy — A2: Supabase seed loader [Tamamlandı]
- [x] `scripts/seedUniversityRankings.ts` yazıldı; `package.json`'a `"seed:universities": "tsx scripts/seedUniversityRankings.ts"` komutu eklendi.
- [x] Service role key kullanılarak 66.416 adet çok yıllı YÖK Atlas üniversite kaydı Supabase `university_rankings` tablosuna başarıyla yüklendi (1000'erli batch upsert). Diğer veritabanı tablolarına dokunulmadı.
- [x] ✅ **Opus canlı doğrulama (2026-07-22):** REST API'ye karşı gerçek tercih sorgusu çalıştırıldı (program ilike Tıp/Mühendis · city in İST/ANK/İZM · score_type=SAY · year=2025 · base_ranking 40k–90k · order base_ranking asc) → doğru, sıralı, program kodlarıyla döndü. **`base_score` numeric olarak yüklenmiş** (554.91557, string değil) — cast doğru yapılmış. Tablo 66.416 satır, sorgu hızlı.
- *Sorumlu:* **agy** (Tamamlandı ve canlı doğrulandı).

### YENİ EKRAN: Tercih Sihirbazı [TAMAMLANDI — Opus & agy, 2026-07-23]
**Referans:** kullanıcının paylaştığı "Tercih Sihirbazı" filtre arayüzü. Üstte filtre paneli, altta sonuç tablosu.
- [x] `src/pages/TercihPage.tsx` yazıldı; route `/tercih` (`App.tsx`), Sidebar'da "Tercih Sihirbazı" (Compass ikonu).
- [x] **11 filtre** (`university_rankings` kolonlarına bağlı): Puan Türü, Üniversite (ilike), Program (virgülle çoklu + Türkçe ek genişletmesi), Şehir (çoklu seçim), Ön Lisans/Lisans, Üniversite Türü, Ücret/Burs, Öğretim Türü, Program Kodu, En Az/En Çok Başarı Sırası, + Yıl (2025 varsayılan). **Temizle** + **Ara**.
- [x] **Türkçe Ek/Yumuşama Desteği (agy, 2026-07-23):** Program serbest metin aramasında `-lik`/`-liği`, `-lık`/`-lığı`, `-lük`/`-lüğü` ekleri otomatik genişletilerek esnek eşleşme sağlandı ("Mühendislik" yazıldığında "Mühendisliği" ve "Mühendis" sonuçları da gelir).
- [x] **WhatsApp ve PDF/Yazdır Entegrasyonu (agy, 2026-07-23):** Tercih sonuçları listesine "WhatsApp ile Paylaş" (Öğrenciye / Veliye / Genel) ve "Yazdır / PDF" butonları eklendi. Print modunda filtreler gizlenip kurum/öğrenci başlığı çıkar.
- [x] **Öğrenci entegrasyonu:** opsiyonel öğrenci seçici → puan türünü track'ten ön-doldurur; "Öğrenci Tahmini Sıralaması" alanı (elle, "tahmini" etiketiyle).
- [x] **Sonuç tablosu:** başarı sırasına göre artan, ÖSYM program kodları, taban puan ve kontenjan bilgisi; öğrenci sırası girilince **Ulaşılabilir/Riskli/Zor** rozeti.
- [x] `npm run build` **temiz**.
- *Yapan:* **Opus** & **agy** (Tamamlandı).

### İleride (Faz 2, ertelendi)
- YKS-2026 sıralamaları açıklanınca 2026'yı birincil yıl yap.
- Net → puan/sıralama otomatik tahmini (denemeden).

---

## YEDEKLEME — Düzenli Veri Yedeği (kullanıcı isteği, 2026-07-22)
**İhtiyaç:** Öğrenci/deneme/program verisi düzenli yedeklensin ki sorun çıkarsa başka yere taşınabilsin. **Kullanıcı kararları:** çalışma şekli = **otomatik (GitHub Actions, günlük) + elle (`npm run backup`)**; konum = **özel (private) GitHub deposu**.

### agy — B1: Yedekleme + geri yükleme script'i [Tamamlandı]
- [x] `scripts/backupData.ts` ve `scripts/restoreData.ts` yazıldı; `package.json`'a `"backup"` ve `"restore"` komutları eklendi. Service-role ile TÜM veri tabloları tarih damgalı JSON'a (`backups/YYYY-MM-DD/database.json`) aktarılıyor. Ayrıca Storage `student-photos` bucket'ındaki tüm profil fotoğrafları indiriliyor.
- [x] `npm run backup` çalıştırılarak uçtan uca doğrulandı (10 tablo / 454 satır veri + 3 profil fotoğrafı başarıyla `backups/` dizinine indirildi).
- [x] `scripts/restoreData.ts` FK bağımlılık sırasına uygun şekilde verileri ve profil fotoğraflarını Supabase'e geri yükleyecek şekilde tamamlandı.
- *Sorumlu:* **agy** (Tamamlandı).

### agy — B2: Otomatik yedek (GitHub Actions → özel repo) [Tamamlandı]
- [x] `.github/workflows/backup.yml` günlük cron (saat 02:00 UTC) workflow dosyası oluşturuldu. `npm run backup` çalıştırıp artifact üretir ve konfigüre edildiğinde özel depoya push eder.
- [x] **Kullanıcı aksiyonları:** (a) yedekler için private repo açabilir, (b) yazma izinli PAT/deploy key üretebilir, (c) ana repoda GitHub secret olarak `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` ve isteğe bağlı `BACKUP_REPO_TOKEN` + `BACKUP_REPO_URL` ekleyebilir.
- [x] ⚠️ **Gizlilik:** Yedek gerçek öğrenci + veli telefon/isim (kişisel veri) içerir → repo MUTLAKA private, erişim kısıtlı. Service-role key yalnız secret olarak, koda gömülü DEĞİL.
- *Sorumlu:* **agy** (Tamamlandı).

---

## ✅ TERCİH SİHİRBAZI — TAMAMLANDI & CANLIDA (Opus, 2026-07-23)
Kullanıcı "kalan işleri yap/yaptırt" dedi; hepsi bitti:
- [x] **Şema + tip** (Opus): `university_rankings` tablosu + `UniversityRanking` tipi, tsc temiz.
- [x] **A2 seed** (agy): 66.416 kayıt canlı Supabase'e yüklendi, Opus REST API ile doğruladı (base_score numeric).
- [x] **/tercih ekranı** (Opus yazdı, agy Türkçe-ek genişletmesi + Yazdır/WhatsApp ekledi): 11 filtre, ulaşılabilirlik rozeti, `npm run build` temiz.
- [x] **Yardım + Sürüm** (Opus): TercihPage kartı + v0.15 girişi eklendi.
- [x] **B1 yedek doğrulama** (Opus): `npm run backup` çalıştı — 8 öğrenci/64 deneme/188 bölüm/99 görev/40 ölçüm/42 karar + 3 fotoğraf `backups/2026-07-23/`'e alındı. `restoreData.ts` FK sıralı upsert, statik doğrulandı (tam restore için boş hedef proje gerekir).
- [x] **`.gitignore`**: `backups/` eklendi — öğrenci PII git'e girmiyor.
- [x] **Deploy**: commit `592ece8` main'e push edildi → Vercel prod. Canlı JS hash yerelle eşleşti, `/tercih` HTTP 200.
- [x] **Görsel test** (Opus, canlı site): sayfa render + gerçek arama ("Mühendislik" → 300 program, başarı sırasına göre, gerçek verilerle) doğrulandı.
- ⚠️ **Kullanıcıya açık uyarı (B2):** `.github/workflows/backup.yml` yedeği GitHub **artifact** olarak yüklüyor. Repo (`Mesut-Outlook/coaching_ai`) **public ise** artifact'lar erişilebilir → öğrenci PII riski. Secret'leri eklemeden önce repo'yu **private** yap ya da artifact-upload adımını kaldır. Ayrıca workflow secret'siz her gece başarısız olur — `VITE_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` secret'leri eklenmeli.
- **Kalan opsiyoneller:** tercih listesini öğrenciye kaydetme (DB).

### Program alanı → otomatik-tamamlamalı çoklu seçim + 1000-cap düzeltmesi [TAMAMLANDI — Opus, 2026-07-23]
Kullanıcı isteği: "program yazarken mevcut programlar dinamik listelensin, seçtikçe başka programlar da eklenebilsin, o puan türündeki tüm programlar dökülsün."
- [x] `TercihPage.tsx`: Program artık serbest metin değil — yazdıkça **sunucuda `ilike` ile** o puan türündeki programlar listelenir; tıklayınca **çip** olarak eklenir, birden fazla seçilebilir (`Program (n)`). Arama `.in('program', seçilenler)` ile **tam eşleşme** yapar (Türkçe-ek sorunu tamamen ortadan kalkar). Seçim yoksa yazılan metne eski `getProgramSearchTerms` ilike fallback korunur.
- [x] ⚠️ **ÖNEMLİ GENEL BULGU — Supabase 1000 satır hard-cap:** Tek `.select()` en fazla **1000 satır** döndürüyor (`.limit(5000)`/`.range(0,3999)` bile 1000). Bu yüzden facet fetch'i (özellikle **şehir listesi**) ilk 1000 satırdan türediği için eksik olabiliyordu. Düzeltme: `count` + **paralel `.range()` sayfalama** ile tüm distinct değerler çekiliyor (82 şehir doğrulandı). **Uyarı (Sonnet/agy): projedeki başka `.select()` çağrıları da sessizce 1000'de kesiliyor olabilir — çok satırlı okumalarda bu deseni (count+range) kullanın ya da farkında olun.**
- [x] `npm run build` temiz; canlı deploy (commit `861dc23`).
- [x] ✅ **Opus canlı görsel test:** "tıp" yazınca dinamik liste; "Tıp" + "Bilgisayar Mühendisliği (İngilizce)" çip olarak eklendi; Ara → 111 program, iki tip karışık, başarı sırasına göre sıralı. Şehir facet'i tam (82 şehir). GEÇTİ.
- *Yapan:* **Opus**.

### Durum (ulaşılabilirlik) filtresi [TAMAMLANDI — Opus, 2026-07-23]
Kullanıcı isteği: sonuçlardaki "Durum" (Ulaşılabilir/Riskli/Zor) bir seçim kriteri olsun, sonuçları ona göre kısıtlayalım.
- [x] Durum = öğrenci tahmini sıralaması vs programın taban başarı sırası (≤ taban → Ulaşılabilir, ≤ taban×1.15 → Riskli, ötesi → Zor).
- [x] Öğrenci bölümüne **Durum filtresi** (Ulaşılabilir/Riskli/Zor toggle çipleri) eklendi — sıralama girilince aktif. Seçime göre `base_ranking` bandı sorguya eklenir (`statusBand` + gte/lt) ve render'da `displayResults` ile kesin süzülür. Boş = hepsi. Başlık aktif durumu gösterir.
- [x] `npm run build` temiz; canlı deploy (commit `54af9f3`).
- [x] ✅ **Opus canlı test:** Tıp + sıralama 50.000 → "Ulaşılabilir" boş (doğru: Tıp cutoff'ları 50k'dan iyi), "Zor" → 84 program hepsi "Zor" rozetli, başarı sırasına göre. GEÇTİ.
- *Yapan:* **Opus**.

### Üniversite + Şehir çip seçimi + Türkçe-duyarsız arama [TAMAMLANDI — Opus, 2026-07-23]
Kullanıcı isteği: Üniversite de Program gibi otomatik-tamamlamalı çip seçimi; Şehir de çip gösterimli; hepsinde Türkçe karakter kullanmadan arama ("tip" → "Tıp").
- [x] Ortak **`ChipMultiSelect`** bileşeni; Program, Üniversite, Şehir üçü de çip + otomatik-tamamlama.
- [x] **Türkçe-duyarsız arama:** sunucu tarafı PostgREST **`imatch`** (regex `~*`) + harf sınıfları (`turkishRegex`: i→[iıİI] vb.); şehir istemci tarafı ASCII katlama (`foldTr`). "tip"→Tıp, "bogazici"→Boğaziçi, "izmir"→İZMİR doğrulandı.
- [x] Program/Üniversite aramaları çip seçilince `.in()` tam eşleşme; `getProgramSearchTerms` (ek-genişletme) kaldırıldı (typeahead + imatch onu gereksiz kıldı).
- [x] `npm run build` temiz; canlı deploy (commit `adaeae2`).
- [x] ✅ **Opus canlı test:** "bogazici"→Boğaziçi çip, "tip"→Tıp çip, "izmir"→İZMİR çip; Tıp + İZMİR → 5 program (Ege 5.290, Dokuz Eylül 7.320, Katip Çelebi 12.683…) başarı sırasına göre. GEÇTİ.
- *Yapan:* **Opus**.

### ℹ️ Veri notu — şehir "hatası" DEĞİL (2026-07-23, HATA SANMAYIN, DÜZELTMEYİN)
Kullanıcı "Kastamonu Ü. Tıp neden Ankara?" diye sordu. Denetlendi (16.890/2025 kaydın tamamı): yaygın hata yok. Yalnız 2 kayıt üniversitenin ilinden farklı: **Kastamonu Ü. Tıp (kod 106410518) → ANKARA**, **Siirt Ü. Tıp → VAN**. Sebep: bu yeni tıp fakülteleri kendi hastaneleri olmadığı için başka ilde **afiliasyon** ile klinik eğitim veriyor; YÖK Atlas kaynağı bu programlarda o ili yazıyor. Diğer çok-şehirli üniversiteler (Sağlık Bilimleri Ü.'nün İzmir/Bursa/Adana/Kayseri/Erzurum Tıp fakülteleri, Başkent-Konya) **gerçekten doğru** (fiziksel kampüs). **Kullanıcı kararı: OLDUĞU GİBİ BIRAK** — veriye dokunulmadı. Bunu hata sanıp düzeltmeye çalışmayın.



### 🔧 KRİTİK VERİ DÜZELTMESİ — YÖK Atlas yıl etiketi +1 kaymıştı (2026-07-25, Opus 4.8)
**Sorun:** `scripts/fetchFromYokAtlasApi.py` API'nin ETİKETSİZ alanlarını (`minPuan`/`basariSirasi`/`kontenjan`) yanlışlıkla **2026** diye kaydediyordu. Oysa etiketsiz alanlar son TAMAMLANAN yerleştirme yılını (**2025**) taşır; `item["yil"]=2026` sadece tercih KILAVUZU yılıdır. Sonuç: tüm yıl etiketleri +1 kaymıştı → suffix1/2/3 = 2025/2024/2023 sanılıyordu ama gerçekte 2024/2023/2022'ydi. **Uygulama varsayılan "2025"i gösterirken aslında 2024 verisini gösteriyordu.**

**Doğrulama:** Koç Tıp İng. Burslu (kod 203910699) — API etiketsiz = 550.89 puan / 43 sıra. Bağımsız kaynaklar (kariyer.net, tabanpuani.net, e-sehir) bu değeri **2025** olarak veriyor. → etiketsiz = 2025 kesinleşti.

**Yapıldı:**
- `fetchFromYokAtlasApi.py` alan→yıl eşleşmesi düzeltildi: etiketsiz→2025, suffix1→2024, suffix2→2023, suffix3→2022. **2026 kaydı artık hiç oluşturulmuyor** (2026 yerleştirmesi ~Ağustos 2026'da yapılacak, o zamana kadar gerçek 2026 sırası YOK).
- Veri yeniden çekildi (`python scripts/fetchFromYokAtlasApi.py`) + Supabase'e yeniden basıldı (`npm run seed:universities`). JSON: 66.416 kayıt, yıllar **2022-2025** (2025=17.287). DB doğrulandı: Koç 203910699 → 2025:43/550.89 ✅, 2026 kaydı: 0.
- Uygulama kod değişikliği gerekmedi: varsayılan `year=2025` artık gerçek 2025'i gösteriyor.

**GELECEK — gerçek 2026 verisi için:** ÖSYM 2026 yerleştirme sonuçları (~Ağustos 2026) yayınlandıktan SONRA, YÖK Atlas kılavuzu bir yıl ilerleyince etiketsiz alan 2026 olur. O zaman script'teki yıl sabitlerini bir kaydırıp (etiketsiz→2026, suffix1→2025…) tekrar çek + seed et. Kaydırmadan önce mutlaka bilinen bir programı yokatlas.yok.gov.tr'de doğrula.

---

## YENİ ÖZELLİK — Devamsızlık Takibi + WhatsApp Bildirimi (Opus 5 planı, 2026-07-29)

**Kullanıcı isteği:** "öğrencilerin devamsızlıklarını takip edecek ve gerektiğinde öğrenci ve velisine aynı anda WhatsApp mesajı ile bu devamsızlığı bildirecek bir düzenek… sonra öğrenci bazında bu devamsızlıkları takip edecek bir özet ekran… devamsızlık girişinde varsa mazeret girişi ve bir seçim de olmalı."

**Roller (kullanıcı talimatı):** Opus 5 = tasarım/plan (bu bölüm). **Sonnet 5 = tüm yazılım işi.**

### Kullanıcı kararları (2026-07-29, Opus sordu)
1. **Giriş şekli: "Sadece devamsızlık kaydı"** — yoklama listesi YOK. Koç "+ Devamsızlık Ekle" der, öğrenci + tarih + durum + mazeret girer. → *Sonuç: katılım yüzdesi (%devam) HESAPLANAMAZ, çünkü payda (toplam ders sayısı) sistemde yok. Özet ekranı **mutlak sayılar** üzerine kurulacak — "%92 devam" gibi bir metrik ASLA gösterilmeyecek, uydurma olur.*
2. **Bildirim: kaydedince sor + manuel buton** — kayıt sonrası "Şimdi bildirilsin mi? (Öğrenciye/Veliye/Her ikisine)" onayı; ayrıca kayıt satırından ve öğrenci özetinden istendiği an tekrar gönderilebilir.
3. **Alanlar: sabit liste + serbest not** — mazeret ve oturum türü kodda sabit union tip (ayrı yönetim ekranı yok).

### A. Şema — `supabase/schema.sql` sonuna (idempotent, mevcut desenle)
```sql
create table if not exists attendance_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  absence_date date not null,
  session_type text not null default 'birebir'
    check (session_type in ('birebir','etut','grup','online')),
  status text not null default 'gelmedi'
    check (status in ('gelmedi','gec_geldi','erken_ayrildi')),
  excuse_type text not null default 'yok'
    check (excuse_type in ('yok','hastalik','ailevi','okul_sinav','ulasim','izinli','diger')),
  excuse_note text,
  notified_at timestamptz,          -- WhatsApp penceresi açıldığında damgalanır
  notified_to text,                 -- 'ogrenci' | 'veli' | 'ikisi' | null
  created_at timestamptz not null default now(),
  unique (student_id, absence_date, session_type)
);
create index if not exists attendance_records_student_idx on attendance_records(student_id);
create index if not exists attendance_records_date_idx on attendance_records(absence_date desc);
```
- **Mazeretli/mazeretsiz ayrı kolon DEĞİL, türetilir:** `excuse_type = 'yok'` → **mazeretsiz**. Ekstra `is_excused` kolonu tutulmayacak (iki kaynak = tutarsızlık riski).
- **RLS:** `students` deseniyle birebir (`schema.sql:196-213`): `enable row level security` + tek `for all` politikası, `exists (select 1 from students s where s.id = student_id and s.coach_id = auth.uid())` hem `using` hem `with check`. **Kural gereği önce `drop policy if exists`, sonra `create policy`** (bkz. idempotency notu, `schema.sql`).
- **DELETE serbest** (müfredat/öğrencinin aksine): yaprak tablo, hiçbir şey buna cascade bağlı değil, yanlış girilen kayıt silinebilmeli.
- `unique (student_id, absence_date, session_type)`: aynı gün aynı oturum için çift kayıt engellenir; aynı gün farklı oturum türü serbest. Insert'te `23505` hatası "Bu öğrenci için bu tarih ve oturum türünde kayıt zaten var" mesajına çevrilecek.

### B. Tipler — `src/types/database.ts`
⚠️ **`type` kullan, `interface` DEĞİL** (postgrest-js tip çıkarımı sessizce `never`'a düşüyor — bkz. "Önemli tip notu").
```ts
export type SessionType = 'birebir' | 'etut' | 'grup' | 'online'
export type AbsenceStatus = 'gelmedi' | 'gec_geldi' | 'erken_ayrildi'
export type ExcuseType = 'yok' | 'hastalik' | 'ailevi' | 'okul_sinav' | 'ulasim' | 'izinli' | 'diger'
export type NotifyTarget = 'ogrenci' | 'veli' | 'ikisi'
export type AttendanceRecord = { id, student_id, absence_date, session_type, status,
  excuse_type, excuse_note: string|null, notified_at: string|null,
  notified_to: NotifyTarget|null, created_at }
```
+ `Database.public.Tables.attendance_records: TableDef<AttendanceRecord>`.
Türkçe etiket haritaları (`SESSION_LABELS`, `STATUS_LABELS`, `EXCUSE_LABELS`) tek yerde — sayfa dosyasında değil, `src/lib/attendance.ts`'te (tablo, modal, WhatsApp şablonu üçü de kullanacak).

### C. Ortak WhatsApp modülü — `src/lib/whatsapp.ts` (YENİ)
`formatPhoneForWhatsApp` şu an **3 yerde kopyalanmış** (`ProgramPage.tsx:117`, `OgrencilerPage.tsx:533,550`). Yeni modüle taşı: `formatPhoneForWhatsApp(raw)` + `openWhatsAppChat(phone, message)`. Yeni kod bunu kullanacak; `ProgramPage`/`OgrencilerPage` de bu modüle bağlanacak (davranış birebir aynı kalmalı, dokunulan yerler build+gözle doğrulanacak).

### D. Ekran 1 — `/devamsizlik` (Sidebar: "Devamsızlık", `UserX` ikonu, Program'dan sonra)
`src/pages/DevamsizlikPage.tsx`. İki sekme:

**Sekme "Kayıtlar"** (varsayılan)
- Üstte 4 özet kutusu: *Bu ay toplam*, *Bu ay mazeretsiz*, *Bildirilmemiş kayıt*, *Son 30 günde en çok devamsızlık yapan öğrenci*.
- Filtreler: öğrenci (seçici), tarih aralığı (varsayılan son 90 gün), mazeret durumu (Hepsi / Mazeretli / Mazeretsiz), oturum türü.
- Tablo (tarihe göre azalan): **Tarih · Öğrenci · Oturum · Durum · Mazeret · Not · Bildirim · ⋯**
  - Bildirim kolonu: `—` ya da `✓ 29.07 · Öğrenci+Veli`.
  - `⋯` menüsü: **WhatsApp ile Bildir** (Öğrenciye/Veliye/Her ikisine) · **Düzenle** · **Sil** (onaylı).
- Sağ üstte **"+ Devamsızlık Ekle"**.

**Sekme "Öğrenci Özeti"** ← kullanıcının istediği özet ekran
- Aktif öğrenci başına bir kart/satır: fotoğraf + ad, **Toplam devamsızlık**, **Mazeretsiz** (kırmızı), **Son 30 gün**, **Son devamsızlık tarihi**, mini aylık dağılım (`Sparkline`, mevcut komponent).
- **Uyarı rozeti:** son 30 günde ≥3 devamsızlık **veya** ≥2 mazeretsiz → turuncu "Takip gerekli" rozeti. Eşikler dosya başında sabit olarak tanımlansın (`ABSENCE_ALERT_THRESHOLDS`) ki sonradan değiştirilebilsin.
- Devamsızlığı olmayan öğrenci "Devamsızlık yok" ile en altta, sönük.
- Karta tıkla → altında o öğrencinin tüm kayıt listesi açılır + **"Veliye Özet Gönder"** butonu (aşağıdaki özet şablonu).
- Sıralama: mazeretsiz sayısına göre azalan (en çok takip gerektiren üstte).

### E. Ekran 2 — `AddAbsenceModal.tsx` (`src/components/attendance/`)
`AddStudentModal.tsx` desenini birebir izle (aynı `.modal-overlay`/`.modal-panel` stilleri, ekleme+düzenleme aynı modal).
Alanlar: **Öğrenci** (aktif öğrenciler; sayfada öğrenci filtresi seçiliyse ön-dolu) · **Tarih** (varsayılan bugün, gelecek tarih engelli) · **Oturum Türü** · **Durum** · **Mazeret** (varsayılan "Mazeret bildirilmedi") · **Not** (serbest metin, opsiyonel).
Butonlar: **İptal** · **Kaydet** · **Kaydet ve Bildir**.
- "Kaydet" → insert sonrası `window.confirm("Kayıt eklendi. Şimdi WhatsApp ile bildirilsin mi?")`; evet → alıcı seçimi.
- "Kaydet ve Bildir" → insert + doğrudan alıcı seçimi.
- Telefon yoksa `ProgramPage.tsx:135-142`'deki uyarı metni deseniyle uyar, kaydı yine de tut (kayıt bildirimden bağımsız).

### F. WhatsApp mesaj şablonları (`src/lib/attendance.ts`)
**Öğrenciye (mazeretli):**
> Merhaba {ad}, {tarih} tarihli {oturum} çalışmana katılamadığını kaydettik. Mazeret: {mazeret}. Kaçırdığın konuları telafi etmek için en kısa sürede planlama yapalım. — Netlik Koçluk

**Öğrenciye (mazeretsiz):**
> Merhaba {ad}, {tarih} tarihli {oturum} çalışmasına katılmadın ve bir mazeret bildirilmedi. Lütfen en kısa sürede iletişime geç. — Netlik Koçluk

**Veliye:**
> Merhaba, {ad} {tarih} tarihli {oturum} çalışmasına katılmadı. Mazeret: {mazeret / "bildirilmedi"}. Bilginize. — Netlik Koçluk

**Veliye özet (Öğrenci Özeti sekmesinden):**
> Merhaba, {ad} için devamsızlık özeti ({başlangıç}–{bitiş}): toplam {n} devamsızlık, {m} tanesi mazeretsiz. Son devamsızlık: {tarih}. Görüşmek üzere. — Netlik Koçluk

"Her ikisine" seçilirse **iki ayrı sekme** açılır (öğrenci mesajı + veli mesajı ayrı metinlerle) — `ProgramPage.tsx:160-165` deseni; pop-up engelleyici uyarısı da aynı şekilde verilsin.

### G. Bildirim damgası — dürüstlük kuralı
`wa.me`/`api.whatsapp.com` linki sadece **sohbeti açar**; mesajın gerçekten gönderildiğini uygulama BİLEMEZ. Bu yüzden:
- Pencere açıldığında `notified_at`/`notified_to` güncellenir,
- UI'da bu **"Bildirildi"** değil, **"WhatsApp açıldı · 29.07"** olarak yazılır (tooltip: "Mesajın gönderildiğini uygulama doğrulayamaz").
- Aynı kayıt için tekrar gönderim serbest, damga güncellenir.

### H. Entegrasyon noktaları (küçük ama gerekli)
- `src/App.tsx`: `/devamsizlik` route. `Sidebar.tsx`: nav öğesi.
- `OgrencilerPage.tsx` profil başlığı: küçük rozet — "Devamsızlık: 4 (2 mazeretsiz)" → `/devamsizlik` öğrenci filtresine link.
- `YardimPage.tsx`: yeni ekran kartı (ne işe yarar, ne zaman kullanılır).
- `SurumGecmisiPage.tsx`: **v0.16** girişi (2026-07-29, Devamsızlık Takibi).

### I. Kapsam dışı (bilerek)
- Yoklama/katılım yüzdesi, sabit haftalık ders takvimi (kullanıcı "sadece devamsızlık kaydı" dedi).
- Otomatik/zamanlanmış bildirim (WhatsApp Business API gerekir; şu anki yöntem sekme açan manuel link).
- Mazeret/oturum türlerinin arayüzden düzenlenmesi (kullanıcı sabit liste seçti).

### J. Kabul kriterleri (Sonnet teslimden önce doğrulayacak)
1. `npx tsc -b` ve `npm run build` **temiz**.
2. `supabase/schema.sql` **iki kez üst üste** çalıştırıldığında hata vermez (idempotent).
3. Kayıt ekle → listede görünür; aynı öğrenci/tarih/oturum tekrar denenince anlaşılır Türkçe hata.
4. Öğrenci Özeti sekmesi mazeretli/mazeretsiz sayılarını doğru ayırır (`excuse_type='yok'` → mazeretsiz).
5. "Her ikisine" iki sekme açar, mesajlar farklıdır, `notified_to='ikisi'` yazılır.
6. Telefonsuz öğrencide uyarı çıkar, kayıt yine de durur.
7. ⚠️ Supabase **1000 satır cap** (bkz. yukarıdaki genel bulgu): özet hesapları client-side ise `count`+`range` sayfalaması ya da tarih aralığı kısıtı ile güvenceye alınsın.

### Durum
- [x] Tasarım — **Opus 5** (2026-07-29).
- [x] Uygulama — **Sonnet 5** (2026-07-29). Tasarımın A–J maddeleri eksiksiz uygulandı.
- [ ] **Kullanıcı eylemi:** `supabase/schema.sql` Supabase SQL Editor'de tekrar çalıştırılacak (idempotent, güvenli — iki kez üst üste çalıştırılabilir doğrulandı) → `attendance_records` tablosu + RLS oluşsun. Bu adım tamamlanmadan `/devamsizlik` ekranı "Devamsızlık verileri yüklenemedi" hatası gösterir (uygulama çökmüyor, sadece tablo yok diye net bir hata basıyor).

**Teslim notu (Sonnet 5, 2026-07-29):**
- **Şema:** `supabase/schema.sql` sonuna `attendance_records` tablosu + index'ler + RLS eklendi (students deseniyle birebir: `for all` + `exists(...s.coach_id = auth.uid())`; DELETE serbest, yaprak tablo). `unique(student_id, absence_date, session_type)` ile aynı gün/oturum çift kaydı engelleniyor.
- **Tipler:** `src/types/database.ts`'e `SessionType`/`AbsenceStatus`/`ExcuseType`/`NotifyTarget`/`AttendanceRecord` (`type`, `interface` değil) + `Database.public.Tables.attendance_records` eklendi.
- **Yeni dosyalar:** `src/lib/whatsapp.ts` (ortak `formatPhoneForWhatsApp`/`openWhatsAppChat` — önceden `ProgramPage.tsx` ve `OgrencilerPage.tsx`'te kopyalanmıştı, şimdi tek kaynak), `src/lib/attendance.ts` (Türkçe etiket haritaları, `ABSENCE_ALERT_THRESHOLDS`, tarih yardımcıları, WhatsApp mesaj şablonları, `planAttendanceNotification`), `src/components/attendance/AddAbsenceModal.tsx` (AddStudentModal deseni, "Kaydet"/"Kaydet ve Bildir"), `src/pages/DevamsizlikPage.tsx` (Kayıtlar + Öğrenci Özeti iki sekme, 4 özet kutusu, filtreler, ⋯ menüsü, WhatsApp alıcı seçim popover'ı, "Takip gerekli" rozeti).
- **Değişen dosyalar:** `src/App.tsx` (+`/devamsizlik` route), `src/components/layout/Sidebar.tsx` (+"Devamsızlık" nav, `UserX` ikonu, Program'dan sonra), `src/pages/ProgramPage.tsx` (yerel WhatsApp fonksiyonları kaldırıldı, `lib/whatsapp.ts`'ten import — davranış aynı), `src/pages/OgrencilerPage.tsx` (profil telefon linkleri `formatPhoneForWhatsApp` kullanıyor + profil başlığına devamsızlık rozeti eklendi, tablo yoksa sessizce 0 gösterip sayfayı çökertmiyor), `src/pages/YardimPage.tsx` (+Devamsızlık kartı), `src/pages/SurumGecmisiPage.tsx` (+v0.16 girişi, 29 Temmuz 2026).
- **1000 satır cap tedbiri:** `DevamsizlikPage.tsx`'teki `fetchAllAttendanceRecords` tüm kayıtları `.range()` ile sayfalayarak çekiyor (tek `.select()`'e güvenmiyor) — özet hesapları (toplam/mazeretsiz/son 30 gün) bu yüzden ölçek büyüse de doğru kalır.
- **Build:** `npx tsc -b` temiz (exit 0), `npm run build` temiz (vite build başarılı), `npm run lint` (oxlint) yeni dosyalarda sıfır uyarı — mevcut ön-var olan uyarılar (unused catch param, exhaustive-deps) bu işten önce de vardı, dokunulmadı.
- **Görsel doğrulama yapılmadı** — Supabase'de tablo henüz oluşmadığı için tarayıcıda uçtan uca test edilemedi; kullanıcı SQL'i çalıştırdıktan sonra yapılmalı.

#### ✅ Opus — Canlı uçtan uca test (2026-07-29, dev sunucusu + gerçek Supabase)
Kullanıcı `schema.sql`'i çalıştırdıktan sonra hem DB hem arayüz denendi. Test "Misafir Koç" hesabıyla yapıldı (gerçek öğrenci verisinden izole), tüm test kayıtları silindi — `attendance_records` tekrar **0 satır**.
- **DB katmanı:** tablo oluşmuş; `unique(student_id, absence_date, session_type)` → `23505`; `check` kısıtı geçersiz `excuse_type`'ı reddediyor → `23514`; RLS sağlam — giriş yapmamış istemci **okuyamıyor** ve **yazamıyor** (`42501`).
- **Arayüz:** kayıt ekleme → liste + 4 özet kutusu anında güncellendi; mükerrer kayıt Türkçe hata verdi (çökme yok); aynı gün farklı oturum türü kabul edildi; Öğrenci Özeti sekmesi (Toplam/Mazeretsiz/Son 30 gün + sparkline, devamsızlığı olmayan öğrenci sönük altta) doğru; satır silme çalışıyor.
- **WhatsApp:** `window.open` yakalanarak doğrulandı (gerçek mesaj gönderilmedi) — "Her İkisine" **2 pencere**, öğrenci ve veli metinleri farklı, telefon `90…` 12 haneye normalize, `notified_to='ikisi'` yazıldı, tabloda **"WhatsApp açıldı · 29/07 · Öğrenci+Veli"** göründü ve "Bildirilmemiş kayıt" sayacı düştü. Veli özet mesajı da doğru üretildi.
- 🔧 **Testte bulunan ve düzeltilen kusur (Opus):** satır `⋯` menüsü tablo kabının `overflowX: auto`'suna takılıp **dikeyde kırpılıyordu** — az satır varken "Düzenle"/"Sil" tıklanamıyordu (kaydırmak da çözmüyordu, çünkü menü kabın içinde). Menü `position: absolute` yerine **`position: fixed` + butonun `getBoundingClientRect()` çapası** ile yeniden konumlandırıldı (`DevamsizlikPage.tsx`, `menuAnchor` state'i). Tarayıcıda doğrulandı: üç seçenek de tam görünüyor. `npx tsc -b` + `npm run build` temiz.
- **Kalan:** commit + Vercel deploy (kullanıcı kararı bekliyor).

#### ✅ Opus — 2. test turu: uç durumlar + regresyon (2026-07-29)
Misafir Koç hesabında 5 çeşitli test kaydı seed'lendi, denendi, hepsi silindi.
- **Filtreler:** mazeret durumu (mazeretsiz → yalnız 3 mazeretsiz kayıt), oturum türü, tarih aralığı (aralık genişletilince kapsam dışı Mart kaydı göründü), öğrenci — hepsi doğru.
- **Öğrenci Özeti:** Ece 5 toplam / 3 mazeretsiz / son 30 günde 4 → **"Takip gerekli"** rozeti çıktı; Ela Duru 1/0/1 → rozet yok; sıralama mazeretsize göre doğru.
- **Düzenleme:** modal ön-dolu açılıyor, öğrenci seçici **disabled**, "Kaydet ve Bildir" yok (düzenlemede bildirim sorulmaması doğru), değişiklik kaydedildi.
- **Gelecek tarih:** tarih girdisinde `max="bugün"` var — istemci tarafı engel. (DB'de gelecek tarih CHECK'i yok; pratikte sorun değil, bilinsin.)
- **Telefon eksikliği:** `planAttendanceNotification` saf fonksiyonu doğrudan çalıştırılarak 6 kombinasyon test edildi — eksik taraf doğru raporlanıyor, çağıran taraf uyarıp **erken dönüyor** (bildirim damgası yazılmıyor). ⚠️ Davranış notu: "Her İkisine" seçilip tek numara eksikse **hiç** gönderilmiyor (ProgramPage ile tutarlı); koçun tek alıcı seçmesi gerekir.
- **Regresyon (ortak `whatsapp.ts` modülü):** `/program` "WhatsApp ile Gönder → Her İkisine" hâlâ 2 pencere + doğru iki metin üretiyor; `/ogrenciler` telefon linkleri ve profil rozeti **"Devamsızlık: 5 (3 mazeretsiz)"** doğru çalışıyor.
- ℹ️ **Küçük tutarlılık notu (düzeltilmedi, kullanıcı kararı):** "BİLDİRİLMEMİŞ KAYIT" kutusu **tüm zamanları** sayıyor (kodda kasıtlı: `unnotifiedCount = allRecords.filter(!notified_at)`), ama yanındaki iki kutu "BU AY" etiketli — kafa karıştırabilir. İstenirse etiket "Bildirilmemiş (tümü)" yapılabilir.

#### 🚀 Deploy (2026-07-29)
- Commit `65e265f` — daha önce commit'lenmemiş YÖK Atlas yıl düzeltmesi + Tercih WhatsApp imzası (devamsızlık işine karışmasın diye ayrı commit).
- Commit `e0b92e0` — Devamsızlık takibi özelliğinin tamamı.
- `main`'e push edildi → Vercel otomatik deploy. Canlı JS bundle hash'i yerel build ile **birebir eşleşti**, `/devamsizlik` HTTP 200, canlı sitede görsel olarak doğrulandı: **https://netlik-koc-paneli.vercel.app/devamsizlik**

## Deneme bölüm skorları: düz metin → açılır tablo (kullanıcı isteği, 2026-07-29)
Kullanıcı: "deneme geçmişindeki denemelere tıkladığımda o tablodaki değerlerin güzel bir tablo gibi görünmesi daha iyi olur, şu an düz yazı gibi görünüyor."
- **Tespit:** bölüm skorları üç yerde de `sectionsList.map(...).join(' · ')` ile tek satır metne çevriliyordu ve denemeler **hiç tıklanabilir değildi** (hiçbir yerde onClick yoktu).
- [x] Yeni ortak bileşen `src/components/exams/ExamSectionsTable.tsx` — Bölüm · Doğru · Yanlış · Boş · Soru · Net + "Toplam" satırı; doğru yeşil, yanlış kırmızı, net indigo; `tabular-nums` ile rakamlar hizalı; bölüm verisi yoksa açıklayıcı mesaj.
- [x] Üç görünüm de tıklanınca bu tabloyu açıyor (akordeon, ok işaretiyle): Deneme Girişi sağ sütunundaki geçmiş kartları, "Tüm Deneme Geçmişi" tablosu (detay satırı `colSpan`), öğrenci profili "Deneme Geçmişi" sekmesi. Satır içi Sil butonu ve öğrenci linki `stopPropagation` ile korundu.
- [x] `npx tsc -b` + `npm run build` temiz; lint'te yeni uyarı yok. Tarayıcıda üç görünüm de doğrulandı (bölüm verisi olmayan deneme dahil).
- [x] Sürüm Geçmişi'ne **v0.17** girişi eklendi.
- *Yapan:* **Opus 5**.
