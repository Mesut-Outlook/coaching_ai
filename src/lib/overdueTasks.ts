import { WHATSAPP_SIGNATURE } from './brand'

// Geçmiş günlerdeki (day_index < bugün) işaretsiz görevler; mola/serbest blokları sayılmaz.
// Çağıran görevleri zaten bu haftaya süzmüş olmalı.
export function overdueTasks<T extends { day_index: number; completed: boolean; block_kind?: string | null }>(
  tasks: T[],
  todayIndex: number,
): T[] {
  return tasks.filter(
    (x) => x.day_index < todayIndex && !x.completed && x.block_kind !== 'mola' && x.block_kind !== 'serbest',
  )
}

export function buildTaskReminderMessage(name: string, count: number, portalLink: string): string {
  return `Merhaba ${name}, programında geçmiş günlerden ${count} görev işaretlenmemiş görünüyor. Yaptıysan portaldan işaretlemeyi unutma, yapmadıysan bugün telafi edelim 💪\n${portalLink}\n\n— ${WHATSAPP_SIGNATURE}`
}
