# Netlik — YKS & LGS Koçluk Paneli

Eda Cangert'in koçluk merkezi için koç paneli. Öğrenci takibi, deneme sonuçları, konu bazlı yeterlilik, haftalık çalışma programı, devamsızlık ve tercih listesi hazırlamayı tek yerde yönetir. Öğrenci ve veli için ayrı bir mobil portalı vardır.

**İki müfredat, tek panel.** Öğrencinin sınıfı hangi müfredattan sorumlu olduğunu belirler: **7 ve 8. sınıf → LGS**, **9-12. sınıf ve mezunlar → YKS**. Ders ve konu listeleri, deneme bölümleri ve net hesabı buna göre değişir; koçun ayrıca bir şey seçmesi gerekmez.

**Canlı:** https://netlik-koc-paneli.vercel.app

## Ekranlar

### Koç paneli (giriş gerektirir)

| Ekran | Yol | Ne işe yarar |
|---|---|---|
| Koç Paneli | `/panel` | Tüm öğrenciler tek bakışta — kritik konu sayısı, son deneme netleri, haftalık tamamlama oranı |
| Öğrenciler | `/ogrenciler` | Öğrenci listesi/profili — ekleme, düzenleme, arşivleme, profil fotoğrafı, öğrenci + veli telefonu, mobil erişim linki gönderme |
| Deneme Girişi | `/denemeler` | Deneme sonucu girişi (net otomatik hesaplanır), açılır bölüm tablosu, tüm deneme geçmişi, sonucu WhatsApp ile gönderme. Sınav türü öğrencinin sınıfına kilitli: LGS öğrencisi yalnız LGS, YKS öğrencisi yalnız TYT/AYT girer |
| Konu Yeterlilik Haritası | `/konular` | Konu bazlı durum takibi, konu testi girişi, konu/ders ortalaması, "Koç Kararı" onayı. Yalnız öğrencinin sınıfına ait dersler ve konular listelenir |
| Haftalık Program | `/program` | Gün gün görev planlama (sürükle-bırak), tek sayfa yazdırma/PDF, WhatsApp ile gönderme |
| Devamsızlık | `/devamsizlik` | Devamsızlık kaydı (oturum türü, mazeret), öğrenci özeti, "Takip gerekli" rozeti, WhatsApp bildirimi |
| Haftalık Görüşme | `/raporlar` | Haftalık birebir görüşme özeti ve gelecek hafta planlaması |
| Müfredat | `/mufredat` | Ders/konu listesi yönetimi — **YKS** ve **LGS** sekmeleri. Yıldan yıla değişebilen müfredat için |
| Tercih Sihirbazı | `/tercih` | YÖK Atlas verisiyle (~66.400 program) bölüm arama, 11 filtre, ulaşılabilirlik durumu |
| Yardım | `/yardim` | Uygulama içi kullanım rehberi + **Sürüm Geçmişi** sekmesi (`?sekme=surum`) |

### Mobil portal (giriş yok, erişim koduyla)

| Ekran | Yol | Kim |
|---|---|---|
| Portal girişi | `/portal` | Erişim kodu girilir. `/portal?code=STU-XXXXXX` linkiyle otomatik giriş yapılır. |
| Öğrenci portalı | `/ogrenci` | Haftalık programı gün gün görür, görevi tamamlandı işaretler, bölüm bazlı deneme sonucu girer. |
| Veli portalı | `/veli` | Salt-okunur özet: tamamlama oranı, son deneme neti, deneme geçmişi, devamsızlık. |

Erişim kodları koç panelinden üretilir (öğrenci profilindeki "Öğrenci Linki" / "Veli Linki" butonları) ve WhatsApp ile gönderilir. Öğrenci/veli bir Supabase kullanıcısı değildir — kod, sunucudaki `SECURITY DEFINER` fonksiyonlarına gönderilen bir bearer token gibi çalışır (`supabase/schema.sql` içindeki `portal_*` fonksiyonları). Portal tarafında tablolara doğrudan sorgu atılmaz.

## Teknoloji

Vite + React + TypeScript + [Supabase](https://supabase.com) (Postgres + Auth + Storage). Tasarım sistemi: `src/styles/tokens.css` + `src/styles/global.css`.

## Kurulum

```bash
npm install
cp .env.example .env.local   # Supabase Project URL ve anon key'i doldur
npm run dev
```

Supabase tarafında yapılması gerekenler (bir kere):
1. [supabase.com](https://supabase.com) üzerinde yeni proje oluştur.
2. SQL Editor'de `supabase/schema.sql`'in tamamını çalıştır (idempotent — güvenle tekrar tekrar çalıştırılabilir).
3. Project Settings → API'den URL ve anon key'i `.env.local`'a yapıştır.
4. Authentication → Users'dan kendine bir koç hesabı aç, `profiles` tablosuna karşılık gelen satırı ekle.

> Şema her değiştiğinde `supabase/schema.sql` yeniden çalıştırılmalıdır — uygulama içinden DDL çalıştırılmaz.

## Script'ler

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Prodüksiyon derlemesi (`tsc -b && vite build`). `src/types/database.test-d.ts` derleme-zamanı tip testleri de burada koşar. |
| `npm run test:types` | `src/types/database.ts` ile `supabase/schema.sql` arasındaki kaymayı **statik** denetler (DB'ye bağlanmaz). Şemaya ya da tip dosyasına dokunan her değişiklikten sonra çalıştır. |
| `npm run lint` | Oxlint |
| `npm run preview` | Derlenmiş çıktıyı yerelde önizle |
| `npm run backup` | Tüm öğrenci verisini + profil fotoğraflarını `backups/YYYY-MM-DD/`'ye indirir. `SUPABASE_SERVICE_ROLE_KEY` gerektirir. |
| `npm run restore` | Yedeği geri yükler (FK bağımlılık sırasına göre). |
| `npm run generate:access-codes` | Kodu olmayan öğrencilere mobil portal erişim kodu üretir. |
| `npm run seed:lgs` | LGS **8. sınıf** müfredatını yükler (`src/data/lgsMufredat.json`). Hiçbir şey silmez, satır satır upsert eder — tekrar tekrar çalıştırılabilir. |
| `npm run seed:lgs7` | LGS **7. sınıf** müfredatını yükler (`src/data/lgsMufredat7.json`) ve mevcut LGS konularını geriye dönük `8. Sınıf` olarak damgalar. Aynı şekilde silme yapmaz. |
| `npm run seed:universities` | YÖK Atlas verisini `university_rankings` tablosuna yükler (`src/data/universityRankings.json` gerekir). |
| `npm run seed` | ⚠️ **Dikkatli kullan** — `subjects`/`topics` tablosunu tamamen silip `src/tytSubjects.json`'daki **eski** listeyle yeniden doldurur (cascade ile bağlı öğrenci verisini de siler). Çalıştırmadan önce `coordination.md`'ye bak. |

## Yedekleme

`npm run backup` 18 tablodan 16'sını ve `student-photos` bucket'ını tarih damgalı klasöre indirir. Kapsam dışı ikisi script'ten yeniden üretilebilen referans veridir: `university_rankings` ve `permission_catalog`. `.github/workflows/backup.yml` her gece otomatik çalışır.

⚠️ **Yedekler gerçek öğrenci ve veli adı/telefonu içerir.** `backups/` klasörü `.gitignore`'dadır; otomatik yedeğin gönderildiği depo **private** olmalıdır. Gerekli GitHub secret'ları: `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, (opsiyonel) `BACKUP_REPO_TOKEN` + `BACKUP_REPO_URL`.

## Deploy

Vercel'e bağlı (proje: `netlik-koc-paneli`). **`main`'e push edilince otomatik deploy olur**; elle `vercel --prod` de çalışır. Production ortamına sadece client-safe değişkenler eklenmeli: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — `SUPABASE_SERVICE_ROLE_KEY` asla.

## Proje geçmişi ve koordinasyon

- **`coordination.md`** — kim ne üzerinde çalışıyor, iş dağılımı (Opus/Sonnet/Fable/Antigravity), aktif ve tamamlanan görevler, mimari kararlar ve bulunan tuzaklar.
- **`CLAUDE.md`** — proje belleği: mimari özet, teslimden önce çalıştırılacaklar, bilinen tuzaklar.
- **`/yardim?sekme=surum`** — uygulama içinden, tarihli tam değişiklik günlüğü.
