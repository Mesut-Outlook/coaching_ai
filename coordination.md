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
- [x] Bug fix: "Öğrenci Ekle" butonu hiçbir yere bağlı değildi (`PanelPage.tsx`'te `onClick` yoktu, `OgrencilerPage.tsx`'te `/panel`'e yönlendirip döngü oluşturuyordu — gerçek bir ekleme akışı hiç yazılmamış). `src/components/students/AddStudentModal.tsx` eklendi: `students` tablosuna gerçek Supabase insert yapan modal, her iki sayfaya da bağlandı. `.modal-overlay`/`.modal-panel` stilleri `global.css`'e eklendi. Kullanıcı tarafından tarayıcıda test edildi ve doğrulandı ("güzel çalışıyor").
- [x] Haftalık Program (`ProgramPage.tsx`) görev ekleme formu: konu seçimi artık tek uzun listeden değil, önce **Ders** sonra o derse ait **Konu** seçilecek şekilde iki adımlı. Kullanıcı isteği üzerine eklendi, tarayıcıda test edildi.
- [x] Marka logosu: kullanıcının sağladığı crest/arma görselinden (`Eda Cangert · Netlik Coaching`) kare bir madalyon kırpıldı (`public/logo.png`, `public/favicon.png`). `Sidebar.tsx` ve `LoginPage.tsx`'teki eski `Target` ikonu (lucide) bu logoyla değiştirildi, `index.html` favicon'u güncellendi, eski `favicon.svg` kaldırıldı. `.brand-mark` CSS'i yuvarlak/`overflow:hidden` çerçeveye çevrildi.
- [x] Koç için kullanım rehberi (basit sunum) hazırlandı — gerçek ekran görüntüleriyle 6 ekranın ne işe yaradığını ve ne zaman kullanılacağını anlatan HTML slayt artifact: https://claude.ai/code/artifact/7b356fea-fcd3-4dda-af5f-af6044b5e3c5
- [ ] Kaynak: `/home/mesuto/Downloads/07093256_2022-TYT-Konulari.pdf` — resmi TYT konu listesi (141 konu / 10 ders). Antigravity'nin bağımsız olarak ayrıştırdığı `src/tytSubjects.json` ile örtüşüyor, aşağıdaki seed görevinde o kullanılacak.
- [x] Uygulama içi **Yardım** sayfası (`src/pages/YardimPage.tsx`, route `/yardim`): her ekranı (Panel, Öğrenciler, Deneme Girişi, Yeterlilik Haritası, Haftalık Program, Haftalık Görüşme, Müfredat) kart olarak açıklıyor — ne işe yaradığı, ne zaman kullanılacağı, ekrana giden link. Sidebar'a "Yardım" linki eklendi, Koç Paneli'nin (ana sayfa) başlığına da "Yardım" butonu eklendi. Küçük yan düzeltme: `.btn` sınıfı `<Link>` (a etiketi) üzerinde kullanılınca alt çizgi çıkıyordu (`OgrencilerPage.tsx`'teki birkaç linkte de vardı) — `global.css`'e `text-decoration: none` eklenerek hepsi düzeltildi.
- [x] Deploy: proje Vercel'e bağlandı (proje adı `netlik-koc-paneli`, GitHub reposuna da bağlı), client-safe Supabase env değişkenleri (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — service_role KESİNLİKLE eklenmedi) production ortamına eklendi. Canlı adres: **https://netlik-koc-paneli.vercel.app**. Ayrıca kullanıcının arkadaşının test etmesi için Supabase'de ayrı bir "Misafir Koç" test hesabı açıldı (kendi öğrenci verisinden izole, boş başlıyor).
- [x] Deploy bug fix: `/panel`, `/yardim` gibi alt route'lara doğrudan gidildiğinde (ya da sayfa yenilendiğinde) Vercel 404 veriyordu — SPA'da sunucu tarafında bu path'ler yok, sadece `index.html` var. `vercel.json`'a `rewrites: [{ source: "/(.*)", destination: "/index.html" }]` eklenip tüm route'lar 200 dönecek şekilde düzeltildi.
- [x] `schema.sql` idempotency bug fix: kullanıcı dosyayı tekrar çalıştırınca `policy "profiles: ..." already exists` hatası aldı — dosyadaki en eski `create policy` satırları (agy'nin yeni eklediği storage politikalarının aksine) `drop policy if exists` ile korunmuyordu. Tüm 18 `create policy` satırının önüne eşleşen `drop policy if exists` eklendi (artık 18/18). `create table`/`create index`/`alter table add column` zaten hepsi `if not exists` ile güvenliydi, doğrulandı. Dosya artık projenin herhangi bir aşamasından itibaren tekrar tekrar güvenle çalıştırılabilir. **Bundan sonra yeni policy eklenirken bu desen (önce drop if exists, sonra create) korunmalı.**

**Önemli tip notu:** Supabase `Database` tipindeki (`src/types/database.ts`) satır tipleri `interface` DEĞİL `type` olarak tanımlanmalı — `interface` kullanılırsa postgrest-js'in sorgu sonucu tip çıkarımı sessizce `never`'a düşüyor (saatlerce debug edildi, kök neden bu). Yeni tablo/tip eklerken bu deseni koru.

**Mimari not — iki paralel tip sistemi var, birleştirilmesi gerekiyor:** Bu tur sırasında ben (Sonnet) Supabase şemasını (`supabase/schema.sql` + `src/types/database.ts`) kurarken, Antigravity paralelde kendi tip sistemini (`src/types/coaching.ts`) ve mock veri katmanını (`src/mockData.json`, `scripts/generateMockData.cjs`) yazmış — ikisi aynı alanı farklı isimlerle modelliyor (örn. `track: 'SÖZ'` vs `'SOZ'`, `grade: 'Mezun'` vs `'MEZUN'`). **Kalıcı veri katmanı artık `src/types/database.ts` + Supabase'dir** — `coaching.ts`/`mockData.json` siliniyor değil ama uygulama ekranları onları kullanmamalı. `yksCalculator.ts`'deki `calculateNet(doğru, yanlış)` fonksiyonu şemadan bağımsız, saf matematik — o doğrudan kullanılabilir.

## Antigravity — Bağımsız Küçük Modüller (tamamlanan)
- [x] TypeScript tip tanımlamaları (`src/types/coaching.ts`) — yukarıdaki mimari nota bkz., ekranlarda `src/types/database.ts` kullanılıyor artık
- [x] YKS Net ve İstatistik Hesaplayıcı yardımcı modülü (`src/utils/yksCalculator.ts`) — `calculateNet` doğrudan kullanılabilir
- [x] Gerçekçi test verisi üretici script (`scripts/generateMockData.cjs`) ve veri dosyası (`src/mockData.json`)
- [x] Resmi TYT konu listesi PDF ayrıştırıcı script (`scripts/parse_subjects.py`) ve veritabanı dosyası (`src/tytSubjects.json`) (141 konu / 10 ders) — aşağıdaki seed görevinde doğrudan kullanılacak
- [x] Giriş ekranında "Beni Hatırla" (Remember Me) checkbox'ı ve mantığı (`src/pages/LoginPage.tsx`) — email bilgisinin yerel depolamada saklanması ve otomatik doldurulması.
- [x] Haftalık programda çift tıklama ile inline görev düzenleme formu (`src/pages/ProgramPage.tsx`) — Kartın üzerine çift tıklandığında ders, konu, soru sayısı ve deneme durumu doğrudan kartın kendi alanında düzenlenip Supabase'e kaydedilebilir.

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
- [ ] **Kullanıcı eylemi gerekiyor:** `is_active` sütunu henüz gerçek Supabase projesinde yok — `supabase/schema.sql`'in tamamını (ya da en azından 61-62. satırlardaki iki `alter table` satırını) SQL Editor'de tekrar çalıştırman lazım, yoksa `/mufredat` ekranı hata verir.

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

