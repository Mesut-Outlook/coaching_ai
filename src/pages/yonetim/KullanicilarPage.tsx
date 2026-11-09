import { useEffect, useState, type FormEvent } from 'react'
import { Plus, UserCheck, Mail, Shield, Trash2, Edit2, Share2, Check, Copy, X, KeyRound, UserMinus } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useAccess } from '../../contexts/useAccess'
import PageHeader from '../../components/layout/PageHeader'
import type { Membership, Invitation, Role, Profile } from '../../types/database'
import { openWhatsAppChat } from '../../lib/whatsapp'
import { WHATSAPP_SIGNATURE } from '../../lib/brand'

// Tarayıcının type="email" denetimi "ad.@gmail.com" gibi adresleri geçiriyor (2026-11-06 canlıda bir davet böyle takıldı).
// Yerel kısım ve alan adı noktayla başlayamaz/bitemez, iki nokta yan yana olamaz.
const EMAIL_RE = /^[^\s@.]+(\.[^\s@.]+)*@[^\s@.]+(\.[^\s@.]+)+$/

type MemberWithDetails = Membership & {
  profiles: Profile | null
  roles: Role | null
}

type InvitationWithRole = Invitation & {
  roles: Role | null
}

type MembershipWithRole = Membership & { roles: Pick<Role, 'name'> | null }

type AuthInfo = { email: string; email_confirmed_at: string | null; last_sign_in_at: string | null }

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('tr-TR')

/** Supabase auth hatalarını kullanıcıya anlaşılır söyle; en sık olanı mail sınırı. */
const authErrorText = (msg: string) =>
  /rate limit|security purposes|too many/i.test(msg)
    ? 'Kısa sürede çok fazla e-posta istendi. Birkaç dakika sonra tekrar deneyin.'
    : msg

/** kurum id → rol id; kurum anahtarı yoksa o kurumda yetkisi yok */
type AccessDraft = Record<string, string>

type InstitutionOption = { institution_id: string; institution_name: string }

/** Hangi kurumda, hangi rolle: davet ve "Kurum ve Rol" pencerelerinin ortak listesi. */
function InstitutionAccessPicker({
  institutions,
  rolesFor,
  value,
  onChange,
  lockedIds = [],
}: {
  institutions: InstitutionOption[]
  rolesFor: (institutionId: string) => Role[]
  value: AccessDraft
  onChange: (next: AccessDraft) => void
  /** İşareti kaldırılamayan kurumlar (kişinin kendi üyeliği — kendini dışarıda bırakmasın) */
  lockedIds?: string[]
}) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {institutions.map((inst) => {
        const roleId = value[inst.institution_id]
        const checked = roleId !== undefined
        const options = rolesFor(inst.institution_id)
        return (
          <div key={inst.institution_id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 160px', fontWeight: 500 }}>
              <input
                type="checkbox"
                checked={checked}
                disabled={checked && lockedIds.includes(inst.institution_id)}
                onChange={(e) => {
                  const next = { ...value }
                  if (e.target.checked) next[inst.institution_id] = options[0]?.id ?? ''
                  else delete next[inst.institution_id]
                  onChange(next)
                }}
              />
              {inst.institution_name}
            </label>
            <select
              style={{ flex: '1 1 160px' }}
              value={roleId ?? ''}
              disabled={!checked}
              onChange={(e) => onChange({ ...value, [inst.institution_id]: e.target.value })}
              aria-label={`${inst.institution_name} rolü`}
            >
              {!checked && <option value="">Yetkisi yok</option>}
              {options.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        )
      })}
    </div>
  )
}

export default function KullanicilarPage() {
  const { user } = useAuth()
  const { activeInstitutionId, memberships: myMemberships, isSystemAdmin } = useAccess()

  // Yalnız üye yönetme yetkisi olan kurumlar seçilebilir; sunucu da aynısını denetler.
  const manageable: InstitutionOption[] = myMemberships.filter(
    (m) => isSystemAdmin || m.permissions.includes('members.manage')
  )
  const manageableKey = manageable.map((m) => m.institution_id).join(',')
  const institutionName = (id: string) =>
    myMemberships.find((m) => m.institution_id === id)?.institution_name ?? 'Kurum'
  const activeInstitutionName = activeInstitutionId ? institutionName(activeInstitutionId) : ''

  const [members, setMembers] = useState<MemberWithDetails[]>([])
  const [invitations, setInvitations] = useState<InvitationWithRole[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  // Listedeki kişilerin tüm kurumlardaki üyelikleri (görebildiğimiz kurumlar)
  const [accessByUser, setAccessByUser] = useState<Record<string, MembershipWithRole[]>>({})
  // user_id → e-posta, onay ve son giriş (member_auth_info; SQL çalıştırılmadıysa boş kalır)
  const [authInfo, setAuthInfo] = useState<Record<string, AuthInfo>>({})
  const [showInactive, setShowInactive] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteDraft, setInviteDraft] = useState<AccessDraft>({})
  const [submittingInvite, setSubmittingInvite] = useState(false)
  const [inviteResultLink, setInviteResultLink] = useState<string | null>(null)
  const [inviteResultNote, setInviteResultNote] = useState<string | null>(null)
  const [invitePendingNames, setInvitePendingNames] = useState('')
  const [copiedLink, setCopiedLink] = useState(false)

  // Kurum ve Rol modal state
  const [editingMember, setEditingMember] = useState<MemberWithDetails | null>(null)
  const [accessDraft, setAccessDraft] = useState<AccessDraft>({})
  const [updatingRole, setUpdatingRole] = useState(false)

  const rolesFor = (institutionId: string) =>
    roles.filter((r) => r.institution_id === institutionId || r.institution_id === null)

  const loadData = async () => {
    // "Tümü" seçiliyken hedef kurum yok: sorgu atma. activeInstitutionId null iken
    // .eq()/.or() PostgREST'e "institution_id.eq.null" gönderir ve uuid sütununda
    // 22P02 ile patlar — üye listesi de rol açılır listesi de sessizce boş kalır.
    if (!isSupabaseConfigured || !activeInstitutionId) {
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
          .or(`institution_id.in.(${[activeInstitutionId, ...manageable.map((m) => m.institution_id)].join(',')}),institution_id.is.null`)
          .order('name'),
      ])

      if (membersRes.error) throw membersRes.error
      if (invitesRes.error) throw invitesRes.error
      if (rolesRes.error) throw rolesRes.error

      const memberRows: MemberWithDetails[] = (membersRes.data as any) || []
      const userIds = memberRows.map((m) => m.user_id)
      const accessRes = userIds.length
        ? await supabase.from('memberships').select('*, roles(name)').in('user_id', userIds)
        : { data: [], error: null }
      if (accessRes.error) throw accessRes.error

      const byUser: Record<string, MembershipWithRole[]> = {}
      for (const row of (accessRes.data as MembershipWithRole[]) || []) {
        ;(byUser[row.user_id] ??= []).push(row)
      }

      // Yeni RPC henüz canlıda yoksa liste e-postasız çalışmaya devam etsin.
      const infoRes = await supabase.rpc('member_auth_info', { p_institution: activeInstitutionId! })
      const info: Record<string, AuthInfo> = {}
      for (const r of infoRes.data ?? []) info[r.user_id] = r

      setAuthInfo(info)
      setMembers(memberRows)
      setInvitations((invitesRes.data as any) || [])
      setRoles(rolesRes.data || [])
      setAccessByUser(byUser)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Veriler yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [activeInstitutionId, manageableKey])

  const handleSendInvite = async (e: FormEvent) => {
    e.preventDefault()
    // Eskiden burada koşulsuz `return` vardı: rol listesi boş geldiğinde inviteRoleId de
    // boş kalıyor, "Davet Gönder" hiçbir şey yapmadan sessizce düşüyordu — ekranda ne hata
    // ne davet. Sebebi kullanıcıya söyle.
    if (!user || !activeInstitutionId) {
      setError('Davet göndermek için önce bir kurum seçin.')
      return
    }
    if (!inviteEmail.trim()) {
      setError('E-posta adresi zorunlu.')
      return
    }
    if (!EMAIL_RE.test(inviteEmail.trim())) {
      setError('E-posta adresi geçersiz görünüyor. "@" işaretinin iki yanını, nokta ve boşlukları kontrol edin (ör. "ad.@gmail.com" olmaz).')
      return
    }
    const targets = Object.entries(inviteDraft)
    if (targets.length === 0) {
      setError('En az bir kurum seçin.')
      return
    }
    if (targets.some(([, roleId]) => !roleId)) {
      setError('Seçili her kurum için bir rol seçin. Rol listesi boşsa Roller ekranından rol tanımlayın.')
      return
    }

    setSubmittingInvite(true)
    setError(null)

    try {
      const email = inviteEmail.trim().toLowerCase()
      // Tek istekte: biri patlarsa (ör. o kurumda zaten bekleyen davet) hiçbiri yazılmaz.
      const { data: created, error } = await supabase
        .from('invitations')
        .insert(
          targets.map(([institution_id, role_id]) => ({
            institution_id,
            email,
            role_id,
            invited_by: user.id,
            status: 'bekliyor' as const,
            accepted_by: null,
            accepted_at: null,
          }))
        )
        .select('token, status, institution_id')

      if (error) throw error

      // Hesabı olan kişi sunucuda doğrudan eklenir ('kabul'); bağlantı yalnız yeni kişi için.
      const pending = (created || []).filter((c) => c.status === 'bekliyor')
      const accepted = (created || []).filter((c) => c.status === 'kabul')
      setInviteResultNote(
        accepted.length
          ? `Bu kişinin hesabı zaten var; ${accepted.map((c) => institutionName(c.institution_id)).join(' ve ')} kurumuna doğrudan eklendi.`
          : null
      )
      setInvitePendingNames(pending.map((c) => institutionName(c.institution_id)).join(' ve '))
      // Bağlantı token taşıyor: /kayit daveti doğrulayabiliyor ve davetsiz kişi hesap
      // açamıyor. Kayıt, aynı e-postaya giden bütün bekleyen davetleri birden kabul eder.
      // '' = sonuç ekranı, ama gönderilecek bağlantı yok (herkes doğrudan eklendi)
      setInviteResultLink(pending[0] ? `${window.location.origin}/kayit?token=${pending[0].token}` : '')
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

  const memberName = (m: MemberWithDetails) => m.profiles?.full_name || authInfo[m.user_id]?.email || 'Bu kişi'

  const handleSendPasswordReset = async (m: MemberWithDetails) => {
    const email = authInfo[m.user_id]?.email
    if (!email || !confirm(`${email} adresine şifre sıfırlama bağlantısı gönderilsin mi?`)) return
    setError(null)
    setNotice(null)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/sifre-sifirla`,
    })
    if (err) setError(authErrorText(err.message))
    else setNotice(`${email} adresine şifre sıfırlama bağlantısı gönderildi. Gelmezse spam klasörüne baksın.`)
  }

  const handleResendConfirmation = async (m: MemberWithDetails) => {
    const email = authInfo[m.user_id]?.email
    if (!email) return
    setError(null)
    setNotice(null)
    const { error: err } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/login` },
    })
    if (err) setError(authErrorText(err.message))
    else setNotice(`${email} adresine doğrulama e-postası yeniden gönderildi.`)
  }

  const handleRemoveMember = async (m: MemberWithDetails) => {
    if (!confirm(`${memberName(m)} ${activeInstitutionName} kurumundan çıkarılsın mı?\n\nHesabı ve öğrencileri silinmez; gerekirse yeniden davet edilebilir.`)) return
    setError(null)
    setNotice(null)
    const { data, error: err } = await supabase.rpc('remove_member', { p_membership: m.id })
    const res = data as { ok?: boolean; error?: string } | null
    if (err || !res?.ok) {
      setError(err?.message.includes('remove_member') ? 'Bu özellik için veritabanı güncellemesi henüz yapılmamış.' : (res?.error ?? err?.message ?? 'Kişi çıkarılamadı.'))
      return
    }
    setNotice(`${memberName(m)} kurumdan çıkarıldı.`)
    loadData()
  }

  const openAccessEditor = (m: MemberWithDetails) => {
    const draft: AccessDraft = {}
    for (const row of accessByUser[m.user_id] ?? []) {
      if (row.is_active && manageable.some((i) => i.institution_id === row.institution_id)) {
        draft[row.institution_id] = row.role_id
      }
    }
    setAccessDraft(draft)
    setEditingMember(m)
  }

  const handleUpdateAccess = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingMember) return
    if (Object.values(accessDraft).some((roleId) => !roleId)) {
      alert('Seçili her kurum için bir rol seçin.')
      return
    }

    setUpdatingRole(true)
    try {
      const existing = accessByUser[editingMember.user_id] ?? []
      for (const inst of manageable) {
        const roleId = accessDraft[inst.institution_id]
        const row = existing.find((r) => r.institution_id === inst.institution_id)
        let res: { error: unknown } | null = null
        if (roleId && !row) {
          res = await supabase
            .from('memberships')
            .insert({ institution_id: inst.institution_id, user_id: editingMember.user_id, role_id: roleId, is_active: true })
        } else if (roleId && row && (row.role_id !== roleId || !row.is_active)) {
          res = await supabase.from('memberships').update({ role_id: roleId, is_active: true }).eq('id', row.id)
        } else if (!roleId && row?.is_active) {
          // Silmek yerine pasifleştir: geri almak tek tık, geçmiş kaybolmaz.
          res = await supabase.from('memberships').update({ is_active: false }).eq('id', row.id)
        }
        if (res?.error) throw res.error
      }
      setEditingMember(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Kurum yetkileri güncellenemedi.')
    } finally {
      setUpdatingRole(false)
      loadData()
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  if (!activeInstitutionId) {
    return (
      <section className="screen">
        <PageHeader title="Kullanıcı Yönetimi" subtitle="Kurum Üyeleri & Davetler" />
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          Lütfen kullanıcıları yönetmek için sidebar'dan bir kurum seçin.
        </div>
      </section>
    )
  }

  const activeMembers = members.filter((m) => m.is_active)
  const inactiveCount = members.length - activeMembers.length
  const visibleMembers = showInactive ? members : activeMembers

  return (
    <section className="screen">
      <PageHeader
        title="Kullanıcı Yönetimi"
        subtitle={`${activeMembers.length} aktif üye${inactiveCount ? `, ${inactiveCount} pasif` : ''}, ${invitations.length} bekleyen davet`}
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setShowInviteModal(true)
              setInviteEmail('')
              setInviteDraft({ [activeInstitutionId]: rolesFor(activeInstitutionId)[0]?.id ?? '' })
              setInviteResultLink(null)
              setInviteResultNote(null)
            }}
          >
            <Plus size={16} /> Yeni Kullanıcı Davet Et
          </button>
        }
      />

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
      {notice && <div className="alert alert-success" style={{ marginBottom: 16 }}>{notice}</div>}

      {/* Bekleyen Davetler */}
      {invitations.length > 0 && (
        <div className="card" style={{ padding: 20, marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Mail size={18} style={{ color: 'var(--indigo-600)' }} /> Bekleyen Davetiyeler
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
                  const inviteUrl = `${window.location.origin}/kayit?token=${inv.token}`
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
                                `Merhaba, ${WHATSAPP_SIGNATURE} sisteminde ${activeInstitutionName} kurumuna davet edildiniz. Kayıt olmak için bağlantı: ${inviteUrl}`
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
          <UserCheck size={18} style={{ color: 'var(--indigo-600)' }} /> Kurum Üyeleri
          {inactiveCount > 0 && (
            <label style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 500, color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              Pasifleri göster ({inactiveCount})
            </label>
          )}
        </h3>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-soft)' }}>Yükleniyor…</div>
        ) : visibleMembers.length === 0 ? (
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
                  <th>Kurumlar</th>
                  <th>Durum</th>
                  <th style={{ textAlign: 'right' }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {visibleMembers.map((m) => {
                  const info = authInfo[m.user_id]
                  return (
                  <tr key={m.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: 'var(--surface-alt)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 600,
                            fontSize: 13,
                          }}
                        >
                          {m.profiles?.full_name ? m.profiles.full_name.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span style={{ fontWeight: 500 }}>{m.profiles?.full_name || 'İsimsiz Üye'}</span>
                          {info && (
                            <>
                              <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{info.email}</span>
                              <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {!info.email_confirmed_at && <span className="badge badge-warning">E-posta onaylanmadı</span>}
                                <span className="badge badge-subtle">
                                  {info.last_sign_in_at ? `Son giriş: ${formatDate(info.last_sign_in_at)}` : 'Hiç giriş yapmadı'}
                                </span>
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-primary">
                        <Shield size={12} style={{ marginRight: 4 }} />
                        {m.roles?.name || 'Varsayılan'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(accessByUser[m.user_id] ?? [])
                          .filter((a) => a.is_active)
                          .map((a) => (
                            <span key={a.id} className="badge badge-neutral" title={a.roles?.name ?? ''}>
                              {institutionName(a.institution_id)}
                            </span>
                          ))}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${m.is_active ? 'badge-success' : 'badge-neutral'}`}>
                        {m.is_active ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => openAccessEditor(m)}
                        >
                          <Edit2 size={14} /> Kurum ve Rol
                        </button>
                        {info && !info.email_confirmed_at && (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleResendConfirmation(m)}>
                            <Mail size={14} /> Onay maili
                          </button>
                        )}
                        {info && m.user_id !== user?.id && (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleSendPasswordReset(m)}>
                            <KeyRound size={14} /> Şifre linki
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ color: m.is_active ? 'var(--critical-text)' : 'var(--success-text)' }}
                          onClick={() => handleToggleMemberStatus(m)}
                        >
                          {m.is_active ? 'Pasifleştir' : 'Aktifleştir'}
                        </button>
                        {m.user_id !== user?.id && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--critical-text)' }}
                            onClick={() => handleRemoveMember(m)}
                          >
                            <UserMinus size={14} /> Kurumdan çıkar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  )
                })}
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

            {inviteResultLink !== null ? (
              <div style={{ padding: 16 }}>
                {inviteResultNote && (
                  <div className="alert alert-success" style={{ marginBottom: 16 }}>
                    {inviteResultNote}
                  </div>
                )}
                {inviteResultLink && (
                <>
                <div className="alert alert-success" style={{ marginBottom: 16 }}>
                  Davetiye oluşturuldu: {invitePendingNames}
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
                </>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ flex: 1 }}
                    onClick={() => setShowInviteModal(false)}
                  >
                    Kapat
                  </button>
                  {inviteResultLink && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={() =>
                      openWhatsAppChat(
                        '',
                        `Merhaba, ${WHATSAPP_SIGNATURE} sisteminde ${invitePendingNames} kurumuna davet edildiniz. Kayıt linkiniz: ${inviteResultLink}`
                      )
                    }
                  >
                    <Share2 size={16} /> WhatsApp ile Gönder
                  </button>
                  )}
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
                  <label>Kurum ve Rol</label>
                  <InstitutionAccessPicker
                    institutions={manageable}
                    rolesFor={rolesFor}
                    value={inviteDraft}
                    onChange={setInviteDraft}
                  />
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
              <h2>Kurum ve Rol</h2>
              <button type="button" className="btn-icon" onClick={() => setEditingMember(null)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateAccess} className="form">
              <p style={{ fontSize: 14, marginBottom: 16 }}>
                <strong>{editingMember.profiles?.full_name}</strong> hangi kurumda, hangi rolle yetkili?
                İşareti kaldırılan kurumda üyelik pasifleşir.
              </p>

              <InstitutionAccessPicker
                institutions={manageable}
                rolesFor={rolesFor}
                value={accessDraft}
                onChange={setAccessDraft}
                lockedIds={editingMember.user_id === user?.id ? manageable.map((i) => i.institution_id) : []}
              />

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
