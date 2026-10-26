import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Building2, Users, GraduationCap, Edit2, X, Calendar } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { useAccess } from '../../contexts/useAccess'
import PageHeader from '../../components/layout/PageHeader'
import type { Institution } from '../../types/database'

type InstitutionStats = Institution & {
  studentCount: number
  memberCount: number
}

export default function KurumlarPage() {
  const { isSystemAdmin } = useAccess()

  const [institutions, setInstitutions] = useState<InstitutionStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [editingInst, setEditingInst] = useState<Institution | null>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [saving, setSaving] = useState(false)

  // Sınav Tarihleri State (exam_calendar)
  const [yksDate, setYksDate] = useState('')
  const [lgsDate, setLgsDate] = useState('')
  const [savingCalendar, setSavingCalendar] = useState(false)
  const [calendarSaved, setCalendarSaved] = useState(false)
  const [calendarError, setCalendarError] = useState<string | null>(null)

  const loadExamCalendar = async () => {
    if (!isSupabaseConfigured) return
    try {
      const { data } = await supabase.from('exam_calendar').select('*')
      if (data) {
        data.forEach((r: any) => {
          if (r.exam === 'YKS') setYksDate(r.exam_date || '')
          if (r.exam === 'LGS') setLgsDate(r.exam_date || '')
        })
      }
    } catch {
      // ignore
    }
  }

  const handleSaveCalendar = async () => {
    if (!isSupabaseConfigured) return
    setSavingCalendar(true)
    setCalendarError(null)
    setCalendarSaved(false)
    try {
      const rows: Array<{ exam: 'YKS' | 'LGS'; exam_date: string; updated_at: string }> = []
      if (yksDate) rows.push({ exam: 'YKS', exam_date: yksDate, updated_at: new Date().toISOString() })
      if (lgsDate) rows.push({ exam: 'LGS', exam_date: lgsDate, updated_at: new Date().toISOString() })

      if (rows.length > 0) {
        const { error: upsertErr } = await supabase.from('exam_calendar').upsert(rows)
        if (upsertErr) throw upsertErr
      }
      setCalendarSaved(true)
      setTimeout(() => setCalendarSaved(false), 3000)
    } catch (err: any) {
      setCalendarError(err.message || 'Sınav tarihleri kaydedilemedi.')
    } finally {
      setSavingCalendar(false)
    }
  }

  const loadInstitutions = async () => {
    if (!isSupabaseConfigured || !isSystemAdmin) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)

    try {
      const { data: instData, error: instError } = await supabase
        .from('institutions')
        .select('*')
        .order('name')

      if (instError) throw instError

      if (!instData || instData.length === 0) {
        setInstitutions([])
        return
      }

      // Fetch stats per institution
      const statsList: InstitutionStats[] = await Promise.all(
        instData.map(async (inst) => {
          const [{ count: studentCount }, { count: memberCount }] = await Promise.all([
            supabase
              .from('students')
              .select('*', { count: 'exact', head: true })
              .eq('institution_id', inst.id),
            supabase
              .from('memberships')
              .select('*', { count: 'exact', head: true })
              .eq('institution_id', inst.id),
          ])

          return {
            ...inst,
            studentCount: studentCount || 0,
            memberCount: memberCount || 0,
          }
        })
      )

      setInstitutions(statsList)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kurumlar yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInstitutions()
    loadExamCalendar()
  }, [isSystemAdmin])

  const handleOpenCreate = () => {
    setEditingInst(null)
    setName('')
    setSlug('')
    setShowModal(true)
  }

  const handleOpenEdit = (inst: Institution) => {
    setEditingInst(inst)
    setName(inst.name)
    setSlug(inst.slug)
    setShowModal(true)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Kurum adı zorunlu.')
      return
    }

    setSaving(true)
    setError(null)

    const generatedSlug =
      slug.trim().toLowerCase().replace(/\s+/g, '-') ||
      name.trim().toLowerCase().replace(/\s+/g, '-')

    try {
      if (editingInst) {
        const { error } = await supabase
          .from('institutions')
          .update({ name: name.trim(), slug: generatedSlug })
          .eq('id', editingInst.id)

        if (error) throw error
      } else {
        const { error } = await supabase.from('institutions').insert({
          name: name.trim(),
          slug: generatedSlug,
          // Arayüzden açılan kurumlar normal kurumdur; "bireysel koçluk pratiği"
          // (Netlik) işareti yalnızca şema seed'inden verilir.
          is_coaching_practice: false,
        })

        if (error) throw error
      }

      setShowModal(false)
      loadInstitutions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kurum kaydedilemedi.')
    } finally {
      setSaving(false)
    }
  }

  if (!isSystemAdmin) {
    return (
      <section className="screen">
        <PageHeader title="Kurum Yönetimi" subtitle="Sistem Genel Kurumlar" />
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          Bu ekrana yalnızca sistem yöneticileri erişebilir.
        </div>
      </section>
    )
  }

  return (
    <section className="screen">
      <PageHeader
        title="Kurum Yönetimi"
        subtitle="Sistemde tanımlı tüm kurumlar ve kullanım istatistikleri"
        actions={
          <button type="button" className="btn btn-primary" onClick={handleOpenCreate}>
            <Plus size={16} /> Yeni Kurum Ekle
          </button>
        }
      />

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {loading ? (
          <div style={{ padding: 24, color: 'var(--ink-soft)' }}>Kurumlar yükleniyor…</div>
        ) : institutions.length === 0 ? (
          <div style={{ padding: 24, color: 'var(--ink-soft)' }}>Henüz kurum bulunmuyor.</div>
        ) : (
          institutions.map((inst) => (
            <div key={inst.id} className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Building2 size={18} style={{ color: 'var(--indigo-600)' }} />
                  {inst.name}
                </h3>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleOpenEdit(inst)}
                >
                  <Edit2 size={14} /> Düzenle
                </button>
              </div>

              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 16 }}>
                Slug: <code>{inst.slug}</code>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <GraduationCap size={16} style={{ color: 'var(--indigo-600)' }} />
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{inst.studentCount}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Kayıtlı Öğrenci</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Users size={16} style={{ color: 'var(--success-text)' }} />
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{inst.memberCount}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Kurum Üyesi</div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Ulusal Sınav Tarihleri Kartı (R1-3) */}
      <div className="card" style={{ marginTop: 24, padding: 20, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={18} style={{ color: 'var(--indigo-600)' }} /> Ulusal Sınav Tarihleri
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: '4px 0 0 0' }}>
              ÖSYM ve MEB tarafından açıklanan resmi sınav tarihlerini belirleyin. Öğrenci profillerinde kalan hafta ve net hızı sayaçlarını besler.
            </p>
          </div>
        </div>

        {calendarError && (
          <div className="alert alert-error" style={{ marginBottom: 12 }}>
            {calendarError}
          </div>
        )}
        {calendarSaved && (
          <div className="alert alert-success" style={{ marginBottom: 12 }}>
            Sınav tarihleri başarıyla güncellendi.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, alignItems: 'flex-end' }}>
          <div className="field">
            <label style={{ fontWeight: 700, fontSize: 12 }}>YKS Sınav Tarihi</label>
            <input
              type="date"
              value={yksDate}
              onChange={(e) => setYksDate(e.target.value)}
              style={{ padding: '8px 10px', fontSize: 13 }}
            />
          </div>
          <div className="field">
            <label style={{ fontWeight: 700, fontSize: 12 }}>LGS Sınav Tarihi</label>
            <input
              type="date"
              value={lgsDate}
              onChange={(e) => setLgsDate(e.target.value)}
              style={{ padding: '8px 10px', fontSize: 13 }}
            />
          </div>
          <div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveCalendar}
              disabled={savingCalendar}
              style={{ height: 38, padding: '0 16px' }}
            >
              {savingCalendar ? 'Kaydediliyor…' : 'Tarihleri Kaydet'}
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2>{editingInst ? 'Kurumu Düzenle' : 'Yeni Kurum Ekle'}</h2>
              <button type="button" className="btn-icon" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="form">
              <div className="field">
                <label>Kurum Adı</label>
                <input
                  type="text"
                  placeholder="Örn: Konsept Akademi"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="field">
                <label>Kurum Slug (Opsiyonel)</label>
                <input
                  type="text"
                  placeholder="Örn: concept-akademi"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                >
                  İptal
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Kaydediliyor…' : editingInst ? 'Güncelle' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
