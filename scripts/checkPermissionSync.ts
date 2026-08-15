/**
 * src/lib/permissions.ts <-> supabase/schema.sql (permission_catalog seed)
 * izin senkronizasyon denetimi.
 *
 * schema.sql içindeki insert into permission_catalog bloğundaki izin anahtarlarını okur,
 * src/lib/permissions.ts dosyasındaki ALL_PERMISSIONS dizisi ile karşılaştırır.
 * Fark varsa exit code 1 döner.
 */

import fs from 'node:fs'
import path from 'node:path'
import { ALL_PERMISSIONS } from '../src/lib/permissions.ts'

const ROOT = path.resolve(import.meta.dirname, '..')
const SCHEMA_PATH = path.join(ROOT, 'supabase', 'schema.sql')

function main() {
  const schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf-8')

  // insert into permission_catalog ... values ... bloğunu yakala
  const catalogMatch = schemaContent.match(
    /insert\s+into\s+permission_catalog[\s\S]*?values\s+([\s\S]*?);/i
  )

  if (!catalogMatch) {
    console.error('❌ schema.sql içinde permission_catalog seed bloğu bulunamadı!')
    process.exit(1)
  }

  const valuesBlock = catalogMatch[1]
  // ('panel.view', ...) kalıplarından ilk elemanı çıkar
  const sqlKeys: string[] = []
  const keyRegex = /\(\s*'([^']+)'/g
  let match: RegExpExecArray | null

  while ((match = keyRegex.exec(valuesBlock)) !== null) {
    sqlKeys.push(match[1])
  }

  const tsKeys = ALL_PERMISSIONS as string[]

  const missingInTs = sqlKeys.filter((k) => !tsKeys.includes(k))
  const missingInSql = tsKeys.filter((k) => !sqlKeys.includes(k))

  let hasError = false

  if (missingInTs.length > 0) {
    console.error('❌ schema.sql içinde var ancak src/lib/permissions.ts içinde eksik izinler:')
    for (const key of missingInTs) {
      console.error(`   - ${key}`)
    }
    hasError = true
  }

  if (missingInSql.length > 0) {
    console.error('❌ src/lib/permissions.ts içinde var ancak schema.sql içinde eksik izinler:')
    for (const key of missingInSql) {
      console.error(`   - ${key}`)
    }
    hasError = true
  }

  if (hasError) {
    console.error('\n❌ İzin kataloğu senkronizasyonu BAŞARISIZ oldu!')
    process.exit(1)
  }

  console.log(`✓ İzin kataloğu senkronize (${tsKeys.length} izin anahtarı doğrulandı).`)
  process.exit(0)
}

main()
