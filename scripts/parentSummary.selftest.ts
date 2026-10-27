/**
 * scripts/parentSummary.selftest.ts
 *
 * R3-6 Veli Haftalık Özeti & Destek Önerileri Öz-Testi
 */

import assert from 'node:assert/strict'
import {
  generateParentSupportTips,
  detectSignificantExamDrop,
  computeSummaryStats,
  formatOpenedAtStamp,
  buildParentSummaryWhatsAppMessage,
} from '../src/lib/parentSummaryCore'

console.log('▶ R3-6 Veli Haftalık Özeti Öz-Testi Başlatılıyor...\n')

// 1. Kural: Görev tamamlama < %60
{
  const tips = generateParentSupportTips({
    completionPct: 50,
    hasSignificantExamDrop: false,
    hasAttendanceIssue: false,
  })
  assert.equal(tips.length, 1)
  assert.equal(
    tips[0],
    'Çalışma saatlerini sabit bir rutine oturtmasına ve çalışma ortamının sessiz kalmasına destek olabilirsiniz.'
  )
}

// 2. Kural: Son denemede belirgin net düşüşü (>= 3 net)
{
  assert.equal(detectSignificantExamDrop(70, 75), true) // 5 net drop
  assert.equal(detectSignificantExamDrop(72, 74), false) // 2 net drop
  assert.equal(detectSignificantExamDrop(null, 75), false)

  const tips = generateParentSupportTips({
    completionPct: 85,
    hasSignificantExamDrop: true,
    hasAttendanceIssue: false,
  })
  assert.equal(tips.length, 1)
  assert.equal(
    tips[0],
    'Deneme süreçlerinde iniş çıkışlar doğaldır; uyku düzenini ve dinlenmesini korumasına yardımcı olun.'
  )
}

// 3. Kural: Devamsızlık varsa
{
  const tips = generateParentSupportTips({
    completionPct: 90,
    hasSignificantExamDrop: false,
    hasAttendanceIssue: true,
  })
  assert.equal(tips.length, 1)
  assert.equal(
    tips[0],
    'Aksayan ders veya etütlerin telafisi konusunda öğrenciyi motive edebilirsiniz.'
  )
}

// 4. Kural: Her şey yolundaysa (suçlamasız, pozitif takdir)
{
  const tips = generateParentSupportTips({
    completionPct: 95,
    hasSignificantExamDrop: false,
    hasAttendanceIssue: false,
  })
  assert.equal(tips.length, 1)
  assert.equal(
    tips[0],
    'Haftalık hedeflerini başarıyla sürdürüyor; gösterdiği disiplini ve emeği takdir edebilirsiniz.'
  )
}

// 5. Kısıt: En fazla 2 madde kuralı
{
  // 3 kural birden tetiklendiğinde ilk 2 kural seçilmeli
  const tips = generateParentSupportTips({
    completionPct: 40,
    hasSignificantExamDrop: true,
    hasAttendanceIssue: true,
  })
  assert.equal(tips.length, 2)
  assert.equal(
    tips[0],
    'Çalışma saatlerini sabit bir rutine oturtmasına ve çalışma ortamının sessiz kalmasına destek olabilirsiniz.'
  )
  assert.equal(
    tips[1],
    'Deneme süreçlerinde iniş çıkışlar doğaldır; uyku düzenini ve dinlenmesini korumasına yardımcı olun.'
  )
}

// 6. Tarih damgası biçimi: "26 Eki 14:05"
{
  const stamp = formatOpenedAtStamp('2026-10-26T14:05:00.000Z')
  assert.ok(stamp.includes('Eki'))
}

// 7. Mesaj oluşturma doğrulaması
{
  const stats = computeSummaryStats({
    tasks: [
      { id: '1', completed: true, block_kind: 'ders' } as any,
      { id: '2', completed: false, block_kind: 'ders' } as any,
      { id: '3', completed: true, block_kind: 'mola' } as any,
      { id: '4', completed: true, block_kind: 'serbest' } as any,
    ],
    latestExam: { id: 'e1', name: 'Özdebir TYT 1', exam_type: 'TYT', total_net: 82.5 } as any,
    targetNet: 90,
    attendanceRecords: [],
  })

  assert.equal(stats.completedCount, 1)
  assert.equal(stats.totalCount, 2)
  assert.equal(stats.completionPct, 50)
  assert.equal(stats.latestExamNet, 82.5)

  const tips = generateParentSupportTips({
    completionPct: stats.completionPct,
    hasSignificantExamDrop: stats.hasExamDrop,
    hasAttendanceIssue: stats.attendanceCount > 0,
  })

  const msg = buildParentSummaryWhatsAppMessage({
    studentName: 'Ahmet Yılmaz',
    weekRangeText: '20–26 Ekim 2026',
    stats,
    tips,
    coachNote: 'Bu hafta matematik soru çözümünde iyi bir gayret gösterdi.',
  })

  assert.ok(msg.includes('Ahmet Yılmaz'))
  assert.ok(msg.includes('Özdebir TYT 1'))
  assert.ok(msg.includes('82,5 Net') && !msg.includes('82.5'))
  assert.ok(msg.includes('Hedef: 90'))
  assert.ok(msg.includes('Bu hafta matematik soru çözümünde iyi bir gayret gösterdi.'))
  assert.ok(msg.includes('Evde Nasıl Destek Olabilirsiniz?'))
  assert.ok(msg.includes('Netlik Koçluk'))
}

console.log('✓ Tüm R3-6 testleri başarıyla geçti!\n')
