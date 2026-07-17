# Coching_AI — Proje Belleği

## Ne inşa ediyoruz
Eda Cangert'in YKS (üniversite giriş sınavı) koçluk merkezi için web/mobil bir uygulama. Web dashboard tarafı için ilk tasarım turu tamamlandı: "Netlik" adlı koç paneli, 5 ekran (Koç Paneli, Öğrenci Profili, Konu Yeterlilik Haritası, Deneme Girişi, Haftalık Görüşme). Tasarım artifact'i: https://claude.ai/code/artifact/04e9bd11-0c63-4c43-b126-6fe457d037e8

Bu tasarım, gerçek uygulamanın referans/başlangıç noktası — henüz backend, veri modeli veya prod kod yok. Klasör şu an boş; yazılım işleri buradan başlayacak.

## İş dağılımı (kullanıcı talimatı)
- **Sonnet**: tüm yazılım/implementasyon işleri (frontend, backend, entegrasyon, test).
- **Fable**: sadece planlama ve tasarım işleri (UX akışları, ekran tasarımları, ürün kararları) — kod yazmaz.
- **Antigravity (agy)**: bazı görevler buraya yönlendirilebilir; hangi görevlerin gideceği henüz netleşmedi, görev bazlı karar veriliyor.

Güncel görev listesi ve kimin ne yaptığı **coordination.md** dosyasında tutuluyor — yeni bir iş başlatmadan önce oraya bak, iş bitince orayı güncelle.

## Bağlam
- Domain: YKS koçluk — öğrenci haftalık çalışma takibi, deneme sonuçları, konu bazlı yeterlilik (yeterli/gelişiyor/kritik/ölçülmedi).
- Track'ler: SAY, EA, SÖZ. Sınıf: 12. Sınıf / Mezun.
- Net hesaplama: Net = Doğru − Yanlış/4 (TYT: Türkçe 40, Matematik 40, Fen 20, Sosyal 20 soru).
- Tüm UI metni Türkçe.
