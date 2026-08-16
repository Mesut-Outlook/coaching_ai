import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Shield, Lock, Edit2, Trash2, X } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { useAccess } from '../../contexts/useAccess'
import PageHeader from '../../components/layout/PageHeader'
import { PERMISSION_GROUPS, type PermissionKey } from '../../lib/permissions'
import type { Role } from '../../types/database'

export default function RollerPage() {
  const { activeInstitutionId } = useAccess()

  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Role Modal State (Create or Edit)
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [roleName, setRoleName] = useState('')
  const [roleKey, setRoleKey] = useState('')
  const [selectedPermissions, setSelectedPermissions] = useState<PermissionKey[]>([])
  const [saving, setSaving] = useState(false)

  const loadRoles = async () => {
    // "Tümü" seçiliyken hedef kurum yok: sorgu atma. activeInstitutionId null iken
    // şablon dizeye gömülürse PostgREST'e "institution_id.eq.null" gider ve uuid
    // sütununda 22P02 ile patlar — tüm liste boş görünür.
    if (!isSupabaseConfigured || !activeInstitutionId) {
      setRoles([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .or(`institution_id.eq.${activeInstitutionId},institution_id.is.null`)
        .order('is_system', { ascending: false })
        .order('name')

      if (error) throw error
      setRoles(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Roller yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRoles()
  }, [activeInstitutionId])

  const handleOpenCreate = () => {
    setEditingRole(null)
    setRoleName('')
    setRoleKey('')
    setSelectedPermissions([])
    setShowRoleModal(true)
  }

  const handleOpenEdit = (role: Role) => {
    if (role.is_system) return
    setEditingRole(role)
    setRoleName(role.name)
    setRoleKey(role.key)
    setSelectedPermissions((role.permissions as PermissionKey[]) || [])
    setShowRoleModal(true)
  }

  const handleCopyFromTemplate = (templateRoleId: string) => {
    const tmpl = roles.find((r) => r.id === templateRoleId)
    if (tmpl) {
      setSelectedPermissions([...((tmpl.permissions as PermissionKey[]) || [])])
    }
  }

  const togglePermission = (key: PermissionKey) => {
    setSelectedPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    )
  }

  const toggleGroup = (keys: PermissionKey[]) => {
    const allSelected = keys.every((k) => selectedPermissions.includes(k))
    if (allSelected) {
      setSelectedPermissions((prev) => prev.filter((k) => !keys.includes(k)))
    } else {
      const next = new Set([...selectedPermissions, ...keys])
      setSelectedPermissions(Array.from(next))
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!roleName.trim()) {
      setError('Rol adı zorunlu.')
      return
    }
    // Sistem admini de dahil: kurum seçilmeden kayıt açılırsa institution_id null gider
    // ve kuruma özel rol yerine yeni bir sistem şablonu yaratılmış olur.
    if (!activeInstitutionId) {
      setError('Rol oluşturmak için bir kurum seçmelisiniz.')
      return
    }

    setSaving(true)
    setError(null)

    const key = roleKey.trim().toLowerCase().replace(/\s+/g, '_') || roleName.trim().toLowerCase().replace(/\s+/g, '_')

    try {
      if (editingRole) {
        const { error } = await supabase
          .from('roles')
          .update({
            name: roleName.trim(),
            key,
            permissions: selectedPermissions,
          })
          .eq('id', editingRole.id)

        if (error) throw error
      } else {
        const { error } = await supabase.from('roles').insert({
          institution_id: activeInstitutionId,
          name: roleName.trim(),
          key,
          permissions: selectedPermissions,
          is_system: false,
        })

        if (error) throw error
      }

      setShowRoleModal(false)
      loadRoles()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rol kaydedilemedi.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRole = async (role: Role) => {
    if (role.is_system) return
    if (!confirm(`"${role.name}" rolünü silmek istediğinize emin misiniz?`)) return

    try {
      const { error } = await supabase.from('roles').delete().eq('id', role.id)
      if (error) throw error
      loadRoles()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Rol silinemedi.')
    }
  }

  return (
    <section className="screen">
      <PageHeader
        title="Rol & İzin Yönetimi"
        subtitle="Kuruma özel veya sistem şablonu roller"
        actions={
          <button type="button" className="btn btn-primary" onClick={handleOpenCreate}>
            <Plus size={16} /> Yeni Rol Oluştur
          </button>
        }
      />

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {!activeInstitutionId && (
        <div className="card" style={{ padding: 24, color: 'var(--ink-soft)' }}>
          Roller kuruma özeldir. Devam etmek için sol menünün üstündeki kurum seçicisinden bir kurum seçin.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {loading ? (
          <div style={{ padding: 24, color: 'var(--ink-soft)' }}>Roller yükleniyor…</div>
        ) : (
          roles.map((role) => (
            <div key={role.id} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Shield size={16} style={{ color: role.is_system ? 'var(--indigo-600)' : 'var(--success-text)' }} />
                    {role.name}
                  </h3>
                  {role.is_system ? (
                    <span className="badge badge-neutral" style={{ fontSize: 11 }}>
                      <Lock size={10} style={{ marginRight: 4 }} /> Sistem Şablonu
                    </span>
                  ) : (
                    <span className="badge badge-primary" style={{ fontSize: 11 }}>
                      Özel Rol
                    </span>
                  )}
                </div>

                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-faint)', marginBottom: 8 }}>
                  {role.permissions?.length || 0} Yetki Tanımlı:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 100, overflowY: 'auto' }}>
                  {role.permissions?.map((p) => (
                    <span key={p} className="badge badge-subtle" style={{ fontSize: 11 }}>
                      {p}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                {!role.is_system && (
                  <>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleOpenEdit(role)}>
                      <Edit2 size={14} /> Düzenle
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--critical-text)' }}
                      onClick={() => handleDeleteRole(role)}
                    >
                      <Trash2 size={14} /> Sil
                    </button>
                  </>
                )}
                {role.is_system && (
                  <span style={{ fontSize: 12, color: 'var(--ink-soft)', alignSelf: 'center' }}>
                    Salt-okunur
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Rol Oluşturma / Düzenleme Modalı */}
      {showRoleModal && (
        <div className="modal-overlay" onClick={() => setShowRoleModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h2>{editingRole ? 'Rolü Düzenle' : 'Yeni Rol Oluştur'}</h2>
              <button type="button" className="btn-icon" onClick={() => setShowRoleModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="form">
              {!editingRole && (
                <div className="field">
                  <label>Şablondan Kopyala (Opsiyonel)</label>
                  <select onChange={(e) => handleCopyFromTemplate(e.target.value)} defaultValue="">
                    <option value="">-- Şablon Seçin --</option>
                    {roles
                      .filter((r) => r.is_system)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} izinlerini kopyala ({r.permissions?.length} izin)
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label>Rol Adı</label>
                  <input
                    type="text"
                    placeholder="Örn: Etüt Görevlisi"
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="field">
                  <label>Rol Anahtarı (Key)</label>
                  <input
                    type="text"
                    placeholder="Örn: etut_gorevlisi"
                    value={roleKey}
                    onChange={(e) => setRoleKey(e.target.value)}
                  />
                </div>
              </div>

              <div className="field">
                <label style={{ marginBottom: 8, fontWeight: 600 }}>İzin Matrisi</label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
                  {PERMISSION_GROUPS.map((group) => {
                    const groupKeys = group.permissions.map((p) => p.key)
                    const allSelected = groupKeys.every((k) => selectedPermissions.includes(k))
                    return (
                      <div
                        key={group.group_key}
                        style={{
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          padding: 12,
                          background: 'var(--surface-alt)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{group.group_label}</span>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 11, padding: '2px 8px' }}
                            onClick={() => toggleGroup(groupKeys)}
                          >
                            {allSelected ? 'Tümünü Kaldır' : 'Tümünü Seç'}
                          </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                          {group.permissions.map((perm) => {
                            const checked = selectedPermissions.includes(perm.key)
                            return (
                              <label
                                key={perm.key}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  fontSize: 12,
                                  cursor: 'pointer',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => togglePermission(perm.key)}
                                  style={{ width: 14, height: 14 }}
                                />
                                <span>{perm.label}</span>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowRoleModal(false)}
                  disabled={saving}
                >
                  İptal
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Kaydediliyor…' : editingRole ? 'Güncelle' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
