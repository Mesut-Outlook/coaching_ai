import { useState, useEffect, useRef, type FormEvent } from 'react'
import { X, Upload, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useAccess } from '../../contexts/AccessContext'
import { GRADES } from '../../types/database'
import type { Student, Track } from '../../types/database'
import { gradeCurriculum } from '../../lib/curriculum'

interface AddStudentModalProps {
  onClose: () => void
  onCreated: (student: Student) => void
  editingStudent?: Student | null
}

export default function AddStudentModal({ onClose, onCreated, editingStudent }: AddStudentModalProps) {
  const { user } = useAuth()
  const { memberships, activeInstitutionId, isSystemAdmin } = useAccess()

  const [selectedInstitutionId, setSelectedInstitutionId] = useState<string>(
    editingStudent?.institution_id || activeInstitutionId || ''
  )
  const [institutions, setInstitutions] = useState<{ id: string; name: string }[]>([])

  const [fullName, setFullName] = useState(editingStudent?.full_name ?? '')
  const [grade, setGrade] = useState<Student['grade']>(editingStudent?.grade ?? '12. Sınıf')
  // LGS sınıflarında (7./8.) Alan kavramı yok → track null. YKS sınıflarında zorunlu.
  const isLgs = gradeCurriculum(grade) === 'LGS'
  const [track, setTrack] = useState<Track | null>(
    editingStudent ? editingStudent.track : (isLgs ? null : 'SAY')
  )
  // Sınıf LGS↔YKS arasında değişince Alan'ı hatırlamak için: LGS'e geçince en son
  // seçili olan Alan burada saklanır, YKS'e dönünce geri getirilir (yoksa 'SAY').
  const lastTrackRef = useRef<Track>(editingStudent?.track ?? 'SAY')
  useEffect(() => {
    if (isLgs) {
      if (track !== null) {
        lastTrackRef.current = track
        setTrack(null)
      }
    } else if (track === null) {
      setTrack(lastTrackRef.current)
    }
    // Yalnızca sınıfın müfredatı değiştiğinde tetiklenmeli — track'in kendisi değil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLgs])
  const [targetProgram, setTargetProgram] = useState(editingStudent?.target_program ?? '')
  const [phoneNumber, setPhoneNumber] = useState(editingStudent?.phone_number ?? '')
  const [parentPhoneNumber, setParentPhoneNumber] = useState(editingStudent?.parent_phone_number ?? '')
  const [photoUrl, setPhotoUrl] = useState(editingStudent?.photo_url ?? '')
  const [isPrivateCoaching, setIsPrivateCoaching] = useState(
    editingStudent ? editingStudent.coaching_coach_id !== null : false
  )

  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Koçluk kilidi varsayılanı kurumun tipinden gelir: Netlik gibi bireysel koçluk
  // pratiklerinde açık, Konsept gibi kurumlarda kapalı. Eskiden her yeni öğrenci
  // koşulsuz kilitli açılıyordu — kurum öğrencisi personele kapanıyordu.
  const selectedIsCoachingPractice = memberships.find(
    (m) => m.institution_id === selectedInstitutionId
  )?.is_coaching_practice ?? false

  useEffect(() => {
    if (editingStudent) return
    setIsPrivateCoaching(selectedIsCoachingPractice)
  }, [selectedIsCoachingPractice, editingStudent])

  useEffect(() => {
    let cancelled = false
    const loadInstitutions = async () => {
      const opts = memberships.map(m => ({ id: m.institution_id, name: m.institution_name }))
      if (isSystemAdmin || opts.length === 0) {
        const { data } = await supabase.from('institutions').select('id, name').order('name')
        if (!cancelled && data && data.length > 0) {
          const map = new Map<string, string>()
          opts.forEach(o => map.set(o.id, o.name))
          data.forEach(d => map.set(d.id, d.name))
          const combined = Array.from(map.entries()).map(([id, name]) => ({ id, name }))
          setInstitutions(combined)
          if (!selectedInstitutionId) {
            if (activeInstitutionId && map.has(activeInstitutionId)) {
              setSelectedInstitutionId(activeInstitutionId)
            } else if (combined.length === 1) {
              setSelectedInstitutionId(combined[0].id)
            }
          }
          return
        }
      }
      if (!cancelled) {
        setInstitutions(opts)
        if (!selectedInstitutionId) {
          if (activeInstitutionId && opts.some(o => o.id === activeInstitutionId)) {
            setSelectedInstitutionId(activeInstitutionId)
          } else if (opts.length === 1) {
            setSelectedInstitutionId(opts[0].id)
          }
        }
      }
    }
    loadInstitutions()
    return () => { cancelled = true }
  }, [memberships, activeInstitutionId, isSystemAdmin, selectedInstitutionId])

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
    if (!selectedInstitutionId) {
      setError('Öğrencinin ekleneceği kurumu seçin.')
      return
    }
    setSaving(true)
    setError(null)

    const payload = {
      coach_id: user.id,
      institution_id: selectedInstitutionId,
      coaching_coach_id: isPrivateCoaching ? user.id : null,
      full_name: fullName.trim(),
      grade,
      track: isLgs ? null : track,
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
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kayıt sırasında bir hata oluştu.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2>{editingStudent ? 'Öğrenciyi Düzenle' : 'Yeni Öğrenci Ekle'}</h2>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Kapat">
            <X size={18} />
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-body">
          <div className="field">
            <label>Profil Fotoğrafı</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt="Önizleme"
                  style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: 'var(--surface-alt)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    fontWeight: 600,
                    color: 'var(--ink-soft)'
                  }}
                >
                  {fullName ? fullName.charAt(0).toUpperCase() : '?'}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
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

          <div className="form-section-title">Kimlik</div>

          <div className="field">
            <label>Kurum</label>
            <select
              value={selectedInstitutionId}
              onChange={(e) => setSelectedInstitutionId(e.target.value)}
              required
            >
              <option value="" disabled>-- Öğrencinin Kurumunu Seçin --</option>
              {institutions.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name}
                </option>
              ))}
            </select>
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

          <div style={{ display: 'grid', gridTemplateColumns: isLgs ? '1fr' : '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Sınıf</label>
              <select value={grade} onChange={(e) => setGrade(e.target.value as Student['grade'])}>
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            {/* LGS'de (7./8. sınıf) Alan kavramı yok — alan zaten track=null gidiyor. */}
            {!isLgs && (
              <div className="field">
                <label>Alan</label>
                <select value={track ?? 'SAY'} onChange={(e) => setTrack(e.target.value as Track)}>
                  <option value="SAY">SAY</option>
                  <option value="EA">EA</option>
                  <option value="SÖZ">SÖZ</option>
                </select>
              </div>
            )}
          </div>

          <div className="form-section-title">İletişim</div>

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
                placeholder="Örn: 0555 987 6543"
                value={parentPhoneNumber}
                onChange={(e) => setParentPhoneNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="form-section-title">Hedef &amp; Erişim</div>

          <div className="field">
            <label>Hedef Program (opsiyonel)</label>
            <input
              type="text"
              placeholder="Örn: İTÜ Bilgisayar Mühendisliği"
              value={targetProgram}
              onChange={(e) => setTargetProgram(e.target.value)}
            />
          </div>

          {/* Bu bir erişim kararı — sıradan bir alan gibi görünmemeli:
              işaretlenirse konu/program/rapor verisi kurumun geri kalanına kapanır. */}
          <label className={`toggle-card${isPrivateCoaching ? ' is-on' : ''}`}>
            <input
              type="checkbox"
              checked={isPrivateCoaching}
              onChange={(e) => setIsPrivateCoaching(e.target.checked)}
            />
            <span>
              <span className="toggle-card-title">Özel koçluk öğrencisi</span>
              <span className="toggle-card-desc">
                Konu yeterliliği, haftalık program ve raporlar yalnızca sana görünür;
                kurumdaki diğer kullanıcılar bu öğrencinin koçluk verisine erişemez.
              </span>
            </span>
          </label>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              İptal
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Kaydediliyor…' : editingStudent ? 'Güncelle' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
