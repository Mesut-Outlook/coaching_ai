# Coching_AI — Proje Belleği

## Ne inşa ediyoruz
Eda Cangert'in YKS (üniversite giriş sınavı) koçluk merkezi için web/mobil bir uygulama. Web dashboard tarafı için ilk tasarım turu tamamlandı: "Netlik" adlı koç paneli, 5 ekran (Koç Paneli, Öğrenci Profili, Konu Yeterlilik Haritası, Deneme Girişi, Haftalık Görüşme). Tasarım artifact'i: https://claude.ai/code/artifact/04e9bd11-0c63-4c43-b126-6fe457d037e8

Yazılım tarafı tamamlandı: **Vite + React + TypeScript + Supabase**. Auth, tasarım sistemi, routing/layout ve tüm ana ekranlar (Koç Paneli, Öğrenciler, Konu Yeterlilik Haritası, Deneme Girişi, Haftalık Program, Devamsızlık Takibi, Haftalık Görüşme, Müfredat, Tercih Sihirbazı, Mobil Öğrenci & Veli Portalı, Yardım) gerçek Supabase sorgularına ve veritabanı tiplerine bağlı olarak çalışmaktadır. Şema: `supabase/schema.sql` (idempotent — tekrar tekrar güvenle çalıştırılabilir). Öne çıkan özellikler:
- **Öğrenciler**: ekleme/düzenleme/arşivleme/kalıcı silme, profil fotoğrafı (Supabase Storage), öğrenci + veli telefonu, mobil erişim kodu (PIN) üretme ve WhatsApp ile "Öğrenci Linki" / "Veli Linki" gönderme.
- **Tercih Sihirbazı** (`/tercih`): YÖK Atlas REST API'den derlenmiş ~66.400 üniversite programı, 11 kriterli filtreleme, başarı sırası aralığı, Türkçe-duyarsız arama (PostgREST `imatch`), ulaşılabilirlik durumu (Ulaşılabilir/Riskli/Zor) ve çıktı alma/WhatsApp paylaşma.
- **Devamsızlık Takibi** (`/devamsizlik`): Oturum türü (birebir/etüt/vb.), mazeret notu, WhatsApp bildirim açılış takibi, dürüst damgalama ("gönderildi" değil "WhatsApp açıldı"), "Takip gerekli" eşik rozetleri ve veli özet mesajı.
- **Mobil Öğrenci & Veli Portalı** (`/portal`, `/ogrenci`, `/veli`): erişim koduyla (PIN) giriş, SECURITY DEFINER RPC katmanı (`portal_login`, `portal_dashboard`, `portal_set_task_completed`, `portal_add_exam`), öğrenci görev tamamlama + bölüm bazlı deneme girişi, veli için salt-okunur özet. Rol renkleri `src/lib/portalTheme.ts` (öğrenci indigo, veli teal).
- **Yardım** (`/yardim`): ekran ekran kullanım rehberi + **Sürüm Geçmişi sekmesi** (`?sekme=surum`; eski `/surum-gecmisi` yolu buraya yönlendiriyor). Mobil portal kartında tıklayınca büyüyen ekran görüntüleri var (`public/yardim/*.webp`).
- **Yedekleme & Geri Yükleme** (`npm run backup`, `npm run restore`): 12 tablodan **11'ini** (`university_rankings` hariç — script'ten yeniden üretilebilen referans veri) ve `student-photos` storage bucket'ını tarihli JSON + görsel yedeği olarak indirir. `.github/workflows/backup.yml` ile her gece saat 05:00 TSİ otomatik çalışır, istenirse gizli (private) GitHub reposuna aktarır.

Service-role key kullanarak RLS kurallarını bypass eden ve `src/tytSubjects.json` müfredatını seede hazır hale getiren bir seed script'i (`scripts/seedSupabase.ts`) ve `npm run seed` komutu var — **⚠️ dikkat: bu script `subjects` tablosunu tamamen silip eski listeyle dolduruyor, cascade ile öğrenci verisini de siliyor, tekrar çalıştırmadan önce coordination.md'ye bak.** Proje `npm run build` ile hatasız derleniyor ve **canlı yayında**: https://netlik-koc-paneli.vercel.app — Vercel GitHub reposuna bağlı, **`main`'e push edilince otomatik deploy oluyor** (elle `vercel --prod` de mümkün). Deploy doğrulaması: yereldeki `dist/assets/index-*.js` hash'i ile canlı `index.html`'deki hash eşleşene kadar bekle. Kullanıcı için ekran görüntülü kullanım rehberi: https://claude.ai/code/artifact/7b356fea-fcd3-4dda-af5f-af6044b5e3c5

## İş dağılımı (kullanıcı talimatı)
- **Sonnet**: tüm yazılım/implementasyon işleri (frontend, backend, entegrasyon, test).
- **Fable**: sadece planlama ve tasarım işleri (UX akışları, ekran tasarımları, ürün kararları) — kod yazmaz.
- **Opus**: mimari kararlar, koordinasyon, veri pipeline'ları, UI refactoring.
- **Antigravity (agy)**: hem bağımsız küçük modüller, yedekleme/script altyapıları, hem de büyük, iyi tanımlanmış görevler alabilir — aktif olarak coordination.md'yi takip edip görev alıyor.

Güncel görev listesi ve kimin ne yaptığı **coordination.md** dosyasında tutuluyor — yeni bir iş başlatmadan önce oraya bak, iş bitince orayı güncelle.

## Teslimden önce çalıştırılacaklar
- `npm run build` (= `tsc -b` + vite) — `src/types/database.test-d.ts` derleme-zamanı tip testleri de burada koşar.
- `npm run test:types` — `src/types/database.ts` ile `supabase/schema.sql` arasındaki kaymayı statik olarak denetler (DB'ye bağlanmaz). **Şemaya ya da tip dosyasına dokunan her iş bunu koşsun.**
- `npm run lint` (oxlint) — mevcut eski uyarılar var, en azından *yeni* uyarı çıkarma.

## Bilinmesi gereken tuzaklar
- **Şema değişikliğini uygulayan kullanıcıdır.** Ortamda DDL çalıştıracak bir yol yok (`psql` kurulu değil, DB parolası yok, Supabase Management API erişimi yok). `supabase/schema.sql`'i güncelle, sonra kullanıcıdan **Supabase SQL Editor'de çalıştırmasını iste** — dosya idempotent olmalı ki tekrar tekrar çalıştırılabilsin. SQL'i teslim etmeden önce Docker'da (`docker run postgres:16`) stub tablolarla sözdizimi/mantık doğrulaması yapılabilir.
- **Mobil portalda `supabase.from(...)` KULLANMA.** Öğrenci/veli giriş yapmış bir Supabase kullanıcısı değil; anon rolünün hiçbir tabloda yetkisi yok, sorgu sessizce boş döner. Veri `portal_*` SECURITY DEFINER RPC'lerinden gelir.
- **Postgrest tip çıkarımı:** `src/types/database.ts`'teki satır tipleri `type` olmalı, `interface` DEĞİL — `interface` sessizce `never`'a düşürüyor.
- **Supabase 1000 satır cap'i:** tek `.select()` en fazla 1000 satır döndürür (`.limit()` bile aşmaz). Çok satırlı okumada `count` + `.range()` sayfalaması kullan.
- **Fonksiyonu anon'a kapatmak:** `revoke ... from public` YETMİYOR — Supabase, `public` şemasındaki fonksiyonlara `anon`/`authenticated` rollerine **doğrudan** execute veriyor. Doğrusu: `revoke all on function f(args) from public, anon, authenticated;` (definer fonksiyonlar owner olarak çalıştığı için birbirini yine çağırabiliyor).
- **supabase-js toplu insert:** dizi halinde insert ederken anahtarları birleştirip eksik olanlara `null` yolluyor. Bir satırda alan verip diğerinde vermezsen `not-null` hatası alırsın — toplu insert'te tüm satırlara aynı alanları yaz.
- **Portal sayfalarında renk:** bu sayfalar zemini/kartları sabit açık renkte çiziyor, `var(--token)` karanlık temada dönüp okunmaz hale getirir → `portalTheme.ts`'te sabit hex kullanılıyor. Metin ve rozet dolgusu daima `accentStrong` (kontrast), `accent` yalnız metin olmayan alanlarda.
- **CSS token adı:** indigo'nun açık tonu `--indigo-050` (sıfır dolgulu). `--indigo-50` diye yazılırsa sessizce hiç uygulanmıyor — bu tuzağa bir kez düşüldü.

## Bağlam & Yedekleme Kurulumu
- Domain: YKS koçluk — öğrenci haftalık çalışma takibi, deneme sonuçları, konu bazlı yeterlilik (yeterli/gelişiyor/kritik/ölçülmedi).
- Track'ler: SAY, EA, SÖZ. Sınıf: 12. Sınıf / Mezun.
- Net hesaplama: Net = Doğru − Yanlış/4 (TYT: Türkçe 40, Matematik 40, Fen 20, Sosyal 20 soru).
- Manuel Yerel Yedek: Terminalde `npm run backup` (çıktı `backups/YYYY-MM-DD/`).
- Otomatik Private GitHub Yedeği: GitHub reposunda `Settings -> Secrets -> Actions` kısmına `BACKUP_REPO_TOKEN` (PAT), `BACKUP_REPO_URL` (`github.com/KULLANICI/GIZLI-REPO.git`), `VITE_SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` eklendiğinde her gece otomatik push eder.
- Tüm UI metni Türkçe.
