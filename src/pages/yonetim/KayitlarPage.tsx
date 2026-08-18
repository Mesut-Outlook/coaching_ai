import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, RefreshCw, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { useAccess } from '../../contexts/useAccess'
import PageHeader from '../../components/layout/PageHeader'
import type { AuditLogEntry } from '../../types/database'

/** Tablo adlarını koçun tanıdığı isimlere çevirir. */
const TABLO_ADI: Record<string, string> = {
  students: 'Öğrenci',
  weekly_tasks: 'Haftalık görev',
  topic_measurements: 'Konu ölçümü',
  coach_decisions: 'Koç kararı',
  attendance_records: 'Devamsızlık',
  mock_exams: 'Deneme',
  mock_exam_sections: 'Deneme bölümü',
  error_basket_items: 'Hata sepeti',
  memberships: 'Üyelik',
  invitations: 'Davet',
  roles: 'Rol',
  institutions: 'Kurum',
  subjects: 'Ders',
  topics: 'Konu',
  _temizlik: 'Kayıt temizliği',
}

const EYLEM: Record<string, { etiket: string; sinif: string }> = {
  insert: { etiket: 'Oluşturdu', sinif: 'badge-success' },
  update: { etiket: 'Değiştirdi', sinif: 'badge-primary' },
  delete: { etiket: 'Sildi', sinif: 'badge-critical' },
}

const SAYFA = 100

interface Istatistik {
  toplam_kayit: number
  en_eski: string | null
  en_yeni: string | null
  boyut_bayt: number
  son_30_gun: number
}

function bayt(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function tarih(s: string) {
  return new Date(s).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/** İki satır arasında gerçekten değişen alanları çıkarır. */
function farklar(oncesi: unknown, sonrasi: unknown) {
  const a = (oncesi ?? {}) as Record<string, unknown>
  const b = (sonrasi ?? {}) as Record<string, unknown>
  const anahtarlar = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]))
  return anahtarlar
    .filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
    .map((k) => ({ alan: k, oncesi: a[k], sonrasi: b[k] }))
}

function deger(v: unknown) {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

export default function KayitlarPage() {
  const { isSystemAdmin } = useAccess()

  const [kayitlar, setKayitlar] = useState<AuditLogEntry[]>([])
  const [istatistik, setIstatistik] = useState<Istatistik | null>(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)
  const [acik, setAcik] = useState<number | null>(null)

  const [tabloFiltre, setTabloFiltre] = useState('')
  const [eylemFiltre, setEylemFiltre] = useState<'' | AuditLogEntry['action']>('')
  const [sayfa, setSayfa] = useState(0)
  const [dahaVar, setDahaVar] = useState(false)

  const [temizlikTarihi, setTemizlikTarihi] = useState('')
  const [temizleniyor, setTemizleniyor] = useState(false)

  const yukle = useCallback(async () => {
    if (!isSupabaseConfigured || !isSystemAdmin) {
      setYukleniyor(false)
      return
    }
    setYukleniyor(true)
    setHata(null)
    try {
      let q = supabase
        .from('audit_log')
        .select('*')
        .order('occurred_at', { ascending: false })
        .range(sayfa * SAYFA, sayfa * SAYFA + SAYFA)

      if (tabloFiltre) q = q.eq('table_name', tabloFiltre)
      if (eylemFiltre) q = q.eq('action', eylemFiltre)

      const [{ data, error }, statRes] = await Promise.all([
        q,
        supabase.rpc('audit_stats'),
      ])
      if (error) throw error

      const satirlar = data ?? []
      setDahaVar(satirlar.length > SAYFA)
      setKayitlar(satirlar.slice(0, SAYFA))

      const st = statRes.data as unknown as (Istatistik & { ok: boolean }) | null
      if (st?.ok) setIstatistik(st)
    } catch (err) {
      setHata(err instanceof Error ? err.message : 'Kayıtlar yüklenemedi.')
    } finally {
      setYukleniyor(false)
    }
  }, [isSystemAdmin, tabloFiltre, eylemFiltre, sayfa])

  useEffect(() => {
    yukle()
  }, [yukle])

  /** Arşivleme: filtrelenmiş kayıtları JSON olarak indirir. Temizlemeden önce alınır. */
  const arsivle = async () => {
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .order('occurred_at', { ascending: false })
      .limit(10000)
    if (error) {
      setHata(error.message)
      return
    }
    const blob = new Blob([JSON.stringify(data ?? [], null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `netlik-denetim-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const temizle = async () => {
    if (!temizlikTarihi) return
    const onay = confirm(
      `${temizlikTarihi} tarihinden ÖNCEKİ tüm denetim kayıtları kalıcı olarak silinecek.\n\n` +
        'Önce "Arşivle" ile yedek aldığından emin ol. Bu işlem geri alınamaz.\n\nDevam edilsin mi?'
    )
    if (!onay) return

    setTemizleniyor(true)
    setHata(null)
    try {
      const { data, error } = await supabase.rpc('audit_purge', { p_before: temizlikTarihi })
      if (error) throw error
      const res = data as unknown as { ok: boolean; silinen?: number; error?: string }
      if (!res.ok) throw new Error(res.error || 'Temizlik başarısız.')
      alert(`${res.silinen} kayıt silindi.`)
      setSayfa(0)
      yukle()
    } catch (err) {
      setHata(err instanceof Error ? err.message : 'Temizlik başarısız.')
    } finally {
      setTemizleniyor(false)
    }
  }

  const tablolar = useMemo(() => Object.keys(TABLO_ADI), [])

  if (!isSystemAdmin) {
    return (
      <section className="screen">
        <PageHeader hideSearch title="Denetim Kayıtları" />
        <div className="card empty-state">
          <p className="empty-state-text">Bu ekran yalnız sistem yöneticisine açıktır.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="screen">
      <PageHeader
        hideSearch
        title="Denetim Kayıtları"
        subtitle="Hangi kullanıcı hangi kaydı oluşturdu, değiştirdi ya da sildi."
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={yukle}>
              <RefreshCw size={15} /> Yenile
            </button>
            <button type="button" className="btn btn-ghost" onClick={arsivle}>
              <Download size={15} /> Arşivle (JSON)
            </button>
          </div>
        }
      />

      {hata && <div className="alert alert-error" style={{ marginBottom: 16 }}>{hata}</div>}

      {istatistik && (
        <div className="card" style={{ padding: 16, marginBottom: 18, display: 'flex', gap: 26, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Toplam kayıt</div>
            <div style={{ fontSize: 19, fontWeight: 700 }}>{istatistik.toplam_kayit.toLocaleString('tr-TR')}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Son 30 gün</div>
            <div style={{ fontSize: 19, fontWeight: 700 }}>{istatistik.son_30_gun.toLocaleString('tr-TR')}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Kapladığı yer</div>
            <div style={{ fontSize: 19, fontWeight: 700 }}>{bayt(istatistik.boyut_bayt)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>En eski kayıt</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>
              {istatistik.en_eski ? tarih(istatistik.en_eski) : '—'}
            </div>
          </div>
        </div>
      )}

      {/* Filtreler + dönemsel temizlik */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ minWidth: 180 }}>
          <label>Kayıt türü</label>
          <select value={tabloFiltre} onChange={(e) => { setSayfa(0); setTabloFiltre(e.target.value) }}>
            <option value="">Tümü</option>
            {tablolar.map((t) => (
              <option key={t} value={t}>{TABLO_ADI[t]}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ minWidth: 150 }}>
          <label>İşlem</label>
          <select value={eylemFiltre} onChange={(e) => { setSayfa(0); setEylemFiltre(e.target.value as '' | AuditLogEntry['action']) }}>
            <option value="">Tümü</option>
            <option value="insert">Oluşturma</option>
            <option value="update">Değiştirme</option>
            <option value="delete">Silme</option>
          </select>
        </div>

        <div style={{ flex: 1 }} />

        <div className="field" style={{ minWidth: 170 }}>
          <label>Bu tarihten öncesini sil</label>
          <input type="date" value={temizlikTarihi} onChange={(e) => setTemizlikTarihi(e.target.value)} />
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ color: 'var(--critical-text)' }}
          disabled={!temizlikTarihi || temizleniyor}
          onClick={temizle}
        >
          <Trash2 size={15} /> {temizleniyor ? 'Siliniyor…' : 'Temizle'}
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {yukleniyor ? (
          <div style={{ padding: 22 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton skeleton-line" style={{ marginBottom: 12 }} />
            ))}
          </div>
        ) : kayitlar.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-text">Bu filtreye uyan denetim kaydı yok.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: 30 }} />
                  <th>Zaman</th>
                  <th>Kim</th>
                  <th>İşlem</th>
                  <th>Kayıt türü</th>
                  <th>Değişen alan</th>
                </tr>
              </thead>
              <tbody>
                {kayitlar.map((k) => {
                  const fark = farklar(k.old_row, k.new_row)
                  const acikMi = acik === k.id
                  return (
                    <>
                      <tr
                        key={k.id}
                        onClick={() => setAcik(acikMi ? null : k.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>{acikMi ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{tarih(k.occurred_at)}</td>
                        <td>
                          {k.actor_name || (
                            <span style={{ color: 'var(--ink-soft)' }}>
                              {k.actor_label.startsWith('ogrenci:')
                                ? 'Öğrenci (portal)'
                                : k.actor_label === 'sistem'
                                ? 'Sistem'
                                : k.actor_label}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${EYLEM[k.action]?.sinif ?? 'badge-neutral'}`}>
                            {EYLEM[k.action]?.etiket ?? k.action}
                          </span>
                        </td>
                        <td>{TABLO_ADI[k.table_name] ?? k.table_name}</td>
                        <td style={{ color: 'var(--ink-soft)' }}>
                          {k.action === 'update'
                            ? fark.map((f) => f.alan).slice(0, 3).join(', ') || '—'
                            : '—'}
                        </td>
                      </tr>
                      {acikMi && (
                        <tr key={`${k.id}-detay`}>
                          <td colSpan={6} style={{ background: 'var(--surface-alt)', padding: 14 }}>
                            {fark.length === 0 ? (
                              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
                                Alan bazlı fark yok.
                              </div>
                            ) : (
                              <table className="table" style={{ width: '100%' }}>
                                <thead>
                                  <tr>
                                    <th>Alan</th>
                                    <th>Önce</th>
                                    <th>Sonra</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {fark.map((f) => (
                                    <tr key={f.alan}>
                                      <td style={{ fontWeight: 600 }}>{f.alan}</td>
                                      <td style={{ color: 'var(--critical-text)' }}>{deger(f.oncesi)}</td>
                                      <td style={{ color: 'var(--success-text)' }}>{deger(f.sonrasi)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(sayfa > 0 || dahaVar) && (
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
          <button type="button" className="btn btn-ghost" disabled={sayfa === 0} onClick={() => setSayfa((s) => s - 1)}>
            Önceki
          </button>
          <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--ink-soft)' }}>Sayfa {sayfa + 1}</span>
          <button type="button" className="btn btn-ghost" disabled={!dahaVar} onClick={() => setSayfa((s) => s + 1)}>
            Sonraki
          </button>
        </div>
      )}
    </section>
  )
}
