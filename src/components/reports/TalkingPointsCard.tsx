import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, ExternalLink, Plus, RefreshCw, AlertCircle } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import {
  type TalkingPoint,
  TALKING_POINT_CONFIG,
  buildTalkingPoints,
  fetchTalkingPointsInput,
} from '../../lib/talkingPoints'
import AddToProgramPopover from '../program/AddToProgramPopover'

export interface TalkingPointsCardProps {
  studentId: string
  studentName?: string
  initialPoints?: TalkingPoint[]
  /** Yenileme veya görev ekleme sonrası tetiklenir */
  onRefresh?: () => void
}

export default function TalkingPointsCard({
  studentId,
  studentName,
  initialPoints,
  onRefresh,
}: TalkingPointsCardProps) {
  const navigate = useNavigate()
  const [points, setPoints] = useState<TalkingPoint[]>(initialPoints || [])
  const [loading, setLoading] = useState(!initialPoints)
  const [error, setError] = useState<string | null>(null)

  // Popover state
  const [popoverAction, setPopoverAction] = useState<{
    topicId?: number
    topicName?: string
    suggestedType?: 'konu' | 'tekrar' | 'rutin' | 'sureli_test' | 'deneme'
  } | null>(null)

  const loadPoints = useCallback(async () => {
    if (!isSupabaseConfigured || !studentId) return
    setLoading(true)
    setError(null)
    try {
      const input = await fetchTalkingPointsInput(supabase, studentId)
      const calculated = buildTalkingPoints(input)
      setPoints(calculated)
    } catch (err: any) {
      console.error('TalkingPoints loading error:', err)
      setError('Görüşme maddeleri yüklenirken bir sorun oluştu.')
    } finally {
      setLoading(false)
    }
  }, [studentId])

  useEffect(() => {
    if (initialPoints) {
      setPoints(initialPoints)
      setLoading(false)
      return
    }
    loadPoints()
  }, [initialPoints, loadPoints])

  if (loading) {
    return (
      <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-soft)', fontSize: 13 }}>
          <RefreshCw size={14} className="animate-spin" />
          <span>Görüşme maddeleri hazırlanıyor…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: 18, marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: 'var(--teal-bg, rgba(13, 148, 136, 0.1))',
              color: 'var(--brand, #0D9488)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MessageSquare size={16} />
          </div>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--ink)' }}>
              Görüşmede Konuşulacaklar
            </h3>
            <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
              Haftalık koçluk görüşmesi için öne çıkan 5 veri odaklı gündem maddesi
            </span>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={loadPoints}
          title="Yenile"
          style={{ padding: '4px 8px', fontSize: 11 }}
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {error ? (
        <div className="alert alert-error" style={{ fontSize: 12, padding: '8px 12px' }}>
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      ) : points.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--ink-faint)', padding: '12px 0', textAlign: 'center' }}>
          Görüşme için henüz kayıtlı bir gündem maddesi bulunmuyor.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {points.map((pt) => {
            const cfg = TALKING_POINT_CONFIG[pt.kind] || TALKING_POINT_CONFIG.bilgi

            return (
              <div
                key={pt.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  padding: '9px 12px',
                  background: 'var(--surface-alt)',
                  borderRadius: 8,
                  border: '1px solid var(--border-soft)',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 }}>
                  <span
                    className={cfg.badgeClass}
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: 4,
                      flexShrink: 0,
                      marginTop: 1,
                      letterSpacing: '0.03em',
                    }}
                  >
                    {cfg.label}
                  </span>
                  <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.45 }}>
                    {pt.text}
                  </div>
                </div>

                {pt.action && (
                  <div style={{ flexShrink: 0 }}>
                    {pt.action.kind === 'add_to_program' && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() =>
                          setPopoverAction({
                            topicId: pt.action!.topicId,
                            topicName: pt.action!.topicName,
                            suggestedType: pt.action!.suggestedType,
                          })
                        }
                        style={{
                          fontSize: 11,
                          padding: '3px 8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontWeight: 600,
                        }}
                      >
                        <Plus size={12} /> {pt.action.label}
                      </button>
                    )}

                    {pt.action.kind === 'open_program' && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => navigate(`/program?studentId=${studentId}`)}
                        style={{
                          fontSize: 11,
                          padding: '3px 8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          color: 'var(--primary)',
                          border: '1px solid var(--border-soft)',
                          borderRadius: 6,
                        }}
                      >
                        <ExternalLink size={12} /> {pt.action.label}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 3. Giriş Noktası: AddToProgramPopover */}
      {popoverAction && (
        <AddToProgramPopover
          studentId={studentId}
          studentName={studentName}
          topicId={popoverAction.topicId}
          originKind="gorusme"
          suggestedType={popoverAction.suggestedType || 'tekrar'}
          onClose={() => setPopoverAction(null)}
          onSuccess={() => {
            setPopoverAction(null)
            onRefresh?.()
            loadPoints()
          }}
        />
      )}
    </div>
  )
}
