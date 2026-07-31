import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { generateRandomCode } from '../src/lib/accessCodeGenerator'

// Read .env.local manually
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8')
    envFile.split('\n').forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
      if (match) {
        const key = match[1]
        let value = match[2] || ''
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1)
        process.env[key] = value
      }
    })
  }
}

loadEnv()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('HATA: .env.local dosyasında VITE_SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY eksik.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

// ⚠️ Buraya kendi kopyanı YAZMA — kod uzunluğu/alfabesi tek yerde tutuluyor.
// (Burada 4 karakterlik, Math.random()'lu bir kopya vardı; uygulama tarafı 6
// karaktere ve crypto.getRandomValues'a geçince bu script geride kalmıştı.)

async function run() {
  console.log('🔄 Öğrencilerin mobil erişim kodları kontrol ediliyor...')

  const { data: students, error } = await supabase
    .from('students')
    .select('id, full_name, student_access_code, parent_access_code')

  if (error || !students) {
    if (error?.code === '42703') {
      console.error('⚠️ SUPABASE UYARISI: Veritabanında student_access_code sütunu henüz açılmamış.')
      console.error('👉 Lütfen Supabase SQL Editor ekranına gidip supabase/schema.sql dosyasının en altındaki SQL satırlarını tek seferde çalıştırın.')
    } else {
      console.error('HATA: Öğrenciler çekilemedi:', error)
    }
    process.exit(1)
  }

  console.log(`📌 Toplam ${students.length} öğrenci bulundu.`)

  let updatedCount = 0

  for (const s of students) {
    let stuCode = s.student_access_code
    let parCode = s.parent_access_code
    let needsUpdate = false

    if (!stuCode) {
      stuCode = generateRandomCode('STU')
      needsUpdate = true
    }

    if (!parCode) {
      parCode = generateRandomCode('PAR')
      needsUpdate = true
    }

    if (needsUpdate) {
      const { error: updateError } = await supabase
        .from('students')
        .update({
          student_access_code: stuCode,
          parent_access_code: parCode,
        })
        .eq('id', s.id)

      if (updateError) {
        console.error(`❌ ${s.full_name} için kod güncelleme hatası:`, updateError.message)
      } else {
        console.log(`✅ ${s.full_name} -> Öğrenci Kodu: ${stuCode} | Veli Kodu: ${parCode}`)
        updatedCount++
      }
    } else {
      console.log(`ℹ️ ${s.full_name} -> Zaten kod mevcut: Ögr: ${stuCode} | Veli: ${parCode}`)
    }
  }

  console.log(`\n🎉 İşlem tamamlandı! ${updatedCount} öğrenci için yeni mobil erişim kodları üretildi.`)
}

run().catch((err) => {
  console.error('Beklenmeyen hata:', err)
  process.exit(1)
})
