import { ArrowLeft } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { aircraft } from '../../data'
import { useApp } from '../../state'
import { PageHeader, Segmented } from '../../ui'
import MassBalance from './Envelope'

/**
 * The mass and balance calculator of one aircraft, for every pilot. It only reads the data; changing them (empty mass, envelope, stations)
 * needs `aircraft.edit` and happens under Flugzeuge > Masse und Schwerpunkt.
 */
export default function MassBalanceTool() {
  const { id = 'a1' } = useParams()
  const nav = useNavigate()
  const { aircraftData, can } = useApp()
  const ac = aircraft.find((a) => a.id === id) ?? aircraft[0]
  const edit = `/flugzeuge/${ac.id}?tab=masse`
  const configure = can('aircraft.edit') ? <Link to={edit} className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-sm font-medium hover:bg-slate-50">Daten ergänzen</Link> : undefined
  return (
    <>
      <button onClick={() => nav('/flugzeuge')} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft size={14} /> Alle Flugzeuge</button>
      <PageHeader title="Masse und Schwerpunkt" actions={configure && <Link to={edit} className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-sm font-medium hover:bg-slate-50">Daten bearbeiten</Link>} />
      <div className="mb-4"><Segmented value={ac.id} onChange={(v) => nav(`/flugzeuge/${v}/rechner`)} options={aircraft.map((a) => ({ value: a.id, label: `${a.reg} · ${a.type}` }))} /></div>
      <MassBalance key={ac.id} d={aircraftData[ac.id]} configure={configure} />
    </>
  )
}
