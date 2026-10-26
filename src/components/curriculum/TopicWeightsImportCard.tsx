import { useState, useEffect, useRef, type DragEvent, type ChangeEvent } from 'react'
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Download,
  Loader2,
  RefreshCw,
  X,
  Layers,
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { useAccess } from '../../contexts/AccessContext'
import type { ExamType } from '../../types/database'

interface ExamTopicWithSubject {
  id: number
  name: string
  exam_subjects?: {
    exam_type: ExamType
    label: string
  } | null
}

interface ParsedCsvRow {
  exam_type: ExamType
  karne_konu_adi: string
  avg_questions: number
  source: string
  year_from?: number | null
  year_to?: number | null
  matched: boolean
  exam_topic_id?: number
  matched_topic_name?: string
  matched_subject_label?: string
  warning?: string
}

interface ExistingSourceGroup {
  source: string
  exam_type: ExamType
  topic_count: number
  year_from?: number | null
  year_to?: number | null
  sample_topics: string[]
}

const SAMPLE_CSV_CONTENT = `exam_type,karne_konu_adi,avg_questions,source,year_from,year_to
TYT,Temel Kavramlar (ÖRNEK),3.5,OSYM_2021_2025,2021,2025
LGS,Çarpanlar ve Katlar (ÖRNEK),1.0,MEB_2020_2024,2020,2024
`

function normalizeTopicName(str: string): string {
  return str
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ')
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

export default function TopicWeightsImportCard() {
  const { can } = useAccess()

  const [examTopics, setExamTopics] = useState<ExamTopicWithSubject[]>([])
  const [loadingTopics, setLoadingTopics] = useState(false)
  const [existingSources, setExistingSources] = useState<ExistingSourceGroup[]>([])
  const [loadingSources, setLoadingSources] = useState(false)

  const [parsedRows, setParsedRows] = useState<ParsedCsvRow[]>([])
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [importing, setImporting] = useState(false)
  const [deletingSource, setDeletingSource] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // 1. Yetki kontrolü: Yalnız curriculum.manage yetkisi olan koçlara açık
  const hasAccess = can('curriculum.manage')

  async function loadExamTopics() {
    if (!isSupabaseConfigured) return
    setLoadingTopics(true)
    try {
      const { data, error } = await supabase
        .from('exam_topics')
        .select('id, name, exam_subjects(exam_type, label)')

      if (error) throw error
      const mapped = (data || []).map((t) => {
        const s = t.exam_subjects as unknown as { exam_type: ExamType; label: string } | null
        return {
          id: t.id,
          name: t.name,
          exam_subjects: s,
        }
      })
      setExamTopics(mapped)
    } catch (err) {
      console.error('Konu kataloğu yüklenemedi:', err)
    } finally {
      setLoadingTopics(false)
    }
  }

  async function loadExistingSources() {
    if (!isSupabaseConfigured) return
    setLoadingSources(true)
    try {
      const { data, error } = await supabase
        .from('topic_weights')
        .select('id, exam_type, exam_topic_id, avg_questions, source, year_from, year_to, exam_topics(name)')

      if (error) throw error

      const groupMap = new Map<string, ExistingSourceGroup>()

      for (const row of data || []) {
        const key = `${row.exam_type}__${row.source}`
        const topicName = (row.exam_topics as unknown as { name?: string } | null)?.name || ''
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            source: row.source,
            exam_type: row.exam_type as ExamType,
            topic_count: 0,
            year_from: row.year_from,
            year_to: row.year_to,
            sample_topics: [],
          })
        }
        const grp = groupMap.get(key)!
        grp.topic_count++
        if (topicName && grp.sample_topics.length < 3 && !grp.sample_topics.includes(topicName)) {
          grp.sample_topics.push(topicName)
        }
        if (row.year_from && (!grp.year_from || row.year_from < grp.year_from)) {
          grp.year_from = row.year_from
        }
        if (row.year_to && (!grp.year_to || row.year_to > grp.year_to)) {
          grp.year_to = row.year_to
        }
      }

      setExistingSources(Array.from(groupMap.values()))
    } catch (err) {
      console.error('Mevcut kaynaklar yüklenemedi:', err)
    } finally {
      setLoadingSources(false)
    }
  }

  useEffect(() => {
    if (hasAccess && isSupabaseConfigured) {
      loadExamTopics()
      loadExistingSources()
    }
  }, [hasAccess])

  if (!hasAccess) {
    return null
  }

  function handleDownloadSample() {
    const blob = new Blob([SAMPLE_CSV_CONTENT], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'topic-weights-ornek.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function parseCsvContent(text: string) {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    if (lines.length < 2) {
      setMessage({ text: 'CSV dosyası boş veya başlık satırı eksik.', type: 'error' })
      return
    }

    const firstLine = lines[0]
    // Virgül veya noktalı virgül desteği
    const semicolonCount = (firstLine.match(/;/g) || []).length
    const commaCount = (firstLine.match(/,/g) || []).length
    const delimiter = semicolonCount > commaCount ? ';' : ','

    const headers = parseCsvLine(firstLine, delimiter).map((h) =>
      h.toLowerCase().replace(/['"]/g, '').trim()
    )

    const idxExamType = headers.findIndex((h) => h === 'exam_type' || h === 'sinav_turu')
    const idxTopicName = headers.findIndex(
      (h) => h === 'karne_konu_adi' || h === 'konu_adi' || h === 'topic_name' || h === 'konu'
    )
    const idxAvgQuestions = headers.findIndex(
      (h) => h === 'avg_questions' || h === 'ortalama' || h === 'soru_sayisi' || h === 'avg'
    )
    const idxSource = headers.findIndex((h) => h === 'source' || h === 'kaynak')
    const idxYearFrom = headers.findIndex(
      (h) => h === 'year_from' || h === 'baslangic_yili' || h === 'yil_baslangic'
    )
    const idxYearTo = headers.findIndex(
      (h) => h === 'year_to' || h === 'bitis_yili' || h === 'yil_bitis'
    )

    if (idxExamType === -1 || idxTopicName === -1 || idxAvgQuestions === -1 || idxSource === -1) {
      setMessage({
        text: 'CSV başlıkları eksik! Zorunlu sütunlar: exam_type, karne_konu_adi, avg_questions, source',
        type: 'error',
      })
      return
    }

    const rows: ParsedCsvRow[] = []

    for (let i = 1; i < lines.length; i++) {
      const parts = parseCsvLine(lines[i], delimiter)
      if (parts.length < 4) continue

      const rawExamType = parts[idxExamType]?.toUpperCase()?.trim() as ExamType
      if (!['TYT', 'AYT', 'LGS'].includes(rawExamType)) {
        continue
      }

      const karneKonuAdi = parts[idxTopicName]?.trim() || ''
      if (!karneKonuAdi) continue

      // Virgüllü ondalık desteği (örn: 3,5 -> 3.5)
      const rawAvg = parts[idxAvgQuestions]?.replace(',', '.')?.trim()
      const avgQuestions = parseFloat(rawAvg) || 0

      const source = parts[idxSource]?.trim() || 'MANUEL'
      const yearFrom = idxYearFrom !== -1 && parts[idxYearFrom] ? parseInt(parts[idxYearFrom], 10) || null : null
      const yearTo = idxYearTo !== -1 && parts[idxYearTo] ? parseInt(parts[idxYearTo], 10) || null : null

      // Eşleştirme algoritması:
      // 1) İlgili sınav türündeki exam_topics listesi
      const candidateTopics = examTopics.filter(
        (et) => !et.exam_subjects || et.exam_subjects.exam_type === rawExamType
      )

      const normSearch = normalizeTopicName(karneKonuAdi)
      // (ÖRNEK) ibaresini temizleyerek de dene
      const normSearchWithoutExample = normalizeTopicName(
        karneKonuAdi.replace(/\s*\((?:örnek|ornek)\)/gi, '')
      )

      let matchedEt = candidateTopics.find(
        (et) => normalizeTopicName(et.name) === normSearch
      )

      if (!matchedEt && normSearchWithoutExample !== normSearch) {
        matchedEt = candidateTopics.find(
          (et) => normalizeTopicName(et.name) === normSearchWithoutExample
        )
      }

      // Kısmi/gevşek eşleştirme (kelime bazlı)
      if (!matchedEt) {
        matchedEt = candidateTopics.find((et) => {
          const normEt = normalizeTopicName(et.name)
          return normEt === normSearch || normEt.startsWith(normSearchWithoutExample)
        })
      }

      if (matchedEt) {
        rows.push({
          exam_type: rawExamType,
          karne_konu_adi: karneKonuAdi,
          avg_questions: avgQuestions,
          source,
          year_from: yearFrom,
          year_to: yearTo,
          matched: true,
          exam_topic_id: matchedEt.id,
          matched_topic_name: matchedEt.name,
          matched_subject_label: matchedEt.exam_subjects?.label || '',
        })
      } else {
        rows.push({
          exam_type: rawExamType,
          karne_konu_adi: karneKonuAdi,
          avg_questions: avgQuestions,
          source,
          year_from: yearFrom,
          year_to: yearTo,
          matched: false,
          warning: 'exam_topics tablosunda bulunamadı',
        })
      }
    }

    if (rows.length === 0) {
      setMessage({ text: 'CSV dosyasında geçerli satır bulunamadı.', type: 'error' })
      return
    }

    setParsedRows(rows)
    setShowPreviewModal(true)
    setMessage(null)
  }

  function handleFileSelected(file: File) {
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv' && file.type !== 'application/vnd.ms-excel') {
      setMessage({ text: 'Lütfen geçerli bir .csv dosyası seçin.', type: 'error' })
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result
      if (typeof content === 'string') {
        parseCsvContent(content)
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  function onFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelected(file)
    }
    e.target.value = ''
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileSelected(file)
    }
  }

  async function handleImport() {
    const validRows = parsedRows.filter((r) => r.matched && r.exam_topic_id)
    if (validRows.length === 0) {
      setMessage({ text: 'İçe aktarılacak eşleşmiş konu satırı yok.', type: 'error' })
      return
    }

    setImporting(true)
    setMessage(null)
    try {
      // Postgres onConflict hatası almamak için aynı (exam_type, exam_topic_id, source) kayıtlarını tekilleştir
      const dedupMap = new Map<string, {
        exam_type: ExamType
        exam_topic_id: number
        avg_questions: number
        source: string
        year_from?: number | null
        year_to?: number | null
      }>()

      for (const r of validRows) {
        const key = `${r.exam_type}_${r.exam_topic_id}_${r.source}`
        dedupMap.set(key, {
          exam_type: r.exam_type,
          exam_topic_id: r.exam_topic_id!,
          avg_questions: r.avg_questions,
          source: r.source,
          year_from: r.year_from ?? null,
          year_to: r.year_to ?? null,
        })
      }

      const payload = Array.from(dedupMap.values())

      const { error } = await supabase
        .from('topic_weights')
        .upsert(payload, { onConflict: 'exam_type,exam_topic_id,source' })

      if (error) throw error

      setMessage({
        text: `${payload.length} adet konu ağırlığı başarıyla kaydedildi/güncellendi.`,
        type: 'success',
      })
      setShowPreviewModal(false)
      setParsedRows([])
      await loadExistingSources()
    } catch (err) {
      console.error('İçe aktarma hatası:', err)
      setMessage({
        text: err instanceof Error ? err.message : 'Kayıt sırasında hata oluştu.',
        type: 'error',
      })
    } finally {
      setImporting(false)
    }
  }

  async function handleDeleteSource(group: ExistingSourceGroup) {
    const confirmed = window.confirm(
      `"${group.source}" (${group.exam_type}) kaynağına ait ${group.topic_count} adet konu ağırlığı silinecek. Emin misiniz?`
    )
    if (!confirmed) return

    setDeletingSource(`${group.exam_type}__${group.source}`)
    try {
      const { error } = await supabase
        .from('topic_weights')
        .delete()
        .eq('source', group.source)
        .eq('exam_type', group.exam_type)

      if (error) throw error

      setMessage({
        text: `"${group.source}" (${group.exam_type}) kaynağı başarıyla kaldırıldı.`,
        type: 'success',
      })
      await loadExistingSources()
    } catch (err) {
      console.error('Silme hatası:', err)
      setMessage({
        text: err instanceof Error ? err.message : 'Silme sırasında hata oluştu.',
        type: 'error',
      })
    } finally {
      setDeletingSource(null)
    }
  }

  const matchedCount = parsedRows.filter((r) => r.matched).length
  const unmatchedCount = parsedRows.filter((r) => !r.matched).length

  return (
    <div className="card" style={{ marginTop: 28, padding: 20 }}>
      {/* Kart Başlığı */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={18} style={{ color: 'var(--indigo-600)' }} />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
              ÖSYM & MEB Konu Soru Ağırlıkları (CSV İçe Aktar)
            </h3>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--ink-soft)' }}>
            Öğrenci 360 raporlarında öncelik matrisi ve Pareto hesaplamaları için resmi soru dağılım ağırlıklarını yükleyin.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownloadSample}
          className="btn btn-ghost btn-sm"
          style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}
          title="Örnek CSV şablonunu indir"
        >
          <Download size={13} /> Örnek CSV İndir
        </button>
      </div>

      {message && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: message.type === 'success' ? 'var(--success-bg)' : 'var(--critical-bg)',
            color: message.type === 'success' ? 'var(--success-text)' : 'var(--critical-text)',
          }}
        >
          {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* CSV Yükleme / Sürükle-Bırak Alanı */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: isDragging ? '2px dashed var(--indigo-600)' : '2px dashed var(--border)',
          background: isDragging ? 'var(--indigo-025)' : 'var(--surface-alt)',
          borderRadius: 10,
          padding: '24px 16px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          marginBottom: 20,
        }}
      >
        <input
          type="file"
          ref={fileInputRef}
          accept=".csv,text/csv"
          onChange={onFileInputChange}
          style={{ display: 'none' }}
        />
        <Upload size={28} style={{ color: 'var(--indigo-600)', margin: '0 auto 8px', display: 'block' }} />
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>
          CSV dosyasını buraya sürükleyin veya dosya seçin
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 4 }}>
          Virgül (,) veya noktalı virgül (;) ayracı desteklenir • Format: exam_type, karne_konu_adi, avg_questions, source, year_from, year_to
        </div>
      </div>

      {/* Mevcut Yüklü Kaynaklar Listesi */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
            Kayıtlı Dağılım Kaynakları
          </span>
          {loadingSources && <RefreshCw size={12} className="animate-spin" style={{ color: 'var(--ink-faint)' }} />}
        </div>

        {existingSources.length === 0 ? (
          <div
            style={{
              padding: '14px',
              borderRadius: 8,
              background: 'var(--surface-alt)',
              border: '1px solid var(--border-soft)',
              fontSize: 12.5,
              color: 'var(--ink-faint)',
              textAlign: 'center',
            }}
          >
            Henüz yüklenmiş bir konu ağırlığı kaynağı bulunmuyor. Raporlarda kurum içi deneme ortalamaları kullanılmaktadır.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {existingSources.map((group) => {
              const groupKey = `${group.exam_type}__${group.source}`
              const isDeleting = deletingSource === groupKey
              return (
                <div
                  key={groupKey}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: 'var(--surface-alt)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        background: group.exam_type === 'TYT' ? 'var(--indigo-050)' : 'var(--plum-bg)',
                        color: group.exam_type === 'TYT' ? 'var(--indigo-700)' : 'var(--plum-text)',
                      }}
                    >
                      {group.exam_type}
                    </span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                        {group.source}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                        {group.topic_count} konu
                        {group.year_from && group.year_to
                          ? ` • Yıllar: ${group.year_from}–${group.year_to}`
                          : group.year_from
                          ? ` • Başlangıç: ${group.year_from}`
                          : ''}
                        {group.sample_topics.length > 0 && ` • Örn: ${group.sample_topics.join(', ')}`}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={isDeleting}
                    onClick={() => handleDeleteSource(group)}
                    style={{ color: 'var(--critical)', padding: '6px 8px' }}
                    title="Bu kaynağa ait tüm ağırlıkları sil"
                  >
                    {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Önizleme Modalı */}
      {showPreviewModal && (
        <div
          className="modal-backdrop"
          onClick={() => !importing && setShowPreviewModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              borderRadius: 12,
              boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
              width: '100%',
              maxWidth: 780,
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
                  CSV Önizleme ve Eşleştirme
                </h3>
                <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 12 }}>
                  <span style={{ color: 'var(--ink-soft)' }}>
                    Toplam: <strong>{parsedRows.length}</strong> satır
                  </span>
                  <span style={{ color: 'var(--success-text)', fontWeight: 600 }}>
                    ✓ {matchedCount} eşleşen
                  </span>
                  {unmatchedCount > 0 && (
                    <span style={{ color: 'var(--warning-text)', fontWeight: 600 }}>
                      ⚠ {unmatchedCount} eşleşmeyen
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowPreviewModal(false)}
                disabled={importing}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body / Tablo */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              {loadingTopics ? (
                <div style={{ textAlign: 'center', padding: 30, color: 'var(--ink-faint)' }}>
                  <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                  Konu kataloğu kontrol ediliyor...
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--ink-soft)' }}>
                      <th style={{ padding: '8px 6px' }}>Sınav</th>
                      <th style={{ padding: '8px 6px' }}>CSV Konu Adı</th>
                      <th style={{ padding: '8px 6px' }}>Eşleşen Sistem Konusu</th>
                      <th style={{ padding: '8px 6px', textAlign: 'right' }}>Ort. Soru</th>
                      <th style={{ padding: '8px 6px' }}>Kaynak</th>
                      <th style={{ padding: '8px 6px' }}>Yıllar</th>
                      <th style={{ padding: '8px 6px', textAlign: 'center' }}>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((row, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: '1px solid var(--border-soft)',
                          background: row.matched ? 'var(--success-bg)' : 'var(--warning-bg)',
                        }}
                      >
                        <td style={{ padding: '8px 6px', fontWeight: 600 }}>{row.exam_type}</td>
                        <td style={{ padding: '8px 6px', color: 'var(--ink)' }}>{row.karne_konu_adi}</td>
                        <td style={{ padding: '8px 6px' }}>
                          {row.matched ? (
                            <div>
                              <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
                                {row.matched_topic_name}
                              </span>
                              {row.matched_subject_label && (
                                <span style={{ fontSize: 11, color: 'var(--ink-soft)', marginLeft: 4 }}>
                                  ({row.matched_subject_label})
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--warning-text)', fontStyle: 'italic' }}>
                              {row.warning || 'Eşleşmedi'}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600 }}>
                          {row.avg_questions}
                        </td>
                        <td style={{ padding: '8px 6px', color: 'var(--ink-soft)' }}>{row.source}</td>
                        <td style={{ padding: '8px 6px', color: 'var(--ink-soft)' }}>
                          {row.year_from && row.year_to
                            ? `${row.year_from}–${row.year_to}`
                            : row.year_from || '—'}
                        </td>
                        <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                          {row.matched ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                color: 'var(--success-text)',
                                fontWeight: 600,
                              }}
                            >
                              <CheckCircle2 size={13} /> Eşleşti
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                color: 'var(--warning-text)',
                                fontWeight: 600,
                              }}
                              title="exam_topics tablosunda bulunamadı"
                            >
                              <AlertTriangle size={13} /> Bulunamadı
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '14px 20px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--surface-alt)',
              }}
            >
              <div style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
                {unmatchedCount > 0
                  ? `Not: Bulunamayan ${unmatchedCount} satır atlanacak, yalnız eşleşen ${matchedCount} satır aktarılacaktır.`
                  : 'Tüm satırlar başarıyla sistemdeki konularla eşleşti.'}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowPreviewModal(false)}
                  disabled={importing}
                >
                  İptal
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={matchedCount === 0 || importing}
                  onClick={handleImport}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {importing ? (
                    <>
                      <Loader2 size={13} className="animate-spin" /> İçe Aktarılıyor...
                    </>
                  ) : (
                    <>
                      <FileText size={13} /> {matchedCount} Konuyu İçe Aktar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
