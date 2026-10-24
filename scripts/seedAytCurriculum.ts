/**
 * AYT EA / SÖZ eksiklerini YKS müfredatına EKLER (MEB 9-12 + ÖSYM AYT kapsamı).
 * Yeni dersler: AYT Edebiyat, Psikoloji, Sosyoloji, Mantık. Mevcut derslere (Tarih, Coğrafya,
 * Felsefe, Din Kültürü, AYT Matematik) eksik konular eklenir.
 *
 * ⚠️ HİÇBİR ŞEY silmez/yeniden adlandırmaz/güncellemez. Idempotent:
 * subjects unique(curriculum,name), topics unique(subject_id,name) — varsa atlanır.
 * sort_order müfredat başına ayrı uzay: YKS içindeki max+1'den; konular dersin max'ından devam.
 *
 * Kullanım:
 *   npm run seed:ayt            -> yalnız planı yazdırır (varsayılan, yazmaz)
 *   npm run seed:ayt -- --dry   -> aynısı
 *   npm run seed:ayt -- --yaz   -> gerçekten yazar
 */
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import type { Database, Grade } from '../src/types/database'

const YAZ = process.argv.includes('--yaz') && !process.argv.includes('--dry')

const YENI_DERSLER: { name: string; color: string; soru_sayisi: string; konular: string[] }[] = [
  {
    name: 'AYT Edebiyat', color: '#b91c1c', soru_sayisi: '24',
    konular: [
      'Anlam Bilgisi', 'Dil Bilgisi', 'Güzel Sanatlar ve Edebiyat', 'Metinlerin Sınıflandırılması',
      'Şiir Bilgisi', 'Edebi Sanatlar', 'Anlatma Esasına Bağlı Metinler (Hikaye, Roman)',
      'Öğretici Metinler', 'Tiyatro (Sahne Eserleri)', 'İslamiyet Öncesi Türk Edebiyatı',
      'Geçiş Dönemi Türk Edebiyatı', 'Halk Edebiyatı', 'Divan Edebiyatı', 'Tanzimat Edebiyatı',
      'Servetifünun Edebiyatı', 'Fecriati Edebiyatı', 'Milli Edebiyat',
      'Cumhuriyet Dönemi Şiiri', 'Cumhuriyet Dönemi Roman ve Hikayesi',
      'Cumhuriyet Dönemi Tiyatrosu ve Öğretici Metinleri', 'Batı Edebiyatı Akımları', 'Dünya Edebiyatı',
    ],
  },
  { name: 'Psikoloji', color: '#c026d3', soru_sayisi: '3', konular: [
    'Psikoloji Bilimini Tanıyalım', 'Psikolojinin Temel Süreçleri', 'Öğrenme, Bellek, Düşünme', 'Ruh Sağlığının Temelleri',
  ] },
  { name: 'Sosyoloji', color: '#ea580c', soru_sayisi: '3', konular: [
    'Sosyolojiye Giriş', 'Birey ve Toplum', 'Toplumsal Yapı', 'Toplumsal Değişme ve Gelişme', 'Toplum ve Kültür', 'Toplumsal Kurumlar',
  ] },
  { name: 'Mantık', color: '#0369a1', soru_sayisi: '3', konular: [
    'Mantığa Giriş', 'Klasik Mantık', 'Mantık ve Dil', 'Sembolik Mantık',
  ] },
]

const MEVCUT_DERSE_EKLE: { ders: string; konular: string[] }[] = [
  { ders: 'Tarih', konular: [
    'Anadolu Selçuklu Devleti', 'Osmanlı Kültür ve Medeniyeti', 'Orta Çağ ve Yeni Çağ Avrupası (Coğrafi Keşifler, Rönesans, Reform)',
    'Aydınlanma Çağı ve Fransız İhtilali', 'Sanayi Devrimi ve Sermaye-Emek İlişkisi', 'Değişen Dünya Dengeleri (1774-1914)',
    'Çok Partili Hayata Geçiş', 'İki Savaş Arası Dönemde Türkiye ve Dünya', 'II. Dünya Savaşı ve Türkiye',
    'Soğuk Savaş Dönemi', 'Yumuşama Dönemi ve Küreselleşen Dünya',
  ] },
  { ders: 'Coğrafya', konular: [
    'Biyoçeşitlilik', 'Ekosistem ve Madde Döngüleri', 'Şehirleşme ve Şehirlerin Fonksiyonları', 'Nüfus Politikaları',
    'Türkiye Ekonomisi', 'Küresel Ticaret', 'Bölgesel Kalkınma Projeleri', 'Doğal Kaynaklar ve Enerji',
    'Çevre Sorunları ve Sürdürülebilirlik', 'Türkiye\'nin Jeopolitik Konumu', 'Kültür Bölgeleri ve Medeniyet Havzaları',
  ] },
  { ders: 'Felsefe', konular: [
    'MS 2. Yüzyıl - MS 15. Yüzyıl Felsefesi', '15. Yüzyıl - 17. Yüzyıl Felsefesi', '18. Yüzyıl - 19. Yüzyıl Felsefesi', '20. Yüzyıl Felsefesi',
  ] },
  { ders: 'Din Kültürü', konular: ['Kur\'an-ı Kerim ve Özellikleri'] },
  { ders: 'AYT Matematik', konular: [
    'Fonksiyonlar', 'Permütasyon ve Kombinasyon', 'Binom Açılımı', 'Olasılık',
    'Doğrunun Analitik İncelenmesi', 'Çemberin Analitik İncelenmesi', 'Çember ve Daire', 'Katı Cisimler',
  ] },
]

function loadEnv() {
  let url = process.env.VITE_SUPABASE_URL
  let key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const envPath = path.join(process.cwd(), '.env.local')
  if (fs.existsSync(envPath)) {
    const c = fs.readFileSync(envPath, 'utf8')
    url = c.match(/VITE_SUPABASE_URL\s*=\s*(.+)/)?.[1]?.trim().replace(/['"]/g, '') ?? url
    key = c.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)/)?.[1]?.trim().replace(/['"]/g, '') ?? key
  }
  if (!url || !key) {
    console.error('❌ VITE_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.')
    process.exit(1)
  }
  return { url, key }
}

async function main() {
  const { url, key } = loadEnv()
  const supabase = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  console.log(YAZ ? '== YAZMA MODU ==' : '== KURU ÇALIŞMA (yazmaz; yazmak için --yaz) ==')

  const { data: subjects, error: sErr } = await supabase
    .from('subjects').select('id, name, sort_order').eq('curriculum', 'YKS')
  if (sErr || !subjects) { console.error('❌ Dersler okunamadı:', sErr?.message); process.exit(1) }

  const idOf = new Map(subjects.map((s) => [s.name, s.id]))
  let nextSubjectSort = Math.max(0, ...subjects.map((s) => s.sort_order)) + 1
  let yeniDers = 0, yeniKonu = 0

  // 1) Yeni dersler
  for (const d of YENI_DERSLER) {
    if (!idOf.has(d.name)) {
      console.log(`+ DERS "${d.name}" (sort_order ${nextSubjectSort}, soru ${d.soru_sayisi})`)
      if (YAZ) {
        const { data, error } = await supabase.from('subjects').insert({
          name: d.name, color: d.color, soru_sayisi: d.soru_sayisi, sort_order: nextSubjectSort,
          is_active: true, curriculum: 'YKS', grades: [], katsayi: null,
        }).select('id').single()
        if (error || !data) { console.error(`❌ "${d.name}" eklenemedi:`, error?.message); process.exit(1) }
        idOf.set(d.name, data.id)
      } else idOf.set(d.name, -1)
      nextSubjectSort++
      yeniDers++
    } else console.log(`= DERS "${d.name}" zaten var.`)
  }

  // 2) Konular (yeni + mevcut dersler)
  const hedefler = [
    ...YENI_DERSLER.map((d) => ({ ders: d.name, konular: d.konular })),
    ...MEVCUT_DERSE_EKLE,
  ]
  for (const { ders, konular } of hedefler) {
    const subjectId = idOf.get(ders)
    if (subjectId === undefined) { console.error(`❌ "${ders}" (YKS) dersi bulunamadı.`); process.exit(1) }
    let var_: { name: string; sort_order: number }[] = []
    if (subjectId !== -1) {
      const { data, error } = await supabase.from('topics').select('name, sort_order').eq('subject_id', subjectId)
      if (error) { console.error('❌ Konular okunamadı:', error.message); process.exit(1) }
      var_ = data ?? []
    }
    const mevcutAd = new Set(var_.map((t) => t.name))
    const yeni = konular.filter((k) => !mevcutAd.has(k))
    let sort = Math.max(0, ...var_.map((t) => t.sort_order))
    const satirlar = yeni.map((name) => ({ subject_id: subjectId, name, sort_order: ++sort, is_active: true, grades: [] as Grade[] }))
    console.log(`\n[${ders}] ${yeni.length} yeni konu (${konular.length - yeni.length} zaten var)`)
    satirlar.forEach((s) => console.log(`   + ${s.sort_order}. ${s.name}`))
    if (YAZ && satirlar.length) {
      const { error } = await supabase.from('topics').insert(satirlar)
      if (error) { console.error(`❌ "${ders}" konuları eklenemedi:`, error.message); process.exit(1) }
    }
    yeniKonu += yeni.length
  }
  console.log(`\nBitti${YAZ ? '' : ' (yazılmadı)'}: ${yeniDers} ders, ${yeniKonu} konu.`)
}

main()
