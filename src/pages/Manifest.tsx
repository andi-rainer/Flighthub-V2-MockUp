import { ArrowRight, Plane, Users } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { comingFrom } from '../backTo'
import { useApp } from '../state'
import { Badge, Button, Card, PageHeader, Segmented, usePaging } from '../ui'
import DayForm from './manifest/DayForm'
import DutyPlan from './manifest/DutyPlan'
import ManifestSettingsPage from './manifest/Settings'
import { dayName, missingDuties, windowLabel, type DayStatus, type ManifestDay } from './manifest/data'

const statusTone: Record<DayStatus, 'ok' | 'info' | 'neutral' | 'bad'> = { aktiv: 'ok', geplant: 'info', abgeschlossen: 'neutral', abgesagt: 'bad' }
const statusLabel: Record<DayStatus, string> = { aktiv: 'Läuft', geplant: 'Geplant', abgeschlossen: 'Abgeschlossen', abgesagt: 'Abgesagt' }
const FROM = { label: 'Manifest', to: '/manifest' }

/** Entry of the menu item "Manifest": the days. The running day is one tap away, other days can be planned, changed and looked at. */
export default function Manifest() {
  const { days, loads, bookings, can, settings } = useApp()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const mayPrices = can('manifest.settings.edit')
  const tab = params.get('tab')
  const view: 'tage' | 'dienstplan' | 'einstellungen' = tab === 'dienstplan' ? 'dienstplan' : mayPrices && tab === 'einstellungen' ? 'einstellungen' : 'tage'
  const [creating, setCreating] = useState(false)
  const [filter, setFilter] = useState<'kommend' | 'vergangen' | 'alle'>('kommend')
  const open = (d: ManifestDay) => nav(`/manifest/${d.id}`, comingFrom(FROM))
  const running = days.find((d) => d.status === 'aktiv')
  const isPast = (d: ManifestDay) => d.status === 'abgeschlossen' || d.status === 'abgesagt'
  const list = days.filter((d) => (filter === 'alle' || (filter === 'vergangen' ? isPast(d) : !isPast(d))) && d.id !== (filter === 'kommend' ? running?.id : ''))
    .sort((a, b) => (filter === 'vergangen' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)))
  const paging = usePaging(list, filter)

  const tandemLine = (d: ManifestDay) => {
    if (d.windows.length === 0) return 'Nur Sportspringer'
    const cap = d.windows.reduce((n, w) => n + w.capacity, 0)
    const n = bookings.filter((b) => b.dayId === d.id && b.state === 'gebucht').length
    return `Tandem: ${d.windows.length} Fenster, ${n} von ${cap} gebucht`
  }
  const flights = (d: ManifestDay) => d.done?.flights ?? loads.filter((l) => l.dayId === d.id).length

  return (
    <>
      <PageHeader title="Manifest" actions={view === 'tage' && can('manifest.operation_days.create') && <Button variant="primary" onClick={() => setCreating(true)}>Neuer Tag</Button>} />
      <div className="mb-4"><Segmented value={view} onChange={(v) => setParams(v === 'tage' ? {} : { tab: v }, { replace: true })} options={[{ value: 'tage', label: 'Tage' }, { value: 'dienstplan', label: 'Dienstplan' }, ...(mayPrices ? [{ value: 'einstellungen' as const, label: 'Einstellungen' }] : [])]} /></div>
      {view === 'einstellungen' ? <ManifestSettingsPage /> : view === 'dienstplan' ? <DutyPlan /> : <>

      {running && filter === 'kommend' && (
        <Card className="mb-5 flex flex-wrap items-center gap-4 border-ok/40 bg-ok-soft/40 p-5">
          <div className="min-w-0 flex-1 basis-60">
            <div className="flex items-center gap-2"><Badge tone="ok">Läuft</Badge><span className="text-lg font-semibold">{dayName(running.date)}</span></div>
            <div className="mt-1 text-sm text-muted">{running.aircraft} · {flights(running)} Flüge · {tandemLine(running)}</div>
          </div>
          <Button variant="primary" size="lg" onClick={() => open(running)}>Zum Manifest <ArrowRight size={18} /></Button>
        </Card>
      )}

      <div className="mb-4"><Segmented value={filter} onChange={setFilter} options={[{ value: 'kommend', label: 'Kommende' }, { value: 'vergangen', label: 'Vergangene' }, { value: 'alle', label: 'Alle' }]} /></div>
      <Card className="divide-y divide-line">
        {paging.rows.map((d) => (
          <div key={d.id} onClick={() => open(d)} className="flex cursor-pointer flex-wrap items-center gap-3 px-5 py-4 hover:bg-slate-50">
            <div className="min-w-0 flex-1 basis-56">
              <div className="font-medium">{dayName(d.date)}</div>
              <div className="flex flex-wrap items-center gap-x-3 text-sm text-muted">
                <span className="inline-flex items-center gap-1"><Plane size={13} /> {d.aircraft} · {d.from}–{d.to}</span>
                <span className="inline-flex items-center gap-1"><Users size={13} /> {tandemLine(d)}</span>
              </div>
              {d.windows.length > 0 && <div className="mt-0.5 text-xs text-muted">{d.windows.map(windowLabel).join(' · ')}</div>}
            </div>
            {d.note && <span className="text-sm text-muted">{d.note}</span>}
            <span className="text-sm text-muted">{flights(d)} {flights(d) === 1 ? 'Flug' : 'Flüge'}</span>
            {d.status === 'geplant' && missingDuties(d, settings.roles).length > 0 && <Badge tone="warn">Dienst fehlt</Badge>}
            <Badge tone={statusTone[d.status]}>{statusLabel[d.status]}</Badge>
          </div>
        ))}
        {paging.rows.length === 0 && <p className="px-5 py-8 text-center text-sm text-muted">{filter === 'vergangen' ? 'Noch keine vergangenen Tage.' : 'Keine weiteren Tage geplant.'}</p>}
        {paging.bar}
      </Card>
      </>}

      <DayForm open={creating} onClose={() => setCreating(false)} onSaved={(d) => nav(`/manifest/${d.id}`, comingFrom(FROM))} />
    </>
  )
}
