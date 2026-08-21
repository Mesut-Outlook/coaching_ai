/**
 * src/data/lgsMufredat7.json dosyasındaki 7. sınıf LGS müfredatını Supabase'e yükler.
 *
 * Ders adlarının çoğu 8. sınıf LGS dersleriyle AYNI (Türkçe, Matematik, Fen Bilimleri,
 * Din Kültürü ve Ahlak Bilgisi, Yabancı Dil (İngilizce)) — bu yüzden ikinci bir ders
 * satırı AÇILMAZ, mevcut LGS satırı bulunup `subjects.grades`'i {"7. Sınıf","8. Sınıf"}
 * yapılır ve konular aynı ders altına, konu bazında `topics.grades = {"7. Sınıf"}`
 * etiketiyle eklenir. Yalnız "Sosyal Bilgiler" 7. sınıfa özel yeni bir derstir.
 *
 * ⚠️ HİÇBİR ŞEY SİLMEZ, hiçbir mevcut satırı (8. sınıf konuları, soru_sayisi, katsayi,
 * color, sort_order) bozmaz. scripts/seedLgsCurriculum.ts'in deseniyle yazıldı:
 * `(curriculum, name)` / `(subject_id, name)` üzerinden bulur, yoksa ekler, varsa
 * yalnız gereken alanı günceller. Tekrar tekrar çalıştırmak güvenlidir (idempotent).
 *
 * Ayrıca bu script, geriye dönük bir damgalama da yapar: bugüne kadar yüklü olan
 * 8. sınıf LGS konularının `topics.grades` alanı hâlâ boştu (kolon P6'da eklendi,
 * varsayılan '{}'). Bu adım olmadan 8. sınıf konuları 7. sınıf öğrencisine de
 * görünürdü (`grades` boş = "tüm sınıflar" demek). Bu adım da idempotent: zaten
 * damgalanmış (`grades` dolu) konulara dokunmaz.
 *
 * Kullanım: npm run seed:lgs7
 */
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import type { Database, Grade } from '../src/types/database'

type LgsDers7 = {
  name: string
  yeni_ders: boolean
  color?: string
  soru_sayisi?: string
  katsayi?: number | null
  konular: string[]
}

type LgsMufredat7 = {
  curriculum: 'LGS'
  siniflar: Grade[]
  dersler: LgsDers7[]
}

const CURRICULUM = 'LGS' as const
const GRADE_7: Grade = '7. Sınıf'
const GRADE_8: Grade = '8. Sınıf'

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
  console.log('7. sınıf LGS müfredatı yükleniyor…\n')

  const { supabaseUrl, serviceRoleKey } = loadEnv()
  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const jsonPath = path.join(process.cwd(), 'src', 'data', 'lgsMufredat7.json')
  const mufredat: LgsMufredat7 = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))

  // ---------------------------------------------------------------------
  // 1. Geriye dönük damgalama: mevcut LGS konularının grades'i hâlâ boşsa
  //    (kolon yeni eklendi, varsayılan '{}') hepsini {"8. Sınıf"} yap.
  //    Bu adım olmadan 8. sınıf konuları 7. sınıfa da görünür kalırdı.
  // ---------------------------------------------------------------------
  const { data: lgsSubjects, error: lgsSubjectsErr } = await supabase
    .from('subjects')
    .select('id')
    .eq('curriculum', CURRICULUM)
  if (lgsSubjectsErr) {
    console.error('❌ LGS dersleri aranırken hata:', lgsSubjectsErr.message)
    process.exit(1)
  }
  const lgsSubjectIds = (lgsSubjects ?? []).map((s) => s.id)

  let backfilledCount = 0
  if (lgsSubjectIds.length > 0) {
    const { data: lgsTopics, error: lgsTopicsErr } = await supabase
      .from('topics')
      .select('id, grades')
      .in('subject_id', lgsSubjectIds)
    if (lgsTopicsErr) {
      console.error('❌ LGS konuları aranırken hata:', lgsTopicsErr.message)
      process.exit(1)
    }
    const toBackfillIds = (lgsTopics ?? []).filter((t) => t.grades.length === 0).map((t) => t.id)
    if (toBackfillIds.length > 0) {
      const { error: backfillErr } = await supabase
        .from('topics')
        .update({ grades: [GRADE_8] })
        .in('id', toBackfillIds)
      if (backfillErr) {
        console.error('❌ Geriye dönük damgalama hatası:', backfillErr.message)
        process.exit(1)
      }
      backfilledCount = toBackfillIds.length
    }
  }

  // ---------------------------------------------------------------------
  // 2. Her ders için: mevcut (ortak) dersi bul & grades'ini genişlet, ya da
  //    yeni dersi (Sosyal Bilgiler) oluştur. Sonra konularını ekle/güncelle.
  // ---------------------------------------------------------------------
  let subjectsCreated = 0
  let subjectsUpdated = 0
  let topicsInserted = 0
  let topicsUpdated = 0

  for (const ders of mufredat.dersler) {
    let subjectId: number
    let subjectGrades: Grade[]

    if (ders.yeni_ders) {
      // Sosyal Bilgiler: yalnız 7. sınıfa özel yeni bir ders.
      const { data: existing, error: findErr } = await supabase
        .from('subjects')
        .select('id, grades')
        .eq('curriculum', CURRICULUM)
        .eq('name', ders.name)
        .maybeSingle()
      if (findErr) {
        console.error(`❌ "${ders.name}" dersi aranırken hata:`, findErr.message)
        process.exit(1)
      }

      if (existing) {
        subjectId = existing.id
        subjectGrades = existing.grades
        // Zaten doğru damgalıysa dokunma (idempotent) — yalnız eksikse düzelt.
        if (!existing.grades.includes(GRADE_7)) {
          const { error: updErr } = await supabase
            .from('subjects')
            .update({ grades: [GRADE_7] })
            .eq('id', subjectId)
          if (updErr) {
            console.error(`❌ "${ders.name}" dersi güncellenirken hata:`, updErr.message)
            process.exit(1)
          }
          subjectGrades = [GRADE_7]
          subjectsUpdated++
        }
      } else {
        const maxOrder = 0 // sort_order hesabı aşağıda, LGS derslerinin mevcut max'ı üzerinden yapılacak
        const { data: allLgs, error: allLgsErr } = await supabase
          .from('subjects')
          .select('sort_order')
          .eq('curriculum', CURRICULUM)
        if (allLgsErr) {
          console.error('❌ LGS ders sıraları okunurken hata:', allLgsErr.message)
          process.exit(1)
        }
        const nextOrder = (allLgs ?? []).reduce((m, s) => Math.max(m, s.sort_order), maxOrder - 1) + 1

        const { data: created, error: insErr } = await supabase
          .from('subjects')
          .insert({
            name: ders.name,
            color: ders.color ?? '#d97706',
            soru_sayisi: ders.soru_sayisi ?? '—',
            sort_order: nextOrder,
            is_active: true,
            curriculum: CURRICULUM,
            grades: [GRADE_7],
            katsayi: ders.katsayi ?? null,
          })
          .select('id')
          .single()
        if (insErr || !created) {
          console.error(`❌ "${ders.name}" dersi eklenirken hata:`, insErr?.message)
          process.exit(1)
        }
        subjectId = created.id
        subjectGrades = [GRADE_7]
        subjectsCreated++
      }
    } else {
      // Ortak ders (Türkçe, Matematik, Fen Bilimleri, Din Kültürü ve Ahlak Bilgisi,
      // Yabancı Dil (İngilizce)): mevcut LGS satırını bul, grades'ini {"7","8"} yap.
      // soru_sayisi/katsayi/color'a DOKUNULMAZ — onlar 8. sınıf LGS sınavının bilgisi.
      const { data: existing, error: findErr } = await supabase
        .from('subjects')
        .select('id, grades')
        .eq('curriculum', CURRICULUM)
        .eq('name', ders.name)
        .maybeSingle()
      if (findErr) {
        console.error(`❌ "${ders.name}" dersi aranırken hata:`, findErr.message)
        process.exit(1)
      }
      if (!existing) {
        console.error(`❌ "${ders.name}" dersi LGS müfredatında bulunamadı — önce 8. sınıf seed'i (npm run seed:lgs) çalışmış olmalı.`)
        process.exit(1)
      }

      subjectId = existing.id
      const alreadyBoth = existing.grades.includes(GRADE_7) && existing.grades.includes(GRADE_8)
      if (alreadyBoth) {
        subjectGrades = existing.grades
      } else {
        subjectGrades = [GRADE_7, GRADE_8]
        const { error: updErr } = await supabase
          .from('subjects')
          .update({ grades: subjectGrades })
          .eq('id', subjectId)
        if (updErr) {
          console.error(`❌ "${ders.name}" dersi güncellenirken hata:`, updErr.message)
          process.exit(1)
        }
        subjectsUpdated++
      }
    }

    // -----------------------------------------------------------------
    // Konular: (subject_id, name) üzerinden bul; yoksa {"7. Sınıf"} ile ekle,
    // varsa yalnız grades'ini 7. sınıfı da kapsayacak şekilde günceller.
    // sort_order, bu dersin mevcut en yüksek sort_order'ının üstünden devam eder
    // (8. sınıf konularının sırası bozulmaz).
    // -----------------------------------------------------------------
    const { data: existingTopics, error: existingTopicsErr } = await supabase
      .from('topics')
      .select('id, name, sort_order, grades')
      .eq('subject_id', subjectId)
    if (existingTopicsErr) {
      console.error(`❌ "${ders.name}" konuları okunurken hata:`, existingTopicsErr.message)
      process.exit(1)
    }
    let nextSortOrder = (existingTopics ?? []).reduce((m, t) => Math.max(m, t.sort_order), 0) + 1
    const byName = new Map((existingTopics ?? []).map((t) => [t.name, t]))

    for (const konuName of ders.konular) {
      const found = byName.get(konuName)
      if (found) {
        if (!found.grades.includes(GRADE_7)) {
          const { error: updTopicErr } = await supabase
            .from('topics')
            .update({ grades: Array.from(new Set([...found.grades, GRADE_7])) })
            .eq('id', found.id)
          if (updTopicErr) {
            console.error(`❌ "${ders.name} / ${konuName}" konusu güncellenirken hata:`, updTopicErr.message)
            process.exit(1)
          }
          topicsUpdated++
        }
      } else {
        const { error: insTopicErr } = await supabase.from('topics').insert({
          subject_id: subjectId,
          name: konuName,
          sort_order: nextSortOrder,
          is_active: true,
          grades: [GRADE_7],
        })
        if (insTopicErr) {
          console.error(`❌ "${ders.name} / ${konuName}" konusu eklenirken hata:`, insTopicErr.message)
          process.exit(1)
        }
        nextSortOrder++
        topicsInserted++
      }
    }
  }

  console.log('✅ 7. sınıf LGS müfredatı yüklendi.\n')
  console.log(`Dersler: ${subjectsCreated} oluşturuldu, ${subjectsUpdated} güncellendi (grades genişletildi).`)
  console.log(`Konular: ${topicsInserted} eklendi, ${topicsUpdated} güncellendi (7. sınıf grades eklendi).`)
  console.log(`Geriye dönük damgalama: ${backfilledCount} mevcut LGS konusu {"8. Sınıf"} olarak damgalandı.`)
}

main().catch((err) => {
  console.error('❌ Beklenmeyen hata:', err)
  process.exit(1)
})
