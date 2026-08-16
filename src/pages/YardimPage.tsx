import { Link, useSearchParams } from 'react-router-dom'
import {
  LayoutGrid, Users, ClipboardList, Layers, Calendar, UserX, BarChart2, BookOpen, Compass, ArrowRight, Smartphone, ShieldCheck,
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
    label: 'Koç Paneli',
    icon: LayoutGrid,
    step: '1 · Güne Başlarken',
    body: 'Tüm öğrencilerini tek bakışta görürsün: kritik konu sayısı, son 5 deneme neti, haftalık görev tamamlama oranı. Yeni öğrenci kaydı da buradaki "Öğrenci Ekle" ile açılır.',
    usage: 'Her gün işe başlarken — bugün önce kime bakmalıyım?',
  },
  {
    to: '/ogrenciler',
    label: 'Öğrenciler',
    icon: Users,
    step: '2 · Öğrenciyi Tanı',
    body: 'Tüm öğrenci listesi ve her birinin profili burada — hedef program, net gelişim grafiği, deneme geçmişi, konu yeterliliği ve görevler dört sekmede. Profil başlığında telefonların yanında devamsızlık sayısı da görünür (tıklayınca Devamsızlık ekranına gider). "Deneme Geçmişi" sekmesinde bir denemeye tıklayınca bölüm bazlı doğru/yanlış/boş/net tablosu açılır ve sonucu oradan WhatsApp ile paylaşabilirsin. Kart üzerindeki "..." menüsünden bilgileri düzenleyebilir, profil fotoğrafı yükleyebilir, öğrenci ve veli telefonu ekleyebilir, öğrenciyi arşivleyebilir ya da kalıcı silebilirsin.',
    usage: 'Bir öğrenciyi aramak, bilgilerini güncellemek ya da geçmişini detaylı incelemek istediğinde.',
  },
  {
    to: '/denemeler',
    label: 'Deneme Girişi',
    icon: ClipboardList,
    step: '3 · Sonuçları Kaydet',
    body: 'Sınav adı, yayıncı, tarih ve bölüm bazlı doğru/yanlış sayılarını girersin; net hesaplaması (Doğru − Yanlış ÷ 4) otomatik yapılır. Sağ tarafta geçmiş denemeler listelenir; bir denemeye tıklarsan altında bölüm tablosu açılır (Bölüm · Doğru · Yanlış · Boş · Soru · Net ve Toplam satırı). "Tüm Deneme Geçmişi" sekmesinde tüm öğrencilerin denemeleri tek tabloda aranabilir ve aynı şekilde tıklanıp detaylandırılabilir. Açılan tablonun altındaki "Sonucu WhatsApp ile gönder" ile deneme sonucunu bölüm dökümü ve toplam netiyle birlikte öğrenciye, veliye ya da her ikisine iletebilirsin.',
    usage: 'Öğrenci her yeni deneme sonucunu paylaştığında — girdikten hemen sonra sonucu WhatsApp ile öğrenciye/veliye gönderebilirsin.',
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
    body: 'Haftalık plan gün gün bir pano şeklinde. Görev eklerken önce ders, sonra o derse ait konu seçilir; bir görevi sürükleyip başka güne taşıyabilirsin. Bir görevin konu adına tıklarsan o konunun gelişim paneli açılır — geçmiş ölçümler, ortalama doğruluk, test sonucu ekleme ve Koç Kararı, hepsi programdan çıkmadan. Görevin kendisini düzenlemek için karta çift tıkla. Sağ üstteki "Yazdır / PDF" ile programı tek sayfaya sığacak şekilde yazdırabilir, "WhatsApp ile Gönder" ile öğrenciye, veliye ya da her ikisine birden iletebilirsin.',
    usage: 'Hafta başında planlarken, ya da hazırladığın programı öğrenciyle/veliyle paylaşman gerektiğinde.',
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
    body: 'Geçen haftanın özeti, öne çıkan kritik konular ve gelecek haftaya doğrudan görev atayabileceğin planlama alanı aynı ekranda.',
    usage: 'Haftalık birebir görüşmelerde, öğrenciyle karşılıklı otururken.',
  },
  {
    to: '/mufredat',
    label: 'Müfredat',
    icon: BookOpen,
    step: 'Arka Plan · Gerektiğinde',
    body: 'Ders ve konu listesini burada düzenlersin — ekleme, yeniden adlandırma, sıralama ve pasifleştirme. TYT dersleri yanında artık 4 ayrı AYT dersi (Matematik, Fizik, Kimya, Biyoloji) de var. Müfredat yıldan yıla değişebildiği için ayrı tutuldu.',
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
