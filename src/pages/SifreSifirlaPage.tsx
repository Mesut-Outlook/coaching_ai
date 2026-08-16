import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import AuthShell from '../components/auth/AuthShell'

/**
 * Tek sayfa, iki mod:
 *  - "iste": e-posta girilir, Supabase sıfırlama bağlantısı yollar.
 *  - "belirle": kullanıcı o bağlantıyla döndüğünde (recovery oturumu açılmış olur)
 *    yeni şifresini belirler.
 *
 * Mod, Supabase'in PASSWORD_RECOVERY olayına göre seçilir; bağlantıdaki token'ı
 * elle ayrıştırmıyoruz — supabase-js zaten oturumu kuruyor.
 */
export default function SifreSifirlaPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'iste' | 'belirle'>('iste')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured) return

    // Bağlantıyla gelindiyse supabase-js recovery oturumunu kurar ve bu olayı yayar.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setMode('belirle')
    })

    // Olay sayfa yüklenmeden önce yayılmış olabilir: URL'de recovery izi varsa da geç.
    if (window.location.hash.includes('type=recovery')) setMode('belirle')

    return () => sub.subscription.unsubscribe()
  }, [])

  async function handleRequest(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/sifre-sifirla`,
    })
    setSubmitting(false)
    if (err) {
      setError(err.message)
      return
    }
    // Hesabın var olup olmadığını sızdırmamak için mesaj her hâlükârda aynı.
    setSent(true)
  }

  async function handleSetPassword(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalı.')
      return
    }
    setSubmitting(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setSubmitting(false)
    if (err) {
      setError(err.message)
      return
    }
    navigate('/panel', { replace: true })
  }

  if (mode === 'belirle') {
    return (
      <AuthShell title="Yeni Şifre Belirle" subtitle="Hesabın için yeni bir şifre gir.">
        <form onSubmit={handleSetPassword} className="form">
          <div className="field">
            <label htmlFor="yeni-sifre">Yeni Şifre</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="yeni-sifre"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                style={{ flex: 1 }}
              />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPassword((v) => !v)}>
                {showPassword ? 'Gizle' : 'Göster'}
              </button>
            </div>
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Kaydediliyor…' : 'Şifreyi Kaydet'}
          </button>
        </form>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Şifremi Unuttum" subtitle="Kayıtlı e-postana sıfırlama bağlantısı gönderelim.">
      {sent ? (
        <>
          <div className="alert alert-success" style={{ marginBottom: 16 }}>
            Bu adres kayıtlıysa sıfırlama bağlantısı gönderildi. Gelen kutunu (ve spam klasörünü) kontrol et.
          </div>
          <Link to="/login" className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }}>
            Girişe dön
          </Link>
        </>
      ) : (
        <form onSubmit={handleRequest} className="form">
          <div className="field">
            <label htmlFor="sifirla-eposta">E-posta</label>
            <input
              id="sifirla-eposta"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              placeholder="ornek@email.com"
            />
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Gönderiliyor…' : 'Sıfırlama Bağlantısı Gönder'}
          </button>
          <div style={{ textAlign: 'center', fontSize: 13 }}>
            <Link to="/login" style={{ color: 'var(--indigo-600)', textDecoration: 'none', fontWeight: 500 }}>
              Girişe dön
            </Link>
          </div>
        </form>
      )}
    </AuthShell>
  )
}
