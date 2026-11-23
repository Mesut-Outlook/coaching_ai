# Program Hatırlatma — kısa tasarım (2026-11-23)

## Niyet
Öğrenci haftalık programındaki görevi yapmadığında **öğrenciyi aynı gün/ertesi gün harekete geçirmek**. Veli bilgilendirmesi bu işin amacı değil (mevcut veli özeti zaten var).

## Kapsam
1. **Koç paneli — tek tıkla hatırlatma.** "Bugün ilgi bekleyenler" listesine yeni neden: `program_geciken` — *"Geçmiş günlerden N görev işaretlenmedi"*. Satırda **"Öğrenciye hatırlat"** düğmesi: hazır mesajla WhatsApp açılır, Eda gönderir.
2. **Öğrenci portalı — giriş uyarısı.** `/ogrenci` açılınca üstte kart: *"Geçmiş günlerden N görevin kaldı"* + o günlere götüren bağlantı. Görevler zaten aynı sayfada işaretleniyor.

## Kural (tek tanım, iki yerde aynı)
Geciken görev = bu haftanın (`week_start` = bu pazartesi), `block_kind = 'ders'`, `day_index < bugünün ISO gün indeksi` (0 = Pazartesi), `completed = false`.
Fonksiyon tek yerde yazılır (saf, test edilebilir) ve panel + portal onu çağırır.

## Dil
Suçlayıcı değil: sistem yalnız "işaretlenmedi"yi görür, "yapmadı"yı değil.
Örnek öğrenci mesajı: *"Merhaba Ali, programında geçmiş günlerden 3 görev işaretlenmemiş görünüyor. Yaptıysan portaldan işaretlemeyi unutma, yapmadıysan bugün telafi edelim 💪 — Konsept Akademi"* + öğrenci portal linki. İmza mevcut WhatsApp mesajlarıyla aynı.

## Yaklaşımlar
- **A. Koç tek tıkla gönderir + portal uyarısı (seçilen).** Ücretsiz, mevcut `openWhatsAppChat` altyapısı, şema değişikliği yok.
- B. Tam otomatik WhatsApp/SMS — ücretli API, Meta onayı, sunucu zamanlayıcısı; şimdilik değil.
- Yalnız portal uyarısı — öğrenci portalı açmazsa görmez; tek başına yetmez.

## Kısıtlar / kararlar (Opus'un çağrıları)
- **Şema değişikliği yok.** Panel verisi `homeSummaryCore` görevlerinden, portal verisi `portal_dashboard` sonucundaki bu haftanın görevlerinden hesaplanır.
- Mevcut `program_dusuk` (hafta yarısında <%50) kalır; `program_geciken` ondan bağımsız günlük sinyal. Aynı öğrencide ikisi de çıkabilir.
- `/devamsizlik`'taki gibi dürüst etiket: düğme "Gönderildi" demez.
- Portal renkleri `portalTheme.ts` sabit hex'lerinden (koyu tema tuzağı).

## Kapsam dışı (bilinen tavan)
- **Pazartesi** önceki haftanın pazar görevleri sayılmaz (hafta sıfırlanır). Gerekirse sonra.
- **"Hatırlatıldı" damgası yok** — iki koç aynı gün iki kez gönderebilir. İhtiyaç olursa `weekly_tasks`'a değil küçük bir `task_reminders` tablosuna eklenir.
- Otomatik gönderim (yol B).

## Builder'a kalan
Uyarı kartının görünümü, mesajda görev adlarının listelenip listelenmeyeceği, panel filtre çipine eklenmesi.
