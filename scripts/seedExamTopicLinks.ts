/**
 * scripts/seedExamTopicLinks.ts
 *
 * Karne Konuları ↔ Müfredat Konuları Eşleşme Tohumlayıcı (K6).
 *
 * ⚠️ YALNIZ EKLER / GÜNCELLER, İDEMPOTENT, HİÇBİR ŞEYİ SİLMEZ.
 * - TYT: data/deneme/tyt-karne-eslesme.json dosyasından (64 karne konusu + FE02 eşlemesi = 65 karne satırı -> 102 link, 65 birincil).
 * - AYT & LGS: exam_topics kataloğu topics'ten 1:1 kopyalandığı için aynı ders + aynı ad ile 1:1 eşleşir (is_primary = true).
 *
 * Kullanım:
 *   npm run seed:exam-links           -> yazar (varsayılan)
 *   npm run seed:exam-links -- --dry  -> kuru çalışma (yazmaz)
 */

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database'

const ROOT = path.resolve(import.meta.dirname, '..')
const TYT_ESLESME_PATH = path.join(ROOT, 'data', 'deneme', 'tyt-karne-eslesme.json')
const DRY = process.argv.includes('--dry')

type EslesmeItem = {
  key: string
  alt_ders: string
  karne_konu: string
  durum: string
  topics: { id: number; name: string }[]
  birincil_topic_id: number
}

type TytEslesmeFile = {
  eslesme: EslesmeItem[]
}

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
  const supabase = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log(DRY ? '== KURU ÇALIŞMA MODU (--dry: DB değiştirilmeyecek) ==' : '== YAZMA MODU ==')

  // 1. Canlı verileri oku
  const [esRes, etRes, topRes] = await Promise.all([
    supabase.from('exam_subjects').select('*'),
    supabase.from('exam_topics').select('*'),
    supabase.from('topics').select('id, subject_id, name'),
  ])

  if (esRes.error || !esRes.data) {
    console.error('❌ exam_subjects okunamadı:', esRes.error?.message)
    process.exit(1)
  }
  if (etRes.error || !etRes.data) {
    console.error('❌ exam_topics okunamadı:', etRes.error?.message)
    process.exit(1)
  }
  if (topRes.error || !topRes.data) {
    console.error('❌ topics okunamadı:', topRes.error?.message)
    process.exit(1)
  }

  const examSubjects = esRes.data
  const examTopics = etRes.data
  const topics = topRes.data

  console.log(`✓ Veriler yüklendi: ${examSubjects.length} exam_subjects, ${examTopics.length} exam_topics, ${topics.length} topics.`)

  const linksToInsert: { exam_topic_id: number; topic_id: number; is_primary: boolean }[] = []

  // 2. TYT Eşlemeleri
  console.log('\n--- TYT Eşlemeleri Hazırlanıyor ---')
  if (!fs.existsSync(TYT_ESLESME_PATH)) {
    console.error('❌ TYT eşleşme dosyası bulunamadı:', TYT_ESLESME_PATH)
    process.exit(1)
  }

  const tytFile: TytEslesmeFile = JSON.parse(fs.readFileSync(TYT_ESLESME_PATH, 'utf8'))
  let tytPrimaryCount = 0

  for (const item of tytFile.eslesme) {
    // Eşleşen exam_subject
    const sub = examSubjects.find(
      (s) => s.exam_type === 'TYT' && s.label.trim().toLowerCase() === item.alt_ders.trim().toLowerCase(),
    )
    if (!sub) {
      console.warn(`⚠ TYT dersi bulunamadı: "${item.alt_ders}" (key: ${item.key})`)
      continue
    }

    // Eşleşen exam_topic
    const et = examTopics.find(
      (t) => t.exam_subject_id === sub.id && t.name.trim().toLowerCase() === item.karne_konu.trim().toLowerCase(),
    )
    if (!et) {
      console.warn(`⚠ TYT karne konusu bulunamadı: "${item.alt_ders}" -> "${item.karne_konu}"`)
      continue
    }

    tytPrimaryCount++
    for (const t of item.topics) {
      const isPrimary = t.id === item.birincil_topic_id
      linksToInsert.push({
        exam_topic_id: et.id,
        topic_id: t.id,
        is_primary: isPrimary,
      })
    }
  }

  // Not: "Felsefe" ve "Felsefe (Seçmeli)"
  // tyt-karne-eslesme.json dosyasında FE02 "Felsefe (Seçmeli)" için tanımlı.
  // Eğer normal "Felsefe" dersinde de "Felsefenin Temel Konuları ve Problemleri" konusu varsa,
  // aynı 7 konuyu ve birincil topic'i ona da bağlıyoruz.
  const felsefeSub = examSubjects.find((s) => s.exam_type === 'TYT' && s.label === 'Felsefe')
  const fe02Item = tytFile.eslesme.find((e) => e.key === 'FE02')
  if (felsefeSub && fe02Item) {
    const feTopic = examTopics.find(
      (t) => t.exam_subject_id === felsefeSub.id && t.name === fe02Item.karne_konu,
    )
    if (feTopic) {
      const alreadyLinked = linksToInsert.some((l) => l.exam_topic_id === feTopic.id)
      if (!alreadyLinked) {
        tytPrimaryCount++
        for (const t of fe02Item.topics) {
          linksToInsert.push({
            exam_topic_id: feTopic.id,
            topic_id: t.id,
            is_primary: t.id === fe02Item.birincil_topic_id,
          })
        }
      }
    }
  }

  const tytTotalLinks = linksToInsert.length
  console.log(`✓ TYT: ${tytPrimaryCount} karne konusu -> ${tytTotalLinks} link hazırlandı.`)

  // 3. AYT & LGS Eşlemeleri (1:1 Müfredat Konusu)
  console.log('\n--- AYT & LGS 1:1 Eşlemeleri Hazırlanıyor ---')
  let aytCount = 0
  let lgsCount = 0

  for (const es of examSubjects) {
    if (es.exam_type !== 'AYT' && es.exam_type !== 'LGS') continue

    // exam_subject'in altındaki exam_topics
    const subExamTopics = examTopics.filter((t) => t.exam_subject_id === es.id)

    // Bu dersin topics tablosundaki konuları
    const curriculumTopics = topics.filter((t) => t.subject_id === es.subject_id)

    for (const et of subExamTopics) {
      const matched = curriculumTopics.find(
        (ct) => ct.name.trim().toLowerCase() === et.name.trim().toLowerCase(),
      )
      if (matched) {
        linksToInsert.push({
          exam_topic_id: et.id,
          topic_id: matched.id,
          is_primary: true,
        })
        if (es.exam_type === 'AYT') aytCount++
        else lgsCount++
      } else {
        console.warn(`⚠ ${es.exam_type} eşleşmeyen konu: [${es.label}] ${et.name}`)
      }
    }
  }

  console.log(`✓ AYT: ${aytCount} konu linki hazırlandı.`)
  console.log(`✓ LGS: ${lgsCount} konu linki hazırlandı.`)
  console.log(`✓ TOPLAM: ${linksToInsert.length} link kaydedilecek.`)

  if (DRY) {
    console.log('\n[DRY] Kuru çalışma tamamlandı, DB yazılmadı.')
    return
  }

  // 4. DB'ye toplu ekle (idempotent: on conflict do update)
  console.log('\n--- DB\'ye Yazılıyor (exam_topic_links) ---')
  // 100'erlik parçalar halinde upsert yap
  const BATCH_SIZE = 100
  let insertedTotal = 0

  for (let i = 0; i < linksToInsert.length; i += BATCH_SIZE) {
    const batch = linksToInsert.slice(i, i + BATCH_SIZE)
    const { error: upsertErr } = await supabase
      .from('exam_topic_links')
      .upsert(batch, { onConflict: 'exam_topic_id,topic_id' })

    if (upsertErr) {
      console.error(`❌ exam_topic_links upsert hatası (batch ${i}):`, upsertErr.message)
      process.exit(1)
    }
    insertedTotal += batch.length
  }

  console.log(`\n✅ BAŞARILI: Toplam ${insertedTotal} eşleşme bağlantısı kaydedildi / güncellendi.`)
}

main().catch((err) => {
  console.error('❌ Beklenmeyen hata:', err)
  process.exit(1)
})
