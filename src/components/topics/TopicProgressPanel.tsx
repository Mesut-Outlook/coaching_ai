import { useEffect, useState } from 'react'
import { Save, CheckCircle2, AlertTriangle, XCircle, HelpCircle } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import Sparkline from '../charts/Sparkline'
import type { CoachDecision, TopicMeasurement } from '../../types/database'

// Bir öğrencinin tek bir konudaki gelişim paneli: ölçüm geçmişi + ortalama,
// yeni test sonucu ekleme ve Koç Kararı düzenleme.
// Kendi verisini yükler; hem Konu Yeterlilik Haritası'nın sağ sütununda hem de
// Haftalık Program'da konuya tıklanınca açılan pencerede kullanılır.

type DecisionState = 'yeterli' | 'gelisiyor' | 'kritik' | 'olculmedi'

type Props = {
  studentId: string
  topicId: number
  topicName: string
  subjectName?: string | null
  /** Kayıt/silme sonrası çağrılır — çağıran sayfa kendi listesini tazeleyebilir. */
  onSaved?: () => void
  /** Koç kararı kaydedildiğinde ya da İptal'e basıldığında çağrılır. */
  onClose?: () => void
}

export default function TopicProgressPanel({
  studentId,
  topicId,
  topicName,
  subjectName,
  onSaved,
  onClose,
}: Props) {
  const [measurements, setMeasurements] = useState<TopicMeasurement[]>([])
  const [coachId, setCoachId] = useState<string>('')
  const [loading, setLoading] = useState(true)

  const [editState, setEditState] = useState<DecisionState>('olculmedi')
  const [editNote, setEditNote] = useState('')
  const [savingDecision, setSavingDecision] = useState(false)

  const [showAddTest, setShowAddTest] = useState(false)
  const [testSourceLabel, setTestSourceLabel] = useState('')
  const [testMeasuredAt, setTestMeasuredAt] = useState(() => new Date().toISOString().split('T')[0])
  const [testCorrect, setTestCorrect] = useState(0)
  const [testWrong, setTestWrong] = useState(0)
  const [testBlank, setTestBlank] = useState(0)
  const [addingTest, setAddingTest] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured || !studentId || !topicId) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setShowAddTest(false)
    setTestSourceLabel('')
    setTestCorrect(0)
    setTestWrong(0)
    setTestBlank(0)
    setTestMeasuredAt(new Date().toISOString().split('T')[0])

    const load = async () => {
      const [{ data: measData }, { data: decData }, { data: studentRow }] = await Promise.all([
        supabase
          .from('topic_measurements')
          .select('*')
          .eq('student_id', studentId)
          .eq('topic_id', topicId)
          .order('measured_at', { ascending: false }),
        supabase.from('coach_decisions').select('*').eq('student_id', studentId).eq('topic_id', topicId),
        supabase.from('students').select('coach_id').eq('id', studentId).single(),
      ])
      if (cancelled) return
      setMeasurements(measData || [])
      const dec = (decData || [])[0] as CoachDecision | undefined
      setEditState((dec?.state as DecisionState) || 'olculmedi')
      setEditNote(dec?.note || '')
      setCoachId(studentRow?.coach_id || '')
      setLoading(false)
    }

    load().catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [studentId, topicId])

  const averageAccuracy =
    measurements.length === 0
      ? null
      : Math.round(measurements.reduce((sum, m) => sum + Number(m.accuracy_pct), 0) / measurements.length)

  const handleAddTestResult = async () => {
    const correct = Number(testCorrect)
    const wrong = Number(testWrong)
    const blank = Number(testBlank)
    const total = correct + wrong + blank
    if (total <= 0) {
      alert('Soru sayısı 0\'dan büyük olmalıdır.')
      return
    }

    setAddingTest(true)
    try {
      const accuracyPct = Math.round((correct / total) * 100)
      const { data, error } = await supabase
        .from('topic_measurements')
        .insert({
          student_id: studentId,
          topic_id: topicId,
          source: 'konu_testi',
          source_label: testSourceLabel.trim() || 'Konu Testi',
          correct_count: correct,
          wrong_count: wrong,
          blank_count: blank,
          accuracy_pct: accuracyPct,
          measured_at: testMeasuredAt,
        })
        .select()
        .single()
      if (error) throw error

      if (data) {
        setMeasurements(prev =>
          [data, ...prev].sort((a, b) => new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime())
        )
        setShowAddTest(false)
        setTestSourceLabel('')
        setTestCorrect(0)
        setTestWrong(0)
        setTestBlank(0)
        onSaved?.()
        alert('Test sonucu başarıyla eklendi!')
      }
    } catch {
      alert('Test sonucu eklenirken hata oluştu.')
    } finally {
      setAddingTest(false)
    }
  }

  const handleSaveDecision = async () => {
    setSavingDecision(true)
    try {
      if (editState === 'olculmedi') {
        const { error } = await supabase
          .from('coach_decisions')
          .delete()
          .eq('student_id', studentId)
          .eq('topic_id', topicId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('coach_decisions')
          .upsert({
            student_id: studentId,
            topic_id: topicId,
            state: editState,
            note: editNote || null,
            decided_by: coachId,
            decided_at: new Date().toISOString(),
          })
          .select()
        if (error) throw error
      }
      onSaved?.()
      onClose?.()
      alert('Koç kararı kaydedildi!')
    } catch {
      alert('Karar kaydedilirken hata oluştu.')
    } finally {
      setSavingDecision(false)
    }
  }

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 12.5 }}>Yükleniyor…</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        {subjectName && (
          <span style={{ fontSize: 10.5, color: 'var(--ink-faint)', fontWeight: 700, textTransform: 'uppercase' }}>
            {subjectName}
          </span>
        )}
        <h3 style={{ fontSize: 15, marginTop: 4 }}>{topicName}</h3>
      </div>

      {/* Ölçüm geçmişi + ortalama */}
      <div style={{ padding: 10, background: 'var(--surface-alt)', borderRadius: 8, border: '1px solid var(--border-soft)', fontSize: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600, marginBottom: 8 }}>
          <span>Deneme / Test Ölçümleri</span>
          {measurements.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Gelişim:</span>
              <Sparkline values={[...measurements].reverse().map(m => Number(m.accuracy_pct))} width={80} height={20} />
            </div>
          )}
        </div>

        {measurements.length === 0 ? (
          <div style={{ color: 'var(--ink-faint)' }}>Henüz test çözülmemiş.</div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderBottom: '1px solid var(--border-soft)', paddingBottom: 4, marginBottom: 6, fontSize: 11.5, color: 'var(--ink)' }}>
              <span>Ortalama Doğruluk</span>
              <span style={{ color: 'var(--indigo-600)' }}>%{averageAccuracy}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 120, overflowY: 'auto', paddingRight: 2 }}>
              {measurements.map(m => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ink-soft)', fontSize: 11 }}>
                  <span>{m.source_label} ({m.measured_at})</span>
                  <span style={{ fontWeight: 700 }}>%{Math.round(Number(m.accuracy_pct))}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Yeni test sonucu ekleme */}
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border-soft)' }}>
          {!showAddTest ? (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ width: '100%', fontSize: 11, padding: '4px 8px', justifyContent: 'center' }}
              onClick={() => setShowAddTest(true)}
            >
              + Test Sonucu Ekle
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--ink-soft)' }}>Yeni Test Ölçümü Ekle</div>

              <div className="field">
                <input
                  type="text"
                  placeholder="Kaynak (örn: Bilgi Sarmal Test 3)"
                  value={testSourceLabel}
                  onChange={e => setTestSourceLabel(e.target.value)}
                  style={{ fontSize: 11.5, padding: '6px 8px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div className="field">
                  <input
                    type="date"
                    value={testMeasuredAt}
                    onChange={e => setTestMeasuredAt(e.target.value)}
                    style={{ fontSize: 11.5, padding: '6px 8px' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input
                    type="number" placeholder="D" min={0} title="Doğru Sayısı"
                    value={testCorrect || ''}
                    onChange={e => setTestCorrect(Math.max(0, parseInt(e.target.value) || 0))}
                    style={{ width: '100%', fontSize: 11, padding: '6px 4px', textAlign: 'center', border: '1px solid var(--border)', borderRadius: 6 }}
                  />
                  <input
                    type="number" placeholder="Y" min={0} title="Yanlış Sayısı"
                    value={testWrong || ''}
                    onChange={e => setTestWrong(Math.max(0, parseInt(e.target.value) || 0))}
                    style={{ width: '100%', fontSize: 11, padding: '6px 4px', textAlign: 'center', border: '1px solid var(--border)', borderRadius: 6 }}
                  />
                  <input
                    type="number" placeholder="B" min={0} title="Boş Sayısı"
                    value={testBlank || ''}
                    onChange={e => setTestBlank(Math.max(0, parseInt(e.target.value) || 0))}
                    style={{ width: '100%', fontSize: 11, padding: '6px 4px', textAlign: 'center', border: '1px solid var(--border)', borderRadius: 6 }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 2 }}>
                <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setShowAddTest(false)}>
                  İptal
                </button>
                <button type="button" className="btn btn-primary" style={{ fontSize: 11, padding: '4px 12px' }} onClick={handleAddTestResult} disabled={addingTest}>
                  Ekle
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Koç Kararı */}
      <div className="field">
        <label>Koç Kararı Durumu</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(['yeterli', 'gelisiyor', 'kritik', 'olculmedi'] as const).map(stateOpt => (
            <button
              key={stateOpt}
              type="button"
              onClick={() => setEditState(stateOpt)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderRadius: 8,
                border: editState === stateOpt ? '2px solid var(--indigo-500)' : '1px solid var(--border-soft)',
                background: editState === stateOpt ? 'var(--indigo-025)' : 'var(--surface)',
                cursor: 'pointer', fontSize: 12.5, fontWeight: editState === stateOpt ? 700 : 500, textAlign: 'left',
              }}
            >
              {stateOpt === 'yeterli' && <CheckCircle2 size={14} color="var(--success)" />}
              {stateOpt === 'gelisiyor' && <AlertTriangle size={14} color="var(--warning)" />}
              {stateOpt === 'kritik' && <XCircle size={14} color="var(--critical)" />}
              {stateOpt === 'olculmedi' && <HelpCircle size={14} color="var(--measured-text)" />}
              <span style={{
                textTransform: 'capitalize',
                color: stateOpt === 'yeterli' ? 'var(--success-text)' : stateOpt === 'gelisiyor' ? 'var(--warning-text)' : stateOpt === 'kritik' ? 'var(--critical-text)' : 'var(--measured-text)',
              }}>
                {stateOpt === 'yeterli' && 'Yeterli'}
                {stateOpt === 'gelisiyor' && 'Gelişiyor'}
                {stateOpt === 'kritik' && 'Kritik'}
                {stateOpt === 'olculmedi' && 'Seçimi Kaldır'}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Koç Notu</label>
        <textarea
          placeholder="Konu gelişimine dair koç notu ekleyin…"
          value={editNote}
          onChange={e => setEditNote(e.target.value)}
          rows={3}
          style={{ resize: 'none', fontSize: 13 }}
        />
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => onClose?.()}>
          İptal
        </button>
        <button type="button" className="btn btn-primary" style={{ flex: 1.5, justifyContent: 'center' }} onClick={handleSaveDecision} disabled={savingDecision}>
          <Save size={14} /> Kaydet
        </button>
      </div>
    </div>
  )
}
