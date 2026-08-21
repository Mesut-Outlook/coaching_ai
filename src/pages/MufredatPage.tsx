import { useEffect, useMemo, useState } from 'react'
import {
  Plus, ChevronDown, ChevronUp, ArrowUp, ArrowDown, Pencil, Check, X, EyeOff, Eye,
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import PageHeader from '../components/layout/PageHeader'
import type { Curriculum, Subject, Topic } from '../types/database'

const DEFAULT_COLOR = '#4C43A8'

export default function MufredatPage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [showInactive, setShowInactive] = useState(false)

  // Müfredat sekmesi: her ders tam olarak bir müfredata ait (subjects.curriculum).
  // Sekme değiştirmek yalnız listeyi süzer, "Yeni Ders" formu da aktif sekmenin
  // curriculum'uyla insert eder.
  const [tab, setTab] = useState<Curriculum>('YKS')

  const [newSubjectOpen, setNewSubjectOpen] = useState(false)
  const [newSubjectName, setNewSubjectName] = useState('')
  const [newSubjectColor, setNewSubjectColor] = useState(DEFAULT_COLOR)
  const [newSubjectSoru, setNewSubjectSoru] = useState('')
  const [newSubjectKatsayi, setNewSubjectKatsayi] = useState('')

  const [newTopicSubjectId, setNewTopicSubjectId] = useState<number | null>(null)
  const [newTopicName, setNewTopicName] = useState('')

  const [editingSubjectId, setEditingSubjectId] = useState<number | null>(null)
  const [editingTopicId, setEditingTopicId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [{ data: subjData, error: subjErr }, { data: topicData, error: topicErr }] = await Promise.all([
        supabase.from('subjects').select('*').order('sort_order', { ascending: true }),
        supabase.from('topics').select('*').order('sort_order', { ascending: true }),
      ])
      if (subjErr) throw subjErr
      if (topicErr) throw topicErr
      setSubjects(subjData ?? [])
      setTopics(topicData ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Müfredat yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    load()
  }, [])

  const topicsBySubject = useMemo(() => {
    const map = new Map<number, Topic[]>()
    topics.forEach((t) => {
      const list = map.get(t.subject_id) ?? []
      list.push(t)
      map.set(t.subject_id, list)
    })
    return map
  }, [topics])

  const tabSubjects = subjects.filter((s) => s.curriculum === tab)
  const visibleSubjects = showInactive ? tabSubjects : tabSubjects.filter((s) => s.is_active)

  function toggleExpand(id: number) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  async function addSubject() {
    if (!newSubjectName.trim()) return
    // sort_order yalnız aktif sekmenin dersleri arasında hesaplanır — YKS (1..14) ve
    // LGS (1..6) ayrı sıralama uzayları, tüm derslere göre hesaplarsak yeni LGS dersi
    // YKS'nin en sonundan (örn. 15) devam eder ve LGS listesinde sıralaması anlamsızlaşır.
    const maxOrder = subjects.filter((s) => s.curriculum === tab).reduce((m, s) => Math.max(m, s.sort_order), -1)
    const { data, error: err } = await supabase
      .from('subjects')
      .insert({
        name: newSubjectName.trim(),
        color: newSubjectColor,
        soru_sayisi: newSubjectSoru.trim() || '—',
        sort_order: maxOrder + 1,
        is_active: true,
        curriculum: tab,
        // LGS dersleri şimdilik yalnız 8. sınıfa özel ekleniyor; YKS dersleri tüm YKS
        // sınıflarına açık (boş dizi = filtre yok). 7. sınıf müfredatı geldiğinde bu
        // varsayılan değişebilir ama şema değişmez.
        grades: tab === 'LGS' ? ['8. Sınıf'] : [],
        katsayi: tab === 'LGS' && newSubjectKatsayi.trim() ? Number(newSubjectKatsayi) : null,
      })
      .select()
      .single()
    if (err) return alert('Ders eklenemedi: ' + err.message)
    setSubjects((prev) => [...prev, data])
    setNewSubjectName('')
    setNewSubjectColor(DEFAULT_COLOR)
    setNewSubjectSoru('')
    setNewSubjectKatsayi('')
    setNewSubjectOpen(false)
  }

  async function addTopic(subjectId: number) {
    if (!newTopicName.trim()) return
    const existing = topicsBySubject.get(subjectId) ?? []
    const maxOrder = existing.reduce((m, t) => Math.max(m, t.sort_order), -1)
    const { data, error: err } = await supabase
      .from('topics')
      .insert({ subject_id: subjectId, name: newTopicName.trim(), sort_order: maxOrder + 1, is_active: true })
      .select()
      .single()
    if (err) return alert('Konu eklenemedi: ' + err.message)
    setTopics((prev) => [...prev, data])
    setNewTopicName('')
    setNewTopicSubjectId(null)
  }

  async function toggleSubjectActive(subject: Subject) {
    const { error: err } = await supabase.from('subjects').update({ is_active: !subject.is_active }).eq('id', subject.id)
    if (err) return alert('Güncellenemedi: ' + err.message)
    setSubjects((prev) => prev.map((s) => (s.id === subject.id ? { ...s, is_active: !s.is_active } : s)))
  }

  async function toggleTopicActive(topic: Topic) {
    const { error: err } = await supabase.from('topics').update({ is_active: !topic.is_active }).eq('id', topic.id)
    if (err) return alert('Güncellenemedi: ' + err.message)
    setTopics((prev) => prev.map((t) => (t.id === topic.id ? { ...t, is_active: !t.is_active } : t)))
  }

  async function renameSubject(subject: Subject, name: string) {
    if (!name.trim() || name === subject.name) return setEditingSubjectId(null)
    const { error: err } = await supabase.from('subjects').update({ name: name.trim() }).eq('id', subject.id)
    if (err) return alert('Güncellenemedi: ' + err.message)
    setSubjects((prev) => prev.map((s) => (s.id === subject.id ? { ...s, name: name.trim() } : s)))
    setEditingSubjectId(null)
  }

  async function renameTopic(topic: Topic, name: string) {
    if (!name.trim() || name === topic.name) return setEditingTopicId(null)
    const { error: err } = await supabase.from('topics').update({ name: name.trim() }).eq('id', topic.id)
    if (err) return alert('Güncellenemedi: ' + err.message)
    setTopics((prev) => prev.map((t) => (t.id === topic.id ? { ...t, name: name.trim() } : t)))
    setEditingTopicId(null)
  }

  async function moveSubject(subject: Subject, direction: -1 | 1) {
    // Yalnız aynı sekmenin (curriculum) dersleri arasında komşuluk kur — YKS ve LGS'nin
    // sort_order'ları iç içe geçtiği için tüm dersler üzerinden sıralarsak ↑/↓ ekranda
    // görünmeyen karşı müfredattan bir dersle sessizce yer değiştirebilir.
    const sorted = subjects.filter((s) => s.curriculum === subject.curriculum).sort((a, b) => a.sort_order - b.sort_order)
    const idx = sorted.findIndex((s) => s.id === subject.id)
    const swapIdx = idx + direction
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const other = sorted[swapIdx]
    const [a, b] = [subject.sort_order, other.sort_order]
    const { error: err } = await supabase.from('subjects').upsert([
      { ...subject, sort_order: b },
      { ...other, sort_order: a },
    ])
    if (err) return alert('Sıralanamadı: ' + err.message)
    setSubjects((prev) =>
      prev.map((s) => (s.id === subject.id ? { ...s, sort_order: b } : s.id === other.id ? { ...s, sort_order: a } : s)),
    )
  }

  async function moveTopic(topic: Topic, direction: -1 | 1) {
    const siblings = (topicsBySubject.get(topic.subject_id) ?? []).slice().sort((a, b) => a.sort_order - b.sort_order)
    const idx = siblings.findIndex((t) => t.id === topic.id)
    const swapIdx = idx + direction
    if (swapIdx < 0 || swapIdx >= siblings.length) return
    const other = siblings[swapIdx]
    const [a, b] = [topic.sort_order, other.sort_order]
    const { error: err } = await supabase.from('topics').upsert([
      { ...topic, sort_order: b },
      { ...other, sort_order: a },
    ])
    if (err) return alert('Sıralanamadı: ' + err.message)
    setTopics((prev) =>
      prev.map((t) => (t.id === topic.id ? { ...t, sort_order: b } : t.id === other.id ? { ...t, sort_order: a } : t)),
    )
  }

  return (
    <section className="screen">
      <PageHeader
        title="Müfredat"
        subtitle="Ders ve konu listesini yönet — YKS müfredatı yıldan yıla değişebilir. Bir konuyu kaldırmak geçmiş verileri silmez, sadece listeden gizler."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setNewSubjectOpen((v) => !v)}>
            <Plus size={14} /> Yeni Ders
          </button>
        }
      />

      {!isSupabaseConfigured && (
        <div className="card" style={{ padding: 16, marginBottom: 20, background: 'var(--warning-bg)', border: 'none', color: 'var(--warning-text)', fontSize: 13 }}>
          Supabase bağlı değil — bu ekran gerçek veriye ihtiyaç duyar.
        </div>
      )}
      {error && (
        <div className="card" style={{ padding: 16, marginBottom: 20, background: 'var(--critical-bg)', border: 'none', color: 'var(--critical-text)', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {(['YKS', 'LGS'] as const).map((c) => {
          const count = subjects.filter((s) => s.curriculum === c).length
          return (
            <button
              key={c}
              type="button"
              onClick={() => setTab(c)}
              style={{
                padding: '10px 4px', background: 'none', border: 'none',
                borderBottom: tab === c ? '2px solid var(--indigo-600)' : '2px solid transparent',
                color: tab === c ? 'var(--indigo-600)' : 'var(--ink-soft)',
                fontWeight: tab === c ? 700 : 500, fontSize: 13.5, cursor: 'pointer',
              }}
            >
              {c} <span style={{ fontSize: 11, color: 'var(--ink-faint)', fontWeight: 500 }}>({count})</span>
            </button>
          )
        })}
      </div>

      {newSubjectOpen && (
        <div className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 2, minWidth: 160 }}>
            <label>Ders Adı</label>
            <input type="text" value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)} placeholder="örn. Yapay Zeka ve Etik" />
          </div>
          <div className="field" style={{ minWidth: 90 }}>
            <label>Renk</label>
            <input type="color" value={newSubjectColor} onChange={(e) => setNewSubjectColor(e.target.value)} style={{ height: 38, padding: 3 }} />
          </div>
          <div className="field" style={{ minWidth: 120 }}>
            <label>Soru Sayısı</label>
            <input type="text" value={newSubjectSoru} onChange={(e) => setNewSubjectSoru(e.target.value)} placeholder="örn. 5 soru" />
          </div>
          {tab === 'LGS' && (
            <div className="field" style={{ minWidth: 100 }}>
              <label>Katsayı</label>
              <input type="number" step="0.1" value={newSubjectKatsayi} onChange={(e) => setNewSubjectKatsayi(e.target.value)} placeholder="örn. 4" />
            </div>
          )}
          <button type="button" className="btn btn-primary" onClick={addSubject}>
            <Check size={14} /> Ekle
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setNewSubjectOpen(false)}>
            Vazgeç
          </button>
        </div>
      )}

      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 16, cursor: 'pointer' }}>
        <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
        Pasif dersleri/konuları da göster
      </label>

      {loading && <p style={{ color: 'var(--ink-soft)', fontSize: 13 }}>Yükleniyor…</p>}

      {!loading &&
        visibleSubjects
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((subject, si, arr) => {
            const subjectTopics = (topicsBySubject.get(subject.id) ?? [])
              .filter((t) => showInactive || t.is_active)
              .slice()
              .sort((a, b) => a.sort_order - b.sort_order)
            const isOpen = expanded[subject.id] ?? false

            return (
              <div key={subject.id} className="card" style={{ marginBottom: 12, opacity: subject.is_active ? 1 : 0.55, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px' }}>
                  <button type="button" onClick={() => toggleExpand(subject.id)} style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', display: 'flex' }}>
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: subject.color, flexShrink: 0 }} />

                  {editingSubjectId === subject.id ? (
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && renameSubject(subject, editValue)}
                      onBlur={() => renameSubject(subject, editValue)}
                      style={{ flex: 1, padding: '4px 8px', border: '1px solid var(--indigo-500)', borderRadius: 6, fontSize: 13.5, fontWeight: 700 }}
                    />
                  ) : (
                    <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{subject.name}</span>
                  )}

                  <span className="subject-soru" style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{subject.soru_sayisi}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{subjectTopics.length} konu</span>
                  {subject.grades.length > 0 && (
                    <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {subject.grades.map((g) => (
                        <span key={g} className="badge badge-neutral">{g}</span>
                      ))}
                    </span>
                  )}
                  {tab === 'LGS' && subject.katsayi !== null && (
                    <span className="badge badge-primary">Katsayı {subject.katsayi}</span>
                  )}

                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEditingSubjectId(subject.id); setEditValue(subject.name) }} title="Adını düzenle">
                    <Pencil size={13} />
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => moveSubject(subject, -1)} disabled={si === 0} title="Yukarı taşı">
                    <ArrowUp size={13} />
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => moveSubject(subject, 1)} disabled={si === arr.length - 1} title="Aşağı taşı">
                    <ArrowDown size={13} />
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleSubjectActive(subject)} title={subject.is_active ? 'Pasifleştir' : 'Aktifleştir'}>
                    {subject.is_active ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>

                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--border-soft)', padding: '4px 16px 14px 48px' }}>
                    {subjectTopics.map((topic, ti, tarr) => (
                      <div key={topic.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: ti < tarr.length - 1 ? '1px solid var(--border-soft)' : 'none', opacity: topic.is_active ? 1 : 0.55 }}>
                        {editingTopicId === topic.id ? (
                          <input
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && renameTopic(topic, editValue)}
                            onBlur={() => renameTopic(topic, editValue)}
                            style={{ flex: 1, padding: '4px 8px', border: '1px solid var(--indigo-500)', borderRadius: 6, fontSize: 13 }}
                          />
                        ) : (
                          <span style={{ flex: 1, fontSize: 13 }}>{topic.name}</span>
                        )}
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEditingTopicId(topic.id); setEditValue(topic.name) }} title="Adını düzenle">
                          <Pencil size={12} />
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => moveTopic(topic, -1)} disabled={ti === 0} title="Yukarı taşı">
                          <ArrowUp size={12} />
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => moveTopic(topic, 1)} disabled={ti === tarr.length - 1} title="Aşağı taşı">
                          <ArrowDown size={12} />
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleTopicActive(topic)} title={topic.is_active ? 'Pasifleştir' : 'Aktifleştir'}>
                          {topic.is_active ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      </div>
                    ))}

                    {newTopicSubjectId === subject.id ? (
                      <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                        <input
                          autoFocus
                          type="text"
                          value={newTopicName}
                          onChange={(e) => setNewTopicName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addTopic(subject.id)}
                          placeholder="Yeni konu adı…"
                          style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12.5 }}
                        />
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => addTopic(subject.id)}>
                          <Check size={12} /> Ekle
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setNewTopicSubjectId(null); setNewTopicName('') }}>
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ marginTop: 10 }}
                        onClick={() => { setNewTopicSubjectId(subject.id); setNewTopicName('') }}
                      >
                        <Plus size={12} /> Konu Ekle
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}

      {!loading && visibleSubjects.length === 0 && (
        <div className="card empty-state">
          <h3>{tab} müfredatında henüz ders yok</h3>
          <p>
            {tab === 'YKS'
              ? '"Yeni Ders" ile müfredatı oluşturmaya başla, ya da Antigravity\'nin seed script\'i ile resmi TYT listesini otomatik yükle.'
              : '"Yeni Ders" ile elle ekleyebilir ya da LGS müfredat seed script\'inin çalıştırılmasını bekleyebilirsin.'}
          </p>
        </div>
      )}
    </section>
  )
}
