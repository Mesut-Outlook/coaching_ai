import { History } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader'

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
    date: '29 Temmuz 2026',
    entries: [
      {
        version: 'v0.16',
        title: 'Devamsızlık Takibi + WhatsApp Bildirimi',
        items: [
          'Yeni ekran: /devamsizlik — "Kayıtlar" ve "Öğrenci Özeti" iki sekmeli. Yoklama listesi yok, sadece devamsızlık olayları kaydediliyor (bu yüzden bir katılım yüzdesi HESAPLANMIYOR — sadece mutlak sayılar).',
          'Devamsızlık Ekle: öğrenci, tarih, oturum türü (birebir/etüt/grup/online), durum (gelmedi/geç geldi/erken ayrıldı), mazeret (7 sabit seçenek) ve not.',
          'Kayıt sonrası "Şimdi WhatsApp ile bildirilsin mi?" sorusu ya da doğrudan "Kaydet ve Bildir" ile öğrenciye/veliye/her ikisine bildirim gönderilebiliyor; bildirim damgası "WhatsApp açıldı · tarih" olarak gösteriliyor (mesajın gerçekten okunduğu uygulama tarafından doğrulanamaz).',
          'Öğrenci Özeti sekmesi: her aktif öğrenci için toplam/mazeretsiz devamsızlık, son 30 gün, aylık mini grafik; son 30 günde 3+ devamsızlık ya da 2+ mazeretsiz devamsızlık olan öğrencilere "Takip gerekli" rozeti. Veliye toplu özet WhatsApp mesajı gönderilebiliyor.',
          'Öğrenci profiline (Öğrenciler sayfası) devamsızlık sayısı rozeti eklendi, Devamsızlık ekranına filtreli link veriyor.',
          'Ortak WhatsApp yardımcıları (telefon formatlama, sohbet açma) tek modüle (src/lib/whatsapp.ts) taşındı — önceden Haftalık Program ve Öğrenciler sayfalarında ayrı ayrı kopyalanmıştı.',
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

export default function SurumGecmisiPage() {
  return (
    <section className="screen">
      <PageHeader
        title="Sürüm Geçmişi"
        subtitle="Netlik'e en başından beri ne zaman ne eklendiğinin tam listesi."
      />

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
    </section>
  )
}
