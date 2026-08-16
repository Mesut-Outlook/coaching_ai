import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import AuthShell from '../components/auth/AuthShell'

export default function RegisterPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Davet doğrulaması. Token yoksa/geçersizse form hiç gösterilmez: bu araç
  // davetle çalışır, açık kayıt ucu istemiyoruz.
  const [inviteState, setInviteState] = useState<'kontrol' | 'gecerli' | 'gecersiz'>('kontrol')
  const [inviteInfo, setInviteInfo] = useState<{ institution_name: string; role_name: string } | null>(null)

  useEffect(() => {
    const token = searchParams.get('token')

    if (!isSupabaseConfigured) {
      setInviteState('gecersiz')
      return
    }
    if (!token) {
      setInviteState('gecersiz')
      return
    }

    let iptal = false
    ;(async () => {
      const { data, error: rpcError } = await supabase.rpc('invitation_by_token', { p_token: token })
      if (iptal) return

      const res = data as unknown as {
        ok: boolean
        email?: string
        institution_name?: string
        role_name?: string
      } | null

      if (rpcError || !res?.ok || !res.email) {
        setInviteState('gecersiz')
        return
      }

      setEmail(res.email)
      setInviteInfo({
        institution_name: res.institution_name ?? '',
        role_name: res.role_name ?? '',
      })
      setInviteState('gecerli')
    })()

    return () => {
      iptal = true
    }
  }, [searchParams])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)

    if (password !== confirmPassword) {
      setError('Şifreler eşleşmiyor.')
      return
    }

    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır.')
      return
    }

    setSubmitting(true)

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      })

      if (signUpError) {
        let msg = signUpError.message
        if (msg.includes('User already registered')) {
          msg = 'Bu e-posta adresi ile zaten bir hesap oluşturulmuş. Lütfen giriş yapın.'
        }
        setError(msg)
        return
      }

      if (data.session) {
        // Otomatik giriş sağlandı
        navigate('/panel', { replace: true })
      } else {
        // E-posta onayı bekliyor olabilir
        setSuccessMsg('Kayıt işleminiz tamamlandı! Davetiyeniz hesabınızla eşleştirildi. Lütfen e-postanızı onayladıktan sonra giriş yapın.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kayıt sırasında bir hata oluştu.')
    } finally {
      setSubmitting(false)
    }
  }

  // Davet doğrulanmadan form gösterilmiyor.
  if (inviteState !== 'gecerli') {
    return (
      <AuthShell
        title={inviteState === 'kontrol' ? 'Davet kontrol ediliyor…' : 'Geçersiz davet bağlantısı'}
        subtitle={
          inviteState === 'kontrol'
            ? undefined
            : 'Bu bağlantı geçersiz, süresi dolmuş ya da davet zaten kullanılmış olabilir.'
        }
      >
        {inviteState === 'gecersiz' && (
          <>
            <div className="alert alert-error" style={{ marginBottom: 16 }}>
              Kayıt olabilmek için kurum yöneticinden yeni bir davet bağlantısı iste.
            </div>
            <Link to="/login" className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }}>
              Girişe dön
            </Link>
          </>
        )}
      </AuthShell>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--paper)',
        padding: 24,
      }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: '36px 32px' }}>
        {inviteInfo && (
          <div className="alert alert-success" style={{ marginBottom: 18 }}>
            <strong>{inviteInfo.institution_name}</strong> kurumuna{' '}
            <strong>{inviteInfo.role_name}</strong> olarak davet edildin.
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 28 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: '#F6EFDD',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 10px -2px rgba(0,0,0,0.2)',
            }}
          >
            <img src="/logo.png" alt="" width={48} height={48} style={{ width: '118%', height: '118%', objectFit: 'cover' }} />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-disp)', fontWeight: 700, fontSize: 17 }}>Netlik</div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Davet ile Kayıt Ol</div>
          </div>
        </div>

        {!isSupabaseConfigured && (
          <div
            style={{
              background: 'var(--warning-bg)',
              color: 'var(--warning-text)',
              fontSize: 12.5,
              padding: '10px 12px',
              borderRadius: 9,
              marginBottom: 18,
              lineHeight: 1.5,
            }}
          >
            Supabase henüz bağlı değil.
          </div>
        )}

        {successMsg ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              style={{
                background: 'var(--success-bg, rgba(46, 125, 50, 0.1))',
                color: 'var(--success-text, #2e7d32)',
                fontSize: 13.5,
                padding: '14px 16px',
                borderRadius: 9,
                lineHeight: 1.5,
              }}
            >
              {successMsg}
            </div>
            <Link
              to="/login"
              className="btn btn-primary"
              style={{ justifyContent: 'center', textDecoration: 'none' }}
            >
              Giriş Sayfasına Git
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="field">
              <label htmlFor="fullName">Ad Soyad</label>
              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ahmet Yılmaz"
              />
            </div>
            <div className="field">
              <label htmlFor="email">E-posta</label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ahmet@example.com"
              />
            </div>
            <div className="field">
              <label htmlFor="password">Şifre</label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="field">
              <label htmlFor="confirmPassword">Şifre Tekrar</label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p style={{ color: 'var(--critical-text)', fontSize: 12.5, margin: 0 }}>{error}</p>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ justifyContent: 'center', marginTop: 4 }}
            >
              {submitting ? 'Kayıt Yapılıyor…' : 'Kayıt Ol'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 8, fontSize: 13 }}>
              <span style={{ color: 'var(--ink-soft)' }}>Zaten hesabınız var mı? </span>
              <Link to="/login" style={{ color: 'var(--indigo-600)', textDecoration: 'none', fontWeight: 500 }}>
                Giriş Yap
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
