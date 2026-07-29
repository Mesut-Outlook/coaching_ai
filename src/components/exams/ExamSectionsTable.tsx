import type { MockExamSection } from '../../types/database'

// Bir denemenin bölüm skorlarını okunur bir tablo olarak gösterir.
// Deneme Girişi geçmiş listesi, Tüm Deneme Geçmişi tablosu ve öğrenci
// profilindeki Deneme Geçmişi sekmesi — üçü de bu bileşeni kullanır.
export default function ExamSectionsTable({ sections }: { sections: MockExamSection[] }) {
  if (sections.length === 0) {
    return (
      <div style={{ padding: 12, fontSize: 12.5, color: 'var(--ink-faint)' }}>
        Bu deneme için bölüm verisi bulunamadı.
      </div>
    )
  }

  const total = sections.reduce(
    (acc, s) => ({
      max: acc.max + Number(s.max_questions),
      correct: acc.correct + Number(s.correct_count),
      wrong: acc.wrong + Number(s.wrong_count),
      blank: acc.blank + Number(s.blank_count),
      net: acc.net + Number(s.net),
    }),
    { max: 0, correct: 0, wrong: 0, blank: 0, net: 0 }
  )

  const cell = { padding: '7px 10px', fontSize: 12.5 } as const
  const num = { ...cell, textAlign: 'center' as const, fontVariantNumeric: 'tabular-nums' as const }
  const netCell = { ...cell, textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' as const, fontWeight: 700 }

  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--border-soft)', borderRadius: 10, background: 'var(--surface)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ background: 'var(--surface-alt)', color: 'var(--ink-soft)' }}>
            <th style={{ ...cell, fontWeight: 600 }}>Bölüm</th>
            <th style={{ ...num, fontWeight: 600 }}>Doğru</th>
            <th style={{ ...num, fontWeight: 600 }}>Yanlış</th>
            <th style={{ ...num, fontWeight: 600 }}>Boş</th>
            <th style={{ ...num, fontWeight: 600 }}>Soru</th>
            <th style={{ ...netCell, fontWeight: 600 }}>Net</th>
          </tr>
        </thead>
        <tbody>
          {sections.map((s) => (
            <tr key={s.id} style={{ borderTop: '1px solid var(--border-soft)' }}>
              <td style={{ ...cell, fontWeight: 600 }}>{s.section_name}</td>
              <td style={{ ...num, color: 'var(--success-text)' }}>{s.correct_count}</td>
              <td style={{ ...num, color: 'var(--critical-text)' }}>{s.wrong_count}</td>
              <td style={{ ...num, color: 'var(--ink-faint)' }}>{s.blank_count}</td>
              <td style={{ ...num, color: 'var(--ink-faint)' }}>{s.max_questions}</td>
              <td style={{ ...netCell, color: 'var(--indigo-600)' }}>{Number(s.net)}</td>
            </tr>
          ))}
          <tr style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-alt)' }}>
            <td style={{ ...cell, fontWeight: 700 }}>Toplam</td>
            <td style={{ ...num, fontWeight: 700, color: 'var(--success-text)' }}>{total.correct}</td>
            <td style={{ ...num, fontWeight: 700, color: 'var(--critical-text)' }}>{total.wrong}</td>
            <td style={{ ...num, fontWeight: 700, color: 'var(--ink-soft)' }}>{total.blank}</td>
            <td style={{ ...num, fontWeight: 700, color: 'var(--ink-soft)' }}>{total.max}</td>
            <td style={{ ...netCell, color: 'var(--indigo-600)', fontSize: 13.5 }}>
              {Math.round(total.net * 100) / 100}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
