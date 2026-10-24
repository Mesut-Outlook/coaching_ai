# Deneme Karnesi: Ders + Konu Girişi ve Gelişim Analizi — Tasarım

Tarih: 2026-10-24 · Durum: ONAYLANDI, uygulamada (agy, coordination.md K1–K6) · Planlayan: Opus · Uygulayan: agy / Sonnet alt ajanları

Ekran taslakları: https://claude.ai/artifact/7cjK71eAWrewk2MTvR2gJ1 (paylaşılabilir sürüm; düzenlenebilir tuval: https://claude.ai/artifact/84FANavGCFNUyJ46mocytS) (giriş · koç genel+ders · koç konu · öğrenci portalı · veli portalı)

## 1. Neden

Eda deneme sonuçlarını Netlik'e **kendisi** giriyor. Girerken öğrencinin hangi konuda ne yaptığını kafasında topluyor, yani giriş onun için bir analiz anı. Bugün Netlik yalnız 4 bölüm (Türkçe/Matematik/Sosyal/Fen) için D/Y tutuyor. Alt ders (Fizik/Kimya…) ve konu verisi hiç yok, bu yüzden "hangi konudan kaybediyor, denemeden denemeye ne değişti" sorusu cevapsız.

Kaynak belge: yayın karnesi (örnek `KONSEPT HIZ VE RENK 1 TYT SONUCU.pdf`, her öğrenciye bir sayfa). Karnede ders özeti, alt ders tabloları ve konu satırları `KONU  S D Y B%` var. **B% başarı yüzdesidir (D/S), boş değildir.** Boş = S − D − Y.

## 2. Kullanıcının verdiği kararlar

- Girişi Eda elle yapar. **PDF ve ekran görüntüsünden otomatik doldurma bu kapsamdan çıkarıldı** (2026-10-24: "sonra düşünürüz").
- **Konu girişi karne ile uyumlu olur.** Eda karnedeki konu satırlarını gördüğü gibi girer ("SAYILAR 5 4 1"). Bizim daha ince müfredatımıza dağıtım yapmaz.
- Müfredatta karneye göre eksik olan eklendi: Felsefe → "MÖ 6. Yüzyıl - MS 2. Yüzyıl Felsefesi" (`npm run seed:tyt-karne`, commit c381451). TYT Türkçe ve TYT Matematik canlıda aktif yapıldı (2026-10-24).
- Konu kataloğu bu karnenin (Konsept) biçimine göre kurulur. Farklı bir yayın biçimi gelince ona ayrı bir ad verilir ve uyum o zaman sağlanır (**şimdi biçim adı/kolonu yok**).
- AYT eşit ağırlık ve sözel dersleri (Edebiyat, Felsefe Grubu, Tarih/Coğrafya'nın AYT konuları) **MEB listesinden müfredata eklenir** (ayrı iş, `npm run seed:ayt`). AYT `exam_subjects`/`exam_topics` kataloğu bu eklemeden sonra müfredattan kopyalanır.
- Konu Yeterlilik Haritası beslemesi için önce **karne konusu → müfredat konusu eşleme listesi** çıkarılıp kullanıcıyla tek tek gözden geçirilir. Onaylanan liste `exam_topic_links` tablosunun tohumu olur (Faz 4).
- Koç, öğrenci ve veli sonuçları istedikleri zaman detaylı görür. Öğrenci ve veli bunu kendi portal linkinden yapar.
- Analiz üç seviyede, her seviyede **sayı + yüzde + grafik**:
  1. **Genel:** son denemedeki durum ve önceki denemelere göre değişim.
  2. **Ders:** denemeler boyunca her dersin değişimi.
  3. **Konu:** denemeler boyunca her konunun değişimi.
- Koç, öğrenci ve veli için "dikkat edilecek konular" uyarıları ve bilgilendirmeler.

## 3. Hedefler / Hedef dışı / Anti-hedefler

**Hedefler**
- Karneyi okuyup girmek, karnenin düzenini birebir takip etmeli: aynı ders blokları, aynı satır sırası, aynı sütunlar.
- Ekrandaki her sayı karnedekiyle aynı çıkmalı. Ders neti, başarı %'si ve konu %'si karnedeki formülle hesaplanır.
- Tek analiz motoru: koç ekranı ve portal aynı TS fonksiyonundan beslenir, mantık kopyalanmaz.

**Hedef dışı (bu turda yok)**
- Öğrencinin portaldan konu girişi yapması (bugünkü bölüm girişi `portal_add_exam` olduğu gibi kalır).
- Yanlış nedeni etiketi (bilgi eksiği/dikkat/süre). Etkin'de var, sonra eklenir. `error_basket_items` tablosuna dokunulmaz.
- Soru numarası → konu şablonu.
- Sınıf/kurum karşılaştırması.
- Gerçek LGS puanı üretmek. Kural değişmiyor: bunun için asla "puan" denmez. Yayının karnesinde yazan puan ve sıra ise **elle girilen bir bilgi** olarak saklanabilir ve "Yayının açıkladığı puan" diye etiketlenir.
- Konu Yeterlilik Haritası'na otomatik besleme (Faz 4, ayrı karar).

**Anti-hedefler (çalışsa bile başarısızlık sayılır)**
- Giriş, karneyi okumaktan yavaşsa: fare gerektiren, sekmeler arası atlayan bir form.
- Karneyle uyuşmayan sayılar. Örnek: net formülü ya da başarı % farklı hesaplanmış.
- Öğrenciyi ya da veliyi suçlayan, korkutan uyarı dili.
- Konu girişi zorunlu olursa. Eda bazen yalnız ders netlerini girip konuları sonra doldurur.

## 4. Veri modeli (`supabase/schema.sql`, idempotent)

> CLAUDE.md tuzakları geçerli: yeni tablolar `create table if not exists`. Var olan tabloya yeni kolon ancak `alter table … add column if not exists` ile eklenir ve o kolona dokunan indeks/constraint bu satırların **altında** olmalı. Docker doğrulaması **eski şema → yeni şema → yeni şema tekrar** sırasıyla yapılır. SQL'i kullanıcı Supabase SQL Editor'de çalıştırır.

### 4.1 Sınav yapısı kataloğu: `exam_subjects`
Karnedeki alt dersler ve soru sayıları. Ör: TYT/Sosyal Bilimler/Tarih-1/5 soru.

| kolon | tip | not |
|---|---|---|
| id | serial pk | |
| exam_type | text check in ('TYT','AYT','LGS') | |
| section_name | text not null | `src/lib/examSections.ts` `SECTIONS_CONFIG` adlarıyla birebir ('Sosyal Bilimler' …) |
| subject_id | int not null → subjects(id) | bizim ders. Ad eşleştirmesi koda gömülmez, bu kolondan gelir |
| label | text not null | karnedeki ad: 'Matematik-1', 'Tarih-1', 'Felsefe (Seçmeli)' |
| question_count | int not null check > 0 | |
| choice_group | text null | aynı gruptan yalnız biri toplama girer. TYT: 'Din Kültürü' ↔ 'Felsefe (Seçmeli)' = 'sosyal-secmeli' |
| sort_order | int not null default 0 | |
| unique (exam_type, section_name, label) | | |

Seed içeriği:
- **TYT:** Türkçe 40 (Türkçe) · Matematik: Matematik-1 30 + Geometri 10 · Sosyal Bilimler: Tarih-1 5, Coğrafya-1 5, Felsefe 5, Din Kültürü 5 \| Felsefe (Seçmeli) 5 · Fen: Fizik 7, Kimya 7, Biyoloji 6.
- **AYT SAY:** Matematik 40 (AYT Matematik), Fen 40: Fizik 14, Kimya 13, Biyoloji 13.
- **AYT EA/SÖZ:** ⚠️ müfredatta AYT Edebiyat, Tarih-2, Coğrafya-2, Felsefe Grubu dersleri **yok**. Bu bölümler için `exam_subjects` satırı açılmaz. O bölümlerde yalnız bölüm toplamı girilir (bugünkü davranış). Bkz. §10 açık soru.
- **LGS:** her bölüm tek alt ders. Türkçe 20, Matematik 20, Fen 20, İnkılap 10, Din 10, İngilizce 10. LGS 7. ve 8. sınıf dersleri aynı adla iki kez var mı, kontrol edilmeli (bkz. `topics.grades`).

### 4.2 Karne konu kataloğu: `exam_topics`
| kolon | tip | not |
|---|---|---|
| id | serial pk | |
| exam_subject_id | int not null → exam_subjects(id) on delete cascade | |
| name | text not null | karnedeki ad, karnedeki yazımıyla ("SAYILAR" → okunur hâli "Sayılar". Seed'de başlık düzenine çevrilir, görünüm karneye sadık kalır) |
| grades | text[] not null default '{}' | `topics.grades` ile aynı anlam (boş = tümü). LGS 7/8 ayrımı için |
| sort_order | int not null default 0 | karnedeki satır sırası |
| is_active | boolean not null default true | |
| unique (exam_subject_id, name) | | |

Seed:
- **TYT:** karneden çıkan 64 konu, karnedeki sırayla. Liste: alt ajan raporu `scratchpad/mufredat-karsilastirma.md` §2. Uygulayıcı listeyi PDF'ten yeniden çıkarmalı, rapor yalnız kontrol içindir.
- **AYT SAY ve LGS:** henüz örnek karne yok. Bizim müfredattaki konular kopyalanır (`topics` → `exam_topics`, `grades` dahil). Karne gelince katalog düzeltilir.
- Giriş ekranından **"+ Konu ekle"** ile kataloğa yeni satır eklenebilir (başka bir denemede karnede olmayan bir konu çıkarsa).

Yetki: okuma her giriş yapmış kullanıcıya açık. Yazma `curriculum.manage` iznine bağlı, `subjects` politikalarındaki desen (`user_has_any_permission('curriculum.manage')`). "+ Konu ekle" `exams.manage` sahibine de açık olmalı. ⇒ Insert politikası `curriculum.manage` **veya** `exams.manage`, update/delete yalnız `curriculum.manage`.

### 4.3 Sonuçlar
`mock_exam_subject_results`: alt ders sonucu (karnedeki "Fizik 7 6 1 0 5,75 %82" satırı).
| kolon | tip |
|---|---|
| id | uuid pk default gen_random_uuid() |
| mock_exam_id | uuid not null → mock_exams(id) on delete cascade |
| exam_subject_id | int not null → exam_subjects(id) |
| question_count | int not null check > 0 |
| correct_count, wrong_count | int not null default 0, check ≥ 0, check correct+wrong ≤ question_count |
| blank_count | int generated always as (question_count − correct_count − wrong_count) stored |
| wrong_penalty | numeric not null default 4 check > 0 (LGS 3; `mock_exam_sections` ile aynı desen) |
| net | numeric generated always as (correct_count − wrong_count / wrong_penalty) stored |
| unique (mock_exam_id, exam_subject_id) | |

`mock_exam_topic_results`: konu sonucu (karnedeki "SAYILAR 5 4 1 80" satırı).
| kolon | tip |
|---|---|
| id | uuid pk |
| mock_exam_id | uuid not null → mock_exams(id) on delete cascade |
| exam_topic_id | int not null → exam_topics(id) |
| question_count | int not null check > 0 |
| correct_count, wrong_count | int not null default 0, ≥ 0, toplam ≤ question_count |
| blank_count | int generated (q − d − y) stored |
| unique (mock_exam_id, exam_topic_id) | |

Konu netine kolon yok. Konu kaybı ve başarı % analiz katmanında hesaplanır (§6).

`mock_exams` ek kolonları (hepsi nullable, isteğe bağlı giriş):
- `score numeric`: yayının açıkladığı puan (karnede 426,442).
- `percentile numeric`: yüzdelik (% 7,34).
- `coach_note text`: koçun öğrenci/veliye görünen kısa notu (§6).
- `ranks jsonb`: `{"sube":{"sira":1,"katilan":8},"kurum":{…},"ilce":{…},"il":{…},"genel":{…}}`. Anahtarların hepsi isteğe bağlı.

RLS: iki sonuç tablosu `mock_exam_sections` ile aynı politikaları alır (`exam_student_id(mock_exam_id)` + `exams.view`/`exams.manage`). `database.ts`'e satır tipleri `type` olarak eklenir (interface DEĞİL). `npm run test:types` geçmeli.

**Bölüm satırlarıyla ilişki:** `mock_exam_sections` olduğu gibi kalır ve toplam netin tek kaynağıdır, çünkü mevcut tüm ekranlar ve `portal_dashboard` onu topluyor. Alt ders satırları girildiğinde o bölümün satırı **istemcide alt derslerin toplamından** hesaplanır ve ikisi aynı kayıtta yazılır. Bölümün kendi kutuları o anda salt-okunur olur. Alt ders girilmemiş bir bölüm eskisi gibi elle girilir. `choice_group` içinde yalnız seçili satır toplama girer.

## 5. Giriş ekranı (Denemeler → "Yeni Deneme")

Görsel dil karneden alınır. Her bölüm kendi renk bloğundadır: Türkçe camgöbeği, Matematik lavanta, Sosyal şeftali, Fen yeşil, LGS bölümleri için de aynı aile. Renkler `global.css`'te token olarak tanımlanır. Var olmayan token yazılmaz (CLAUDE.md token tuzağı). Tailwind yok.

1. **Başlık şeridi:** öğrenci, deneme adı, yayın, tarih, sınav türü (öğrencinin sınıfına kilitli; bugünkü davranış). Sağda canlı özet balonları (karnenin üstündeki daireler gibi): **Soru · Doğru · Yanlış · Boş · Net**.
2. **"Puan ve sıralama (isteğe bağlı)"**: kapalı açılır panel. İçinde puan, yüzdelik ve şube/kurum/ilçe/il/genel için "sıra / katılan" kutuları.
3. **Bölüm kartları** (karnedeki gibi iki sütunlu ızgara, mobilde tek sütun). Her kartta:
   - **Ders tablosu:** satırlar alt dersler. Sütunlar Soru (katalogdan gelir, değiştirilebilir) · **Doğru** · **Yanlış** (giriş) · Boş · Net · Başarı (hesaplanır). Altında kalın **toplam satırı**. Seçmeli grup satırında "Din / Felsefe (Seçmeli)" anahtarı.
   - **"Konular ▾"**: açılır alt tablo. Alt ders başlığı altında konu satırları, her satırda S · D · Y (giriş) · B · % (hesaplanır). Yalnız dolu satırlar kaydedilir, boş satır "girilmedi" sayılır, sıfır sayılmaz.
   - **Tutarlılık çubuğu** (konuların altında): "Konular: 38/40 soru · 33/35 doğru · 5/5 yanlış". Tutarsızlık sarı uyarıdır, kaydı **engellemez** (karnenin kendisinde bile kayma var: Felsefe Seçmeli 5 soru / konular 3).
   - "+ Konu ekle": satır içi ad yazılır, kataloğa eklenir.
4. **Doğrulama:** D + Y ≤ S, aksi hâlde kutu kırmızı olur ve kayıt engellenir. Negatif sayı girilemez.
5. **Klavye akışı:** Tab yalnız giriş kutularında dolaşır (D → Y → sonraki satırın D'si), hesaplanan hücreler sekme sırasına girmez. Enter bir alt satıra iner. Odaklanınca kutunun içeriği seçili gelir. Hedef: fare kullanmadan bir karne 3 dakikada girilebilsin.
6. **Sonradan tamamlama:** deneme listesinde her satırda "Düzenle / Konuları gir" düğmesi bulunur ve aynı formu dolu açar. Bugün düzenleme yok, bu iş paketiyle gelir. Kayıtta sonuçlar upsert edilir (`unique` kısıtları üzerinden), formda boşaltılan satırlar silinir.

## 6. Analiz (tek motor: `src/lib/examReport.ts`)

Saf TS, React yok. Girdi, ham satırlar (`mock_exams` + sections + subject_results + topic_results + katalog adları). Çıktı, üç seviyenin verisi ve uyarılar. Koç ekranı Supabase sorgusuyla, portal RPC ile **aynı biçimde** ham veri toplar ve bu fonksiyona verir.

Formüller (karneyle aynı):
- Net = D − Y / ceza (YKS 4, LGS 3). Cezayı `wrongPenaltyFor()` verir.
- Ders / bölüm **başarı %** = net / soru × 100. Karne bunu kullanıyor: Matematik 33,75/40 = %84.
- Konu **başarı %** = D / S × 100. Karnede: SAYILAR 4/5 = %80.
- **Kayıp net** (konu ya da ders) = S − (D − Y/ceza). "Bu konu kaç net götürdü?"
- Değişim (Δ) = son deneme − bir önceki **aynı türdeki** deneme (TYT, TYT ile karşılaştırılır).
- Konu birikimli: tüm denemelerde ΣS, ΣD, ΣY, ΣB ve Σ başarı % = ΣD/ΣS.

Görünüm (sınav türü seçici: TYT / AYT / LGS, yalnız verisi olanlar):

**Seviye 1, Genel**
- Karne başlığı kartı: son denemenin toplam neti (büyük), Soru/D/Y/B balonları, başarı %, önceki denemeye göre Δ (▲ yeşil / ▼ kırmızı, sayı ve %). Varsa puan, yüzdelik ve genel sıra ("Yayının açıkladığı").
- Grafik: toplam net çizgisi (x: denemeler, tarih sırasıyla). Kesikli ortalama çizgisi, noktanın üzerine gelince ipucu.
- Tablo: deneme · tarih · toplam net · Δ · başarı %. Grafik ↔ tablo geçişi.

**Seviye 2, Ders**
- Isı tablosu: satırlar alt dersler (Türkçe, Matematik, Geometri, Fizik…), sütunlar denemeler. Hücrede net ve başarı %, rengi başarı bandından.
- Seçili ders için çizgi grafik (net + başarı %), ayrıca son denemede D/Y/B yığılı çubuk.
- "Son denemede hangi ders kaç net götürdü?": kayıp netin yatay çubukları, büyükten küçüğe.

**Seviye 3, Konu**
- Ders seçici (alt ders). Isı tablosu: satırlar konular, sütunlar denemeler. Hücrede "D/S" ve %, renkli. Konu o denemede girilmediyse gri "–".
- Sağdaki birikimli sütunlar: ΣS · ΣD · ΣY · ΣB · Σ% · eğilim (mevcut `Sparkline` bileşeni) · durum rozeti.
- "En çok net kaybettiren konular": tüm denemelerin birikimli kaybına göre ilk 10.
- Konuya tıklayınca deneme deneme S/D/Y çubukları ve yüzde çizgisi açılır.

Başarı bantları (tek yerde, sabit): ≥ %75 iyi (yeşil), %50–75 orta (sarı), < %50 zayıf (kırmızı), veri yok (gri). Her rengin yanında sayı ya da yüzde yazar, tek başına renk anlam taşımaz (erişilebilirlik).

Etkin Koçluk'tan alınan sunum kuralları (2026-10-24'te demo hesabıyla incelendi, yalnızca bakıldı):
- **Her kartın tek cümlelik bir başlık özeti olur**, grafiğin üstünde sayıyla yazılır: "Son deneme 65 net (−17)", "En çok kaybettiren ders Matematik: 25,3 net", "En yüksek Türkçe %80, en düşük Matematik %57". Bu cümleler `examReport.ts` içinde üretilir ve grafiğin altında yorum olarak tekrar edilmez.
- **Her grafikte Grafik/Tablo geçişi** vardır.
- **Asgari veri kuralı:** çizgi/eğilim için en az 3 aynı tür deneme, konu yüzdesi ve uyarı için konuda en az 3 soru gerekir. Eşiğin altında grafik çizilmez, dürüst bir boş durum gösterilir: "Çizgi için en az 3 deneme gerekir (şu an 2). Önceki → şimdi: 37,5 → 34".
- **"Nasıl hesaplandı ⓘ"**: her hesaplanan metriğin yanında formülü yazan küçük bir ipucu bulunur.
- **Veri dürüstlüğü notu** (portal görünümünün altında): "Sayılar girilen deneme sonuçlarından hesaplanır; konusu girilmemiş denemeler konu analizinde yer almaz."
- **Koç genel bakışı** (Denemeler sayfasının "Sonuçlar" sekmesi): öğrenci öğrenci son deneme, net ve önceki aynı tür denemeye göre Δ rozeti. Üstte 3 sayı kartı: son 7 günde girilen deneme · konusu girilmemiş deneme · ortalama net değişimi. Sağda "Nerede puan kaybediyorlar?" listesi, tüm öğrencilerin (filtrelenebilir) en çok net kaybettiren karne konuları.
- **Veli görünümü** "Güçlü konular / Üzerinde çalışılacak konular" ikilisiyle başlar (en iyi 3 / en zayıf 3, en az 3 soru şartıyla). Ardından "Denemelerde nasıl gidiyoruz?" bölümü gelir.
- **Koçun notu:** `mock_exams.coach_note text null`. Eda denemeye kısa bir not yazar, not öğrenci ve veli görünümünde deneme kartının altında çıkar. (Etkin'de "Koçun notu" kutusu var.)

Grafikler: yeni kütüphane yok. Elle SVG (çizgi, çubuk, ısı tablosu hücreleri). `src/components/charts/` altına mevcut `Sparkline` ile aynı tarzda yazılır.

## 7. Uyarılar ve bilgilendirmeler (`src/lib/examInsights.ts`)

Kural tabanlı, sabit eşikler dosyanın başında tek blokta. Her kural bir `{kind, severity, subject/topic, numbers}` üretir, metni role göre ayrı şablon yazar.

| kural | koşul (öneri, uygulayıcı sabit olarak koyar) |
|---|---|
| Kritik konu | birikimli ΣS ≥ 4 ve Σ% < 50 |
| Tekrarlayan hata | konu son 3 denemenin üçünde de en az 1 yanlış ya da boş |
| Düşüş | ders neti bir önceki aynı tür denemeye göre ≥ soru sayısının %10'u kadar düştü |
| Boş alışkanlığı | bir derste son 3 denemede ΣB / ΣS ≥ %25 |
| Yanlış riski | bir derste Y > 2 × B ve Y / S ≥ %20 ("Emin olmadığın soruyu boş bırak": 4 yanlış 1 doğruyu götürür, LGS'te 3) |
| İlerleme (olumlu) | konu %50 altından %75 üstüne çıktı ya da ders neti ardışık 3 denemede arttı |

Rol tonu:
- **Koç:** teknik ve eyleme dönük. "Sayılar: son 3 denemede 15 sorudan 7 doğru (%47) → haftalık programa ekle." En fazla 8 madde, önem sırasıyla.
- **Öğrenci:** cesaretlendirici ve odak veren. "Bu hafta odak: Sayılar ve Paragraf. Geçen denemeye göre Fen'de +2,5 net, harika!" Her uyarının yanında bir olumlu madde bulunur. En fazla 5 madde.
- **Veli:** sade ve suçlamasız, terim yok. "Son denemede toplam net 89,5 (geçen denemeden +4). Güçlü: Fen. Desteklenecek: Matematik'te sayı konuları." En fazla 4 madde.

## 8. Nerede görünür

- **Koç:** Öğrenci Profili'nde (`/ogrenciler/:studentId`) yeni **"Deneme Analizi"** sekmesi, üç seviye ve koç uyarılarıyla. Denemeler listesinde bir deneme açılınca da o denemenin karnesi görünür: §5'teki düzen salt-okunur hâlde, konu satırları renkli.
- **Öğrenci / veli portalı** (`/ogrenci`, `/veli`): yeni **"Denemelerim" / "Deneme Analizi"** sekmesi. Aynı bileşen, rol uyarılarıyla. Veli salt-okunur görür (zaten öyle).
  - Veri yeni RPC'den gelir: `portal_exam_report(p_code text) returns json`. SECURITY DEFINER, `portal_resolve_code` ile öğrenciyi bulur, ham satırları §6'daki biçimde döndürür (son 30 deneme). `revoke all … from public, anon, authenticated` ardından `grant execute … to anon, authenticated` (CLAUDE.md fonksiyon yetkisi tuzağı: desen `portal_dashboard` ile aynı).
  - **Portalda `supabase.from(...)` kullanılmaz** (anon'un tablo yetkisi yok, sessizce boş döner).
  - Portal sayfaları renkleri `portalTheme.ts`'teki sabit hex'lerden alır, `var(--token)` kullanmaz (karanlık temada okunmaz hâle gelir). ⇒ Analiz bileşeni renkleri **prop olarak bir palet nesnesinden** alır. Koç tarafı CSS token paletini, portal `portalTheme` paletini verir.
- **Yardım** sayfasına (`/yardim`) bölüm ve sürüm geçmişine yeni sürüm satırı eklenir.

## 9. Fazlar ve iş paketleri

| Faz | Paket | Kim | Bağımlılık |
|---|---|---|---|
| 1 | **K1 Şema + seed:** §4 tabloları, RLS, `database.ts`, `scripts/seedExamCatalog.ts` (idempotent, silmez; TYT konuları PDF'ten), Docker doğrulaması | Sonnet | — |
| 1 | Kullanıcı SQL'i çalıştırır, seed koşulur | kullanıcı + Opus | K1 |
| 2 | **K2 Giriş ekranı:** §5 (yeni deneme + düzenle/konuları gir) | agy veya Sonnet | K1 canlıda |
| 2 | **K3 Analiz motoru + uyarılar:** `examReport.ts`, `examInsights.ts` + `assert` tabanlı küçük öz-test | Sonnet | K1 (tipler) |
| 3 | **K4 Koç görünümü:** profil sekmesi + SVG grafikler + deneme karnesi görünümü | agy veya Sonnet | K3 |
| 3 | **K5 Portal:** `portal_exam_report` RPC + öğrenci/veli sekmesi | Sonnet | K3, K4 bileşenleri |
| 4 | **K6 Konu Yeterlilik beslemesi:** `exam_topic_links(exam_topic_id, topic_id)` + gözden geçirilmiş eşleme seed'i + haritanın deneme sonuçlarını okuması (1→N dağıtım kuralı eşleme gözden geçirmesinde kararlaştırılır) | Sonnet | K1, eşleme onayı |
| sonra | PDF / ekran görüntüsünden doldurma · yanlış nedeni · hedef net (Etkin'deki "Hedefe ne kadar yakın?" ve ders başına hedef payı; `students.target_net` gerekir) · zayıf konudan tek tıkla haftalık programa görev | — | §10 |

Her paketin kapısı (Opus): kod incelemesi + `npm run build` + `npm run test:types` + `npm run lint` (yeni uyarı yok) + canlıda doğrulama (agy için: `git log`, canlı bundle'da yeni string, DB'de `count=exact`). Bkz. memory `agy-teslim-dogrulama`.

## 10. Kullanıcı cevapları (2026-10-24)

1. PDF/ekran görüntüsünden doldurma: kaldırıldı, sonra düşünülecek.
2. Konu Yeterlilik Haritası: önce eşleşen/eşleşmeyen listesi çıkarılıp birlikte gözden geçirilecek (K6'nın girdisi).
3. AYT EA/SÖZ: müfredata MEB listesinden eklenecek.

## 10b. Uygulayıcı kontrolünden çıkan kararlar (Opus'un kararı, kullanıcı itiraz edebilir)

1. **"Girilmedi" ile "0".** Kutular boş başlar (placeholder), "0" yazmak bir değerdir. Konu satırı S dolu ise girilmiş sayılır, boş D/Y kutusu 0 kabul edilir. Alt ders satırında S katalogdan dolu gelir, satır ancak D ya da Y'ye bir değer (0 dahil) yazılınca girilmiş sayılır. Karnedeki "Felsefe (Seçmeli) 0 0 5" bu yolla girilebilir.
2. **Bölüm ↔ alt ders.** Bir bölüm, **alt derslerinin hepsi** (seçmeli grupta seçili olan) girilmişse "ayrıntılı" sayılır. O zaman bölüm satırı alt derslerin toplamından yazılır ve kutuları salt-okunur olur. Kısmi girişte bölüm satırı elle kalır ve "alt ders toplamı bölümden farklı" sarı uyarısı çıkar. Öğrencinin portaldan girdiği bölüm değerleri, Eda alt dersleri tamamlayana kadar korunur.
3. **Atomik kayıt.** Tek RPC: `save_exam_report(p_payload jsonb) returns uuid`, **SECURITY INVOKER** (RLS geçerli kalır), tek transaction içinde `mock_exams` upsert, sections, subject_results ve topic_results upsert ve formda boşaltılan satırların silinmesi. Ceza (`wrong_penalty`) istemciden alınmaz, `exam_type`'tan sunucuda türetilir. İstemci sıralı `insert` yapmaz.
4. **"Aynı tür".** Yalnız `exam_type` (TYT ile TYT; AYT'de alan farkı bölüm adından anlaşılır). Yayın farkı gözetilmez. Alt ders ya da konu verisi olmayan denemeler, Ders ve Konu ısı tablolarında "–" sütunu olarak görünür. 3 deneme eşiği **o seviyede verisi olan** denemeleri sayar.
5. **Portal görünürlüğü.** Puan, yüzdelik, sıralar ve koç notu öğrenciye de veliye de görünür (karne zaten onlara veriliyor). Tek koç notu iki role birden gider. Arayüzde "öğrenci ve veli görür" diye yazar.
6. **LGS/AYT kataloğu** müfredattan kopyalanır, giriş açık kalır. Eda "+ Konu ekle" ile düzeltir, gerçek karne gelince katalog düzenlenir.
7. **Test verisi.** K3'ün öz-testi Konsept karnesindeki bir öğrencinin sayılarıyla yazılır. Ad ve kimlik bilgisi taşımaz, "Örnek Öğrenci" olarak geçer. K3, K2'yi beklemez. Gerçek veriyle ilk doğrulama K2 canlıya çıktıktan sonra yapılır.

## 11. Uygulayıcıya bırakılanlar

Bileşen bölümlemesi, dosya adları (yukarıda adı verilenler dışında), SVG grafiklerin ayrıntısı, ipucu davranışı, boş durum metinleri, `exam_topics.name` başlık düzeni dönüşümünün ayrıntısı (Türkçe büyük/küçük harf: `toLocaleLowerCase('tr')`).
