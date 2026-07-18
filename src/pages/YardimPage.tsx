import { Link } from 'react-router-dom'
import {
  LayoutGrid, Users, ClipboardList, Layers, Calendar, BarChart2, BookOpen, ArrowRight,
} from 'lucide-react'
import PageHeader from '../components/layout/PageHeader'

interface GuideItem {
  to: string
  label: string
  icon: typeof LayoutGrid
  step: string
  body: string
  usage: string
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
    body: 'Tüm öğrenci listesi ve her birinin profili burada — hedef program, net gelişim grafiği, deneme geçmişi, konu yeterliliği ve görevler dört sekmede.',
    usage: 'Bir öğrenciyi aramak ya da geçmişini detaylı incelemek istediğinde.',
  },
  {
    to: '/denemeler',
    label: 'Deneme Girişi',
    icon: ClipboardList,
    step: '3 · Sonuçları Kaydet',
    body: 'Sınav adı, yayıncı, tarih ve bölüm bazlı doğru/yanlış sayılarını girersin; net hesaplaması (Doğru − Yanlış ÷ 4) otomatik yapılır.',
    usage: 'Öğrenci her yeni deneme sonucunu paylaştığında.',
  },
  {
    to: '/konular',
    label: 'Konu Yeterlilik Haritası',
    icon: Layers,
    step: '4 · Konuyu Değerlendir',
    body: 'Her konudaki durum (Yeterli / Gelişiyor / Kritik / Ölçülmedi) burada. Sistem bir durum önerir, sen "Koç Kararı" ile onaylar ya da değiştirirsin.',
    usage: 'Haftalık programı hazırlamadan önce, hangi konulara ağırlık vereceğine karar verirken.',
  },
  {
    to: '/program',
    label: 'Haftalık Program',
    icon: Calendar,
    step: '5 · Haftayı Planla',
    body: 'Haftalık plan gün gün bir pano şeklinde. Görev eklerken önce ders, sonra o derse ait konu seçilir; bir görevi sürükleyip başka güne taşıyabilirsin.',
    usage: 'Hafta başında ya da görüşme sırasında gelecek haftayı planlarken.',
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
    body: 'Ders ve konu listesini burada düzenlersin — ekleme, yeniden adlandırma, sıralama ve pasifleştirme. Müfredat yıldan yıla değişebildiği için ayrı tutuldu.',
    usage: 'Yeni bir ders/konu eklemen ya da eskiyeni kaldırman gerektiğinde.',
  },
]

export default function YardimPage() {
  return (
    <section className="screen">
      <PageHeader
        title="Yardım & Nasıl Kullanılır"
        subtitle="Netlik'i ilk kez mi kullanıyorsun? Her ekranın ne işe yaradığı ve ne zaman kullanılacağı aşağıda."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }}>
        {GUIDE.map(({ to, label, icon: Icon, step, body, usage }) => (
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

            <span style={{ fontSize: 12, color: 'var(--indigo-600)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Ekrana git <ArrowRight size={14} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
