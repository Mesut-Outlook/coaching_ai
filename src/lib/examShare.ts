import type { MockExamSection, MockExam } from '../types/database'
import { weightedNet } from './examSections'

// Deneme sonucunun WhatsApp mesajı. WhatsApp kalın metni *yıldız* ile gösterir.
// Devamsızlık bildirimleriyle aynı ton: öğrenciye doğrudan, veliye bilgilendirme.

export type ExamShareTarget = 'ogrenci' | 'veli'

function fmtDateTr(iso: string) {
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}.${m}.${y}` : iso
}

function fmtNet(n: number) {
  const rounded = Math.round(Number(n) * 100) / 100
  return String(rounded)
}

export function buildExamResultMessage(
  exam: Pick<MockExam, 'name' | 'publisher' | 'exam_type' | 'exam_date'>,
  sections: MockExamSection[],
  studentName: string,
  target: ExamShareTarget
): string {
  const totalNet = sections.reduce((sum, s) => sum + Number(s.net), 0)
  const totalCorrect = sections.reduce((sum, s) => sum + Number(s.correct_count), 0)
  const totalWrong = sections.reduce((sum, s) => sum + Number(s.wrong_count), 0)
  const totalBlank = sections.reduce((sum, s) => sum + Number(s.blank_count), 0)

  const header =
    target === 'ogrenci'
      ? `Merhaba ${studentName}, *${exam.name}* denemesinin sonucu:`
      : `Merhaba, *${studentName}* için *${exam.name}* denemesinin sonucu:`

  const meta = `${exam.exam_type} · ${fmtDateTr(exam.exam_date)}${exam.publisher ? ` · ${exam.publisher}` : ''}`

  const lines = sections.map(
    s => `• ${s.section_name}: ${s.correct_count}D · ${s.wrong_count}Y · ${s.blank_count}B → *${fmtNet(Number(s.net))} net*`
  )

  // LGS'te gerçek puan (500'lük) hesaplanamaz — ders katsayılarıyla tartılmış NET
  // eklenir, asla "puan" denmez.
  const weightedLine =
    exam.exam_type === 'LGS' && lines.length > 0
      ? `\n*Ağırlıklı Net: ${fmtNet(weightedNet(sections))}*`
      : ''

  const body = lines.length > 0
    ? `\n*Bölüm Netleri*\n${lines.join('\n')}\n\nToplam: ${totalCorrect}D · ${totalWrong}Y · ${totalBlank}B\n*TOPLAM NET: ${fmtNet(totalNet)}*${weightedLine}`
    : '\n_Bu deneme için bölüm skorları girilmemiş._'

  const footer =
    target === 'ogrenci'
      ? '\n\nEksik kaldığın bölümleri bu haftaki programa ekleyelim. — Netlik Koçluk'
      : '\n\nBilginize. — Netlik Koçluk'

  return `${header}\n${meta}\n${body}${footer}`
}
