# Netlik — YKS Koçluk Paneli

Eda Cangert'in YKS (üniversite giriş sınavı) koçluk merkezi için koç paneli. Öğrenci takibi, deneme sonuçları, konu bazlı yeterlilik ve haftalık çalışma programını tek yerde yönetir.

**Canlı:** https://netlik-koc-paneli.vercel.app

## Ekranlar

| Ekran | Yol | Ne işe yarar |
|---|---|---|
| Koç Paneli | `/panel` | Tüm öğrenciler tek bakışta — kritik konu sayısı, son deneme netleri, haftalık tamamlama oranı |
| Öğrenciler | `/ogrenciler` | Öğrenci listesi/profili — ekleme, düzenleme, arşivleme, profil fotoğrafı, öğrenci + veli telefonu |
| Deneme Girişi | `/denemeler` | Deneme sonucu girişi (net otomatik hesaplanır) ve tüm deneme geçmişi |
| Konu Yeterlilik Haritası | `/konular` | Konu bazlı durum takibi, konu testi girişi, konu/ders ortalaması, "Koç Kararı" onayı |
| Haftalık Program | `/program` | Gün gün görev planlama (sürükle-bırak), tek sayfa yazdırma/PDF, WhatsApp ile gönderme |
| Haftalık Görüşme | `/raporlar` | Haftalık birebir görüşme özeti ve gelecek hafta planlaması |
| Müfredat | `/mufredat` | Ders/konu listesi yönetimi (TYT + AYT), yıldan yıla değişebilen müfredat için |
| Yardım | `/yardim` | Uygulama içi kullanım rehberi |
| Sürüm Geçmişi | `/surum-gecmisi` | v0.1'den bugüne tam değişiklik günlüğü |

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

## Script'ler

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Prodüksiyon derlemesi (`tsc -b && vite build`) |
| `npm run lint` | Oxlint |
| `npm run preview` | Derlenmiş çıktıyı yerelde önizle |
| `npm run seed` | ⚠️ **Dikkatli kullan** — `subjects`/`topics` tablosunu tamamen silip `src/tytSubjects.json`'daki listeyle yeniden doldurur (cascade ile bağlı öğrenci verisini de siler). `SUPABASE_SERVICE_ROLE_KEY` gerektirir. |

## Deploy

Vercel'e bağlı (proje: `netlik-koc-paneli`), `vercel --prod` ile deploy edilir. Production ortamına sadece client-safe değişkenler eklenmeli: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — `SUPABASE_SERVICE_ROLE_KEY` asla.

## Proje geçmişi ve koordinasyon

- **`coordination.md`** — kim ne üzerinde çalışıyor, iş dağılımı (Sonnet/Fable/Antigravity), aktif ve tamamlanan görevler.
- **`CLAUDE.md`** — proje belleği, mimari notlar, bilinen tuzaklar.
- **`/surum-gecmisi`** — uygulama içinden, tarihli tam değişiklik günlüğü.
