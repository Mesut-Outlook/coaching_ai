import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { isSupabaseConfigured } from '../lib/supabase'
import { Target } from 'lucide-react'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
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
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'linear-gradient(155deg, var(--indigo-500), var(--indigo-700))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Target size={21} color="#fff" strokeWidth={1.8} />
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
        </form>
      </div>
    </div>
  )
}
