import { MessageCircle } from 'lucide-react'
import { openWhatsAppChat } from '../../lib/whatsapp'
import { buildExamResultMessage } from '../../lib/examShare'
import type { MockExam, MockExamSection } from '../../types/database'

// Bir deneme sonucunu WhatsApp ile öğrenciye / veliye / her ikisine gönderir.
// Haftalık Program ve Devamsızlık ekranlarındaki alıcı seçimiyle aynı desen:
// numara yoksa uyarır ve hiçbir pencere açmaz.

type Props = {
  exam: Pick<MockExam, 'name' | 'publisher' | 'exam_type' | 'exam_date'>
  sections: MockExamSection[]
  studentName: string
  phone: string | null
  parentPhone: string | null
}

export default function ExamShareButtons({ exam, sections, studentName, phone, parentPhone }: Props) {
  // Bölüm skoru girilmemiş denemede paylaşılacak bir sonuç yok — butonları gösterme.
  if (sections.length === 0) return null

  const send = (target: 'ogrenci' | 'veli' | 'ikisi') => {
    const wantsStudent = target === 'ogrenci' || target === 'ikisi'
    const wantsParent = target === 'veli' || target === 'ikisi'

    const missing: string[] = []
    if (wantsStudent && !phone) missing.push('öğrenci')
    if (wantsParent && !parentPhone) missing.push('veli')
    if (missing.length > 0) {
      alert(
        `Bu öğrencinin ${missing.join(' ve ')} telefon numarası girilmemiş. Lütfen önce Öğrenciler sayfasından öğrenciyi düzenleyerek telefon numarasını kaydedin.`
      )
      return
    }

    const label = target === 'ogrenci' ? 'öğrenciye' : target === 'veli' ? 'veliye' : 'öğrenciye ve veliye'
    const ok = window.confirm(
      `Deneme sonucu ${label} WhatsApp üzerinden gönderilecek — sohbet penceresi/pencereleri açılacaktır.` +
        (target === 'ikisi'
          ? '\n\nİki sohbet penceresi açılacağı için tarayıcınız pop-up engelleyebilir — izin vermeniz gerekebilir.'
          : '')
    )
    if (!ok) return

    if (wantsStudent && phone) {
      openWhatsAppChat(phone, buildExamResultMessage(exam, sections, studentName, 'ogrenci'))
    }
    if (wantsParent && parentPhone) {
      openWhatsAppChat(parentPhone, buildExamResultMessage(exam, sections, studentName, 'veli'))
    }
  }

  const btn = {
    fontSize: 11,
    padding: '4px 10px',
    border: '1px solid var(--border)',
    borderRadius: 8,
    background: 'var(--surface)',
    color: 'var(--ink)',
    cursor: 'pointer',
  } as const

  return (
    <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--ink-soft)', fontWeight: 600 }}>
        <MessageCircle size={13} color="var(--success)" /> Sonucu WhatsApp ile gönder:
      </span>
      <button type="button" style={btn} onClick={() => send('ogrenci')}>Öğrenciye</button>
      <button type="button" style={btn} onClick={() => send('veli')}>Veliye</button>
      <button
        type="button"
        style={{ ...btn, background: 'var(--success)', color: '#fff', border: '1px solid var(--success)', fontWeight: 600 }}
        onClick={() => send('ikisi')}
      >
        Her İkisine
      </button>
    </div>
  )
}
