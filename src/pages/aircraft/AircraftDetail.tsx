import clsx from 'clsx'
import { ArrowLeft, Calculator } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Badge } from '../../ui'
import { TODAY_ISO } from '../../state'
import Components from './Components'
import { dueList } from './data'
import Documents from './Documents'
import MassBalanceConfig from './MassBalanceConfig'
import { Costs, MasterData } from './MasterData'
import Maintenance from './Maintenance'
import Overview from './Overview'
import { effectiveStatus, STATUS, useAircraft } from './parts'

const TABS = [
  { id: 'uebersicht', label: 'Übersicht' },
  { id: 'wartung', label: 'Wartung' },
  { id: 'komponenten', label: 'Komponenten' },
  { id: 'dokumente', label: 'Dokumente' },
  { id: 'masse', label: 'Masse und Schwerpunkt' },
  { id: 'stammdaten', label: 'Stammdaten' },
  { id: 'kosten', label: 'Kosten' },
] as const
type TabId = (typeof TABS)[number]['id']
const DUE_TAB: Record<string, TabId> = { wartung: 'wartung', komponenten: 'komponenten', dokumente: 'dokumente' }

/** One aircraft in tabs, like the member file. The calculator is a tool of its own; the data behind it are edited under "Masse und Schwerpunkt". */
export default function AircraftDetail() {
  const { id = 'a1' } = useParams()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const { ac, d } = useAircraft(id)
  const tab = TABS.find((t) => t.id === params.get('tab'))?.id ?? 'uebersicht'
  const go = (t: string) => setParams(t === 'uebersicht' ? {} : { tab: t }, { replace: true })
  const status = STATUS[effectiveStatus(ac.status, d)]
  // Tabs with something that needs attention get a dot.
  const attention = new Set(dueList(d, TODAY_ISO).filter((x) => x.tone !== 'ok').map((x) => DUE_TAB[x.tab]))

  return (
    <>
      <button onClick={() => nav('/flugzeuge')} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft size={14} /> Alle Flugzeuge</button>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{ac.reg} <span className="text-lg font-normal text-muted">{ac.type}</span></h1>
          <div className="mt-2 flex flex-wrap gap-2"><Badge tone={status.tone}>{status.label}</Badge>{ac.uses.map((u) => <Badge key={u} tone="info">{u}</Badge>)}</div>
        </div>
        <Link to={`/flugzeuge/${ac.id}/rechner`} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-medium hover:bg-slate-50"><Calculator size={15} /> Masse und Schwerpunkt rechnen</Link>
      </div>
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => <button key={t.id} onClick={() => go(t.id)} className={clsx('relative shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium', tab === t.id ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink')}>{t.label}{attention.has(t.id) && <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-warn align-middle" aria-label="Achtung" />}</button>)}
      </div>
      <div className="max-w-4xl">
        {tab === 'uebersicht' && <Overview id={ac.id} onTab={(t) => go(DUE_TAB[t])} />}
        {tab === 'wartung' && <Maintenance id={ac.id} />}
        {tab === 'komponenten' && <Components id={ac.id} />}
        {tab === 'dokumente' && <Documents id={ac.id} />}
        {tab === 'masse' && <MassBalanceConfig id={ac.id} />}
        {tab === 'stammdaten' && <MasterData id={ac.id} />}
        {tab === 'kosten' && <Costs id={ac.id} />}
      </div>
    </>
  )
}
