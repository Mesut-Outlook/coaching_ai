# Ek Yerleştirme Modülü

ÖSYM, merkezî yerleştirme ve kayıtlar bittikten sonra boş kalan kontenjanları **Ek Yerleştirme Kılavuzu** (PDF) ile yayımlar. Merkezî yerleştirmede hiçbir programa yerleşmemiş aday bu listeden **en fazla 24 tercih** yapabilir. Bu modül koçun öğrenci bazında ek tercih listesi hazırlamasını sağlar.

İlk sürüm (2026-10-23): şema + 26 örnek program + sayfa. Tam veri yüklemesi sonraki oturumda (bkz. "Tam içe aktarma planı").

## Tasarım kararları

| Karar | Neden |
|---|---|
| Ayrı tablolar, ayrı sayfa (`/ek-yerlestirme`) | Ana tercih verisi (`university_rankings`, `/tercih`) değişmez. Ek yerleştirme verisi onun üzerine yazılmaz. |
| `university_rankings`'e **FK yok**, yalnız program koduyla salt-okur eşleşme | `seed:universities` o tabloyu silip yeniden dolduruyor; FK olsaydı ya seed kırılır ya tercih listeleri silinirdi. |
| Veri yıl bazlı (`yil` kolonu), ayrı "dönem" tablosu yok | Yılda tek ek yerleştirme var; 24 tercih sınırı sabit. Gerekirse sonra eklenir. |
| Boş kontenjan = 0, boş en küçük puan = `null` | PDF'te ikisi de boşluk. Boş puan "merkezde dolmadı, puanı hesaplanan herkes tercih edebilir" demek; 0 yazmak bu anlamı bozardı. |
| `ogrenci_tercih_listeleri.donem` = `asil` \| `ek` | Asıl YKS tercihi de 24 sıralı program. Aynı tablo ileride `/tercih` listesini kaydetmek için kullanılabilir (şimdilik yalnız `ek`). |
| Liste kaydı `tercih_listesi_kaydet()` ile tek transaction (sil + ekle) | Sıralama değişirken `unique(sira)` çakışması ve yarım kalmış liste olmaz. `security invoker` → RLS geçerli. |
| 24 sınırı DB'de: `sira between 1 and 24` + `unique(student_id, yil, donem, sira)` | İstemci hatasında bile 25. tercih yazılamaz. |
| Yetki: mevcut `tercih.view` | Tercih Sihirbazı'nı gören koç ek listeyi de hazırlar; yeni izin anahtarı 3 dosyada senkron gerektirirdi. |
| Öğrenci puanı sayfada elle girilir, tarayıcıda (`localStorage`) hatırlanır | `students`'ta puan alanı yok; uyarı için şema değişikliği gerekmiyor. |
| Vakıf ücreti **ad üzerinden yaklaşık** eşleşir | Ücret tablosunda program kodu yok; indirimli/İngilizce varyantlar ayrı satır değil. Arayüzde "yaklaşık" diye etiketlenir. |

## Şema

`supabase/schema.sql` → "Ek Yerleştirme" bölümü.

- `ek_yerlestirme_programlari` — yil, tablo (`onlisans`/`lisans`), universite, universite_turu (`devlet`/`vakif`/`kktc`/`yurtdisi`), il, fakulte, program_kodu, program_adi, ogrenim_suresi, puan_turu, genel/sgy/k34 ek kontenjan, kosul_kodlari `int[]`, en_kucuk_gk/sgy/34y, burs_indirim, kaynak_sayfa. `unique(yil, program_kodu)`.
- `ek_yerlestirme_kosullari` — `(yil, kosul_no)` pk, kisim (1 = ÖSYM kontrol eder, 2 = etmez), metin.
- `vakif_ogrenim_ucretleri` — yil, universite, duzey, program, ucret, aciklama.
- `ogrenci_tercih_listeleri` — student_id, yil, donem, program_kodu, sira, notlar.

Referans tabloları (ilk üçü) authenticated okur, yalnız service role yazar.

## Veri yükleme

```
npm run seed:ek -- --yil 2026 --dosya data/ek-yerlestirme/2026-ornek.json
```

Upsert eder, **hiçbir şey silmez**, başka yılın satırına dokunmaz. `il` boşsa program koduyla `university_rankings`'ten doldurur. Script `.env.local`'i kendisi okur ve **canlıya yazar** — yalnız kullanıcı çalıştırır.

## PDF yapısı (2026 kılavuzu, 472 sayfa)

Sayfa numaraları PDF sayfasıdır (basılı numara 2 eksik: PDF s.126 = basılı 124).

| Sayfa | İçerik |
|---|---|
| 1–9 | Genel bilgiler |
| 10–124 | Tablo 3: Ön lisans (devlet ~11–82, vakıf/KKTC/yurt dışı ~83–124) |
| 125–304 | Tablo 4: Lisans (devlet ~126–214, vakıf/KKTC/yurt dışı ~215–304) |
| 305–308 | Koşullar 1. kısım (ÖSYM kontrol eder; s.308 "1. KISIM KOŞULLAR BİTTİ") |
| 309–329 | Koşullar 2. kısım |
| 330–401 | Tablo 6A–6D ek puan, Tablo 7/8 okul türü/alan kodları (kapsam dışı) |
| 402–~455 | Vakıf üniversiteleri öğrenim ücretleri |
| ~456–472 | Web adresleri, bankalar |

Tablo 3/4 kolonları, başlıkta `(1)…(11)` etiketli: kod, ad, öğrenim süresi, puan türü, genel / şehit-gazi yakını / 34 yaş üstü kadın ek kontenjan, koşul no'ları, en küçük puan GK / SGY / 34Y. Tablo 3 başlığı "2026-TYT", Tablo 4 "2026-YKS".

## Tam içe aktarma planı (sonraki oturum — agy E6)

Çıktı: `scripts/parseEkKilavuz.py --yil 2027 <pdf>` → `data/ek-yerlestirme/<yil>.json` + `<yil>-rapor.md`. Ardından `npm run seed:ek -- --yil <yil> --dosya …`.

**Araç: `pdftotext -bbox`** (poppler, zaten kurulu). Her kelimeyi `xMin/yMin/xMax/yMax` ile verir; pdfplumber/PyMuPDF kurmaya gerek yok. `pdftotext -layout` **yetmez**: ortadaki kontenjan/puan kolonu boşken sağdaki sayının hangi kolona ait olduğu kaybolur (örn. Burslu satırlardaki "1", SGY'de de 34Y'de de olabiliyor).

1. **Kolon sınırları her sayfada yeniden okunur.** Başlıktaki `(3)`, `(4)` … `(11)` kelimelerinin x-merkezleri o sayfanın kolon merkezleridir (s.126 örneği: `(3)` x≈416, `(5)` x≈464, `(9)` x≈726, `(11)` x≈817). Bir değer en yakın kolon merkezine atanır. Sabit x değeri kodlanmaz — sayfadan sayfaya kayıyor.
2. **Satırlar y-koordinatına göre gruplanır** (tolerans ~2pt). Satır tipi:
   - 9 haneli kodla başlıyor → program satırı.
   - Kodsuz, kırmızı/kalın üniversite başlığı → üniversite. Tür ve il parantezlerde: `(Devlet Üniversitesi)`, `(Vakıf Üniversitesi)`, `(İSTANBUL)`, KKTC'de `(KKTC-LEFKOŞA)`. Başlık **iki satıra bölünebilir** — kod içermeyen ardışık başlık satırlarını birleştir. İl her başlıkta yok → seed'de `university_rankings`'ten doldurulur.
   - Kodsuz büyük harfli satır → fakülte / MYO.
   - Kodsuz, ad kolonunda kalan satır → **program adının devamı**. Uzun adlarda kod **ortadaki** satırda; üst ve alt satırdaki metin ada eklenir (örn. `…(KKTC` / `Uyruklu)`).
3. **Yurt dışı:** `UOLP-…` ortak programlar ad içinde, vakıf üniversitesinin altında. Gerçek yurt dışı üniversiteler kendi başlıklarıyla gelir → `universite_turu = 'yurtdisi'`.
4. **burs_indirim** addan: `(Burslu)`, `(%50 İndirimli)`, `(%25 İndirimli)`, `(Ücretli)`; devlette `null`.
5. **Koşullar (s.305–329):** `Bk.`/sola dayalı numara + paragraf; paragraflar sayfa sınırını aşabilir. Kısım = s.308 sınırına göre.
6. **Ücretler (s.402+):** kolonlar Üniversite | Düzey | Program | Ücret (`1.800.000,00`, yıllık KDV dahil) | Açıklama. Üniversite adı her satırda tekrar ediyor ama hücre içinde iki satıra bölünüyor. İngilizce program ücreti çoğunlukla Açıklama'da.

**Doğrulama raporu** (seed'den önce okunur, tutmayan madde varsa seed yapılmaz):
- Satır sayısı: Tablo 3 ≈ 8.400, Tablo 4 ≈ 8.300; 2026 toplamı **16.715**. Puan türü 2026: TYT 8407, SAY 3312, EA 2955, SÖZ 1491, DİL 550.
- `program_kodu` tekil, 9 hane; her satırda puan türü dolu.
- Kolonu belirsiz değer sayısı (iki kolon merkezine eşit uzak) → 0 olmalı, değilse listele.
- **Çapraz kontrol:** kılavuzdaki `en_kucuk_gk` ile YÖK Atlas'ın aynı yıl `minPuan`'ı (program koduyla) karşılaştırılır. Kaymış kolon burada hemen görünür. (Eşleşmenin gerçekten birebir tuttuğu ilk parser koşusunda örneklerle teyit edilmeli.)
- `university_rankings` ile kod eşleşme oranı (2026'da %88; yeni açılan programlar eşleşmez).
- Koşul sayısı (2026: 187) ve programlardaki her koşul no'sunun koşul tablosunda bulunması.
- Örnek veri regresyonu: `data/ek-yerlestirme/2026-ornek.json`'daki 26 satır parser çıktısıyla birebir aynı olmalı (ikisi tutmazsa hangisinin yanlış olduğuna PDF görüntüsüne bakarak karar ver).

## Yeni Yıl Ekleme Adımları (E8)

Yeni bir yılın Ek Yerleştirme Kılavuzu yayımlandığında (veya geriye dönük 2025 kılavuzu eklendiğinde) izlenecek adımlar:

1. **PDF İndir:** ÖSYM sitesinden (veya arşivden) ilgili yılın Yükseköğretim Programları Ek Yerleştirme Kılavuzu PDF'i indirilir (örn. `~/Downloads/<YIL>-ek-yerlestirme-kilavuzu.pdf`).
2. **Parser'ı Koştur:**
   ```bash
   python3 scripts/parseEkKilavuz.py --yil <YIL> /yol/to/<YIL>-ek-yerlestirme-kilavuzu.pdf
   ```
   *Not:* Parser sayfa aralıklarını (`TABLO-3`, `TABLO-4`, Koşul 1/2. Kısım, Vakıf Ücretleri) otomatik tanır. Gerekirse kaçış kapısı olarak `--sayfalar tablo3=S-E,tablo4=S-E,k1=S-E,k2=S-E,ucret=S-E` elle verilebilir.
3. **Doğrulama Raporunu İncele:** `data/ek-yerlestirme/<YIL>-rapor.md` dosyasındaki denetimleri kontrol et:
   - Mükerrer program kodu = 0 olmalı.
   - Tanımsız koşul kodu = 0 olmalı.
   - Boş üniversite adı = 0 olmalı.
   - Şüpheli adlar ve eşlenemeyen ücret satırları makul sınırlar içinde olmalı.
4. **Veritabanına Yükle (Seed — Yalnız Kullanıcı Onayıyla):**
   ```bash
   npm run seed:ek -- --yil <YIL> --dosya data/ek-yerlestirme/<YIL>.json --ucret-temizle
   ```
   *Not:* Script `.env.local` üzerinden Supabase'e yazar; idempotent çalışır ve mevcut tercih listelerine zarar vermez.
5. **Arayüzde Doğrula:** `/ek-yerlestirme` sayfasında yıl seçicide yeni yıl görünür; programlar, kontenjanlar, taban puanlar ve vakıf ücretleri yıla göre filtrelenerek görüntülenir.

## Yıllık takvim (asıl + ek yerleştirme)

| Zaman | Olay | Yapılacak |
|---|---|---|
| Haziran–Temmuz | ÖSYM asıl tercih kılavuzu, YÖK Atlas yeni kılavuz yılına geçer | `fetchFromYokAtlasApi.py --son-yil <son tamamlanan yerleştirme>` → `seed:universities` |
| Ağustos–Ekim | Yerleştirme sonuçları; YÖK Atlas etiketsiz alanları bir yıl ilerletir | Aynı script; çapa guard'ı (Koç Tıp 203910699 vb.) kaymayı yakalar, `--son-yil` bir artırılır |
| Ağustos (prova) | — | Parser'ı bir önceki yılın PDF'inde koştur, rapor bilinen sayılarla tutmalı |
| Eylül | Ek Yerleştirme Kılavuzu; tercih penceresi ~5 gün | PDF → parser → rapor → `seed:ek` → koç listeleri hazırlar |

⚠️ YÖK Atlas'ın etiketsiz alanlarının yılı kılavuz `yil`'inden türetilemez (Temmuz'da yil−1, Ekim'de yil). Bkz. coordination.md T1.
