# Coching_AI — Proje Belleği

## Ne inşa ediyoruz
Eda Cangert'in YKS (üniversite giriş sınavı) koçluk merkezi için web/mobil bir uygulama. Web dashboard tarafı için ilk tasarım turu tamamlandı: "Netlik" adlı koç paneli, 5 ekran (Koç Paneli, Öğrenci Profili, Konu Yeterlilik Haritası, Deneme Girişi, Haftalık Görüşme). Tasarım artifact'i: https://claude.ai/code/artifact/04e9bd11-0c63-4c43-b126-6fe457d037e8

Yazılım tarafı tamamlandı: **Vite + React + TypeScript + Supabase**. Auth, tasarım sistemi, routing/layout ve 9 ekran (Koç Paneli, Öğrenciler, Konu Yeterlilik Haritası, Deneme Girişi, Haftalık Program, Haftalık Görüşme, Müfredat, Yardım, Sürüm Geçmişi) gerçek Supabase sorgularına ve veritabanı tiplerine bağlı olarak çalışmaktadır. Şema: `supabase/schema.sql` (idempotent — tekrar tekrar güvenle çalıştırılabilir). Öne çıkan özellikler:
- **Öğrenciler**: ekleme/düzenleme/arşivleme/kalıcı silme, profil fotoğrafı (Supabase Storage), öğrenci + veli telefonu.
- **Müfredat** (`/mufredat`): ders/konu ekleme, düzenleme, sıralama, pasifleştirme (soft-delete, geçmiş veriyi korur). TYT'nin 6 dersi + 4 ayrı AYT dersi (Matematik/Fizik/Kimya/Biyoloji, toplam 187 konu).
- **Konu Yeterlilik Haritası**: konu testi sonucu girişi, konu/ders ortalaması takibi, "Koç Kararı" onay mekanizması.
- **Haftalık Program**: ders→konu iki adımlı görev ekleme, sürükle-bırak, tek sayfa yazdırma/PDF, WhatsApp ile gönderme (öğrenciye/veliye/her ikisine).
- **Yardım** (`/yardim`) ve **Sürüm Geçmişi** (`/surum-gecmisi`): uygulama içi kullanım rehberi ve v0.1'den bugüne tam değişiklik günlüğü.

Service-role key kullanarak RLS kurallarını bypass eden ve `src/tytSubjects.json` müfredatını seede hazır hale getiren bir seed script'i (`scripts/seedSupabase.ts`) ve `npm run seed` komutu var — **⚠️ dikkat: bu script `subjects` tablosunu tamamen silip eski listeyle dolduruyor, cascade ile öğrenci verisini de siliyor, tekrar çalıştırmadan önce coordination.md'ye bak.** Proje `npm run build` ile hatasız derleniyor ve **canlı yayında**: https://netlik-koc-paneli.vercel.app (Vercel, GitHub reposuna bağlı, `vercel --prod` ile deploy edilir). Kullanıcı için ekran görüntülü kullanım rehberi: https://claude.ai/code/artifact/7b356fea-fcd3-4dda-af5f-af6044b5e3c5

**Bekleyen:** Mobil (öğrenci tarafı) — Fable önce tasarlayıp coordination.md'de onaylamadan kodlamaya geçilmeyecek (bkz. coordination.md'deki 3 adımlı plan). Yeni tip/tablo gerekirse tek kaynak `src/types/database.ts` + `supabase/schema.sql` olmalı, ayrı bir mobil tip dosyası açılmasın. Ayrıntılı, tarihli değişiklik geçmişi için: `/surum-gecmisi` sayfası ya da coordination.md.

## İş dağılımı (kullanıcı talimatı)
- **Sonnet**: tüm yazılım/implementasyon işleri (frontend, backend, entegrasyon, test).
- **Fable**: sadece planlama ve tasarım işleri (UX akışları, ekran tasarımları, ürün kararları) — kod yazmaz.
- **Antigravity (agy)**: hem bağımsız küçük modüller hem de büyük, iyi tanımlanmış görevler alabilir (kullanıcı talimatı) — aktif olarak coordination.md'yi takip edip görev alıyor, benimle (Sonnet) paralel çalışabiliyor. Çakışma riski: aynı alanı farklı şekilde modelleyebiliyoruz (bkz. coordination.md'deki "Mimari not"), yeni iş başlatmadan önce coordination.md'yi mutlaka oku.

Güncel görev listesi ve kimin ne yaptığı **coordination.md** dosyasında tutuluyor — yeni bir iş başlatmadan önce oraya bak, iş bitince orayı güncelle.

## Bağlam
- Domain: YKS koçluk — öğrenci haftalık çalışma takibi, deneme sonuçları, konu bazlı yeterlilik (yeterli/gelişiyor/kritik/ölçülmedi).
- Track'ler: SAY, EA, SÖZ. Sınıf: 12. Sınıf / Mezun.
- Net hesaplama: Net = Doğru − Yanlış/4 (TYT: Türkçe 40, Matematik 40, Fen 20, Sosyal 20 soru).
- Tüm UI metni Türkçe.
