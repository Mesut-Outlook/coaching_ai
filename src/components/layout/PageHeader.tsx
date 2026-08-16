import type { ReactNode } from 'react'
import StudentSearch from './StudentSearch'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  /** Öğrenci profili gibi zaten tek öğrenciye odaklı ekranlarda aramayı gizle */
  hideSearch?: boolean
}

export default function PageHeader({ title, subtitle, actions, hideSearch }: PageHeaderProps) {
  return (
    <div className="topbar topbar-static">
      <div>
        <h1 className="topbar-title">{title}</h1>
        {subtitle && <p className="topbar-sub">{subtitle}</p>}
      </div>
      <div className="topbar-right">
        {!hideSearch && <StudentSearch />}
        {actions}
      </div>
    </div>
  )
}
