import { type ReactNode } from 'react'

/**
 * Giriş/kayıt/şifre ekranlarının ortak çerçevesi. Bu ekranlar AppShell'in dışında
 * olduğu için sidebar'daki marka alanından yararlanamıyor; markayı burada taşıyoruz.
 */
export default function AuthShell({
  title,
  subtitle,
  children,
  wide = false,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  wide?: boolean
}) {
  return (
    <div className="auth-page">
      <div className="auth-brand">
        <div className="auth-logo">
          <img src="/logo.png" alt="" width={52} height={52} />
        </div>
        <div>
          <div className="auth-brand-title">Netlik</div>
          <div className="auth-brand-sub">Eda Cangert · YKS Koçluk</div>
        </div>
      </div>

      <div className="card auth-card" style={wide ? { maxWidth: 760 } : undefined}>
        <h1 className="auth-title">{title}</h1>
        {subtitle && <p className="auth-sub">{subtitle}</p>}
        {children}
      </div>
    </div>
  )
}
