/**
 * Yayın karnesi (KONSEPT HIZ VE RENK TYT) ile canlı müfredat karşılaştırmasından çıkan,
 * bizde HİÇ karşılığı olmayan TYT konularını EKLER. Yalnız ekleme: hiçbir şey silmez,
 * yeniden adlandırmaz, güncellemez (topic id'lerine öğrenci verisi bağlı).
 * Idempotent: (subject_id, name) zaten varsa atlar. grades boş = tüm YKS sınıfları.
 *
 * Kullanım: npm run seed:tyt-karne
 */
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database'

const EKLENECEK: { ders: string; konu: string }[] = [
  { ders: 'Felsefe', konu: 'MÖ 6. Yüzyıl - MS 2. Yüzyıl Felsefesi' },
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

  let eklenen = 0
  for (const { ders, konu } of EKLENECEK) {
    const { data: subject, error: sErr } = await supabase
      .from('subjects').select('id').eq('curriculum', 'YKS').eq('name', ders).maybeSingle()
    if (sErr || !subject) {
      console.error(`❌ "${ders}" (YKS) dersi bulunamadı:`, sErr?.message)
      process.exit(1)
    }
    const { data: topics, error: tErr } = await supabase
      .from('topics').select('name, sort_order').eq('subject_id', subject.id)
    if (tErr) {
      console.error('❌ Konular okunamadı:', tErr.message)
      process.exit(1)
    }
    if ((topics ?? []).some((t) => t.name === konu)) {
      console.log(`= "${ders} / ${konu}" zaten var, atlandı.`)
      continue
    }
    const maxSort = Math.max(0, ...(topics ?? []).map((t) => t.sort_order))
    const { error: iErr } = await supabase
      .from('topics')
      .insert({ subject_id: subject.id, name: konu, sort_order: maxSort + 1, is_active: true, grades: [] })
    if (iErr) {
      console.error(`❌ "${konu}" eklenemedi:`, iErr.message)
      process.exit(1)
    }
    console.log(`+ "${ders} / ${konu}" eklendi (sort_order ${maxSort + 1}).`)
    eklenen++
  }
  console.log(`\nBitti: ${eklenen} konu eklendi.`)
}

main()
