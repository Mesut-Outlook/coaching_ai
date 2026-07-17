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
- [x] Koç paneli ilk tasarım turu — 5 ekran (Panel, Öğrenci Profili, Konu Yeterlilik Haritası, Deneme Girişi, Haftalık Görüşme). Artifact: https://claude.ai/code/artifact/04e9bd11-0c63-4c43-b126-6fe457d037e8
- [ ] Mobil (öğrenci tarafı) akış tasarımı — kapsam henüz tanımlanmadı
- [ ] Bilgi mimarisi: öğrenci verisi, deneme verisi, konu verisi arasındaki ilişkiler (ürün/veri modeli taslağı, kod değil)

## Sonnet — Yazılım
- [ ] Proje iskeleti kurulumu (frontend + backend, henüz stack seçilmedi)
- [ ] Veri modeli / şema implementasyonu (öğrenci, deneme, konu yeterlilik, görev atama)
- [ ] Netlik tasarımının gerçek koda dönüştürülmesi (5 ekran)
- [ ] Kimlik doğrulama (koç girişi)

## Antigravity — Bağımsız Küçük Modüller
- [ ] Henüz görev atanmadı — ana akıştan izole, tekil script/entegrasyon işleri buraya düşecek

---

## Açık kararlar (kullanıcıdan netleşmesi gereken)
- Tech stack seçimi (frontend framework, backend, veritabanı)
- Mobil mi, web mi, ikisi birden mi — öncelik sırası
