import { Lock } from 'lucide-react'

interface CoachingLockedStateProps {
  coachName?: string | null
}

export default function CoachingLockedState({ coachName }: CoachingLockedStateProps) {
  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center',
        gap: 16,
        margin: '24px 0',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'rgba(245, 158, 11, 0.1)',
          color: '#d97706',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Lock size={28} />
      </div>
      <div>
        <h3 style={{ fontSize: 17, fontWeight: 600, margin: '0 0 6px 0' }}>
          Koçluk Verileri Kilitli
        </h3>
        <p style={{ color: 'var(--ink-soft)', fontSize: 14, margin: 0, maxWidth: 440 }}>
          Bu öğrencinin konu, program ve rapor verileri {coachName ? <strong>{coachName}</strong> : 'atanmış koçu'} ile sınırlıdır.
        </p>
      </div>
    </div>
  )
}
