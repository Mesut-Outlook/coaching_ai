import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { verifyAccessCode } from '../../lib/accessCode'
import { Smartphone, ArrowRight } from 'lucide-react'

export default function PortalAccessPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [code, setCode] = useState(searchParams.get('code') || '')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Automatic login if ?code= is present in URL
  useEffect(() => {
    const urlCode = searchParams.get('code')
    if (urlCode) {
      handleAccess(urlCode)
    }
  }, [searchParams])

  async function handleAccess(accessCodeToTest: string) {
    if (!accessCodeToTest.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await verifyAccessCode(accessCodeToTest)
      if (res.error || !res.student) {
        setError(res.error || 'Erişim kodu bulunamadı.')
        setLoading(false)
        return
      }

      // Save credentials locally
      localStorage.setItem('netlik_mobile_code', accessCodeToTest.trim().toUpperCase())
      localStorage.setItem('netlik_mobile_student_id', res.student.id)
      localStorage.setItem('netlik_mobile_role', res.role || 'ogrenci')

      // Redirect to specific mobile view
      if (res.role === 'veli') {
        navigate('/veli')
      } else {
        navigate('/ogrenci')
      }
    } catch (err: any) {
      setError(err?.message || 'Giriş yapılamadı.')
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          backgroundColor: '#ffffff',
          borderRadius: 20,
          padding: '32px 24px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.06)',
          border: '1px solid var(--border)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            backgroundColor: 'var(--indigo-50)',
            color: 'var(--indigo-600)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px auto',
          }}
        >
          <Smartphone size={32} />
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', marginBottom: 8 }}>
          Netlik Mobil Portalı
        </h1>
        <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginBottom: 24, lineHeight: 1.5 }}>
          Koçunuzun size veya velinize ilettiği 6 haneli erişim kodunu girerek giriş yapabilirsiniz.
        </p>

        {error && (
          <div
            style={{
              padding: 12,
              borderRadius: 10,
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleAccess(code)
          }}
        >
          <div style={{ marginBottom: 16, position: 'relative' }}>
            <input
              type="text"
              placeholder="Örn: STU-8492"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              style={{
                width: '100%',
                padding: '14px 16px',
                fontSize: 18,
                fontWeight: 700,
                textAlign: 'center',
                letterSpacing: 2,
                borderRadius: 12,
                border: '2px solid var(--border)',
                outline: 'none',
                textTransform: 'uppercase',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '14px',
              fontSize: 15,
              fontWeight: 700,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {loading ? 'Kontrol Ediliyor...' : 'Giriş Yap'}
            <ArrowRight size={18} />
          </button>
        </form>

        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--ink-soft)' }}>
          Netlik Coaching · Mobil Öğrenci & Veli Portalı
        </div>
      </div>
    </div>
  )
}
