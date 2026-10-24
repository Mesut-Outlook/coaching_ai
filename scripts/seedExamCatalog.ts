/**
 * scripts/seedExamCatalog.ts
 *
 * Deneme Karne Kataloğu Tohumlayıcı (TYT, AYT, LGS).
 *
 * ⚠️ YALNIZ EKLER, İDEMPOTENT, HİÇBİR ŞEYİ SİLMEZ.
 * - TYT: data/deneme/tyt-karne-katalog.json dosyasından okunur (11 alt ders / 65 konu).
 * - AYT SAY: Matematik 40; Fen: Fizik 14, Kimya 13, Biyoloji 13.
 * - AYT EA/SÖZ: Edebiyat-Sosyal1 (Edebiyat 24, Tarih-1 10, Coğrafya-1 6),
 *               Sosyal Bilimler-2 (Tarih-2 11, Coğrafya-2 11, Felsefe Grubu 12, Din 6).
 *   Ders DB'de henüz yoksa o satır atlanır ve konsola yazılır.
 * - LGS: SECTIONS_CONFIG.LGS'teki 6 bölümün her biri tek alt derstir.
 * - TYT dışındaki konular topics tablosundan kopyalanır (grades ve sort_order dahil).
 *
 * Kullanım:
 *   npm run seed:exam-catalog           -> yazar (varsayılan)
 *   npm run seed:exam-catalog -- --dry  -> kuru çalışma (yazmaz)
 */

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database'
import { SECTIONS_CONFIG } from '../src/lib/examSections'

const ROOT = path.resolve(import.meta.dirname, '..')
const TYT_CATALOG_PATH = path.join(ROOT, 'data', 'deneme', 'tyt-karne-katalog.json')
const DRY = process.argv.includes('--dry')

type TytKatalogTopic = {
  name: string
  karne_ad?: string
  key?: string
}

type TytKatalogSubject = {
  section_name: string
  label: string
  subject_id: number
  subject_name: string
  question_count: number
  choice_group: string | null
  topics: TytKatalogTopic[]
}

type TytKatalog = {
  exam_type: 'TYT'
  exam_subjects: TytKatalogSubject[]
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

  // 1. Canlıdaki tüm dersleri ve konuları oku
  const { data: allSubjects, error: subErr } = await supabase
    .from('subjects')
    .select('id, name, curriculum, sort_order, is_active')
  if (subErr || !allSubjects) {
    console.error('❌ subjects tablosu okunamadı:', subErr?.message)
    process.exit(1)
  }

  const { data: allTopics, error: topErr } = await supabase
    .from('topics')
    .select('id, subject_id, name, grades, sort_order, is_active')
  if (topErr || !allTopics) {
    console.error('❌ topics tablosu okunamadı:', topErr?.message)
    process.exit(1)
  }

  // Mevcut exam_subjects ve exam_topics
  const { data: existingExamSubjects, error: esErr } = await supabase
    .from('exam_subjects')
    .select('*')
  if (esErr || !existingExamSubjects) {
    console.error('❌ exam_subjects tablosu okunamadı:', esErr?.message)
    process.exit(1)
  }

  const { data: existingExamTopics, error: etErr } = await supabase
    .from('exam_topics')
    .select('*')
  if (etErr || !existingExamTopics) {
    console.error('❌ exam_topics tablosu okunamadı:', etErr?.message)
    process.exit(1)
  }

  let eklenenDersSayisi = 0
  let eklenenKonuSayisi = 0

  // Yardımcı: subject bulma
  function findSubject(candidates: string[], curriculum: 'YKS' | 'LGS', fallbackId?: number) {
    for (const cand of candidates) {
      const found = allSubjects.find((s) => s.curriculum === curriculum && s.name === cand)
      if (found) return found
    }
    if (fallbackId != null) {
      const found = allSubjects.find((s) => s.id === fallbackId)
      if (found) return found
    }
    return null
  }

  // Yardımcı: exam_subject ekleme / bulma
  async function ensureExamSubject(spec: {
    exam_type: 'TYT' | 'AYT' | 'LGS'
    section_name: string
    subject_id: number
    label: string
    question_count: number
    choice_group: string | null
    sort_order: number
  }): Promise<number> {
    const existing = existingExamSubjects.find(
      (es) =>
        es.exam_type === spec.exam_type &&
        es.section_name === spec.section_name &&
        es.label === spec.label,
    )
    if (existing) {
      return existing.id
    }

    if (DRY) {
      console.log(`[DRY] + exam_subject: ${spec.exam_type} | ${spec.section_name} | ${spec.label} (${spec.question_count} soru)`)
      const dummyId = -(existingExamSubjects.length + 1)
      existingExamSubjects.push({ id: dummyId, ...spec })
      eklenenDersSayisi++
      return dummyId
    }

    const { data, error } = await supabase
      .from('exam_subjects')
      .insert({
        exam_type: spec.exam_type,
        section_name: spec.section_name,
        subject_id: spec.subject_id,
        label: spec.label,
        question_count: spec.question_count,
        choice_group: spec.choice_group,
        sort_order: spec.sort_order,
      })
      .select('id')
      .single()

    if (error || !data) {
      console.error(`❌ exam_subject eklenemedi (${spec.exam_type} - ${spec.label}):`, error?.message)
      process.exit(1)
    }

    existingExamSubjects.push({ id: data.id, ...spec })
    eklenenDersSayisi++
    return data.id
  }

  // Yardımcı: exam_topic ekleme / bulma
  async function ensureExamTopic(spec: {
    exam_subject_id: number
    name: string
    grades: string[]
    sort_order: number
    is_active: boolean
  }): Promise<void> {
    const existing = existingExamTopics.find(
      (et) => et.exam_subject_id === spec.exam_subject_id && et.name === spec.name,
    )
    if (existing) {
      return
    }

    if (DRY) {
      existingExamTopics.push({ id: -(existingExamTopics.length + 1), ...spec })
      eklenenKonuSayisi++
      return
    }

    const { error } = await supabase.from('exam_topics').insert({
      exam_subject_id: spec.exam_subject_id,
      name: spec.name,
      grades: spec.grades,
      sort_order: spec.sort_order,
      is_active: spec.is_active,
    })

    if (error) {
      console.error(`❌ exam_topic eklenemedi (${spec.name}):`, error.message)
      process.exit(1)
    }

    existingExamTopics.push({ id: -(existingExamTopics.length + 1), ...spec })
    eklenenKonuSayisi++
  }

  // -------------------------------------------------------------------------
  // 1. TYT Kataloğu
  // -------------------------------------------------------------------------
  console.log('\n--- TYT Kataloğu İşleniyor ---')
  if (!fs.existsSync(TYT_CATALOG_PATH)) {
    console.error('❌ TYT katalog dosyası bulunamadı:', TYT_CATALOG_PATH)
    process.exit(1)
  }
  const tytKatalog: TytKatalog = JSON.parse(fs.readFileSync(TYT_CATALOG_PATH, 'utf8'))

  let tytSubSort = 0
  for (const s of tytKatalog.exam_subjects) {
    tytSubSort++
    const matchedSubject = findSubject(
      [s.subject_name, s.subject_name.replace('TYT ', '')],
      'YKS',
      s.subject_id,
    )
    if (!matchedSubject) {
      console.error(`❌ TYT dersi bulunamadı: "${s.subject_name}"`)
      process.exit(1)
    }

    const examSubId = await ensureExamSubject({
      exam_type: 'TYT',
      section_name: s.section_name,
      subject_id: matchedSubject.id,
      label: s.label,
      question_count: s.question_count,
      choice_group: s.choice_group,
      sort_order: tytSubSort,
    })

    let topicSort = 0
    for (const t of s.topics) {
      topicSort++
      await ensureExamTopic({
        exam_subject_id: examSubId,
        name: t.name,
        grades: [],
        sort_order: topicSort,
        is_active: true,
      })
    }
  }

  // -------------------------------------------------------------------------
  // 2. AYT SAY Kataloğu
  // -------------------------------------------------------------------------
  console.log('\n--- AYT SAY Kataloğu İşleniyor ---')
  // Matematik 40
  const aytMatSubject = findSubject(['AYT Matematik', 'Matematik'], 'YKS')
  if (aytMatSubject) {
    const subId = await ensureExamSubject({
      exam_type: 'AYT',
      section_name: 'Matematik',
      subject_id: aytMatSubject.id,
      label: 'Matematik',
      question_count: 40,
      choice_group: null,
      sort_order: 1,
    })
    // Konuları topics'ten kopyala
    const matTopics = allTopics.filter((t) => t.subject_id === aytMatSubject.id && t.is_active)
    for (const mt of matTopics) {
      await ensureExamTopic({
        exam_subject_id: subId,
        name: mt.name,
        grades: mt.grades ?? [],
        sort_order: mt.sort_order ?? 0,
        is_active: true,
      })
    }
  } else {
    console.warn('= AYT Matematik: subjects tablosunda ders bulunamadı, atlandı.')
  }

  // Fen: Fizik 14, Kimya 13, Biyoloji 13
  const aytFenAltDersleri = [
    { label: 'Fizik', q: 14, sort: 1, cands: ['AYT Fizik', 'Fizik'] },
    { label: 'Kimya', q: 13, sort: 2, cands: ['AYT Kimya', 'Kimya'] },
    { label: 'Biyoloji', q: 13, sort: 3, cands: ['AYT Biyoloji', 'Biyoloji'] },
  ]
  for (const fen of aytFenAltDersleri) {
    const subj = findSubject(fen.cands, 'YKS')
    if (subj) {
      const subId = await ensureExamSubject({
        exam_type: 'AYT',
        section_name: 'Fen Bilimleri',
        subject_id: subj.id,
        label: fen.label,
        question_count: fen.q,
        choice_group: null,
        sort_order: fen.sort,
      })
      const fenTopics = allTopics.filter((t) => t.subject_id === subj.id && t.is_active)
      for (const ft of fenTopics) {
        await ensureExamTopic({
          exam_subject_id: subId,
          name: ft.name,
          grades: ft.grades ?? [],
          sort_order: ft.sort_order ?? 0,
          is_active: true,
        })
      }
    } else {
      console.warn(`= AYT Fen Bilimleri / ${fen.label}: subjects tablosunda ders bulunamadı, atlandı.`)
    }
  }

  // -------------------------------------------------------------------------
  // 3. AYT EA/SÖZ Kataloğu
  // -------------------------------------------------------------------------
  console.log('\n--- AYT EA/SÖZ Kataloğu İşleniyor ---')
  // Edebiyat-Sosyal1 bölümü: Edebiyat 24, Tarih-1 10, Coğrafya-1 6
  const aytEdSos1 = [
    { label: 'Edebiyat', q: 24, sort: 1, cands: ['AYT Edebiyat', 'Edebiyat'] },
    { label: 'Tarih-1', q: 10, sort: 2, cands: ['Tarih', 'AYT Tarih'] },
    { label: 'Coğrafya-1', q: 6, sort: 3, cands: ['Coğrafya', 'AYT Coğrafya'] },
  ]
  for (const item of aytEdSos1) {
    const subj = findSubject(item.cands, 'YKS')
    if (subj) {
      const subId = await ensureExamSubject({
        exam_type: 'AYT',
        section_name: 'Edebiyat-Sosyal1',
        subject_id: subj.id,
        label: item.label,
        question_count: item.q,
        choice_group: null,
        sort_order: item.sort,
      })
      const topics = allTopics.filter((t) => t.subject_id === subj.id && t.is_active)
      for (const top of topics) {
        await ensureExamTopic({
          exam_subject_id: subId,
          name: top.name,
          grades: top.grades ?? [],
          sort_order: top.sort_order ?? 0,
          is_active: true,
        })
      }
    } else {
      console.warn(`= AYT Edebiyat-Sosyal1 / ${item.label}: subjects tablosunda ders bulunamadı, atlandı.`)
    }
  }

  // Sosyal Bilimler-2 bölümü: Tarih-2 11, Coğrafya-2 11, Felsefe Grubu 12, Din 6
  const aytSos2 = [
    { label: 'Tarih-2', q: 11, sort: 1, cands: ['Tarih', 'AYT Tarih'] },
    { label: 'Coğrafya-2', q: 11, sort: 2, cands: ['Coğrafya', 'AYT Coğrafya'] },
    { label: 'Felsefe Grubu', q: 12, sort: 3, cands: ['Felsefe Grubu', 'Felsefe'] },
    { label: 'Din', q: 6, sort: 4, cands: ['Din Kültürü', 'Din Kültürü ve Ahlak Bilgisi'] },
  ]
  for (const item of aytSos2) {
    const subj = findSubject(item.cands, 'YKS')
    if (subj) {
      const subId = await ensureExamSubject({
        exam_type: 'AYT',
        section_name: 'Sosyal Bilimler-2',
        subject_id: subj.id,
        label: item.label,
        question_count: item.q,
        choice_group: null,
        sort_order: item.sort,
      })
      const topics = allTopics.filter((t) => t.subject_id === subj.id && t.is_active)
      for (const top of topics) {
        await ensureExamTopic({
          exam_subject_id: subId,
          name: top.name,
          grades: top.grades ?? [],
          sort_order: top.sort_order ?? 0,
          is_active: true,
        })
      }
    } else {
      console.warn(`= AYT Sosyal Bilimler-2 / ${item.label}: subjects tablosunda ders bulunamadı, atlandı.`)
    }
  }

  // -------------------------------------------------------------------------
  // 4. LGS Kataloğu
  // -------------------------------------------------------------------------
  console.log('\n--- LGS Kataloğu İşleniyor ---')
  let lgsSort = 0
  for (const sec of SECTIONS_CONFIG.LGS) {
    lgsSort++
    const subj = findSubject([sec.name], 'LGS')
    if (subj) {
      const subId = await ensureExamSubject({
        exam_type: 'LGS',
        section_name: sec.name,
        subject_id: subj.id,
        label: sec.name,
        question_count: sec.max,
        choice_group: null,
        sort_order: lgsSort,
      })
      const topics = allTopics.filter((t) => t.subject_id === subj.id && t.is_active)
      for (const top of topics) {
        await ensureExamTopic({
          exam_subject_id: subId,
          name: top.name,
          grades: top.grades ?? [],
          sort_order: top.sort_order ?? 0,
          is_active: true,
        })
      }
    } else {
      console.warn(`= LGS ${sec.name}: subjects tablosunda ders bulunamadı, atlandı.`)
    }
  }

  console.log('\n=============================================')
  console.log(`İşlem tamamlandı.`)
  console.log(`Eklenen exam_subjects: ${eklenenDersSayisi}`)
  console.log(`Eklenen exam_topics:   ${eklenenKonuSayisi}`)
  console.log('=============================================')
}

main().catch((err) => {
  console.error('Beklenmeyen hata:', err)
  process.exit(1)
})
