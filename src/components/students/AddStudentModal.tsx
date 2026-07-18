import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Student } from '../../types/database'

interface AddStudentModalProps {
  onClose: () => void
  onCreated: (student: Student) => void
}

export default function AddStudentModal({ onClose, onCreated }: AddStudentModalProps) {
  const { user } = useAuth()
  const [fullName, setFullName] = useState('')
  const [grade, setGrade] = useState<Student['grade']>('12. Sınıf')
  const [track, setTrack] = useState<Student['track']>('SAY')
  const [targetProgram, setTargetProgram] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!fullName.trim()) {
      setError('Ad Soyad zorunlu.')
      return
    }
    setSaving(true)
    setError(null)
    const { data, error: insertError } = await supabase
      .from('students')
      .insert({
        coach_id: user.id,
        full_name: fullName.trim(),
        grade,
        track,
        target_program: targetProgram.trim() || null,
        target_ranking: null,
        target_net_label: null,
        target_net_value: null,
      })
      .select()
      .single()

    setSaving(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    onCreated(data)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel card" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h3 style={{ fontSize: 15 }}>Yeni Öğrenci Ekle</h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Kapat">
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field">
            <label>Ad Soyad</label>
            <input
              type="text"
              placeholder="Örn: Ayşe Yılmaz"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Sınıf</label>
              <select value={grade} onChange={(e) => setGrade(e.target.value as Student['grade'])}>
                <option value="12. Sınıf">12. Sınıf</option>
                <option value="Mezun">Mezun</option>
              </select>
            </div>
            <div className="field">
              <label>Alan</label>
              <select value={track} onChange={(e) => setTrack(e.target.value as Student['track'])}>
                <option value="SAY">SAY</option>
                <option value="EA">EA</option>
                <option value="SÖZ">SÖZ</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label>Hedef Program (opsiyonel)</label>
            <input
              type="text"
              placeholder="Örn: Boğaziçi Bilgisayar Müh."
              value={targetProgram}
              onChange={(e) => setTargetProgram(e.target.value)}
            />
          </div>

          {error && <div style={{ color: 'var(--critical-text)', fontSize: 12.5 }}>{error}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Vazgeç</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
