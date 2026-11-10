import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { eur } from '../../data'
import { useSession } from '../../session/session'
import { TODAY_ISO, useApp } from '../../state'
import { Badge, Button, Row, RowMenu, Section } from '../../ui'
import { dmy, withSportPrice, type DutyRole, type ManifestSettings } from './data'
import DutyRoleDrawer from './DutyRoleDrawer'

const field = 'h-9 rounded-lg border border-line bg-surface px-2.5 text-sm outline-none focus:border-brand'
const num = (v: string) => Number(v.replace(',', '.'))

/** A whole number that is saved when the field is left (no extra Speichern button); an invalid entry falls back to the saved value. */
function NumField({ value, min, unit, label, onSave }: { value: number; min: number; unit: string; label: string; onSave: (n: number) => void }) {
  const [v, setV] = useState(String(value))
  const done = () => { const n = num(v); if (Number.isInteger(n) && n >= min) { if (n !== value) onSave(n) } else setV(String(value)) }
  return (
    <>
      <input aria-label={label} inputMode="numeric" value={v} onChange={(e) => setV(e.target.value.replace(/\D/g, ''))} onBlur={done} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} className={`${field} w-20 text-right tabular-nums`} />
      <span className="w-14 text-muted">{unit}</span>
    </>
  )
}

/** The price of a sport jump: the current price, a change from today on, and the archive of the earlier prices. */
function SportPrice() {
  const { settings, setSettings } = useApp()
  const { guarded } = useSession()
  const [edit, setEdit] = useState(false)
  const [show, setShow] = useState(false)
  const [v, setV] = useState('')
  const ok = v.trim() !== '' && Number.isFinite(num(v)) && num(v) >= 0 && num(v) !== settings.sportPrice
  const save = () => { guarded('manifest.settings.edit', () => setSettings(withSportPrice(settings, num(v), TODAY_ISO))); setEdit(false); setShow(true) }
  return (
    <>
      <Row label="Sprungpreis Sportspringer" hint={<>Tandem-Preise stehen unter <Link to="/tickets?tab=arten" className="text-brand">Tickets und Voucher</Link></>}>
        {edit ? (
          <>
            <input autoFocus aria-label="Neuer Sprungpreis" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && ok) save(); if (e.key === 'Escape') setEdit(false) }} className={`${field} w-24 text-right tabular-nums`} />
            <span className="text-muted">€ ab heute</span>
            <Button variant="primary" disabled={!ok} onClick={save}>Speichern</Button>
            <Button onClick={() => setEdit(false)}>Abbrechen</Button>
          </>
        ) : (
          <>
            <span className="tabular-nums"><b>{eur(settings.sportPrice)}</b> <span className="text-muted">je Sprung · seit {dmy(settings.sportPriceSince)}</span></span>
            <Button onClick={() => { setV(String(settings.sportPrice).replace('.', ',')); setEdit(true) }}>Ändern</Button>
          </>
        )}
      </Row>
      {settings.sportPriceHistory.length > 0 && (
        <div className="px-5 py-2 text-sm">
          <button onClick={() => setShow((s) => !s)} className="text-xs font-medium text-brand hover:underline">{show ? 'Frühere Preise ausblenden' : `Frühere Preise (${settings.sportPriceHistory.length})`}</button>
          {show && (
            <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
              {settings.sportPriceHistory.map((h) => <li key={h.since} className="flex items-center justify-between px-3 py-1.5"><span className="text-muted">{dmy(h.since)} bis {dmy(h.until)}</span><span className="tabular-nums">{eur(h.price)} je Sprung</span></li>)}
            </ul>
          )}
        </div>
      )}
    </>
  )
}

/** Settings of the manifest, per club: prices, usual gap between flights and operating hours, duties of a day. Changing them needs a confirmation on public devices. */
export default function ManifestSettingsPage() {
  const { settings, setSettings, functions } = useApp()
  const { guarded } = useSession()
  const [editing, setEditing] = useState<DutyRole | 'new' | null>(null)
  const commit = (next: Partial<ManifestSettings>) => guarded('manifest.settings.edit', () => setSettings({ ...settings, ...next }))
  const fnNames = (r: DutyRole) => (r.functions.length === 0 ? 'jedes Mitglied' : r.functions.map((c) => functions.find((f) => f.code === c)?.name ?? c).join(' oder '))
  const saveRole = (r: DutyRole) => { commit({ roles: settings.roles.some((x) => x.id === r.id) ? settings.roles.map((x) => (x.id === r.id ? r : x)) : [...settings.roles, r] }); setEditing(null) }

  return (
    <div className="max-w-3xl space-y-4">
      <Section title="Preise"><SportPrice /></Section>

      <Section title="Flugbetrieb">
        <Row label="Standardabstand zwischen Flügen" hint="bestimmt „+ Flug“ und „Mehrere …“"><NumField label="Abstand in Minuten" value={settings.loadGap} min={5} unit="Minuten" onSave={(n) => commit({ loadGap: n })} /></Row>
        <Row label="Standard-Flugzeit (Cycle Time)" hint="Vorgabe im AFP"><NumField label="Flugzeit in Minuten" value={settings.cycleMin} min={5} unit="Minuten" onSave={(n) => commit({ cycleMin: n })} /></Row>
        <Row label="Betriebszeit neuer Tage">
          <input type="time" aria-label="Betrieb von" value={settings.from} onChange={(e) => e.target.value && e.target.value < settings.to && commit({ from: e.target.value })} className={`${field} w-28`} />
          <span className="text-muted">bis</span>
          <input type="time" aria-label="Betrieb bis" value={settings.to} onChange={(e) => e.target.value && e.target.value > settings.from && commit({ to: e.target.value })} className={`${field} w-28`} />
        </Row>
      </Section>

      <Section title="Dienste eines Manifest-Tags" action={<Button onClick={() => setEditing('new')}><Plus size={14} /> Dienst</Button>}>
        {settings.roles.map((r) => (
          <div key={r.id} className="flex min-h-14 items-center gap-3 px-5 py-2">
            <div className="min-w-0 flex-1"><div className="text-sm font-medium">{r.name}</div><div className="text-xs text-muted">Darf: {fnNames(r)}</div></div>
            {r.required ? <Badge tone="info">Pflicht{r.min > 1 ? `, mind. ${r.min}` : ''}</Badge> : <Badge>optional</Badge>}
            <RowMenu actions={[{ label: 'Bearbeiten', onSelect: () => setEditing(r) }, { label: 'Löschen', danger: true, onSelect: () => commit({ roles: settings.roles.filter((x) => x.id !== r.id) }) }]} />
          </div>
        ))}
        {settings.roles.length === 0 && <p className="px-5 py-4 text-sm text-muted">Noch kein Dienst.</p>}
      </Section>

      {editing && <DutyRoleDrawer role={editing} onClose={() => setEditing(null)} onSave={saveRole} onDelete={(id) => { commit({ roles: settings.roles.filter((x) => x.id !== id) }); setEditing(null) }} />}
    </div>
  )
}
