/**
 * src/data/lgsMufredat.json dosyasındaki LGS 8. sınıf müfredatını (6 ders, 47 konu)
 * Supabase'e yükler.
 *
 * ⚠️ HİÇBİR ŞEY SİLMEZ. scripts/seedSupabase.ts'in tersine — o `subjects` tablosunu
 * komple silip cascade ile öğrenci ölçüm/karar verisini götürüyor — bu script yalnız
 * `(curriculum, name)` üzerinden eşleşen satırı arar; varsa günceller, yoksa ekler.
 * Tekrar tekrar çalıştırmak güvenlidir (idempotent).
 *
 * Kullanım: npm run seed:lgs
 */
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import type { Database, Grade } from '../src/types/database'

type LgsDers = {
  name: string
  color: string
  soru_sayisi: string
  katsayi: number
  sort_order: number
  konular: string[]
}

type LgsMufredat = {
  curriculum: 'LGS'
  siniflar: Grade[]
  dersler: LgsDers[]
}

const CURRICULUM = 'LGS' as const

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
  console.log('LGS müfredatı yükleniyor…\n')

  const { supabaseUrl, serviceRoleKey } = loadEnv()
  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const jsonPath = path.join(process.cwd(), 'src', 'data', 'lgsMufredat.json')
  const mufredat: LgsMufredat = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))

  // LGS 8. sınıf dersleri her zaman yalnız 8. sınıfa uygulanır (grades boş değil).
  const grades = mufredat.siniflar

  let subjectsInserted = 0
  let subjectsUpdated = 0
  let topicsInserted = 0
  let topicsUpdated = 0

  for (const ders of mufredat.dersler) {
    // curriculum + name üzerinden ara — schema.sql'deki unique(curriculum, name) ile birebir.
    const { data: existingSubject, error: findErr } = await supabase
      .from('subjects')
      .select('id')
      .eq('curriculum', CURRICULUM)
      .eq('name', ders.name)
      .maybeSingle()
    if (findErr) {
      console.error(`❌ "${ders.name}" dersi aranırken hata:`, findErr.message)
      process.exit(1)
    }

    let subjectId: number
    if (existingSubject) {
      subjectId = existingSubject.id
      const { error: updErr } = await supabase
        .from('subjects')
        .update({
          color: ders.color,
          soru_sayisi: ders.soru_sayisi,
          katsayi: ders.katsayi,
          sort_order: ders.sort_order,
          grades,
        })
        .eq('id', subjectId)
      if (updErr) {
        console.error(`❌ "${ders.name}" dersi güncellenirken hata:`, updErr.message)
        process.exit(1)
      }
      subjectsUpdated++
    } else {
      const { data: newSubject, error: insErr } = await supabase
        .from('subjects')
        .insert({
          name: ders.name,
          color: ders.color,
          soru_sayisi: ders.soru_sayisi,
          sort_order: ders.sort_order,
          is_active: true,
          curriculum: CURRICULUM,
          grades,
          katsayi: ders.katsayi,
        })
        .select('id')
        .single()
      if (insErr || !newSubject) {
        console.error(`❌ "${ders.name}" dersi eklenirken hata:`, insErr?.message)
        process.exit(1)
      }
      subjectId = newSubject.id
      subjectsInserted++
    }

    for (let i = 0; i < ders.konular.length; i++) {
      const konuName = ders.konular[i]
      const sortOrder = i + 1

      const { data: existingTopic, error: findTopicErr } = await supabase
        .from('topics')
        .select('id')
        .eq('subject_id', subjectId)
        .eq('name', konuName)
        .maybeSingle()
      if (findTopicErr) {
        console.error(`❌ "${ders.name} / ${konuName}" konusu aranırken hata:`, findTopicErr.message)
        process.exit(1)
      }

      if (existingTopic) {
        const { error: updTopicErr } = await supabase
          .from('topics')
          .update({ sort_order: sortOrder })
          .eq('id', existingTopic.id)
        if (updTopicErr) {
          console.error(`❌ "${ders.name} / ${konuName}" konusu güncellenirken hata:`, updTopicErr.message)
          process.exit(1)
        }
        topicsUpdated++
      } else {
        const { error: insTopicErr } = await supabase.from('topics').insert({
          subject_id: subjectId,
          name: konuName,
          sort_order: sortOrder,
          is_active: true,
        })
        if (insTopicErr) {
          console.error(`❌ "${ders.name} / ${konuName}" konusu eklenirken hata:`, insTopicErr.message)
          process.exit(1)
        }
        topicsInserted++
      }
    }
  }

  console.log('✅ LGS müfredatı yüklendi.\n')
  console.log(`Dersler: ${subjectsInserted} eklendi, ${subjectsUpdated} zaten vardı (güncellendi).`)
  console.log(`Konular: ${topicsInserted} eklendi, ${topicsUpdated} zaten vardı (güncellendi).`)
}

main().catch((err) => {
  console.error('❌ Beklenmeyen hata:', err)
  process.exit(1)
})
