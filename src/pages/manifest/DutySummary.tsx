import { members } from '../../data'
import { dayHours, dutyGaps, type DutyRole, type ManifestDay } from './data'

const short = (id: string) => { const [first, ...rest] = (members.find((m) => m.id === id)?.name ?? '–').split(' '); return `${first} ${rest.map((r) => r[0]).join('')}.` }

/**
 * The duties of a day as a small side note: who is there, and which duty is still missing. Editing happens elsewhere, this is only to read.
 * Shifts that cover the whole day show no hours.
 */
export default function DutySummary({ day, roles, onEdit }: { day: Pick<ManifestDay, 'from' | 'to' | 'duties'>; roles: DutyRole[]; onEdit?: () => void }) {
  const { from, to } = dayHours(day)
  const parts = roles.map((r) => {
    const shifts = (day.duties[r.id] ?? []).filter((s) => s.memberId).sort((a, b) => a.from - b.from)
    const gaps = dutyGaps(day, r)
    return { r, shifts, gaps }
  }).filter((p) => p.shifts.length > 0 || p.gaps.length > 0)
  if (parts.length === 0 && !onEdit) return null
  return (
    <p className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-xs text-muted">
      {parts.map(({ r, shifts, gaps }) => (
        <span key={r.id}>
          <span className="font-medium text-ink">{r.name}:</span>{' '}
          {shifts.map((s, i) => <span key={i}>{i > 0 && ', '}{short(s.memberId)}{s.from > from || s.to < to ? ` ${s.from}–${s.to}` : ''}</span>)}
          {gaps.length > 0 && <span className="font-medium text-warn">{shifts.length > 0 ? ', ' : ''}{shifts.length === 0 ? 'fehlt' : `fehlt ${gaps.map(([f, t]) => `${f}–${t}`).join(', ')}`}</span>}
        </span>
      ))}
      {parts.length === 0 && <span>Keine Dienste eingetragen</span>}
      {onEdit && <button onClick={onEdit} className="font-medium text-brand hover:underline">Dienste bearbeiten</button>}
    </p>
  )
}
