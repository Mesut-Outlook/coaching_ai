import { Link, useSearchParams } from 'react-router-dom'
import {
  LayoutGrid, Users, ClipboardList, Layers, Calendar, UserX, BarChart2, BookOpen, Compass, ListPlus, ArrowRight, Smartphone, ShieldCheck, ScrollText, TrendingUp,
} from 'lucide-react'
import PageHeader from '../components/layout/PageHeader'
import VersionHistory from '../components/help/VersionHistory'
import ScreenshotStrip, { type Screenshot } from '../components/help/ScreenshotStrip'

interface GuideItem {
  to: string
  label: string
  icon: typeof LayoutGrid
  step: string
  body: string
  usage: string
  /** Karta eklenen küçük ekran görüntüleri (tıklanınca büyür). */
  shots?: Screenshot[]
}

const GUIDE: GuideItem[] = [
  {
    to: '/panel',
    label: 'Ana Sayfa',
    icon: LayoutGrid,
    step: '1 · Güne Başlarken',
    body: 'Güne buradan başlarsın. "Bugün ilgi bekleyenler" listesi öğrencileri nedenleriyle sıralar: kritik konu, net düşüşü, devamsızlık, yarım kalan ya da hiç olmayan program, uzun süredir deneme girilmemesi. Her öğrencinin yanında en önemli nedenine göre tek bir düğme durur (deneme analizini aç, programı aç, deneme gir…). Sağda bu haftanın görev tamamlaması gün gün görünür; altta beş modül kartı ilgili ekranlara götürür, son denemeler ve son hareketler listelenir. Sol menüdeki kırmızı sayaçlar konusu girilmemiş denemeleri ve takip gereken öğrencileri gösterir. Yeni öğrenci kaydı ve deneme girişi sağ üstteki düğmelerden açılır.',
    usage: 'Her gün işe başlarken — bugün önce kime bakmalıyım?',
  },
  {
    to: '/ogrenciler',
    label: 'Öğrenciler',
    icon: Users,
    step: '2 · Öğrenciyi Tanı',
    body: 'Tüm öğrenci listesi ve her birinin profili burada — hedef program, net gelişim grafiği, deneme geçmişi, konu yeterliliği ve görevler sekmelerde. Profil başlığında hedef net (TYT, AYT ya da LGS) ve hedefe kalan net görünür; sınav tarihi girildiyse haftalık gereken artış da hesaplanır. "Genel Bakış" sekmesinin başında "Görüşmede konuşulacaklar" kartı en fazla 5 madde listeler. Profil başlığında telefonların yanında devamsızlık sayısı da görünür (tıklayınca Devamsızlık ekranına gider). "Deneme Geçmişi" sekmesinde bir denemeye tıklayınca bölüm bazlı doğru/yanlış/boş/net tablosu açılır ve sonucu oradan WhatsApp ile paylaşabilirsin. Kart üzerindeki "..." menüsünden bilgileri düzenleyebilir, profil fotoğrafı yükleyebilir, öğrenci ve veli telefonu ekleyebilir, öğrenciyi arşivleyebilir ya da kalıcı silebilirsin. Öğrenci ekleme/düzenleme formunda sınıf artık 7. Sınıf\'tan 12. Sınıf\'a kadar (+ Mezun) seçilebiliyor.',
    usage: 'Bir öğrenciyi aramak, bilgilerini güncellemek ya da geçmişini detaylı incelemek istediğinde.',
  },
  {
    to: '/denemeler',
    label: 'Deneme Girişi & Karnesi',
    icon: ClipboardList,
    step: '3 · Sonuçları Kaydet',
    body: 'Sınav adı, yayıncı, tarih, alt ders ve konu detaylarını karne düzeninde girersin; net hesaplaması (YKS: Doğru − Yanlış ÷ 4, LGS: Doğru − Yanlış ÷ 3) ve canlı özet balonları anında hesaplanır. İsteğe bağlı olarak yayının açıkladığı puan, yüzdelik dilim ve sıralamalar girilebilir. "Sonuçlar & Koç Özeti" sekmesinde kurum genelinde son 7 günde girilen denemeleri ve en çok net kaybedilen alanları görebilirsin. "Tüm Deneme Geçmişi" sekmesinde geçmiş denemeler listelenir ve "Düzenle" düğmesiyle herhangi bir denemenin konuları güncellenebilir.',
    usage: 'Öğrenci her yeni deneme sonucunu paylaştığında — girdikten hemen sonra sonucu WhatsApp ile öğrenciye/veliye gönderebilirsin.',
  },
  {
    to: '/ogrenciler',
    label: 'Deneme Analizi (3 Seviye)',
    icon: TrendingUp,
    step: 'Analiz & Görüşme',
    body: 'Öğrenci profilindeki "Deneme Analizi" sekmesi deneme verilerini üç seviyede inceler: (1) Genel: net çizgisi, ortalama, net değişimi (Δ) ve görüşmede konuşulacak koç içgörüleri; (2) Ders: en çok net kaybettiren dersler ve tüm denemelerin ders ısı tablosu; (3) Konu: en çok net kaybettiren ilk 10 konu, ders filtreli konu ısı tablosu, birikimli soru/doğru/yanlış toplamları ve gelişim eğilimleri. Grafik ve tablo arasında tek tıkla geçiş yapılabilir.',
    usage: 'Öğrenciyle haftalık görüşmede veya veli bilgilendirmesinde deneme gelişimini ve eksik konuları netleştirmek istediğinde.',
  },
  {
    to: '/ogrenciler',
    label: 'Koç 360 Raporu',
    icon: Compass,
    step: '360° Analiz',
    body: 'Öğrenci profilindeki "360 Rapor" sekmesi, öğrencinin sınav hazırlığını altı analitik eksende değerlendirir: (1) Hedef Yolu: Doğrusal regresyonla sınav günündeki tahmini net ve belirsizlik bandı; (2) Konu Öncelik Matrisi: Soru ağırlığı ve başarı oranına göre 4 bölge (Hemen Çalış, Koru, Hızlı Kazanım, Sonra); (3) Net Kaybı Pareto Analizi: En çok net kaybına yol açan ilk %60 kritik konular; (4) Ders Hata Profili: Yanlış ve boş oranlarına göre 4 strateji bölgesi (Sağlam, Riskli İşaretleme, Süre/Strateji, Konu Eksiği); (5) Ödev ↔ Deneme Tutarlılığı: Görev sonuçları ile deneme başarısı arasındaki farkları yakalayan dambıl analizi; (6) Müfredat İlerlemesi ve Yetişme Tahmini: Konu tamamlama hızı ve sınav tarihine yetişme projeksiyonu. Her grafik üzerinden tek tıkla haftalık programa görev atanabilir.',
    usage: 'Öğrenci veya veliyle yapılan detaylı performans değerlendirmelerinde ve sınav stratejisi belirlerken.',
  },
  {
    to: '/konular',
    label: 'Konu Yeterlilik Haritası',
    icon: Layers,
    step: '4 · Konuyu Değerlendir',
    body: 'Her konudaki durum (Yeterli / Gelişiyor / Kritik / Ölçülmedi) burada. Bir konuya tıklayıp "Test Sonucu Ekle" ile konu testi sonucu girebilir, geçmiş ölçümleri ve konu/ders ortalamasını görebilirsin. Sistem bir durum önerir, sen "Koç Kararı" ile onaylar ya da değiştirirsin.',
    usage: 'Bir konu testi çözüldüğünde sonucu kaydetmek, ya da haftalık programı hazırlamadan önce hangi konulara ağırlık vereceğine karar verirken. İpucu: aynı panel Haftalık Program ekranında konu adına tıklayarak da açılır.',
  },
  {
    to: '/program',
    label: 'Haftalık Program',
    icon: Calendar,
    step: '5 · Haftayı Planla',
    body: 'Haftalık plan gün gün saatli bloklar panosu şeklinde. "+ Görev Ekle" ile açılan yeni pencerede çoklu gün × çoklu saat seçerek Ders, Mola veya Serbest blokları tek seferde oluşturabilirsin. Ders blokları sol kenarlık rengiyle ayrışır, YKS öğrencisinde TYT/AYT ayrımı ve isteğe bağlı konu seçimi sunar; dinlenme molaları (☕) ve serbest aktiviteler (📌 Özel ders, okul sınavı vb.) koçluk analizlerine ve sayaçlara karışmaz. Kartlar saat sırasına göre dizilir, saatsiz görevler günün altında toplanır. Kartların üzerine çift tıklayarak düzenleyebilir, sürükleyerek başka güne taşıyabilirsin. Tamamlanan görevlerde koç Doğru/Yanlış/Boş sonuçlarını girip kart rozetlerinde görüntüleyebilir; soru hedefi olmayan saatli görevlerde soru sayısı girilen sonuca göre otomatik tamamlanır. Sağ üstteki "Yazdır / PDF" ve "WhatsApp ile Gönder" butonlarıyla hazırladığın programı saatli formatta kolayca paylaşabilirsin.',
    usage: 'Hafta başında planlarken, görev sonuçlarını girerken ya da hazırladığın programı öğrenciyle/veliyle paylaşman gerektiğinde.',
  },
  {
    to: '/devamsizlik',
    label: 'Devamsızlık',
    icon: UserX,
    step: 'Gerektiğinde',
    body: 'Öğrenci devamsızlıklarını kaydedersin — tarih, oturum türü (birebir/etüt/grup/online), durum ve varsa mazeret. Kayıt sonrası WhatsApp ile öğrenciye, veliye ya da her ikisine bildirim gönderebilirsin. "Öğrenci Özeti" sekmesinde her öğrencinin toplam/mazeretsiz devamsızlık sayısını, son 30 gündeki durumunu ve aylık dağılımını görür, son 30 günde üç ya da daha fazla devamsızlığı veya iki ya da daha fazla mazeretsiz devamsızlığı olanlar için "Takip gerekli" uyarısı görürsün; veliye tek tuşla devamsızlık özeti gönderebilirsin. Not: yoklama listesi yok, bu yüzden bir katılım yüzdesi hesaplanmaz — sadece mutlak sayılar gösterilir.',
    usage: 'Bir öğrenci derse/etüde gelmediğinde kaydetmek, ya da hangi öğrencilerin devamsızlık açısından takip gerektirdiğine bakmak istediğinde.',
  },
  {
    to: '/raporlar',
    label: 'Haftalık Görüşme',
    icon: BarChart2,
    step: '6 · Haftayı Kapat',
    body: 'Geçen haftanın özeti, öne çıkan kritik konular ve gelecek haftaya doğrudan görev atayabileceğin planlama alanı aynı ekranda. En üstte yer alan "Görüşmede Konuşulacaklar" kartı, öğrencinin son deneme, görev ve konu ölçümlerinden türetilen en fazla 5 maddeyi (Kritik, Ödev, Tutarsızlık, Tekrar, İlerleme) otomatik listeler; maddenin yanındaki düğmeyle doğrudan programa görev eklenir.',
    usage: 'Haftalık birebir görüşmelerde, öğrenciyle karşılıklı otururken.',
  },
  {
    to: '/mufredat',
    label: 'Müfredat',
    icon: BookOpen,
    step: 'Arka Plan · Gerektiğinde',
    body: 'Ders ve konu listesini burada düzenlersin — ekleme, yeniden adlandırma, sıralama ve pasifleştirme. Ekran artık YKS ve LGS olmak üzere iki sekmeye ayrıldı, her sekme kendi derslerini gösterir ve sekme başlığında o müfredatın ders sayısı yazar. YKS sekmesinde bugüne kadarki 14 ders (187 konu, TYT dersleri + 4 AYT dersi: Matematik, Fizik, Kimya, Biyoloji) var — 9, 10, 11, 12. Sınıf ve mezunlar bundan sorumlu. LGS sekmesinde 6 ders (47 konu, 90 soru: Türkçe, Matematik, Fen Bilimleri, T.C. İnkılap Tarihi ve Atatürkçülük, Din Kültürü ve Ahlak Bilgisi, Yabancı Dil) var, şimdilik 8. Sınıfa tanımlı — 7. Sınıf müfredatı geldiğinde aynı yere eklenecek. Hangi öğrencinin hangi müfredatı göreceği sınıfına göre kendiliğinden belirlenir: 7. ve 8. Sınıf yalnız LGS, 9. Sınıf ve üzeri yalnız YKS görür — bu ayrım Konu Yeterlilik Haritası, Haftalık Program, Haftalık Görüşme ve öğrenci profilindeki Konu Yeterliliği sekmesinin hepsinde geçerlidir.',
    usage: 'Yeni bir ders/konu eklemen ya da eskiyeni kaldırman gerektiğinde.',
  },
  {
    to: '/tercih',
    label: 'Tercih Sihirbazı',
    icon: Compass,
    step: 'Tercih Dönemi · Gerektiğinde',
    body: 'YÖK Atlas 2025 taban puan ve başarı sırası verisiyle bölüm arama motoru. Puan türü, üniversite, program, şehir (çoklu), ön lisans/lisans, üniversite türü, ücret/burs, öğretim türü, program kodu ve başarı sırası aralığına göre filtreler; sonuçları başarı sırasına göre sıralar ve ÖSYM program kodlarıyla listeler. Bir öğrenci seçersen puan türü otomatik dolar; tahmini sıralamayı girince her program için Ulaşılabilir / Riskli / Zor durumunu gösterir.',
    usage: 'Öğrenciye tercih listesi hazırlarken — "sadece Tıp/Mühendislik, sadece İstanbul-Ankara-İzmir, şu sıralamaya uygun" gibi kriterlerle bölüm ararken.',
  },
  {
    to: '/ek-yerlestirme',
    label: 'Ek Yerleştirme',
    icon: ListPlus,
    step: 'Ek Yerleştirme Dönemi · Gerektiğinde',
    body: 'ÖSYM Ek Yerleştirme Kılavuzu\'ndaki boş kontenjanlar. (1) Üstten kılavuz yılını seç (öğrenci puanları yıla göre ayrı saklanır); tablo, puan türü, il, üniversite türü, burs/indirim ve program/üniversite adıyla filtrele; listede öğrenim süresi, puan türü, üç ek kontenjan ve üç en küçük puan kılavuzdaki sırayla görünür — "Sadece kontenjanı olanlar" ve "En küçük puanı boş olanlar" kutuları da var. (2) Bir satıra tıklayınca sağda genel / şehit-gazi yakını / 34 yaş üstü kadın kontenjanları, en küçük puanlar ve koşul metinleri açılır; en küçük puan "Dolmadı" ise puanı olan herkes tercih edebilir. Vakıf programlarında yıllık ücret ad üzerinden yaklaşık eşleşir, kesin değildir. (3) Öğrenciyi seç, programları "Listeye ekle" ile ekle (en fazla 24), sürükleyerek ya da ok butonlarıyla sırala, kalem başına not yaz ve Kaydet\'e bas. (4) Öğrencinin TYT/SAY/EA/SÖZ/DİL puanlarını girersen, puanı bir programın en küçük puanının altında kalan satırlarda kırmızı uyarı çıkar; puanlar yalnız bu tarayıcıda saklanır. (5) Yazdır, ÖSYM\'ye girilecek program kodlarını sıra numarasıyla tek sayfalık liste olarak basar.',
    usage: 'Merkezî yerleştirmede hiçbir programa yerleşemeyen bir öğrenci için ek tercih listesi hazırlarken.',
  },
  {
    to: '/yonetim/kullanicilar',
    label: 'Yönetim (Roller, İzinler & Kurumlar)',
    icon: ShieldCheck,
    step: 'Yönetim · Yetkin Varsa',
    body: 'Çok kurumlu yapı ve rol tabanlı erişim kontrolü (RBAC) burada yönetilir. Kurum üyelerini listeleyebilir, e-posta ile yeni üyeler davet edebilir, 22 ayrı izin hakkından özel roller ("Etüt Görevlisi", "Rehberlik Uzmanı" vb.) tanımlayabilir ve yetkileri düzenleyebilirsin. Davet akışı üç adımdır: (1) sol üstteki kurum seçicisinden doğru kurumu seç — "Tüm Kurumlar" seçiliyken davet gönderilemez; (2) e-posta ve rol girip daveti oluştur; (3) çıkan kayıt bağlantısını kişiye ilet. Bağlantı davete özel gizli bir anahtar taşır, yani bağlantısı olmayan kimse kayıt olamaz. ÖNEMLİ: Kişi kaydolduktan sonra Supabase\'in gönderdiği doğrulama e-postasındaki bağlantıya tıklamadan giriş yapamaz — "davet çalışmıyor" gibi görünen durumun sebebi genelde budur, gelen kutusunu (ve spam klasörünü) kontrol etsin. Şifresini unutan herkes giriş ekranındaki "Şifremi unuttum" bağlantısını kullanabilir.',
    usage: 'Yeni bir ekip üyesi davet ederken, kullanıcı yetkilerini düzenlerken ya da özel bir rol oluştururken.',
  },
  {
    to: '/ogrenciler',
    label: 'Mobil Öğrenci & Veli Portalı',
    icon: Smartphone,
    step: 'Bir kere kur · Sonra kendiliğinden',
    body: 'Öğrenci ve veli, e-posta/şifre olmadan, sadece bir erişim koduyla telefonundan girer. Bir öğrencinin profilini aç, "Öğrenci Linki" ya da "Veli Linki" butonuna bas — kod otomatik üretilir ve kayıtlı numaraya WhatsApp mesajı olarak hazırlanır (numara yoksa link ekranda gösterilir). Öğrenci kendi portalında haftalık programını gün gün görür, biten görevi işaretler ve denemesini bölüm bazlı doğru/yanlış girerek kaydeder — işaretlediği görevler ve girdiği denemeler senin panelinde de anında görünür. Veli ise ayrı bir kodla girer ve salt-okunur bir özet görür: haftalık tamamlama oranı, son deneme neti, devamsızlık geçmişi ve hedef bölüm. Veli hiçbir şeyi değiştiremez. Kodlar kişiye özeldir, paylaşılmamalıdır.',
    usage: 'Öğrenciyi sisteme ilk aldığında bir kere linkleri gönder; sonrası kendiliğinden işler. Öğrencinin programını takip etmesini ya da velinin gelişimi görmesini istediğinde.',
    shots: [
      { src: '/yardim/portal-giris.webp', caption: 'Giriş ekranı — öğrenci ya da veli, kendisine iletilen erişim kodunu girer. WhatsApp\'tan gelen linke tıklanırsa kod otomatik dolar ve giriş kendiliğinden yapılır.' },
      { src: '/yardim/portal-ogrenci-program.webp', caption: 'Öğrenci portalı — haftalık program gün gün listelenir, bugün vurgulanır. Her görevde konu ve ders adı ile hedef soru sayısı görünür; göreve dokunulunca tamamlandı işaretlenir ve bu senin panelinde de anında görünür.' },
      { src: '/yardim/portal-ogrenci-deneme.webp', caption: 'Öğrenci deneme girişi — bölüm bölüm doğru ve yanlış girilir, boş sayısı ve netler anında hesaplanır. Kaydedilen deneme, Deneme Girişi ekranında tüm bölüm dökümüyle karşına gelir.' },
      { src: '/yardim/portal-veli-ozet.webp', caption: 'Veli portalı — haftalık tamamlama oranı, son deneme neti, devamsızlık durumu ve hedef bölüm. Veli salt-okunur görür; hiçbir şeyi değiştiremez, ayrı bir kodla girer.' },
    ],
  },
{
    to: '/yonetim/kayitlar',
    label: 'Denetim Kayıtları',
    icon: ScrollText,
    step: 'Yönetim · Yalnız Sistem Yöneticisi',
    body: 'Sistemde kim hangi kaydı oluşturdu, değiştirdi ya da sildi. Bir satıra tıklayınca değişikliğin alan bazlı dökümü açılır: hangi alan, önceki değer, yeni değer. Kayıt türüne ve işleme göre filtrelenebilir. Kim sütununu okurken üç kaynağı ayırt et: panelden yapılanlar kullanıcının adıyla, öğrencinin mobil portalda yaptıkları "Öğrenci (portal)" olarak, gece yedeği gibi otomatik işler "Sistem" olarak görünür. Erişim kodları kayda maskelenerek yazılır — geçmişten kimsenin PIN\'i okunamaz.',
    usage: 'Bir verinin neden değiştiğini ya da bir hatayı kimin ne zaman yaptığını bulmak istediğinde. Yer büyürse "Arşivle (JSON)" ile indirip bir tarihten öncesini "Temizle" ile silebilirsin; temizliğin kendisi de kaydedilir ve o kayıt asla silinmez. Bu ekranı yalnız sen görürsün — kurum yöneticileri dahil kimse erişemez.',
  },
]

export default function YardimPage() {
  // Sürüm Geçmişi ayrı bir menü öğesiyken sol menü çok uzuyordu; buraya sekme olarak taşındı.
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('sekme') === 'surum' ? 'surum' : 'rehber'

  return (
    <section className="screen">
      <PageHeader
        title="Yardım"
        subtitle={
          tab === 'rehber'
            ? "Netlik'i ilk kez mi kullanıyorsun? Her ekranın ne işe yaradığı ve ne zaman kullanılacağı aşağıda."
            : "Netlik'e en başından beri ne zaman ne eklendiğinin tam listesi."
        }
      />

      <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid var(--border)', marginBottom: 22 }}>
        {([['rehber', 'Nasıl Kullanılır'], ['surum', 'Sürüm Geçmişi']] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSearchParams(key === 'surum' ? { sekme: 'surum' } : {})}
            style={{
              padding: '10px 4px', background: 'none', border: 'none',
              borderBottom: tab === key ? '2px solid var(--indigo-600)' : '2px solid transparent',
              color: tab === key ? 'var(--indigo-600)' : 'var(--ink-soft)',
              fontWeight: tab === key ? 700 : 500, fontSize: 13.5, cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'surum' && <VersionHistory />}

      {tab === 'rehber' && (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }}>
        {GUIDE.map(({ to, label, icon: Icon, step, body, usage, shots }) => (
          <Link
            key={to}
            to={to}
            className="card"
            style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, textDecoration: 'none', color: 'inherit' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 38, height: 38, borderRadius: 10, background: 'var(--indigo-050)', color: 'var(--indigo-700)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                <Icon size={18} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.04, color: 'var(--indigo-600)', textTransform: 'uppercase' }}>
                  {step}
                </div>
                <h3 style={{ fontSize: 15, marginTop: 2 }}>{label}</h3>
              </div>
            </div>

            <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ink-soft)', margin: 0 }}>{body}</p>

            <div
              style={{
                display: 'flex', gap: 10, padding: '10px 12px', background: 'var(--surface-alt)',
                borderLeft: '3px solid var(--indigo-500)', borderRadius: 4, marginTop: 'auto',
              }}
            >
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.04, color: 'var(--indigo-600)', textTransform: 'uppercase' }}>
                  Ne zaman kullanılır
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2, lineHeight: 1.45 }}>{usage}</div>
              </div>
            </div>

            {shots && <ScreenshotStrip shots={shots} />}

            <span style={{ fontSize: 12, color: 'var(--indigo-600)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Ekrana git <ArrowRight size={14} />
            </span>
          </Link>
        ))}
      </div>
      )}
    </section>
  )
}
