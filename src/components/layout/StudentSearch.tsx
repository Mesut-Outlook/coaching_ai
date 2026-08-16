import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { fetchStudents } from '../../lib/students'
import { useAccess } from '../../contexts/AccessContext'
import type { Student } from '../../types/database'

/**
 * Her ekrandan erişilebilen öğrenci araması. İki kurum + arşivlenenlerle liste
 * büyüdükçe "öğrenciyi bul" işi Öğrenciler ekranına gitmeyi zorunlu kılıyordu.
 *
 * Öğrenciler bir kez çekilip bellekte filtreleniyor: liste birkaç yüz satır
 * mertebesinde, her tuşta sorgu atmaya değmez.
 */
export default function StudentSearch() {
  const navigate = useNavigate()
  const { studentScope, loading: accessLoading } = useAccess()

  const [students, setStudents] = useState<Student[]>([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (accessLoading) return
    let iptal = false
    fetchStudents({ ...studentScope, activeOnly: true, orderBy: 'full_name' })
      .then((rows) => {
        if (!iptal) setStudents(rows)
      })
      .catch(() => {
        if (!iptal) setStudents([])
      })
    return () => {
      iptal = true
    }
  }, [studentScope, accessLoading])

  // Dışarı tıklayınca kapat
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const results = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr')
    if (!q) return []
    return students
      .filter((s) => s.full_name.toLocaleLowerCase('tr').includes(q))
      .slice(0, 8)
  }, [query, students])

  function go(s: Student) {
    setQuery('')
    setOpen(false)
    navigate(`/ogrenciler/${s.id}`)
  }

  return (
    <div className="student-search" ref={boxRef}>
      <Search size={15} className="student-search-icon" />
      <input
        type="text"
        value={query}
        placeholder="Öğrenci ara…"
        aria-label="Öğrenci ara"
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setHighlight(0)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!results.length) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHighlight((h) => (h + 1) % results.length)
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlight((h) => (h - 1 + results.length) % results.length)
          } else if (e.key === 'Enter') {
            e.preventDefault()
            go(results[highlight])
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
      />
      {query && (
        <button type="button" className="student-search-clear" onClick={() => setQuery('')} aria-label="Temizle">
          <X size={14} />
        </button>
      )}

      {open && query.trim() !== '' && (
        <div className="student-search-results">
          {results.length === 0 ? (
            <div className="student-search-empty">Eşleşen öğrenci yok</div>
          ) : (
            results.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className={`student-search-item${i === highlight ? ' is-active' : ''}`}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => go(s)}
              >
                <span className="student-search-name">{s.full_name}</span>
                <span className="student-search-meta">{s.grade} · {s.track}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
