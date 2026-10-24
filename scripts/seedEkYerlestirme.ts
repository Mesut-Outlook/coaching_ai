/**
 * Ek Yerleştirme referans verisini (program / koşul / vakıf ücreti) Supabase'e yükler.
 *
 * Kullanım: npm run seed:ek -- --yil 2026 --dosya data/ek-yerlestirme/2026-ornek.json [--ucret-temizle]
 *
 * ⚠️ HİÇBİR ŞEY SİLMEZ. Upsert yapar: (yil, program_kodu), (yil, kosul_no),
 * (yil, universite, duzey, program) üzerinden eşleşen satırı günceller, yoksa ekler.
 * Tekrar tekrar çalıştırmak güvenlidir (idempotent).
 *
 * İSTİSNA (yalnız açıkça istenirse): `--ucret-temizle` bayrağı, upsert'ten SONRA o yılın
 * vakif_ogrenim_ucretleri satırlarından (universite, duzey, program) anahtarı dosyada OLMAYANLARI
 * siler (eski/bozuk parser çıktısından kalan, yanlış ücret gösteren satırlar). Programlar için
 * böyle bir temizlik YOKTUR: öğrenci tercih listeleri program_kodu'na bağlıdır.
 *
 * Dosyadaki `yil` ve her satırın `yil`'i --yil ile aynı değilse hiçbir şey yazmadan çıkar.
 */
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database'

type DosyaProgram = {
  yil: number
  tablo: 'onlisans' | 'lisans'
  universite: string
  universite_turu: 'devlet' | 'vakif' | 'kktc' | 'yurtdisi'
  il: string | null
  fakulte: string | null
  program_kodu: number
  program_adi: string
  ogrenim_suresi: number | null
  puan_turu: 'TYT' | 'SAY' | 'EA' | 'SÖZ' | 'DİL'
  genel_ek_kont?: number | null
  sgy_ek_kont?: number | null
  k34_ek_kont?: number | null
  kosul_kodlari: number[]
  en_kucuk_gk: number | null
  en_kucuk_sgy: number | null
  en_kucuk_34y: number | null
  kaynak_sayfa: number | null
}

type DosyaKosul = {
  yil: number
  kosul_no: number
  kisim: 1 | 2
  metin: string
}

type DosyaUcret = {
  yil: number
  universite: string
  duzey: string | null
  program: string
  ucret: number | null
  not?: string | null
}

type EkDosya = {
  yil: number
  kaynak?: string
  programlar: DosyaProgram[]
  kosullar: DosyaKosul[]
  ucretler: DosyaUcret[]
}

const PARTI = 500

// Program adındaki ilk parantezli ek: (Burslu), (%50 İndirimli), (Ücretli), (Ücretsiz). Yoksa null.
function bursIndirim(ad: string): string | null {
  return ad.match(/\((Burslu|%\d+ İndirimli|Ücretli|Ücretsiz)\)/)?.[1] ?? null
}

function argOku(ad: string): string | undefined {
  const i = process.argv.indexOf(ad)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function loadEnv() {
  let supabaseUrl = process.env.VITE_SUPABASE_URL
  let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  try {
    const envPath = path.join(process.cwd(), '.env.local')
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8')

      const urlMatch = envContent.match(/VITE_SUPABASE_URL\s*=\s*(.+)/)
      if (urlMatch?.[1]) supabaseUrl = urlMatch[1].trim().replace(/['"]/g, '')

      const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)/)
      if (keyMatch?.[1]) serviceRoleKey = keyMatch[1].trim().replace(/['"]/g, '')
    }
  } catch (e) {
    console.error('.env.local okunamadı:', e)
  }

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Hata: VITE_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY (.env.local veya ortam değişkeni) gerekli.')
    process.exit(1)
  }

  return { supabaseUrl, serviceRoleKey }
}

async function main() {
  const yilArg = argOku('--yil')
  const dosyaArg = argOku('--dosya')
  if (!yilArg || !dosyaArg || !/^\d{4}$/.test(yilArg)) {
    console.error('Kullanım: npm run seed:ek -- --yil <yıl> --dosya <yol>')
    console.error('Örnek:    npm run seed:ek -- --yil 2026 --dosya data/ek-yerlestirme/2026-ornek.json')
    process.exit(1)
  }
  const yil = Number(yilArg)

  // Doğrulama: dosya okunur ve yıllar tutarlıysa çıkar; hiçbir yazma yapılmaz.
  const dosya: EkDosya = JSON.parse(fs.readFileSync(path.resolve(dosyaArg), 'utf8'))
  const hatalar: string[] = []
  if (dosya.yil !== yil) hatalar.push(`dosya yil=${dosya.yil}, --yil=${yil}`)
  const yilUyumsuz = (ad: string, rows: { yil: number }[]) =>
    rows.forEach((r, i) => r.yil !== yil && hatalar.push(`${ad}[${i}].yil=${r.yil}, --yil=${yil}`))
  yilUyumsuz('programlar', dosya.programlar)
  yilUyumsuz('kosullar', dosya.kosullar)
  yilUyumsuz('ucretler', dosya.ucretler)
  if (hatalar.length) {
    console.error('❌ Yıl uyuşmazlığı, HİÇBİR ŞEY YAZILMADI:\n  ' + hatalar.slice(0, 20).join('\n  '))
    process.exit(1)
  }

  const { supabaseUrl, serviceRoleKey } = loadEnv()
  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // il boş olan programlar için university_rankings'ten şehir bul (en büyük year kaydı).
  // Supabase 1000 satır cap'i: codes parçalanır, her parti range ile sayfalanır.
  const ilEksik = dosya.programlar.filter((p) => !p.il).map((p) => p.program_kodu)
  const sehirMap = new Map<number, string | null>()
  const kodParca = 100
  for (let i = 0; i < ilEksik.length; i += kodParca) {
    const codes = [...new Set(ilEksik.slice(i, i + kodParca))]
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('university_rankings')
        .select('program_code, city, year, id')
        .in('program_code', codes)
        .order('year', { ascending: false })
        .order('id', { ascending: true })
        .range(from, from + 999)
      if (error) {
        console.error('❌ university_rankings okunamadı:', error.message)
        process.exit(1)
      }
      for (const r of data ?? []) {
        if (!sehirMap.has(r.program_code)) sehirMap.set(r.program_code, r.city)
      }
      if (!data || data.length < 1000) break
    }
  }

  let ilDoldurulan = 0
  const programlar = dosya.programlar.map((p) => {
    let il = p.il ?? null
    if (!il && sehirMap.get(p.program_kodu)) {
      il = sehirMap.get(p.program_kodu) ?? null
      ilDoldurulan++
    }
    return {
      yil: p.yil,
      tablo: p.tablo,
      universite: p.universite,
      universite_turu: p.universite_turu,
      il,
      fakulte: p.fakulte ?? null,
      program_kodu: p.program_kodu,
      program_adi: p.program_adi,
      ogrenim_suresi: p.ogrenim_suresi ?? null,
      puan_turu: p.puan_turu,
      genel_ek_kont: p.genel_ek_kont ?? 0,
      sgy_ek_kont: p.sgy_ek_kont ?? 0,
      k34_ek_kont: p.k34_ek_kont ?? 0,
      kosul_kodlari: p.kosul_kodlari ?? [],
      en_kucuk_gk: p.en_kucuk_gk ?? null,
      en_kucuk_sgy: p.en_kucuk_sgy ?? null,
      en_kucuk_34y: p.en_kucuk_34y ?? null,
      burs_indirim: bursIndirim(p.program_adi),
      kaynak_sayfa: p.kaynak_sayfa ?? null,
    }
  })

  const kosullar = dosya.kosullar.map((k) => ({
    yil: k.yil,
    kosul_no: k.kosul_no,
    kisim: k.kisim,
    metin: k.metin,
  }))

  const ucretlerHam = dosya.ucretler.map((u) => ({
    yil: u.yil,
    universite: u.universite,
    duzey: u.duzey ?? null,
    program: u.program,
    ucret: u.ucret ?? null,
    aciklama: u.not ?? null,
  }))

  // Postgres unique(yil, universite, duzey, program) kuralı için parti içi tekilleştirme
  const ucretMap = new Map<string, (typeof ucretlerHam)[number]>()
  for (const u of ucretlerHam) {
    const key = `${u.yil}__${u.universite}__${u.duzey}__${u.program}`
    ucretMap.set(key, u)
  }
  const ucretler = Array.from(ucretMap.values())

  async function yazParti<T>(
    tablo: 'ek_yerlestirme_programlari' | 'ek_yerlestirme_kosullari' | 'vakif_ogrenim_ucretleri',
    satirlar: T[],
    onConflict: string,
  ) {
    for (let i = 0; i < satirlar.length; i += PARTI) {
      const parti = satirlar.slice(i, i + PARTI)
      // supabase-js tipleri Insert'e göre zorlar; satırlar aynı anahtar kümesine sahip.
      const { error } = await supabase.from(tablo).upsert(parti as never[], { onConflict })
      if (error) {
        console.error(`❌ ${tablo} yazılırken hata (parti ${i / PARTI + 1}):`, error.message)
        process.exit(1)
      }
    }
    return satirlar.length
  }

  const progSayi = await yazParti('ek_yerlestirme_programlari', programlar, 'yil,program_kodu')
  const kosulSayi = await yazParti('ek_yerlestirme_kosullari', kosullar, 'yil,kosul_no')
  const ucretSayi = await yazParti('vakif_ogrenim_ucretleri', ucretler, 'yil,universite,duzey,program')

  // --ucret-temizle: dosyada olmayan o yılın ücret satırlarını sil (varsayılan KAPALI).
  let ucretSilinen = 0
  if (process.argv.includes('--ucret-temizle')) {
    const dosyadakiler = new Set(ucretler.map((u) => `${u.universite}__${u.duzey}__${u.program}`))
    const silinecek: number[] = []
    // Supabase 1000 satır cap'i: count + range ile sayfala (id sırası sabit).
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('vakif_ogrenim_ucretleri')
        .select('id, universite, duzey, program')
        .eq('yil', yil)
        .order('id', { ascending: true })
        .range(from, from + 999)
      if (error) {
        console.error('❌ vakif_ogrenim_ucretleri okunamadı:', error.message)
        process.exit(1)
      }
      for (const r of data ?? []) {
        if (!dosyadakiler.has(`${r.universite}__${r.duzey}__${r.program}`)) silinecek.push(r.id)
      }
      if (!data || data.length < 1000) break
    }
    for (let i = 0; i < silinecek.length; i += PARTI) {
      const { error } = await supabase.from('vakif_ogrenim_ucretleri').delete().in('id', silinecek.slice(i, i + PARTI))
      if (error) {
        console.error('❌ vakif_ogrenim_ucretleri silinirken hata:', error.message)
        process.exit(1)
      }
    }
    ucretSilinen = silinecek.length
  }

  console.log(
    process.argv.includes('--ucret-temizle')
      ? '✅ Ek Yerleştirme verisi yüklendi (upsert + --ucret-temizle: yalnız dosyada olmayan ücret satırları silindi).\n'
      : '✅ Ek Yerleştirme verisi yüklendi (upsert, hiçbir şey silinmedi).\n',
  )
  console.log(`ek_yerlestirme_programlari: ${progSayi} satır yazıldı (il doldurulan: ${ilDoldurulan} / il boş: ${ilEksik.length})`)
  console.log(`ek_yerlestirme_kosullari:   ${kosulSayi} satır yazıldı`)
  console.log(`vakif_ogrenim_ucretleri:    ${ucretSayi} satır yazıldı`)
  if (process.argv.includes('--ucret-temizle')) console.log(`vakif_ogrenim_ucretleri:    ${ucretSilinen} eski satır silindi`)
}

main().catch((err) => {
  console.error('❌ Beklenmeyen hata:', err)
  process.exit(1)
})
