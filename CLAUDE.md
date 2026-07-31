# Coching_AI — Proje Belleği

## Ne inşa ediyoruz
Eda Cangert'in YKS (üniversite giriş sınavı) koçluk merkezi için web/mobil bir uygulama. Web dashboard tarafı için ilk tasarım turu tamamlandı: "Netlik" adlı koç paneli, 5 ekran (Koç Paneli, Öğrenci Profili, Konu Yeterlilik Haritası, Deneme Girişi, Haftalık Görüşme). Tasarım artifact'i: https://claude.ai/code/artifact/04e9bd11-0c63-4c43-b126-6fe457d037e8

Yazılım tarafı tamamlandı: **Vite + React + TypeScript + Supabase**. Auth, tasarım sistemi, routing/layout ve tüm ana ekranlar (Koç Paneli, Öğrenciler, Konu Yeterlilik Haritası, Deneme Girişi, Haftalık Program, Haftalık Görüşme, Müfredat, Devamsızlık Takibi, Tercih Sihirbazı, Mobil Öğrenci & Veli Portalı, Yardım, Sürüm Geçmişi) gerçek Supabase sorgularına ve veritabanı tiplerine bağlı olarak çalışmaktadır. Şema: `supabase/schema.sql` (idempotent — tekrar tekrar güvenle çalıştırılabilir). Öne çıkan özellikler:
- **Öğrenciler**: ekleme/düzenleme/arşivleme/kalıcı silme, profil fotoğrafı (Supabase Storage), öğrenci + veli telefonu, mobil erişim kodu (PIN) üretme ve WhatsApp paylaşımı.
- **Tercih Sihirbazı** (`/tercih`): YÖK Atlas REST API'den derlenmiş ~66.400 üniversite programı, 11 kriterli filtreleme, başarı sırası aralığı, Türkçe-duyarsız arama (`imatch`), ulaşılabilirlik durumu (Ulaşılabilir/Riskli/Zor) ve çıktı alma/WhatsApp paylaşma.
- **Devamsızlık Takibi** (`/devamsizlik`): Oturum türü (birebir/etüt/vb.), mazeret notu, WhatsApp bildirim açılış takibi, dürüst damgalama, "Takip Gelişi" eşik rozetleri ve veli özet mesajı.
- **Mobil Öğrenci & Veli Portalı** (`/portal`, `/ogrenci`, `/veli`): PIN kodlu hızlı giriş, RLS korumalı SECURITY DEFINER RPC katmanı (`portal_login`, `portal_dashboard`, `portal_set_task_completed`, `portal_add_exam`), günlük ödev takibi, net hesaplama ve veli özet görünümü.
- **Yedekleme & Geri Yükleme System** (`npm run backup`, `npm run restore`): Veritabanındaki tüm 11 tabloyu (`attendance_records` dahil) ve `student-photos` storage bucket'ını tarihli JSON + görsel yedeği olarak indirir. `.github/workflows/backup.yml` ile her gece saat 05:00 TSİ otomatik çalışır, istenirse gizli (private) GitHub reposuna aktarır.

Service-role key kullanarak RLS kurallarını bypass eden ve `src/tytSubjects.json` müfredatını seede hazır hale getiren bir seed script'i (`scripts/seedSupabase.ts`) ve `npm run seed` komutu var — **⚠️ dikkat: bu script `subjects` tablosunu tamamen silip eski listeyle dolduruyor, cascade ile öğrenci verisini de siliyor, tekrar çalıştırmadan önce coordination.md'ye bak.** Proje `npm run build` ile hatasız derleniyor ve **canlı yayında**: https://netlik-koc-paneli.vercel.app (Vercel, GitHub reposuna bağlı, `vercel --prod` ile deploy edilir). Kullanıcı için ekran görüntülü kullanım rehberi: https://claude.ai/code/artifact/7b356fea-fcd3-4dda-af5f-af6044b5e3c5

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

## Bağlam & Yedekleme Kurulumu
- Domain: YKS koçluk — öğrenci haftalık çalışma takibi, deneme sonuçları, konu bazlı yeterlilik (yeterli/gelişiyor/kritik/ölçülmedi).
- Track'ler: SAY, EA, SÖZ. Sınıf: 12. Sınıf / Mezun.
- Net hesaplama: Net = Doğru − Yanlış/4 (TYT: Türkçe 40, Matematik 40, Fen 20, Sosyal 20 soru).
- Manuel Yerel Yedek: Terminalde `npm run backup` (çıktı `backups/YYYY-MM-DD/`).
- Otomatik Private GitHub Yedeği: GitHub reposunda `Settings -> Secrets -> Actions` kısmına `BACKUP_REPO_TOKEN` (PAT), `BACKUP_REPO_URL` (`github.com/KULLANICI/GIZLI-REPO.git`), `VITE_SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` eklendiğinde her gece otomatik push eder.
- Tüm UI metni Türkçe.
