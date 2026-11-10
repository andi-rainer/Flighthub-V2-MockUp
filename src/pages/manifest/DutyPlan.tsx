import clsx from 'clsx'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { members } from '../../data'
import { useApp } from '../../state'
import { Badge, Button, Card, Drawer, usePaging } from '../../ui'
import { dayHours, dayName, dutyCounts, dutyGaps, hourRange, withShifts, type ManifestDay } from './data'
import DutyFields from './DutyFields'

const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? '–'

/** Duty roster: who covers which duty on the coming days (edit per day) and how often and how long each member has done which duty. */
export default function DutyPlan() {
  const { days, setDays, settings, can } = useApp()
  const mayEdit = can('manifest.operation_days.edit')
  const [editing, setEditing] = useState<string | null>(null)
  const day = days.find((d) => d.id === editing)
  const coming = days.filter((d) => d.status === 'geplant' || d.status === 'aktiv').sort((a, b) => a.date.localeCompare(b.date))
  const counts = dutyCounts(days)
  const total = (id: string) => Object.values(counts[id] ?? {}).reduce((n, c) => n + c.done, 0)
  const people = members.filter((m) => counts[m.id]).sort((a, b) => total(b.id) - total(a.id) || a.name.localeCompare(b.name))
  const paging = usePaging(people, 'duty-people')
  const cell = (d: ManifestDay, roleId: string) => (d.duties[roleId] ?? []).filter((s) => s.memberId)
  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Kommende Tage</h2>
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line text-left text-xs text-muted"><th className="px-4 py-2 font-medium">Tag</th>{settings.roles.map((r) => <th key={r.id} className="px-2 py-2 font-medium">{r.name}{r.required ? ' *' : ''}</th>)}<th /></tr></thead>
            <tbody className="divide-y divide-line">
              {coming.map((d) => (
                <tr key={d.id}>
                  <td className="whitespace-nowrap px-4 py-2 align-top"><Link to={`/manifest/${d.id}`} className="font-medium hover:text-brand">{dayName(d.date)}</Link></td>
                  {settings.roles.map((r) => {
                    const shifts = cell(d, r.id)
                    const gap = dutyGaps(d, r).length > 0
                    return (
                      <td key={r.id} className={clsx('px-2 py-2 align-top', gap && 'bg-warn-soft/50')}>
                        {shifts.map((s, i) => <div key={i}>{nameOf(s.memberId)} <span className="text-xs text-muted">{hourRange(s)}</span></div>)}
                        {gap && <div className="text-xs text-warn">{shifts.length === 0 ? 'unbesetzt' : `Lücke: ${dutyGaps(d, r).map(([f, t]) => `${f}–${t}`).join(', ')} Uhr`}</div>}
                        {!gap && shifts.length === 0 && <span className="text-muted">–</span>}
                      </td>
                    )
                  })}
                  <td className="px-2 py-2 text-right align-top">{mayEdit && <Button onClick={() => setEditing(d.id)}>Bearbeiten</Button>}</td>
                </tr>
              ))}
              {coming.length === 0 && <tr><td className="px-4 py-6 text-center text-muted" colSpan={settings.roles.length + 2}>Keine kommenden Tage.</td></tr>}
            </tbody>
          </table>
        </Card>
        {settings.roles.some((r) => r.required) && <p className="mt-1 flex items-center gap-1 text-xs text-muted">* Pflichtdienst: eine Lücke wird gemeldet, der Tag lässt sich trotzdem starten.</p>}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Wer hat wie oft</h2>
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line text-left text-xs text-muted"><th className="px-4 py-2 font-medium">Mitglied</th>{settings.roles.map((r) => <th key={r.id} className="px-4 py-2 text-right font-medium">{r.name}</th>)}</tr></thead>
              <tbody className="divide-y divide-line">
                {paging.rows.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-2 font-medium">{m.name}</td>
                    {settings.roles.map((r) => {
                      const c = counts[m.id]?.[r.id]
                      return <td key={r.id} className="px-4 py-2 text-right tabular-nums">{c ? <>{c.done}× · {c.hours} h{c.planned > 0 && <Badge tone="info">+ {c.planned} geplant</Badge>}</> : <span className="text-muted">–</span>}</td>
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {paging.bar}
        </Card>
      </section>

      <Drawer open={!!day} title={day ? `Dienste · ${dayName(day.date)}` : ''} size="xl" onClose={() => setEditing(null)}>
        {day && <DutyFields roles={settings.roles} duties={day.duties} hours={dayHours(day)} onChange={(r, s) => setDays((all) => all.map((x) => (x.id === day.id ? withShifts(x, r, s) : x)))} />}
      </Drawer>
    </div>
  )
}
