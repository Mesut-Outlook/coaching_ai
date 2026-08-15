/**
 * src/types/database.ts  <->  supabase/schema.sql  eşleşme denetimi.
 *
 * database.ts'in ilk satırı "supabase/schema.sql ile birebir eşleşir" diyor —
 * bu script onu doğruluyor. Veritabanına BAĞLANMAZ, iki dosyayı statik okur:
 *   - schema.sql: create table / alter table add column blokları ayrıştırılır
 *   - database.ts: TypeScript compiler API (zaten devDependency) ile AST'den
 *     Database['public']['Tables'] -> TableDef<Row> -> Row alanları çıkarılır
 *
 * Kullanım: npm run test:types   (tsc -b + bu script)
 * Çıkış kodu: kayma varsa 1, yoksa 0.
 */

import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const ROOT = path.resolve(import.meta.dirname, '..')
const SCHEMA_PATH = path.join(ROOT, 'supabase', 'schema.sql')
const TYPES_PATH = path.join(ROOT, 'src', 'types', 'database.ts')

type TsPrimitive = 'string' | 'number' | 'boolean' | 'string[]' | 'unknown'

type SqlColumn = {
  name: string
  sqlType: string
  primitive: TsPrimitive
  notNull: boolean
  hasDefault: boolean
  generated: boolean
}

type TsField = {
  name: string
  text: string
  primitive: TsPrimitive
  nullable: boolean
}

// ---------------------------------------------------------------------------
// SQL ayrıştırma
// ---------------------------------------------------------------------------

/** `--` yorumlarını atar; tek tırnak içindeki `--` korunur (yorumlar satır içi). */
function stripSqlComments(sql: string): string {
  return sql
    .split('\n')
    .map((line) => {
      let inString = false
      for (let i = 0; i < line.length; i++) {
        if (line[i] === "'") inString = !inString
        else if (!inString && line[i] === '-' && line[i + 1] === '-') return line.slice(0, i)
      }
      return line
    })
    .join('\n')
}

/** `open` konumundaki `(` ile eşleşen `)` indeksi (tırnak ve iç içe parantez farkında). */
function matchParen(sql: string, open: number): number {
  let depth = 0
  let inString = false
  for (let i = open; i < sql.length; i++) {
    const ch = sql[i]
    if (ch === "'") inString = !inString
    else if (!inString && ch === '(') depth++
    else if (!inString && ch === ')') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/** Tablo gövdesini üst düzey virgüllerden böler. */
function splitTopLevel(body: string): string[] {
  const parts: string[] = []
  let depth = 0
  let inString = false
  let current = ''
  for (const ch of body) {
    if (ch === "'") inString = !inString
    if (!inString && ch === '(') depth++
    if (!inString && ch === ')') depth--
    if (!inString && ch === ',' && depth === 0) {
      parts.push(current)
      current = ''
      continue
    }
    current += ch
  }
  if (current.trim()) parts.push(current)
  return parts.map((p) => p.trim()).filter(Boolean)
}

const TABLE_CONSTRAINT_KEYWORDS = new Set([
  'unique',
  'primary',
  'foreign',
  'check',
  'constraint',
  'exclude',
  'like',
])

const SQL_TYPE_MAP: Record<string, TsPrimitive> = {
  uuid: 'string',
  text: 'string',
  citext: 'string',
  'text[]': 'string[]',
  varchar: 'string',
  char: 'string',
  date: 'string',
  timestamptz: 'string',
  timestamp: 'string',
  time: 'string',
  int: 'number',
  int2: 'number',
  int4: 'number',
  int8: 'number',
  integer: 'number',
  smallint: 'number',
  bigint: 'number',
  serial: 'number',
  bigserial: 'number',
  smallserial: 'number',
  numeric: 'number',
  decimal: 'number',
  real: 'number',
  float4: 'number',
  float8: 'number',
  double: 'number',
  boolean: 'boolean',
  bool: 'boolean',
}

function parseColumn(def: string): SqlColumn | null {
  const tokens = def.split(/\s+/).filter(Boolean)
  if (tokens.length < 2) return null

  const first = tokens[0].replace(/"/g, '').toLowerCase()
  if (TABLE_CONSTRAINT_KEYWORDS.has(first)) return null

  const rest = def.slice(tokens[0].length)
  // Tip adı parantezli olabilir: numeric(10,2) -> numeric
  const sqlType = tokens[1].toLowerCase().replace(/\(.*$/, '')
  const generated = /\bgenerated\s+always\b/i.test(rest)
  const isPrimaryKey = /\bprimary\s+key\b/i.test(rest)

  return {
    name: tokens[0].replace(/"/g, ''),
    sqlType,
    primitive: SQL_TYPE_MAP[sqlType] ?? 'unknown',
    // generated stored kolon kaynak kolonlardan türer; deklarasyonda NOT NULL
    // yazmasa da pratikte hiç null olmaz — TS'te non-null olması doğru.
    notNull: /\bnot\s+null\b/i.test(rest) || isPrimaryKey || generated,
    hasDefault: /\bdefault\b/i.test(rest),
    generated,
  }
}

function parseSchema(sql: string): Map<string, SqlColumn[]> {
  const clean = stripSqlComments(sql)
  const tables = new Map<string, SqlColumn[]>()

  const createRe = /create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z_][\w.]*)\s*\(/gi
  let m: RegExpExecArray | null
  while ((m = createRe.exec(clean)) !== null) {
    const name = m[1]
    // storage.* Supabase'in kendi şeması — database.ts'i ilgilendirmiyor.
    if (name.includes('.')) continue
    const open = clean.indexOf('(', m.index + m[0].length - 1)
    const close = matchParen(clean, open)
    if (close === -1) continue
    const columns = splitTopLevel(clean.slice(open + 1, close))
      .map(parseColumn)
      .filter((c): c is SqlColumn => c !== null)
    tables.set(name, columns)
    createRe.lastIndex = close
  }

  // Geriye dönük eklemeler: alter table X add column [if not exists] col type ...
  const alterRe =
    /alter\s+table\s+([a-z_][\w.]*)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?([^;]+);/gi
  while ((m = alterRe.exec(clean)) !== null) {
    const columns = tables.get(m[1])
    if (!columns) continue
    const col = parseColumn(m[2].trim())
    if (col && !columns.some((c) => c.name === col.name)) columns.push(col)
  }

  return tables
}

// ---------------------------------------------------------------------------
// database.ts ayrıştırma (TypeScript AST)
// ---------------------------------------------------------------------------

type ParsedTypes = {
  /** tablo adı -> Row tip adı (TableDef<X> içindeki X) */
  tableToRowType: Map<string, string>
  /** Row tip adı -> alanlar */
  rowFields: Map<string, TsField[]>
  /** TableDef.Insert'in Omit<Row, ...> ile düşürdüğü alanlar */
  insertOmitted: string[]
}

function memberName(member: ts.TypeElement): string | null {
  const name = member.name
  if (!name) return null
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text
  return null
}

function literalUnionOfStrings(node: ts.TypeNode): boolean {
  if (!ts.isUnionTypeNode(node)) return false
  return node.types.every((t) => ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal))
}

function parseTypes(source: string): ParsedTypes {
  const sf = ts.createSourceFile('database.ts', source, ts.ScriptTarget.Latest, true)
  const aliases = new Map<string, ts.TypeAliasDeclaration>()
  for (const stmt of sf.statements) {
    if (ts.isTypeAliasDeclaration(stmt)) aliases.set(stmt.name.text, stmt)
  }

  /** Bir tip düğümünü ilkel karşılığına indirger (alias union'larını çözer). */
  const toPrimitive = (node: ts.TypeNode, depth = 0): TsPrimitive => {
    if (depth > 4) return 'unknown'
    switch (node.kind) {
      case ts.SyntaxKind.StringKeyword:
        return 'string'
      case ts.SyntaxKind.NumberKeyword:
        return 'number'
      case ts.SyntaxKind.BooleanKeyword:
        return 'boolean'
    }
    if (ts.isLiteralTypeNode(node)) {
      if (ts.isStringLiteral(node.literal)) return 'string'
      if (ts.isNumericLiteral(node.literal)) return 'number'
      if (
        node.literal.kind === ts.SyntaxKind.TrueKeyword ||
        node.literal.kind === ts.SyntaxKind.FalseKeyword
      )
        return 'boolean'
    }
    if (ts.isArrayTypeNode(node)) {
      if (node.elementType.kind === ts.SyntaxKind.StringKeyword) return 'string[]'
    }
    if (literalUnionOfStrings(node)) return 'string'
    if (ts.isUnionTypeNode(node)) {
      const kinds = new Set(node.types.map((t) => toPrimitive(t, depth + 1)))
      kinds.delete('unknown')
      return kinds.size === 1 ? [...kinds][0] : 'unknown'
    }
    if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) {
      const alias = aliases.get(node.typeName.text)
      if (alias) return toPrimitive(alias.type, depth + 1)
    }
    return 'unknown'
  }

  const isNull = (node: ts.TypeNode) =>
    ts.isLiteralTypeNode(node) && node.literal.kind === ts.SyntaxKind.NullKeyword

  const fieldsOf = (typeName: string): TsField[] | null => {
    const alias = aliases.get(typeName)
    if (!alias || !ts.isTypeLiteralNode(alias.type)) return null
    const fields: TsField[] = []
    for (const member of alias.type.members) {
      if (!ts.isPropertySignature(member) || !member.type) continue
      const name = memberName(member)
      if (!name) continue
      const nullable = ts.isUnionTypeNode(member.type) && member.type.types.some(isNull)
      const base = ts.isUnionTypeNode(member.type)
        ? (member.type.types.filter((t) => !isNull(t))[0] ?? member.type)
        : member.type
      fields.push({
        name,
        text: member.type.getText(sf).replace(/\s+/g, ' '),
        primitive: toPrimitive(base),
        nullable,
      })
    }
    return fields
  }

  // Database['public']['Tables'] üyelerini gez.
  const tableToRowType = new Map<string, string>()
  const database = aliases.get('Database')
  if (database && ts.isTypeLiteralNode(database.type)) {
    const pub = database.type.members.find((mem) => memberName(mem) === 'public')
    if (pub && ts.isPropertySignature(pub) && pub.type && ts.isTypeLiteralNode(pub.type)) {
      const tablesMember = pub.type.members.find((mem) => memberName(mem) === 'Tables')
      if (
        tablesMember &&
        ts.isPropertySignature(tablesMember) &&
        tablesMember.type &&
        ts.isTypeLiteralNode(tablesMember.type)
      ) {
        for (const member of tablesMember.type.members) {
          const table = memberName(member)
          if (!table || !ts.isPropertySignature(member) || !member.type) continue
          const def = member.type
          if (
            ts.isTypeReferenceNode(def) &&
            ts.isIdentifier(def.typeName) &&
            def.typeName.text === 'TableDef' &&
            def.typeArguments?.length === 1
          ) {
            const arg = def.typeArguments[0]
            if (ts.isTypeReferenceNode(arg) && ts.isIdentifier(arg.typeName)) {
              tableToRowType.set(table, arg.typeName.text)
            }
          }
        }
      }
    }
  }

  const rowFields = new Map<string, TsField[]>()
  for (const rowType of new Set(tableToRowType.values())) {
    const fields = fieldsOf(rowType)
    if (fields) rowFields.set(rowType, fields)
  }

  // TableDef.Insert -> Omit<Row, 'id' | 'created_at'>
  let insertOmitted: string[] = []
  const tableDef = aliases.get('TableDef')
  if (tableDef) {
    const omit = /Omit<\s*Row\s*,([^>]*)>/.exec(tableDef.getText(sf))
    if (omit) insertOmitted = [...omit[1].matchAll(/'([^']+)'/g)].map((mm) => mm[1])
  }

  return { tableToRowType, rowFields, insertOmitted }
}

// ---------------------------------------------------------------------------
// Karşılaştırma
// ---------------------------------------------------------------------------

const errors: string[] = []
const warnings: string[] = []

function main() {
  for (const file of [SCHEMA_PATH, TYPES_PATH]) {
    if (!fs.existsSync(file)) {
      console.error(`✗ Dosya bulunamadı: ${path.relative(ROOT, file)}`)
      process.exit(1)
    }
  }

  const sqlTables = parseSchema(fs.readFileSync(SCHEMA_PATH, 'utf8'))
  const { tableToRowType, rowFields, insertOmitted } = parseTypes(
    fs.readFileSync(TYPES_PATH, 'utf8'),
  )

  if (tableToRowType.size === 0) {
    console.error('✗ database.ts içinde Database["public"]["Tables"] okunamadı.')
    process.exit(1)
  }

  // 1. Tablo kapsamı
  for (const table of sqlTables.keys()) {
    if (!tableToRowType.has(table)) {
      errors.push(`${table}: schema.sql'de var, database.ts'de TableDef girdisi YOK`)
    }
  }
  for (const table of tableToRowType.keys()) {
    if (!sqlTables.has(table)) {
      errors.push(`${table}: database.ts'de var, schema.sql'de "create table" YOK`)
    }
  }

  // 2. Sütun bazlı karşılaştırma
  const defaulted: string[] = []
  let checkedColumns = 0

  for (const [table, rowType] of [...tableToRowType].sort()) {
    const sqlColumns = sqlTables.get(table)
    const fields = rowFields.get(rowType)
    if (!sqlColumns) continue
    if (!fields) {
      errors.push(`${table}: ${rowType} tipi database.ts'de bulunamadı (veya nesne tipi değil)`)
      continue
    }

    const byName = new Map(fields.map((f) => [f.name, f]))
    const sqlByName = new Map(sqlColumns.map((c) => [c.name, c]))

    for (const col of sqlColumns) {
      const field = byName.get(col.name)
      if (!field) {
        errors.push(
          `${table}.${col.name}: schema.sql'de var (${col.sqlType}), ${rowType} tipinde YOK`,
        )
        continue
      }
      checkedColumns++

      if (col.primitive === 'unknown') {
        warnings.push(`${table}.${col.name}: bilinmeyen SQL tipi "${col.sqlType}" — tip denetlenmedi`)
      } else if (field.primitive === 'unknown') {
        warnings.push(
          `${table}.${col.name}: TS tipi "${field.text}" çözümlenemedi — tip denetlenmedi`,
        )
      } else if (field.primitive !== col.primitive) {
        errors.push(
          `${table}.${col.name}: SQL ${col.sqlType} (→ ${col.primitive}) ama TS "${field.text}"`,
        )
      }

      if (col.notNull && field.nullable) {
        errors.push(
          `${table}.${col.name}: SQL "not null" ama TS "${field.text}" — gereksiz null kontrolü`,
        )
      } else if (!col.notNull && !field.nullable) {
        errors.push(
          `${table}.${col.name}: SQL null kabul ediyor ama TS "${field.text}" — çalışma zamanında null gelebilir`,
        )
      }

      // TableDef.Insert yalnız id/created_at'i opsiyonel yapıyor; DB varsayılanı
      // ya da generated olan diğer kolonlar boşuna zorunlu görünüyor.
      if ((col.hasDefault || col.generated) && !insertOmitted.includes(col.name)) {
        defaulted.push(`${table}.${col.name}${col.generated ? ' (generated!)' : ''}`)
      }
    }

    for (const field of fields) {
      if (!sqlByName.has(field.name)) {
        errors.push(`${table}.${field.name}: ${rowType} tipinde var, schema.sql'de sütun YOK`)
      }
    }
  }

  // 3. Rapor
  const tableCount = tableToRowType.size
  console.log(`\ndatabase.ts ↔ schema.sql — ${tableCount} tablo, ${checkedColumns} sütun denetlendi\n`)

  if (errors.length > 0) {
    console.log(`✗ ${errors.length} kayma:`)
    for (const e of errors) console.log(`   ${e}`)
    console.log('')
  }

  if (warnings.length > 0) {
    console.log(`⚠ ${warnings.length} uyarı:`)
    for (const w of warnings) console.log(`   ${w}`)
    console.log('')
  }

  if (defaulted.length > 0) {
    console.log(
      `ℹ DB varsayılanı olduğu halde Insert tipinde zorunlu görünen ${defaulted.length} sütun`,
    )
    console.log('   (TableDef.Insert sadece ' + insertOmitted.map((k) => `'${k}'`).join('/') + " düşürüyor):")
    console.log(`   ${defaulted.join(', ')}`)
    console.log(
      '   "generated!" işaretli sütun DB tarafından üretiliyor, insert edilemez —\n' +
        '   bu yüzden çağıran kod "as any" ile tip denetimini atlamak zorunda kalıyor.\n',
    )
  }

  if (errors.length === 0) {
    console.log('✓ Tüm tablo ve sütunlar eşleşiyor.\n')
    process.exit(0)
  }
  process.exit(1)
}

main()
