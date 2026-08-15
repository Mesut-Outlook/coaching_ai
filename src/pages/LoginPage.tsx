import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { isSupabaseConfigured } from '../lib/supabase'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState(() => {
    return localStorage.getItem('remembered_email') || ''
  })
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(() => {
    return Boolean(localStorage.getItem('remembered_email'))
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    if (rememberMe) {
      localStorage.setItem('remembered_email', email)
    } else {
      localStorage.removeItem('remembered_email')
    }

    const { error: signInError } = await signIn(email, password)
    setSubmitting(false)
    if (signInError) {
      setError(signInError === 'Invalid login credentials' ? 'E-posta veya şifre hatalı.' : signInError)
      return
    }
    navigate('/panel', { replace: true })
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
      <div className="card" style={{ width: '100%', maxWidth: 380, padding: '36px 32px' }}>
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
            <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Eda Cangert · YKS Koçluk</div>
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
            Supabase henüz bağlı değil. <code>.env.example</code> dosyasını{' '}
            <code>.env.local</code> olarak kopyalayıp proje URL'ini ve anon anahtarını gir.
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="field">
            <label htmlFor="email">E-posta</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="eda@netlik.app"
            />
          </div>
          <div className="field">
            <label htmlFor="password">Şifre</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: -4 }}>
            <input
              id="rememberMe"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ cursor: 'pointer', width: 16, height: 16 }}
            />
            <label
              htmlFor="rememberMe"
              style={{
                fontSize: 13,
                cursor: 'pointer',
                color: 'var(--ink-soft)',
                margin: 0,
                fontWeight: 400,
                userSelect: 'none'
              }}
            >
              Beni Hatırla
            </label>
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
            {submitting ? 'Giriş yapılıyor…' : 'Giriş Yap'}
          </button>

          <div style={{ textAlign: 'center', marginTop: 8, fontSize: 13 }}>
            <span style={{ color: 'var(--ink-soft)' }}>Davetiyeniz var mı? </span>
            <Link to="/kayit" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
              Kayıt Ol
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
