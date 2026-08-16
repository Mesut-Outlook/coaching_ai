import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { GraduationCap, Users, ArrowRight } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { isSupabaseConfigured } from '../lib/supabase'
import AuthShell from '../components/auth/AuthShell'

/**
 * Karşılama sayfası. Eskiden burada tek bir koç giriş formu vardı; oysa uygulamanın
 * üç kitlesi var ve ikisi (öğrenci, veli) şifreyle değil erişim koduyla giriyor.
 * Portal bağlantısını kaybeden öğrenci/veli bu ekranda çıkmaza giriyordu — artık
 * kendi kapısı var.
 */
export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState(() => localStorage.getItem('remembered_email') || '')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(() => Boolean(localStorage.getItem('remembered_email')))
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    if (rememberMe) localStorage.setItem('remembered_email', email)
    else localStorage.removeItem('remembered_email')

    const { error: signInError } = await signIn(email, password)
    setSubmitting(false)
    if (signInError) {
      setError(signInError === 'Invalid login credentials' ? 'E-posta veya şifre hatalı.' : signInError)
      return
    }
    navigate('/panel', { replace: true })
  }

  return (
    <AuthShell title="Hoş geldin" subtitle="Devam etmek için nasıl giriş yapacağını seç." wide>
      {!isSupabaseConfigured && (
        <div className="alert alert-warning" style={{ marginBottom: 18 }}>
          Supabase henüz bağlı değil. <code>.env.example</code> dosyasını <code>.env.local</code> olarak
          kopyalayıp proje URL'ini ve anon anahtarını gir.
        </div>
      )}

      <div className="auth-split">
        {/* Koç / personel: e-posta + şifre */}
        <section className="auth-pane">
          <header className="auth-pane-head">
            <span className="auth-pane-icon"><Users size={18} /></span>
            <div>
              <h2 className="auth-pane-title">Koç / Personel</h2>
              <p className="auth-pane-sub">E-posta ve şifrenle gir</p>
            </div>
          </header>

          <form onSubmit={handleSubmit} className="form">
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

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--ink-soft)', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ cursor: 'pointer', width: 15, height: 15 }}
                />
                Beni hatırla
              </label>
              <Link to="/sifre-sifirla" className="auth-link">Şifremi unuttum</Link>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Giriş yapılıyor…' : 'Giriş Yap'}
            </button>

            <p className="auth-foot">
              Davetiyen mi var? <Link to="/kayit" className="auth-link">Kayıt ol</Link>
            </p>
          </form>
        </section>

        {/* Öğrenci / veli: erişim kodu */}
        <section className="auth-pane auth-pane-alt">
          <header className="auth-pane-head">
            <span className="auth-pane-icon auth-pane-icon-alt"><GraduationCap size={18} /></span>
            <div>
              <h2 className="auth-pane-title">Öğrenci &amp; Veli</h2>
              <p className="auth-pane-sub">Koçundan aldığın erişim koduyla gir</p>
            </div>
          </header>

          <p className="auth-pane-body">
            Şifreye gerek yok. Koçunun paylaştığı <strong>erişim kodunu</strong> girerek haftalık
            programını, görevlerini ve deneme sonuçlarını görebilirsin.
          </p>

          <Link to="/portal" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
            Erişim Koduyla Gir <ArrowRight size={16} />
          </Link>

          <p className="auth-foot">Kodun yok mu? Koçundan isteyebilirsin.</p>
        </section>
      </div>
    </AuthShell>
  )
}
