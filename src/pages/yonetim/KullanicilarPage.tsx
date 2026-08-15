import { useEffect, useState, type FormEvent } from 'react'
import { Plus, UserCheck, Mail, Shield, Trash2, Edit2, Share2, Check, Copy, X } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useAccess } from '../../contexts/useAccess'
import PageHeader from '../../components/layout/PageHeader'
import type { Membership, Invitation, Role, Profile } from '../../types/database'
import { openWhatsAppChat } from '../../lib/whatsapp'

type MemberWithDetails = Membership & {
  profiles: Profile | null
  roles: Role | null
}

type InvitationWithRole = Invitation & {
  roles: Role | null
}

export default function KullanicilarPage() {
  const { user } = useAuth()
  const { activeInstitutionId, isSystemAdmin } = useAccess()

  const [members, setMembers] = useState<MemberWithDetails[]>([])
  const [invitations, setInvitations] = useState<InvitationWithRole[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRoleId, setInviteRoleId] = useState('')
  const [submittingInvite, setSubmittingInvite] = useState(false)
  const [inviteResultLink, setInviteResultLink] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  // Edit Role modal state
  const [editingMember, setEditingMember] = useState<MemberWithDetails | null>(null)
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [updatingRole, setUpdatingRole] = useState(false)

  const loadData = async () => {
    if (!isSupabaseConfigured || (!activeInstitutionId && !isSystemAdmin)) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)

    try {
      const [membersRes, invitesRes, rolesRes] = await Promise.all([
        supabase
          .from('memberships')
          .select('*, profiles(*), roles(*)')
          .eq('institution_id', activeInstitutionId!),
        supabase
          .from('invitations')
          .select('*, roles(*)')
          .eq('institution_id', activeInstitutionId!)
          .eq('status', 'bekliyor'),
        supabase
          .from('roles')
          .select('*')
          .or(`institution_id.eq.${activeInstitutionId},institution_id.is.null`)
          .order('name'),
      ])

      if (membersRes.error) throw membersRes.error
      if (invitesRes.error) throw invitesRes.error
      if (rolesRes.error) throw rolesRes.error

      setMembers((membersRes.data as any) || [])
      setInvitations((invitesRes.data as any) || [])
      setRoles(rolesRes.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Veriler yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [activeInstitutionId])

  const handleSendInvite = async (e: FormEvent) => {
    e.preventDefault()
    if (!user || !activeInstitutionId || !inviteEmail.trim() || !inviteRoleId) return

    setSubmittingInvite(true)
    setError(null)

    try {
      const email = inviteEmail.trim().toLowerCase()
      const { error } = await supabase
        .from('invitations')
        .insert({
          institution_id: activeInstitutionId,
          email,
          role_id: inviteRoleId,
          invited_by: user.id,
          status: 'bekliyor',
          accepted_by: null,
          accepted_at: null,
        })

      if (error) throw error

      const link = `${window.location.origin}/kayit?email=${encodeURIComponent(email)}`
      setInviteResultLink(link)
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Davet oluşturulamadı.')
    } finally {
      setSubmittingInvite(false)
    }
  }

  const handleCancelInvite = async (inviteId: string) => {
    if (!confirm('Bu daveti iptal etmek istediğinize emin misiniz?')) return
    try {
      const { error } = await supabase
        .from('invitations')
        .update({ status: 'iptal' })
        .eq('id', inviteId)
      if (error) throw error
      loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Davet iptal edilemedi.')
    }
  }

  const handleToggleMemberStatus = async (member: MemberWithDetails) => {
    const actionText = member.is_active ? 'pasifleştirmek' : 'aktifleştirmek'
    if (!confirm(`Kullanıcıyı ${actionText} istediğinize emin misiniz?`)) return

    try {
      const { error } = await supabase
        .from('memberships')
        .update({ is_active: !member.is_active })
        .eq('id', member.id)
      if (error) throw error
      loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Durum güncellenemedi.')
    }
  }

  const handleUpdateRole = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingMember || !selectedRoleId) return

    setUpdatingRole(true)
    try {
      const { error } = await supabase
        .from('memberships')
        .update({ role_id: selectedRoleId })
        .eq('id', editingMember.id)

      if (error) throw error
      setEditingMember(null)
      loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Rol güncellenemedi.')
    } finally {
      setUpdatingRole(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  if (!activeInstitutionId && !isSystemAdmin) {
    return (
      <section className="screen">
        <PageHeader title="Kullanıcı Yönetimi" subtitle="Kurum Üyeleri & Davetler" />
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          Lütfen kullanıcıları yönetmek için sidebar'dan bir kurum seçin.
        </div>
      </section>
    )
  }

  return (
    <section className="screen">
      <PageHeader
        title="Kullanıcı Yönetimi"
        subtitle={`${members.length} aktif/pasif üye, ${invitations.length} bekleyen davet`}
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setShowInviteModal(true)
              setInviteEmail('')
              setInviteRoleId(roles[0]?.id || '')
              setInviteResultLink(null)
            }}
          >
            <Plus size={16} /> Yeni Kullanıcı Davet Et
          </button>
        }
      />

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Bekleyen Davetler */}
      {invitations.length > 0 && (
        <div className="card" style={{ padding: 20, marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Mail size={18} style={{ color: 'var(--brand)' }} /> Bekleyen Davetiyeler
          </h3>

          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>E-posta</th>
                  <th>Atanan Rol</th>
                  <th>Tarih</th>
                  <th style={{ textAlign: 'right' }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv) => {
                  const inviteUrl = `${window.location.origin}/kayit?email=${encodeURIComponent(inv.email)}`
                  return (
                    <tr key={inv.id}>
                      <td style={{ fontWeight: 500 }}>{inv.email}</td>
                      <td>
                        <span className="badge badge-neutral">
                          {inv.roles?.name || 'Rol atamasız'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--ink-soft)', fontSize: 13 }}>
                        {new Date(inv.created_at).toLocaleDateString('tr-TR')}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            title="Bağlantıyı Kopyala"
                            onClick={() => copyToClipboard(inviteUrl)}
                          >
                            <Copy size={14} /> Kopyala
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            title="WhatsApp ile Gönder"
                            onClick={() =>
                              openWhatsAppChat(
                                '',
                                `Merhaba, Netlik Koçluk sistemine davet edildiniz. Kayıt olmak için bağlantı: ${inviteUrl}`
                              )
                            }
                          >
                            <Share2 size={14} /> WhatsApp
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--critical-text)' }}
                            onClick={() => handleCancelInvite(inv.id)}
                          >
                            <Trash2 size={14} /> İptal Et
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Üye Listesi */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserCheck size={18} style={{ color: 'var(--brand)' }} /> Kurum Üyeleri
        </h3>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-soft)' }}>Yükleniyor…</div>
        ) : members.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-soft)' }}>
            Bu kurumda henüz kayıtlı üye bulunmuyor.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Kullanıcı</th>
                  <th>Rol</th>
                  <th>Durum</th>
                  <th style={{ textAlign: 'right' }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: 'var(--surface-sunken)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 600,
                            fontSize: 13,
                          }}
                        >
                          {m.profiles?.full_name ? m.profiles.full_name.charAt(0).toUpperCase() : '?'}
                        </div>
                        <span style={{ fontWeight: 500 }}>{m.profiles?.full_name || 'İsimsiz Üye'}</span>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-primary">
                        <Shield size={12} style={{ marginRight: 4 }} />
                        {m.roles?.name || 'Varsayılan'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${m.is_active ? 'badge-success' : 'badge-neutral'}`}>
                        {m.is_active ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setEditingMember(m)
                            setSelectedRoleId(m.role_id)
                          }}
                        >
                          <Edit2 size={14} /> Rol Değiştir
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ color: m.is_active ? 'var(--critical-text)' : 'var(--success-text)' }}
                          onClick={() => handleToggleMemberStatus(m)}
                        >
                          {m.is_active ? 'Pasifleştir' : 'Aktifleştir'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Davet Modalı */}
      {showInviteModal && (
        <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h2>Kullanıcı Davet Et</h2>
              <button type="button" className="btn-icon" onClick={() => setShowInviteModal(false)}>
                <X size={18} />
              </button>
            </div>

            {inviteResultLink ? (
              <div style={{ padding: 16 }}>
                <div className="alert alert-success" style={{ marginBottom: 16 }}>
                  Davetiye oluşturuldu!
                </div>
                <div className="field">
                  <label>Kayıt Bağlantısı</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="text" readOnly value={inviteResultLink} style={{ flex: 1 }} />
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => copyToClipboard(inviteResultLink)}
                    >
                      {copiedLink ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ flex: 1 }}
                    onClick={() => setShowInviteModal(false)}
                  >
                    Kapat
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={() =>
                      openWhatsAppChat(
                        '',
                        `Merhaba, Netlik Koçluk sistemine davet edildiniz. Kayıt linkiniz: ${inviteResultLink}`
                      )
                    }
                  >
                    <Share2 size={16} /> WhatsApp ile Gönder
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSendInvite} className="form">
                <div className="field">
                  <label>E-posta Adresi</label>
                  <input
                    type="email"
                    placeholder="ornek@email.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="field">
                  <label>Atanacak Rol</label>
                  <select
                    value={inviteRoleId}
                    onChange={(e) => setInviteRoleId(e.target.value)}
                    required
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setShowInviteModal(false)}
                    disabled={submittingInvite}
                  >
                    İptal
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={submittingInvite}>
                    {submittingInvite ? 'Davet Oluşturuluyor…' : 'Davet Oluştur'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Rol Değiştirme Modalı */}
      {editingMember && (
        <div className="modal-overlay" onClick={() => setEditingMember(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2>Rol Değiştir</h2>
              <button type="button" className="btn-icon" onClick={() => setEditingMember(null)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateRole} className="form">
              <p style={{ fontSize: 14, marginBottom: 16 }}>
                <strong>{editingMember.profiles?.full_name}</strong> için yeni rol seçin:
              </p>

              <div className="field">
                <label>Yeni Rol</label>
                <select
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                  required
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setEditingMember(null)}
                  disabled={updatingRole}
                >
                  İptal
                </button>
                <button type="submit" className="btn btn-primary" disabled={updatingRole}>
                  {updatingRole ? 'Güncelleniyor…' : 'Güncelle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
