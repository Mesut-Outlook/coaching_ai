import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { todayIso } from '../../lib/attendance'
import type { AttendanceRecord, Student } from '../../types/database'

interface AddAbsenceModalProps {
  students: Student[]
  defaultStudentId?: string
  editingRecord?: AttendanceRecord | null
  onClose: () => void
  /** opts.promptNotify=true → kaydeden ekran alıcı seçimi (WhatsApp) akışını açmalı. */
  onSaved: (record: AttendanceRecord, opts?: { promptNotify?: boolean }) => void
}

export default function AddAbsenceModal({ students, defaultStudentId, editingRecord, onClose, onSaved }: AddAbsenceModalProps) {
  const [studentId, setStudentId] = useState(editingRecord?.student_id ?? defaultStudentId ?? '')
  const [absenceDate, setAbsenceDate] = useState(editingRecord?.absence_date ?? todayIso())
  const [sessionType, setSessionType] = useState<AttendanceRecord['session_type']>(editingRecord?.session_type ?? 'birebir')
  const [status, setStatus] = useState<AttendanceRecord['status']>(editingRecord?.status ?? 'gelmedi')
  const [excuseType, setExcuseType] = useState<AttendanceRecord['excuse_type']>(editingRecord?.excuse_type ?? 'yok')
  const [note, setNote] = useState(editingRecord?.excuse_note ?? '')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Düzenleme modunda öğrenci arşivlenmiş olabilir — listede kaybolmasın.
  const selectableStudents = editingRecord
    ? students.filter((s) => s.is_active || s.id === editingRecord.student_id)
    : students.filter((s) => s.is_active)

  async function saveRecord(promptNotify: boolean) {
    if (!studentId) {
      setError('Lütfen öğrenci seçin.')
      return
    }
    setSaving(true)
    setError(null)

    const payload = {
      student_id: studentId,
      absence_date: absenceDate,
      session_type: sessionType,
      status,
      excuse_type: excuseType,
      excuse_note: note.trim() || null,
    }

    try {
      let result
      if (editingRecord) {
        result = await supabase.from('attendance_records').update(payload).eq('id', editingRecord.id).select().single()
      } else {
        result = await supabase
          .from('attendance_records')
          .insert({ ...payload, notified_at: null, notified_to: null })
          .select()
          .single()
      }

      if (result.error) throw result.error
      const record = result.data as AttendanceRecord

      if (editingRecord) {
        onSaved(record)
        return
      }

      if (promptNotify) {
        onSaved(record, { promptNotify: true })
        return
      }

      const wantsNotifyNow = window.confirm(
        'Kayıt eklendi. Şimdi WhatsApp ile bildirilsin mi? (Öğrenciye/Veliye/Her ikisine)'
      )
      onSaved(record, { promptNotify: wantsNotifyNow })
    } catch (err) {
      const code = (err as { code?: string } | null)?.code
      if (code === '23505') {
        setError('Bu öğrenci için bu tarih ve oturum türünde kayıt zaten var.')
      } else {
        setError(err instanceof Error ? err.message : 'Devamsızlık kaydı kaydedilemedi.')
      }
    } finally {
      setSaving(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    saveRecord(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>
            {editingRecord ? 'Devamsızlık Kaydını Düzenle' : 'Devamsızlık Ekle'}
          </h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Kapat">
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field">
            <label>Öğrenci</label>
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)} required disabled={!!editingRecord}>
              <option value="" disabled>Öğrenci seçin</option>
              {selectableStudents.map((s) => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Tarih</label>
              <input
                type="date"
                value={absenceDate}
                max={todayIso()}
                onChange={(e) => setAbsenceDate(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Oturum Türü</label>
              <select value={sessionType} onChange={(e) => setSessionType(e.target.value as AttendanceRecord['session_type'])}>
                <option value="birebir">Birebir</option>
                <option value="etut">Etüt</option>
                <option value="grup">Grup</option>
                <option value="online">Online</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Durum</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as AttendanceRecord['status'])}>
                <option value="gelmedi">Gelmedi</option>
                <option value="gec_geldi">Geç Geldi</option>
                <option value="erken_ayrildi">Erken Ayrıldı</option>
              </select>
            </div>
            <div className="field">
              <label>Mazeret</label>
              <select value={excuseType} onChange={(e) => setExcuseType(e.target.value as AttendanceRecord['excuse_type'])}>
                <option value="yok">Mazeret bildirilmedi</option>
                <option value="hastalik">Hastalık</option>
                <option value="ailevi">Ailevi</option>
                <option value="okul_sinav">Okul / Sınav</option>
                <option value="ulasim">Ulaşım</option>
                <option value="izinli">İzinli</option>
                <option value="diger">Diğer</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label>Not (opsiyonel)</label>
            <textarea
              placeholder="Örn: Velisi arayıp bilgi verdi."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>

          {error && <div style={{ color: 'var(--critical-text)', fontSize: 12.5 }}>{error}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Vazgeç</button>
            <button type="submit" className={editingRecord ? 'btn btn-primary' : 'btn btn-ghost'} disabled={saving}>
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            {!editingRecord && (
              <button type="button" className="btn btn-primary" disabled={saving} onClick={() => saveRecord(true)}>
                Kaydet ve Bildir
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
