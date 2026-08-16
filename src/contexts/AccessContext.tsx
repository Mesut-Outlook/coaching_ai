import { createContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { ALL_PERMISSIONS, type PermissionKey } from '../lib/permissions'

export interface UserMembershipAccess {
  institution_id: string
  institution_name: string
  /** true = bireysel koçluk pratiği (Netlik) — öğrenci listesi koça göre kurulur */
  is_coaching_practice: boolean
  /** null = gerçek üyelik değil; sistem admini için türetilmiş kurum girdisi */
  role_id: string | null
  role_key: string
  role_name: string
  permissions: PermissionKey[]
}

/**
 * Öğrenci sorgularının kapsamı. Doğrudan `fetchStudents`'a yayılacak şekilde
 * tasarlandı: `fetchStudents({ ...studentScope })`.
 * Normal kurumda yalnız `institutionId` dolar; Netlik gibi koçluk pratiklerinde
 * `coachingCoachId` de dolar ve sorgu OR'a döner.
 */
export interface StudentScope {
  institutionId: string | null
  coachingCoachId: string | null
}

interface AccessContextValue {
  loading: boolean
  isSystemAdmin: boolean
  memberships: UserMembershipAccess[]
  activeInstitutionId: string | null
  setActiveInstitution: (id: string | null) => void
  /** Aktif kuruma göre hazırlanmış öğrenci sorgu kapsamı */
  studentScope: StudentScope
  can: (key: PermissionKey) => boolean
  refetchAccess: () => Promise<void>
}

export const AccessContext = createContext<AccessContextValue | undefined>(undefined)

const STORAGE_KEY = 'netlik_active_institution_id'

export function AccessProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [isSystemAdmin, setIsSystemAdmin] = useState(false)
  const [memberships, setMemberships] = useState<UserMembershipAccess[]>([])
  const [activeInstitutionId, setActiveInstitutionIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY)
    } catch {
      return null
    }
  })

  const setActiveInstitution = useCallback((id: string | null) => {
    setActiveInstitutionIdState(id)
    try {
      if (id) {
        localStorage.setItem(STORAGE_KEY, id)
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      // localStorage kapalıysa göz ardı et
    }
  }, [])

  const fetchAccess = useCallback(async () => {
    // Auth henüz oturumu çözmediyse user null'dur. Bunu "izni yok" saymak,
    // sayfa yenilendiğinde RequirePermission'ı boş izin kümesiyle çalıştırıp
    // kullanıcıyı /yardim'a atıyordu. Auth bitene kadar yüklemede kal.
    if (authLoading) {
      setLoading(true)
      return
    }

    if (!user || !isSupabaseConfigured) {
      setIsSystemAdmin(false)
      setMemberships([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('my_access')
      if (error) {
        console.error('Erişim bilgisi çekilemedi:', error)
        setIsSystemAdmin(false)
        setMemberships([])
      } else if (data && typeof data === 'object' && 'ok' in data && data.ok) {
        const res = (data as unknown) as {
          ok: boolean
          is_system_admin: boolean
          memberships: UserMembershipAccess[]
        }
        setIsSystemAdmin(!!res.is_system_admin)

        const own = res.memberships || []

        // my_access() yalnız gerçek üyelikleri döndürür. Sistem admini üye OLMADIĞI
        // kurumu kurum seçicide hiç göremiyordu — seçici bu listeden besleniyor —
        // ve o kuruma davet gönderemiyordu. Admin için eksik kurumları ekliyoruz.
        if (res.is_system_admin) {
          const { data: instRows } = await supabase
            .from('institutions')
            .select('id, name, is_coaching_practice')
            .order('name')

          const known = new Set(own.map((m) => m.institution_id))
          const extras: UserMembershipAccess[] = (instRows || [])
            .filter((i) => !known.has(i.id))
            .map((i) => ({
              institution_id: i.id,
              institution_name: i.name,
              is_coaching_practice: i.is_coaching_practice,
              role_id: null,
              role_key: 'sistem_yoneticisi',
              role_name: 'Sistem Yöneticisi',
              permissions: ALL_PERMISSIONS,
            }))

          setMemberships([...own, ...extras])
        } else {
          setMemberships(own)
        }
      }
    } catch (err) {
      console.error('my_access çağrı hatası:', err)
    } finally {
      setLoading(false)
    }
  }, [user, authLoading])

  useEffect(() => {
    fetchAccess()
  }, [fetchAccess])

  const can = useCallback(
    (key: PermissionKey): boolean => {
      if (isSystemAdmin) return true

      if (activeInstitutionId) {
        const m = memberships.find((item) => item.institution_id === activeInstitutionId)
        return m ? m.permissions.includes(key) : false
      }

      return memberships.some((m) => m.permissions.includes(key))
    },
    [isSystemAdmin, activeInstitutionId, memberships]
  )

  // Aktif kurum bir koçluk pratiğiyse (Netlik) listeye kendi koçluk öğrencilerimizi de kat.
  // Sistem admini de dahil: kendi koçluk verdikleri + kurumun öğrencileri birlikte gelir.
  // useMemo şart: referansı sabit kalmazsa bunu bağımlılık dizisine koyan her
  // useEffect sonsuz döngüye girer.
  const studentScope = useMemo<StudentScope>(() => {
    const active = memberships.find((m) => m.institution_id === activeInstitutionId)
    return {
      institutionId: activeInstitutionId,
      coachingCoachId: active?.is_coaching_practice && user ? user.id : null,
    }
  }, [memberships, activeInstitutionId, user])

  return (
    <AccessContext.Provider
      value={{
        loading,
        isSystemAdmin,
        memberships,
        activeInstitutionId,
        setActiveInstitution,
        studentScope,
        can,
        refetchAccess: fetchAccess,
      }}
    >
      {children}
    </AccessContext.Provider>
  )
}

export { useAccess } from './useAccess'
