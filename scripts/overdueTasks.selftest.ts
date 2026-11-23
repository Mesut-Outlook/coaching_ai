/** Geciken görev kuralı + hatırlatma mesajı öz-testi. Çalıştırma: npm run test:overdue */
import assert from 'node:assert/strict'
import { overdueTasks, buildTaskReminderMessage } from '../src/lib/overdueTasks'
import { WHATSAPP_SIGNATURE } from '../src/lib/brand'

const t = (day_index: number, completed = false, block_kind: string | null = 'ders') => ({ day_index, completed, block_kind })
// Çarşamba (2): Pzt+Sal işaretsiz ders görevleri geciken
assert.equal(overdueTasks([t(0), t(1), t(2), t(3)], 2).length, 2)
// tamamlanan sayılmaz
assert.equal(overdueTasks([t(0, true), t(1)], 2).length, 1)
// mola/serbest sayılmaz; block_kind null/undefined ders sayılır
assert.equal(overdueTasks([t(0, false, 'mola'), t(0, false, 'serbest'), t(0, false, null)], 2).length, 1)
// Pazartesi: hiçbiri geciken değil
assert.equal(overdueTasks([t(0), t(3)], 0).length, 0)
// mesaj
const m = buildTaskReminderMessage('Ali', 3, 'https://x/portal?code=ABC')
assert.ok(m.startsWith('Merhaba Ali,'))
assert.ok(m.includes('3 görev işaretlenmemiş'))
assert.ok(m.includes('https://x/portal?code=ABC'))
assert.ok(m.includes(WHATSAPP_SIGNATURE))
assert.ok(!/yapmadın/i.test(m))
console.log('overdueTasks selftest OK')
