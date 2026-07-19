import { useState, type FormEvent } from 'react'
import { X, Upload, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Student } from '../../types/database'

interface AddStudentModalProps {
  onClose: () => void
  onCreated: (student: Student) => void
  editingStudent?: Student | null
}

export default function AddStudentModal({ onClose, onCreated, editingStudent }: AddStudentModalProps) {
  const { user } = useAuth()
  const [fullName, setFullName] = useState(editingStudent?.full_name ?? '')
  const [grade, setGrade] = useState<Student['grade']>(editingStudent?.grade ?? '12. Sınıf')
  const [track, setTrack] = useState<Student['track']>(editingStudent?.track ?? 'SAY')
  const [targetProgram, setTargetProgram] = useState(editingStudent?.target_program ?? '')
  const [phoneNumber, setPhoneNumber] = useState(editingStudent?.phone_number ?? '')
  const [parentPhoneNumber, setParentPhoneNumber] = useState(editingStudent?.parent_phone_number ?? '')
  const [photoUrl, setPhotoUrl] = useState(editingStudent?.photo_url ?? '')
  
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingPhoto(true)
    setError(null)

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('student-photos')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('student-photos')
        .getPublicUrl(filePath)

      setPhotoUrl(data.publicUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fotoğraf yüklenemedi.')
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!fullName.trim()) {
      setError('Ad Soyad zorunlu.')
      return
    }
    setSaving(true)
    setError(null)

    const payload = {
      coach_id: user.id,
      full_name: fullName.trim(),
      grade,
      track,
      target_program: targetProgram.trim() || null,
      phone_number: phoneNumber.trim() || null,
      parent_phone_number: parentPhoneNumber.trim() || null,
      photo_url: photoUrl || null,
      is_active: editingStudent ? editingStudent.is_active : true
    }

    try {
      let result
      if (editingStudent) {
        result = await supabase
          .from('students')
          .update(payload)
          .eq('id', editingStudent.id)
          .select()
          .single()
      } else {
        result = await supabase
          .from('students')
          .insert({
            ...payload,
            target_ranking: null,
            target_net_label: null,
            target_net_value: null,
          })
          .select()
          .single()
      }

      if (result.error) throw result.error
      onCreated(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Öğrenci kaydedilemedi.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>
            {editingStudent ? 'Öğrenci Bilgilerini Düzenle' : 'Yeni Öğrenci Ekle'}
          </h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Kapat">
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          
          {/* Profile Photo Upload Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface-alt)', padding: 12, borderRadius: 10 }}>
            <div style={{ width: 76, height: 76, borderRadius: '50%', background: 'var(--measured-bg)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--border-soft)' }}>
              {photoUrl ? (
                <img src={photoUrl} alt="Öğrenci" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-soft)' }}>
                  {fullName ? fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?'}
                </span>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4, color: 'var(--ink-soft)' }}>
                Profil Fotoğrafı
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
                  {uploadingPhoto ? (
                    <>
                      <Loader2 size={13} className="animate-spin" /> Yükleniyor...
                    </>
                  ) : (
                    <>
                      <Upload size={13} /> Fotoğraf Seç
                    </>
                  )}
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} disabled={uploadingPhoto} />
                </label>
                {photoUrl && (
                  <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--critical-text)' }} onClick={() => setPhotoUrl('')}>
                    Kaldır
                  </button>
                )}
              </div>
            </div>
          </div>

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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Öğrenci Telefonu (opsiyonel)</label>
              <input
                type="tel"
                placeholder="Örn: 0555 123 4567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Veli Telefonu (opsiyonel)</label>
              <input
                type="tel"
                placeholder="Örn: 0555 765 4321"
                value={parentPhoneNumber}
                onChange={(e) => setParentPhoneNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label>Hedef Program (opsiyonel)</label>
            <input
              type="text"
              placeholder="Örn: Boğaziçi Bilgisayar"
              value={targetProgram}
              onChange={(e) => setTargetProgram(e.target.value)}
            />
          </div>

          {error && <div style={{ color: 'var(--critical-text)', fontSize: 12.5 }}>{error}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Vazgeç</button>
            <button type="submit" className="btn btn-primary" disabled={saving || uploadingPhoto}>
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
