import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Building2, Users, GraduationCap, Edit2, X } from 'lucide-react'
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
                  <Building2 size={18} style={{ color: 'var(--brand)' }} />
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
                  <GraduationCap size={16} style={{ color: 'var(--brand)' }} />
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
                  placeholder="Örn: Concept Akademi"
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
