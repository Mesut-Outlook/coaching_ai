import { History } from 'lucide-react'

// Sürüm geçmişi listesi. Yardım sayfasının "Sürüm Geçmişi" sekmesinde gösterilir
// (eskiden ayrı bir /surum-gecmisi ekranıydı; sol menüyü kısaltmak için Yardım'a taşındı).
interface VersionEntry {
  version: string
  title: string
  items: string[]
}

interface DateGroup {
  date: string
  entries: VersionEntry[]
}

const HISTORY: DateGroup[] = [
  {
    date: '27 Ekim 2026',
    entries: [
      {
        version: 'v0.30',
        title: 'Saatli program blokları: Ders / Mola / Serbest, çoklu gün & saat ekleme penceresi, zamanlı pano ve mobil portal',
        items: [
          'Saatli program blokları: Haftalık programdaki görevlere başlangıç saati ve süre (dk) tanımlandı. Bloklar panoda saat sırasına göre dizilir; her blokta "07:00 – 07:40" gibi zaman aralığı gösterilir. Saati olmayan görevler günün altında "Saatsiz" başlığında toplanır.',
          'Üç blok türü (Ders / Mola / Serbest): Çalışma görevlerinin yanı sıra gün içine dinlenme molaları (☕ Mola) ve serbest aktiviteler (📌 Özel ders, koçluk görüşmesi, okul sınavı vb.) eklenebilir.',
          'Çoklu gün × saat ekleme penceresi: Gün sütunundaki "+ Görev Ekle" düğmesiyle açılan yeni pencereden birden çok gün ve birden çok saat (örneğin 3 gün × 2 saat = 6 blok) tek seferde toplu olarak eklenebilir.',
          'Zaman kısayolları: Son eklenen saatin üstüne seçili süreyi ekleyen "+ Ardından" düğmesi ve öğrencinin son 8 haftasındaki en sık kullanılan 3 saat kısayoluyla program dakikalar içinde hazırlanır.',
          'Mola ve serbest bloklar raporlardan bağımsızdır: Mola ve serbest aktiviteler ödev tamamlama, doğruluk oranı, 360 rapor, haftalık görüşme maddeleri, veli haftalık özeti ve portal sayaçlarına dahil edilmez; analizler yalnız ders bloklarını ölçer.',
          'YKS için TYT | AYT seçici ve esnek ders girişi: YKS öğrencileri için TYT ve AYT sınav grubu ayrımı eklendi. Ders kutusundan arama yapılabilir; konu seçmek isteğe bağlıdır (konu seçilmeden genel ders çalışması planlanabilir).',
          'Çakışma uyarısı: Aynı gün içinde kesişen saat aralıkları varsa sarı çakışma uyarısı görüntülenir, ancak koçun esnekliği sınırlandırılmaz.',
          'Mobil portal güncellemeleri: Öğrenci portalında ders saatleri saat aralığıyla gösterilir; molalar tek satır gri, serbest bloklar ise onay kutusuz nötr kart olarak sunulur. Portal sayaçları yalnız dersleri sayar.',
          'Esnek sonuç girişi: Soru hedefi girilmemiş saatli görevlere sonradan Doğru/Yanlış/Boş girildiğinde hedef soru sayısı otomatik olarak toplam soruya eşitlenir.',
        ],
      },
    ],
  },
  {
    date: '26 Ekim 2026',
    entries: [
      {
        version: 'v0.29',
        title: 'Raporlar 2.0 (R3 + R4): öneri motoru, akıllı haftalık taslak, tekrar zamanı, müdahale etkisi, öğrenci "Haftam", veli haftalık özeti',
        items: [
          'Akıllı taslak: Program ekranında "Akıllı Taslak Üret" zayıf ve tekrar zamanı gelmiş konulardan gelecek haftaya kesikli çerçeveli öneriler çıkarır, her birinde nedeni yazar. Onaylamadıkça hiçbir şey kaydedilmez ve öğrenciye gitmez.',
          'Öncelik ve öneri listesi: Haftalık Görüşme sayfasında gelecek hafta için sıralı konu listesi, önerilen soru sayısı ve türüyle. Her satırdan tek tıkla programa eklenir.',
          '360 Rapor yeni kartlar: tekrar zamanı gelen konular (3 hafta çalışılmayan yeterli konular), müdahale etkisi (rapordan programa eklenen konuların sonraki ölçümü), yanlış nedenleri dağılımı, soru başına süre ve kurum içi anonim sıra (en az 5 öğrenciyle).',
          'Öğrenci portalında "Haftam": görev ilerlemesi, hedefe yolculuk, bu hafta iyi gidenler ve sıradaki odak konuları. Öğrenci doğru/yanlış sayılarını görmez.',
          'Veliye haftalık özet: görevler, son deneme, devamsızlık ve suçlamasız "Evde nasıl destek olabilirsiniz?" önerileri; "WhatsApp\'ta Aç" ile gönderilir, ekranda "WhatsApp açıldı" damgası kalır.',
          'Görevlerde çalışma süresi (dk) ve deneme analizinde yanlış nedeni (bilgi eksiği, işlem, dikkat, süre) girilebiliyor. Müfredat ekranından ÖSYM/MEB konu ağırlıkları CSV ile yüklenebiliyor.',
          'LGS\'te bütün raporlar katsayılı net kullanıyor (Türkçe, Matematik, Fen ×4; diğerleri ×1; en fazla 270). Bu bir LGS puanı değildir.',
          'Sınav tarihleri girildi: YKS 19 Haziran 2027, LGS 6 Haziran 2027. Ana Sayfa\'da kalan gün sayaçları ve 360 Rapor\'da sınav gününe tahmin.',
          'Düzeltmeler: dar ekranda açılır pencerelerin sol menünün altında kalması, Haftalık Görüşme sayfasının yana taşması, Konu Yeterlilik Haritası\'nda deneme ölçümlerinin görünmemesi (izin hatası).',
          'Test öğrencileri: Test YKS, Test LGS ve Test Test denemeler, 8 haftalık program, sonuçlar ve koç kararlarıyla dolduruldu; bütün ekranları bunlarla deneyebilirsin.',
        ],
      },
      {
        version: 'v0.28',
        title: 'Raporlar 2.0 (R2) — Koç 360 Raporu: hedef yolu, öncelik matrisi, net kaybı Pareto, hata profili, tutarlılık ve müfredat yetişme',
        items: [
          '360 Rapor Sekmesi: Öğrenci profilinde Genel Bakış\'ın hemen yanına açılan yeni "360 Rapor" sekmesi, öğrencinin sınav hazırlığını altı analitik eksende inceler. Sınav türü seçicisi (TYT, AYT ya da LGS) öğrencinin sınıf müfredatına göre otomatik filtrelenir.',
          'K0 KPI Şeridi: Son deneme neti ve değişimi (Δ), hedefe kalan net ve gereken haftalık artış, son 4 haftalık ödev tamamlama oranı, son 4 haftalık ödev doğruluğu ve müfredat kapsamı tek bakışta sunulur.',
          'B2 Hedef Yolu: Doğrusal regresyonla son deneme eğilimi sınav gününe uzatılır ve artıkların standart sapmasıyla güven/belirsizlik bandı çizilir. Sınav günündeki tahmini net ile hedef arasındaki fark özetlenir.',
          'B3 Konu Öncelik Matrisi: Soru ağırlığı (koç geneli ortalama soru sayısı) ve öğrenci başarı oranına göre konular 4 analitik bölgeye ayrılır: Hemen Çalış, Koru, Hızlı Kazanım ve Sonra. En yüksek öncelikli 6 konu listelenir ve tek tıkla haftalık programa atanabilir.',
          'B4 Net Kaybı Pareto Analizi: Yanlış ve boşlardan kaynaklanan net kayıpları azalan sırada listelenir. Toplam kaybın ilk %60\'ını oluşturan kritik konular vurgulanır ve doğrudan programa eklenebilir.',
          'B5 Ders Hata Profili: Son 3 denemenin ders bazında yanlış ve boş oranları (eşik: %15) 4 stratejik bölgede eşleştirilir: Sağlam, Riskli İşaretleme, Süre/Strateji ve Konu Eksiği. Her bölgeye özel koçluk eylem önerileri sunulur.',
          'B6 Ödev ↔ Deneme Tutarlılığı: En az 20 ödev sorusu çözülmüş konularda ödev doğruluğu ile deneme başarısı arasındaki 15 puan ve üzeri farklar dambıl grafiğiyle gösterilir; "Süreli test ekle" veya "Kaynağı zorlaştır" önerileri üretilir.',
          'B7 Müfredat İlerlemesi & Yetişme Tahmini: Ders bazında Yeterli, Gelişiyor, Çalışıldı ve Başlanmadı konu durumları yığılı çubuklarla izlenir. Son 6 haftalık konu yeterlilik hızı hesaplanarak sınav tarihine yetişme projeksiyonu yapılır.',
          'Haftalık Görüşme Bağlantısı: Raporlar ekranındaki öğrenci seçici yanına "360 Raporu Aç" bağlantısı eklendi.',
        ],
      },
      {
        version: 'v0.27',
        title: 'Yeni Ana Sayfa, petrol tema ve Raporlar 2.0 (R1): hedef net, görev sonuçları, programa ekle, görüşme maddeleri',
        items: [
          'Yeni Ana Sayfa: "Bugün ilgi bekleyenler" listesi öğrencileri nedenleriyle (kritik konu, net düşüşü, devamsızlık, program, deneme yok) sıralar ve her birinin yanında tek bir sonraki adım gösterir. Altında bu haftanın görev tamamlaması, beş modül kartı (Öğrenciler, Denemeler, Program, Devamsızlık, Raporlar), son denemeler ve son hareketler yer alır.',
          'Sol menü ve tema: Panel artık "Ana Sayfa". Menüde modül renkleri, konusu girilmemiş deneme ve takip gereken öğrenci sayaçları, ince kaydırma çubuğu ve sayfa geçiş efekti var. Uygulamanın rengi mordan petrole geçti; Konsept kurumu menüde gold tonuyla ayrışıyor.',
          'Görev türü ve kaynak: Haftalık programdaki görevler Konu, Tekrar, Rutin, Süreli Test ya da Deneme olarak işaretlenir. Kaynak alanı öğrencinin son kullandığı kaynakları önerir. "Deneme mi?" kutusu kalktı, deneme artık bir görev türü.',
          'Görev sonucu: Tamamlanan görevde "Sonuç gir" ile Doğru, Yanlış ve Boş girilir; kartta "12D · 5Y · 3B · %60" gibi bir rozet görünür. Görevin tamamlandığı an otomatik kaydedilir.',
          'Hedef net ve sınav tarihleri: Öğrenciye TYT, AYT ya da LGS hedef neti girilir; profil başlığında hedefe kalan net görünür. Sınav tarihleri Kurumlar ekranından girilir; tarih girilince kalan hafta ve haftalık gereken artış da hesaplanır.',
          'Programa ekle: Deneme analizindeki konu tablosundan ve Konu Yeterlilik Haritası\'ndan bir konuyu tek pencerede birden fazla güne görev olarak ekleyebilirsin. Liste yalnız öğrencinin müfredatındaki konuları gösterir.',
          'Görüşmede konuşulacaklar: Haftalık Görüşme (Raporlar) sayfasında ve öğrenci profilinin Genel Bakış sekmesinde en fazla 5 madde (kritik konu, ödev temposu, tutarsızlık, tekrar, ilerleme) otomatik listelenir; maddenin yanındaki düğmeyle doğrudan programa görev eklenir.',
          'Düzeltmeler: "Konusu girilmemiş deneme" sayacı artık gerçekten konu sonucuna bakıyor. Çok denemeli öğrencilerde 1000 satır sınırı nedeniyle eksik görünen bölüm ve konu sonuçları tam yükleniyor. Deneme girişinde seçmeli ders kutusu (Din Kültürü) Net/Başarı sütununu kartın dışına itiyordu. Konu Yeterlilik Haritası deneme ölçümlerini bir izin hatası yüzünden göstermiyordu.',
        ],
      },
    ],
  },
  {
    date: '24 Ekim 2026',
    entries: [
      {
        version: 'v0.26',
        title: 'Deneme Karnesi & 3 Seviyeli Analiz Modülü (Genel · Ders · Konu)',
        items: [
          'Karne Düzeninde Deneme Girişi: Soru, Doğru, Yanlış ve Boş sayıları artık fiziksel karne formatında, alt ders ve açılır konu detaylarıyla girilebiliyor. Canlı özet balonları net ve başarı oranını anında hesaplıyor.',
          'Puan ve Sıralamalar: Yayının açıkladığı puan, yüzdelik dilim ve şube/kurum/ilçe/il/genel sıraları isteğe bağlı olarak kaydedilebiliyor. Ayrıca koçun yazdığı not öğrenci ve veli portalına doğrudan iletiliyor.',
          'Öğrenci Profilinde Deneme Analizi: Profilde açılan yeni "Deneme Analizi" sekmesiyle öğrencinin denemeleri Genel, Ders ve Konu olmak üzere 3 seviyede incelenebiliyor.',
          'Gelişim ve Kayıp Grafikleri: Saf SVG ile çizilen net eğilimi çizgisi, ortalama çizgisi, en çok net kaybettiren dersler ve konuların yatay çubukları ve bölüm dağılımı grafikleri eklendi.',
          'Denemeler Sayfasında Koç Genel Bakışı ("Sonuçlar"): Tüm öğrencilerin son deneme netleri, net değişim rozetleri (Δ), son 7 günde girilen deneme sayısı ve kurum genelinde en çok net kaybedilen alanlar tek ekranda toplandı.',
        ],
      },
      {
        version: 'v0.25',
        title: 'Ek Yerleştirme ekranı, veri düzeltmesi ve yıl bazlı puanlar',
        items: [
          'Yeni Ek Yerleştirme ekranı: ÖSYM Ek Yerleştirme Kılavuzu\'ndaki 16.715 program artık uygulamada. Tablo (Ön Lisans / Lisans), puan türü, üniversite türü (devlet / vakıf / KKTC / yurt dışı), burs ya da indirim, il ve program / üniversite adıyla süzebiliyorsun; "Sadece kontenjanı olanlar" ve "En küçük puanı boş olanlar" kutuları da var. Adlarda Türkçe harfler önemsenmiyor, "hemsirelik" yazınca "Hemşirelik" de geliyor.',
          'Bir programa tıklayınca yanda genel, şehit / gazi yakını ve 34 yaş üstü kadın kontenjanları, her birinin en küçük puanı ve kılavuzdaki koşul metinleri açılıyor. Vakıf ve KKTC programlarında yıllık öğrenim ücreti de gösteriliyor; ücret program adından yaklaşık eşleştirildiği için kesin değil, kılavuzla birlikte kontrol et.',
          'Öğrenci için en fazla 24 tercihlik liste hazırlanıyor: öğrenciyi seç, programları "Listeye ekle" ile ekle, sürükleyerek ya da ok butonlarıyla sırala, her satıra kısa not yaz ve Kaydet\'e bas. "Yazdır" ÖSYM\'ye girilecek program kodlarını sıra numarasıyla tek sayfalık liste olarak basıyor.',
          'Öğrencinin puanlarını (TYT, SAY, EA, SÖZ, DİL) girersen, puanı bir programın en küçük puanının altında kalan satırlarda kırmızı "Puan altında" uyarısı çıkıyor. "Dolmadı" yazan programlarda merkezî yerleştirmede kontenjan dolmadığı için karşılaştırılacak bir puan yok, bu satırlarda uyarı çıkmaz. Puanlar yalnızca bu tarayıcıda saklanıyor.',
          'Kaydedilmemiş değişiklik uyarısı: listede değişiklik yapıp Kaydet\'e basmadan başka öğrenciye ya da başka yıla geçmeye, hatta sayfayı kapatmaya çalışırsan uygulama önce soruyor; böylece hazırladığın liste yanlışlıkla kaybolmuyor.',
          'Düzeltme: bazı programlarda üniversite adı boş ya da eksik görünüyordu, ad ayrıştırması düzeltildi. Bazı vakıf programlarında da başka bir üniversitenin ya da bozuk bir yıllık ücret gösteriliyordu; artık ücret yalnızca gerçekten aynı üniversite ve programla eşleşirse gösteriliyor, eşleşme yoksa hiçbir şey yazılmıyor.',
          'Program listesine kılavuzdaki sütunlar eklendi: öğrenim süresi, puan türü, genel / şehit-gazi yakını / 34 yaş üstü kadın ek kontenjanı ve bu üç kontenjanın en küçük puanı. Kontenjanı olmayan hücreler kılavuzdaki gibi boş bırakılıyor; başlıklara fare ile gelince tam adı görünüyor.',
          'Kılavuz yılı seçici artık etiketli ("Kılavuz yılı"). Öğrencinin puanları yıla göre ayrı saklanıyor: yıl değiştirince o yıla ait puanlar geliyor. Önceden girilmiş puanlar kaybolmadı, en yeni yıla taşındı.',
        ],
      },
    ],
  },
  {
    date: '21 Ağustos 2026',
    entries: [
      {
        version: 'v0.24',
        title: 'Müfredat YKS / LGS ayrımı + 7-8. sınıf desteği',
        items: [
          'Öğrenci sınıf aralığı genişledi: artık 7. Sınıf\'tan 12. Sınıf\'a kadar ve Mezun seçilebiliyor — önceden yalnızca 12. Sınıf ve Mezun vardı.',
          'Müfredat ekranı YKS ve LGS olmak üzere iki sekmeye ayrıldı; her sekme kendi derslerini gösteriyor ve ders sayısı sekme başlığında yazıyor. Bugüne kadarki 14 ders (187 konu) YKS oldu — 9, 10, 11, 12. Sınıf ve mezunlar sorumlu. LGS müfredatı yüklendi: 6 ders, 47 konu, 90 soru (Türkçe, Matematik, Fen Bilimleri, T.C. İnkılap Tarihi ve Atatürkçülük, Din Kültürü ve Ahlak Bilgisi, Yabancı Dil) — şimdilik 8. Sınıfa tanımlı, 7. Sınıf müfredatı geldiğinde aynı yere eklenecek.',
          '7. ve 8. Sınıf öğrencisi artık yalnızca LGS müfredatını görüyor, 9. Sınıf ve üzeri yalnızca YKS\'i — bu ayrım Konu Yeterlilik Haritası, Haftalık Program, Haftalık Görüşme ve öğrenci profilindeki Konu Yeterliliği sekmesinin hepsinde geçerli.',
          'LGS\'te alan (SAY/EA/SÖZ) kavramı olmadığı için 7. ya da 8. Sınıf seçilince öğrenci ekleme formunda Alan sorusu kayboluyor, panel kartında da alan rozeti basılmıyor.',
          '8. Sınıf öğrencisine deneme girerken artık LGS bölümleri çıkıyor (6 bölüm, 90 soru) ve net LGS kuralına göre hesaplanıyor: 3 yanlış 1 doğruyu götürüyor (YKS\'de 4). Derslerin katsayısı farklı olduğu için katsayılı "ağırlıklı net" ayrıca gösteriliyor. Bu, gerçek 500 puanlık LGS puanı değil — o puan yalnızca merkezî sınav istatistikleriyle hesaplanabildiği için uygulama puan üretmiyor, yalnızca ağırlıklı neti gösteriyor.',
          'Düzeltme: öğrenci profilindeki "Konu Yeterliliği" sekmesi 14 dersten yalnızca 4\'ünü (Tarih, Coğrafya, Felsefe, Din Kültürü) gösteriyordu, ders adları eski bir listeyle eşleştirildiği için geri kalan 10 ders sessizce eksik kalıyordu. Artık bütün dersler görünüyor.',
        ],
      },
    ],
  },
  {
    date: '18 Ağustos 2026',
    entries: [
      {
        version: 'v0.23',
        title: 'Denetim Kayıtları, şifre sıfırlama ve arayüz turu',
        items: [
          'Denetim Kayıtları (/yonetim/kayitlar): Sistemdeki her oluşturma, değişiklik ve silme kaydediliyor. Bir satıra tıklayınca alan bazlı "önce → sonra" dökümü açılıyor. Yalnız sistem yöneticisi görür; kurum yöneticileri dahil kimse erişemez.',
          'Kayıtlar üç kanaldan da toplanıyor: panelden yapılanlar kullanıcı adıyla, mobil portalda öğrencinin yaptıkları "Öğrenci (portal)" olarak, otomatik script\'ler "Sistem" olarak. Erişim kodları kayda maskelenerek yazılıyor.',
          'Kayıt yönetimi: üstteki kutucuklarda toplam kayıt, son 30 gün ve kapladığı yer görünüyor. "Arşivle (JSON)" ile indirilebiliyor, bir tarihten öncesi temizlenebiliyor. Temizliğin kendisi de kaydediliyor ve o kayıt asla silinmiyor.',
          'Şifremi unuttum: Giriş ekranından şifre sıfırlama bağlantısı istenebiliyor, gelen bağlantıyla yeni şifre belirleniyor. Daha önce şifresini unutan kullanıcı için hiçbir kurtarma yolu yoktu.',
          'Karşılama ekranı: Giriş sayfası ikiye ayrıldı — "Koç / Personel" e-posta ve şifreyle, "Öğrenci & Veli" erişim koduyla. Portal bağlantısını kaybeden öğrenci artık çıkmaza girmiyor.',
          'Davet bağlantıları artık davete özel gizli bir anahtar taşıyor; bağlantısı olmayan kimse kayıt olamıyor ve kayıt ekranı hangi kuruma hangi rolle davet edildiğini gösteriyor.',
          'Sol menü katlanabilir ve kilitlenebilir hale geldi; kapalıyken üzerine gelince açılıyor. Menü rengi aktif kuruma göre değişiyor, böylece hangi kurumda çalıştığın tek bakışta belli oluyor.',
          'Haftalık Program\'ın 7 günü artık tek ekrana sığıyor — sağa kaydırma gerekmiyor. Boş günlerde doğrudan "Görev ekle" çıkıyor.',
          'Panel kartlarında görev planlanmamış öğrencide %0 yerine "Plan yok" yazıyor; ikisi aynı şey değildi. Her kartta tekrar eden "Kritik yok" rozeti kaldırıldı.',
          'Mobil portal telefona uygun hale getirildi: deneme girişindeki kutulara dokununca sayfanın kendiliğinden yakınlaşması giderildi, dokunma hedefleri büyütüldü, çentikli telefonlarda kenar boşlukları düzeltildi.',
          'Düzeltme: Öğrenci Ekle/Düzenle başta olmak üzere modal pencereler şeffaf görünüyordu, arkadaki sayfa içlerinden okunuyordu.',
          'Düzeltme: Yeni öğrenci her zaman "özel koçluk" işaretli açılıyordu; kurum öğrencileri bu yüzden kuruma kapalı doğuyordu. Artık kurumun türüne göre belirleniyor.',
        ],
      },
    ],
  },
  {
    date: '13 Ağustos 2026',
    entries: [
      {
        version: 'v0.22',
        title: 'Çok Kurumlu Yapı ve Rol Tabanlı Yetki Sistemi (RBAC)',
        items: [
          'Çoklu kurum (multi-tenancy) ve esnek rol/izin mimarisi yayına alındı. Artık her kullanıcı kendi kurumunun verilerine erişir, yetkisiz alanlara erişim kısıtlanır.',
          'Yönetim Paneli (/yonetim): Kullanıcılar, Roller ve Kurumlar olmak üzere 3 yeni yönetim sekmesi eklendi.',
          'Kullanıcı Yönetimi (/yonetim/kullanicilar): Aktif kurumdaki üyeler listelenir, yeni üyeler e-posta ve rol seçimiyle davet edilebilir, mevcut üyelerin rolleri değiştirilebilir veya üyelikleri pasife alınabilir.',
          'Rol & İzin Yönetimi (/yonetim/roller): Dinamik izin matrisi (22 bağımsız izin hakkı) ile kurum bazlı özel roller (örn. "Etüt Görevlisi", "Rehberlik Uzmanı") oluşturulabilir.',
          'Davet & Kayıt Akışı (/kayit): Davet edilen kişilere özel kayıt bağlantısı üretilir, davetliler tek adımla ilgili kuruma ve role atanarak kaydolur.',
          'Koçluk Kilidi Arayüzü: Özel koçluk öğrencisi olan bir öğrencinin Konular, Program ve Raporlar sekmelerine yetkisiz erişimlerde net ve açıklayıcı kilit ekranı gösterilir.',
        ],
      },
    ],
  },
  {
    date: '31 Temmuz 2026',
    entries: [
      {
        version: 'v0.21',
        title: 'Portalda öğrenci/veli rolü artık ilk bakışta belli',
        items: [
          'Rol rozeti (Öğrenci / Veli) soluk bir etiket olmaktan çıkıp dolu renkli bir rozete dönüştü; sayfanın en üstüne de ince bir renk şeridi eklendi — hangi portalda olduğun sekmeye bakmadan anlaşılıyor.',
          'İki portal artık farklı renkte: öğrenci tarafı indigo (uygulamanın ana rengi), veli tarafı teal/petrol mavisi. Yüzdeler, netler, ilerleme çubuğu ve seçili alt sekme de bu renge uyuyor.',
          'Düzeltme: rozet ve "Bugün" etiketinin arka plan rengi hiç basılmıyordu (yazım hatası olan bir renk değişkeni kullanılıyordu) — bu yüzden rozet zeminsiz ve sönük görünüyordu.',
          'Renkler okunabilirlik için koyu tonlardan seçildi (beyaz yazı üzerinde WCAG AA kontrast eşiğini geçiyor).',
          'Yardım sayfasındaki "Mobil Öğrenci & Veli Portalı" kartına ekran görüntüleri eklendi: giriş ekranı, öğrenci programı, deneme girişi ve veli özeti. Küçük görsele tıklayınca tam boy açılıyor, oklarla ya da klavyeyle aralarında gezinebiliyorsun.',
          'Giriş ekranındaki örnek kod eski 4 haneli biçimi gösteriyordu, güncel 6 haneli biçime çevrildi.',
        ],
      },
      {
        version: 'v0.20',
        title: 'Mobil Öğrenci & Veli Portalı çalışır hale getirildi',
        items: [
          'Öğrenci profilinde artık iki ayrı buton var: "Öğrenci Linki" ve "Veli Linki". Her biri kendi erişim kodunu üretip WhatsApp ile gönderiyor (numara kayıtlı değilse link ekranda gösteriliyor, elle iletebilirsin).',
          'Öğrenci portalı (/ogrenci): haftalık program gün gün listeleniyor, bugün vurgulanıyor, konu ve ders adı görünüyor; göreve dokununca tamamlandı işaretleniyor ve bu kayıt koç panelinde de anında görünüyor.',
          'Öğrenci artık denemesini bölüm bazlı doğru/yanlış girerek kaydedebiliyor — netler anında hesaplanıyor ve deneme koçun ekranında da tüm bölüm dökümüyle çıkıyor. (Önceden netsiz, boş deneme kaydediliyordu.)',
          'Veli portalı (/veli) üç sekmeye kavuştu: Özet (haftalık tamamlama oranı, son deneme neti, devamsızlık durumu, hedef bölüm), Denemeler (net listesi + bölüm tablosu) ve Devamsızlık (tarih, oturum türü, mazeret geçmişi). Önceden üç sekme de aynı ekranı gösteriyordu.',
          'Bu hafta için henüz program girilmemişse portal boş kalmıyor; en son girilen haftayı "bu hafta değil" uyarısıyla gösteriyor.',
          'Güvenlik: öğrenci/veli verisi artık sunucuda kod doğrulayan özel fonksiyonlar üzerinden geliyor. Önceki sürümde erişim kodu üretilmiş tüm öğrencilerin adı, telefonu, veli telefonu ve erişim kodları dışarıdan okunabiliyordu — bu açık kapatıldı. Erişim kodları da 4 karakterden 6 karaktere çıkarıldı.',
        ],
      },
    ],
  },
  {
    date: '29 Temmuz 2026',
    entries: [
      {
        version: 'v0.19',
        title: 'Deneme sonucunu WhatsApp ile gönderme',
        items: [
          'Bir denemeye tıklayıp bölüm tablosunu açtığında altında "Sonucu WhatsApp ile gönder: Öğrenciye · Veliye · Her İkisine" butonları çıkıyor.',
          'Mesajda sınav adı, türü, tarihi, yayıncısı; bölüm bazlı doğru/yanlış/boş ve net dökümü; toplam doğru/yanlış/boş ve toplam net yer alıyor (WhatsApp kalın yazı biçimiyle).',
          'Öğrenciye ve veliye giden metinler farklı; "Her İkisine" seçilirse iki ayrı sohbet penceresi açılır. Telefon numarası eksikse uyarı verilir ve hiçbir pencere açılmaz.',
          'Üç yerden de gönderilebiliyor: Deneme Girişi geçmiş listesi, "Tüm Deneme Geçmişi" tablosu ve öğrenci profilindeki Deneme Geçmişi sekmesi. Bölüm skoru girilmemiş denemelerde butonlar görünmez.',
        ],
      },
      {
        version: 'v0.18',
        title: 'Haftalık Programdaki konudan gelişim paneli açılıyor',
        items: [
          'Haftalık Program\'da bir görevin konu adına tıklandığında, Konu Yeterlilik Haritası\'nın sağındaki gelişim paneli aynen bir pencere olarak açılıyor: ölçüm geçmişi, ortalama doğruluk, gelişim grafiği, "+ Test Sonucu Ekle" ve Koç Kararı + koç notu.',
          'Panelden yapılan kayıtlar doğrudan veritabanına gidiyor; Konu Yeterlilik Haritası ekranında da anında görünüyor.',
          'Panel her iki ekranda da aynı yerden geliyor — Konu Yeterlilik Haritası\'nda ne görüyorsan Haftalık Program\'da da birebir aynısını görürsün, ikisi asla farklılaşmaz.',
          'Kartın kendisine çift tıklayarak görev düzenleme eskisi gibi çalışmaya devam ediyor.',
          'Yardım sayfası son özelliklere göre güncellendi: Devamsızlık, açılır deneme bölüm tablosu ve programdan açılan konu gelişim paneli anlatıldı.',
        ],
      },
      {
        version: 'v0.17',
        title: 'Deneme bölüm skorları artık tablo olarak açılıyor',
        items: [
          'Deneme geçmişindeki bir denemeye tıklandığında bölüm skorları düz metin yerine tablo olarak açılıyor: Bölüm · Doğru · Yanlış · Boş · Soru · Net ve altında "Toplam" satırı.',
          'Üç yerde birden çalışıyor: Deneme Girişi ekranının sağındaki geçmiş listesi, "Tüm Deneme Geçmişi" tablosu ve öğrenci profilindeki "Deneme Geçmişi" sekmesi.',
          'Satırların tıklanabilir olduğu ok işaretiyle belli ediliyor; açık olan deneme kapatılabiliyor, bölüm verisi olmayan denemelerde açıklayıcı mesaj çıkıyor.',
        ],
      },
      {
        version: 'v0.16',
        title: 'Devamsızlık Takibi + WhatsApp Bildirimi',
        items: [
          'Yeni ekran: Devamsızlık — "Kayıtlar" ve "Öğrenci Özeti" iki sekmeli. Yoklama listesi yok, sadece devamsızlık olayları kaydediliyor (bu yüzden bir katılım yüzdesi HESAPLANMIYOR — sadece mutlak sayılar).',
          'Devamsızlık Ekle: öğrenci, tarih, oturum türü (birebir/etüt/grup/online), durum (gelmedi/geç geldi/erken ayrıldı), mazeret (7 sabit seçenek) ve not.',
          'Kayıt sonrası "Şimdi WhatsApp ile bildirilsin mi?" sorusu ya da doğrudan "Kaydet ve Bildir" ile öğrenciye/veliye/her ikisine bildirim gönderilebiliyor; bildirim damgası "WhatsApp açıldı · tarih" olarak gösteriliyor — uygulama sohbeti açar, mesajı senin gönderip göndermediğini doğrulayamaz, o yüzden "gönderildi" demiyor.',
          'Öğrenci Özeti sekmesi: her aktif öğrenci için toplam/mazeretsiz devamsızlık, son 30 gün, aylık mini grafik; son 30 günde 3+ devamsızlık ya da 2+ mazeretsiz devamsızlık olan öğrencilere "Takip gerekli" rozeti. Veliye toplu özet WhatsApp mesajı gönderilebiliyor.',
          'Öğrenci profiline (Öğrenciler sayfası) devamsızlık sayısı rozeti eklendi, Devamsızlık ekranına filtreli link veriyor.',
          'WhatsApp gönderimi (numara biçimlendirme, sohbet açma) tüm ekranlarda tek ve aynı şekilde çalışacak biçimde birleştirildi.',
        ],
      },
    ],
  },
  {
    date: '23 Temmuz 2026',
    entries: [
      {
        version: 'v0.15',
        title: 'Tercih Sihirbazı',
        items: [
          'Yeni ekran: YÖK Atlas 2025 verisiyle (66.416 kayıt, ÖSYM program kodları dahil) bölüm arama ve tercih listesi oluşturma.',
          '11 filtre: puan türü, üniversite, program, şehir (çoklu), ön lisans/lisans, üniversite türü, ücret/burs, öğretim türü, program kodu, en az/en çok başarı sırası.',
          'Öğrenci seçilince puan türü otomatik dolar; tahmini sıralamaya göre her program için Ulaşılabilir / Riskli / Zor durumu gösterilir.',
          'Sonuçlar başarı sırasına göre sıralanır.',
        ],
      },
    ],
  },
  {
    date: '19 Temmuz 2026',
    entries: [
      {
        version: 'v0.14',
        title: 'Yazdırma başlığına logo',
        items: ['Haftalık Program çıktısının (yazdır/PDF) üst kısmına Netlik logosu eklendi.'],
      },
      {
        version: 'v0.13',
        title: 'Veli telefonu ve WhatsApp ile gönderme',
        items: [
          'Öğrenci kaydına, öğrenci telefonu yanında ayrı bir veli telefonu alanı eklendi.',
          'Haftalık Program’da "WhatsApp ile Gönder" artık seçilebilir: Öğrenciye, Veliye ya da Her İkisine.',
        ],
      },
      {
        version: 'v0.12',
        title: 'Müfredat yeniden dizaynı',
        items: [
          'TYT dersleri (Türkçe, Matematik, Geometri, Fizik, Kimya, Biyoloji) sadeleştirilmiş bir listeyle yeniden düzenlendi.',
          '4 yeni AYT dersi eklendi: AYT Matematik, AYT Fizik, AYT Kimya, AYT Biyoloji (toplam 38 yeni konu).',
          'Eski konular silinmedi, sadece listeden gizlendi — geçmiş ölçüm ve görev verileri korundu.',
        ],
      },
      {
        version: 'v0.11',
        title: 'Deneme geçmişi listesi',
        items: ['Deneme Girişi ekranında geçmiş denemeler listelenip filtrelenebilir hale geldi.'],
      },
      {
        version: 'v0.10',
        title: 'Yazdırılabilir Haftalık Program',
        items: [
          'Haftalık Program’a "Yazdır / PDF" butonu eklendi — 7 gün tek sayfaya, yatay düzende sığacak şekilde.',
        ],
      },
    ],
  },
  {
    date: '18 Temmuz 2026',
    entries: [
      {
        version: 'v0.9',
        title: 'Öğrenci düzenleme, arşivleme, fotoğraf',
        items: [
          'Öğrenci kartlarına "..." menüsü eklendi: Düzenle, Arşivle/Aktifleştir, Kalıcı Sil.',
          'Profil fotoğrafı yükleme desteği eklendi (Supabase Storage).',
        ],
      },
      {
        version: 'v0.8',
        title: 'Konu testi, Beni Hatırla, hızlı düzenleme',
        items: [
          'Konu Yeterlilik Haritası’na konu testi sonucu girme ve konu/ders ortalaması takibi eklendi.',
          'Giriş ekranına "Beni Hatırla" eklendi.',
          'Haftalık Program’da bir göreve çift tıklayarak yerinde düzenleme yapılabilir hale geldi.',
        ],
      },
      {
        version: 'v0.7',
        title: 'Yardım sayfası ve canlı yayın',
        items: [
          'Uygulama içi Yardım sayfası eklendi — her ekranın ne işe yaradığı ve ne zaman kullanılacağı.',
          'Proje Vercel üzerinden canlı yayına alındı.',
        ],
      },
      {
        version: 'v0.6',
        title: 'Müfredat yönetimi ve marka kimliği',
        items: [
          'Ders/konu ekleme, yeniden adlandırma, sıralama ve pasifleştirme ekranı (Müfredat) eklendi.',
          'Netlik marka logosu; giriş ekranı, menü ve tarayıcı sekmesine (favicon) işlendi.',
          'Koç için ekran görüntülü kullanım rehberi (sunum/PDF) hazırlandı.',
        ],
      },
      {
        version: 'v0.5',
        title: 'Kurulum tamamlandı, ilk giriş',
        items: [
          'Supabase projesi kuruldu, veritabanı şeması çalıştırıldı, ilk koç hesabı açıldı.',
          '"Öğrenci Ekle" butonu çalışır hale getirildi (önceden hiçbir yere bağlı değildi).',
          'Haftalık Program’da görev eklerken önce ders, sonra konu seçilen iki adımlı yapı eklendi.',
        ],
      },
      {
        version: 'v0.4',
        title: 'Tüm ekranlar canlandı',
        items: [
          'Öğrenciler, Deneme Girişi, Konu Yeterlilik Haritası, Haftalık Program, Haftalık Görüşme ekranları gerçek Supabase verisiyle çalışır hale geldi.',
        ],
      },
      {
        version: 'v0.3',
        title: 'Supabase entegrasyonu',
        items: ['Kimlik doğrulama (giriş/çıkış), tasarım sistemi ve sayfa yönlendirmeleri (routing) kuruldu.'],
      },
      {
        version: 'v0.2',
        title: 'Veri modeli',
        items: [
          'TypeScript tipleri, net hesaplama fonksiyonu ve resmi 2022 TYT konu listesi (141 konu / 10 ders) veritabanına işlendi.',
        ],
      },
    ],
  },
  {
    date: '17 Temmuz 2026',
    entries: [
      {
        version: 'v0.1',
        title: 'Proje temeli',
        items: ['Vite + React + TypeScript iskeleti kuruldu — Netlik’in ilk satır kodu.'],
      },
    ],
  },
]

export default function VersionHistory() {
  return (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 30, maxWidth: 720 }}>
    {HISTORY.map((group) => (
      <div key={group.date}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <History size={15} color="var(--ink-faint)" />
          <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: 0.04 }}>
            {group.date}
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderLeft: '2px solid var(--border-soft)', paddingLeft: 20 }}>
          {group.entries.map((entry) => (
            <div key={entry.version} className="card" style={{ padding: 16, position: 'relative' }}>
              <div
                style={{
                  position: 'absolute', left: -26, top: 20, width: 10, height: 10, borderRadius: '50%',
                  background: 'var(--indigo-500)', border: '2px solid var(--paper)',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span
                  style={{
                    fontSize: 11, fontWeight: 800, color: 'var(--indigo-700)', background: 'var(--indigo-050)',
                    padding: '2px 8px', borderRadius: 20, fontFamily: 'var(--font-mono)',
                  }}
                >
                  {entry.version}
                </span>
                <h3 style={{ fontSize: 14.5 }}>{entry.title}</h3>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {entry.items.map((item, idx) => (
                  <li key={idx} style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5 }}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
  )
}
