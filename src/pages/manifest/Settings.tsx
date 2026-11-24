import { Archive, ArrowDown, ArrowUp, Plus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { eur } from '../../data'
import { useSession } from '../../session/session'
import { TODAY_ISO, useApp } from '../../state'
import { Badge, Button, Row, RowMenu, Section } from '../../ui'
import { DEFAULT_EXTRAS, dmy, extraPriceOn, withExtraPrice, withSportPrice, type DutyRole, type ExtraCost, type ManifestSettings } from './data'
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

const euroText = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2)).replace('.', ',')

/**
 * [Entwurf] One Zusatzkosten item in one slim row: the name is saved when the field is left, a new price holds from its "gültig ab" day on
 * (earlier settlements keep their price), order and archive in the menu.
 */
function ExtraRow({ x, first, last, onSave, onMove }: { x: ExtraCost; first: boolean; last: boolean; onSave: (x: ExtraCost) => void; onMove: (d: -1 | 1) => void }) {
  const [name, setName] = useState(x.name)
  const [edit, setEdit] = useState(false)
  const [history, setHistory] = useState(false)
  const [price, setPrice] = useState('')
  const [since, setSince] = useState(TODAY_ISO)
  const now = extraPriceOn(x, TODAY_ISO)
  const next = x.prices.find((p) => p.since > TODAY_ISO)
  const earlier = x.prices.filter((p) => p.since <= TODAY_ISO).slice(0, -1).reverse()
  const n = num(price), ok = price.trim() !== '' && Number.isFinite(n) && n >= 0 && !!since
  const saveName = () => (name.trim() ? name.trim() !== x.name && onSave({ ...x, name: name.trim() }) : setName(x.name))
  const savePrice = () => { onSave(withExtraPrice(x, Math.round(n * 100) / 100, since)); setEdit(false) }
  if (x.archived) return (
    <div className="flex min-h-11 items-center gap-3 px-5 py-1">
      <span className="min-w-0 flex-1 truncate text-sm text-muted">{x.name}</span>
      <span className="text-sm tabular-nums text-muted">{eur(now)}</span>
      <Button onClick={() => onSave({ ...x, archived: false })}>Wiederherstellen</Button>
    </div>
  )
  return (
    <div>
      <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 px-5 py-1">
        <input aria-label="Bezeichnung" value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} className={`${field} min-w-0 flex-1 basis-40 border-transparent hover:border-line`} />
        {edit ? (
          <span className="flex flex-wrap items-center gap-2 text-sm">
            <input autoFocus aria-label={`Neuer Preis ${x.name}`} inputMode="decimal" value={price} onFocus={(e) => e.target.select()} onChange={(e) => setPrice(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && ok) savePrice(); if (e.key === 'Escape') setEdit(false) }} className={`${field} w-20 text-right tabular-nums`} />
            <span className="text-muted">€ gültig ab</span>
            <input type="date" aria-label="Gültig ab" value={since} min={TODAY_ISO} onChange={(e) => setSince(e.target.value)} className={`${field} w-36`} />
            <Button variant="primary" disabled={!ok} onClick={savePrice}>Speichern</Button>
            <Button onClick={() => setEdit(false)}>Abbrechen</Button>
          </span>
        ) : (
          <>
            <button onClick={() => { setPrice(euroText(now)); setSince(TODAY_ISO); setEdit(true) }} title="Preis ändern" className="rounded-lg px-2 py-1 text-sm tabular-nums hover:bg-slate-100">
              <b className="font-semibold">{eur(now)}</b>{next && <span className="ml-1.5 text-muted">· ab {dmy(next.since).slice(0, 6)} {eur(next.price)}</span>}
            </button>
            <span className="w-16 text-right">{earlier.length > 0 && <button onClick={() => setHistory((h) => !h)} className="text-xs font-medium text-brand hover:underline">{history ? 'ausblenden' : `früher (${earlier.length})`}</button>}</span>
            <span className="flex items-center">
              <Icon label={`${x.name} nach oben`} disabled={first} onClick={() => onMove(-1)}><ArrowUp size={15} /></Icon>
              <Icon label={`${x.name} nach unten`} disabled={last} onClick={() => onMove(1)}><ArrowDown size={15} /></Icon>
              <Icon label={`${x.name} archivieren`} onClick={() => onSave({ ...x, archived: true })}><Archive size={15} /></Icon>
            </span>
          </>
        )}
      </div>
      {history && earlier.length > 0 && (
        <ul className="mx-5 mb-2 divide-y divide-line rounded-lg border border-line text-sm">
          {earlier.map((p) => <li key={p.since} className="flex justify-between px-3 py-1"><span className="text-muted">ab {dmy(p.since)}</span><span className="tabular-nums">{eur(p.price)}</span></li>)}
        </ul>
      )}
    </div>
  )
}

function Icon({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return <button aria-label={label} title={label} disabled={disabled} onClick={onClick} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-slate-100 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent">{children}</button>
}

/** [Entwurf] A new Zusatzkosten item: name and price in one row. */
function NewExtraRow({ onSave, onCancel }: { onSave: (name: string, price: number) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const n = num(price), ok = name.trim() !== '' && price.trim() !== '' && Number.isFinite(n) && n >= 0
  const save = () => ok && onSave(name.trim(), Math.round(n * 100) / 100)
  return (
    <div className="flex min-h-11 flex-wrap items-center gap-2 bg-brand-soft/30 px-5 py-1.5">
      <input autoFocus aria-label="Bezeichnung des neuen Postens" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onCancel() }} placeholder="Bezeichnung" className={`${field} min-w-0 flex-1 basis-40`} />
      <input aria-label="Preis des neuen Postens" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onCancel() }} placeholder="0" className={`${field} w-20 text-right tabular-nums`} />
      <span className="text-sm text-muted">€</span>
      <Button variant="primary" disabled={!ok} onClick={save}>Anlegen</Button>
      <Button onClick={onCancel}>Abbrechen</Button>
    </div>
  )
}

/** [Entwurf] Zusatzkosten of the club: active ones in their order, archived ones folded away. */
function Extras({ extras, commit }: { extras: ExtraCost[]; commit: (x: ExtraCost[]) => void }) {
  const [adding, setAdding] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const active = extras.filter((x) => !x.archived), archived = extras.filter((x) => x.archived)
  const save = (x: ExtraCost) => commit(extras.map((y) => (y.id === x.id ? x : y)))
  const move = (x: ExtraCost, d: -1 | 1) => {
    const i = active.indexOf(x), other = active[i + d]
    if (!other) return
    const order = extras.map((y) => (y.id === x.id ? other : y.id === other.id ? x : y))
    commit(order)
  }
  return (
    <Section title="Zusatzkosten" action={!adding && <Button onClick={() => setAdding(true)}><Plus size={14} /> Posten</Button>}>
      {active.map((x, i) => <ExtraRow key={x.id} x={x} first={i === 0} last={i === active.length - 1} onSave={save} onMove={(d) => move(x, d)} />)}
      {adding && <NewExtraRow onCancel={() => setAdding(false)} onSave={(name, price) => { commit([...extras, { id: `x-${Date.now()}`, name, prices: [{ price, since: TODAY_ISO }] }]); setAdding(false) }} />}
      {active.length === 0 && !adding && <p className="px-5 py-4 text-sm text-muted">Noch kein Posten.</p>}
      {archived.length > 0 && (
        <div className="px-5 py-2">
          <button onClick={() => setShowArchived((s) => !s)} className="text-xs font-medium text-brand hover:underline">{showArchived ? 'Archivierte ausblenden' : `Archiviert (${archived.length})`}</button>
        </div>
      )}
      {showArchived && archived.map((x) => <ExtraRow key={x.id} x={x} first last onSave={save} onMove={() => undefined} />)}
    </Section>
  )
}

/** Settings of the manifest, per club: prices, usual gap between flights and operating hours, duties of a day. Changing them needs a confirmation on public devices. */
export default function ManifestSettingsPage() {
  const { settings, setSettings, functions } = useApp()
  const { guarded } = useSession()
  const [editing, setEditing] = useState<DutyRole | 'new' | null>(null)
  const commit = (next: Partial<ManifestSettings>) => guarded('manifest.settings.edit', () => setSettings({ ...settings, ...next }))
  const fnNames = (r: DutyRole) => (r.functions.length === 0 ? 'jedes Mitglied' : r.functions.map((c) => functions.find((f) => f.code === c)?.name ?? c).join(' oder '))
  const extras = settings.extras ?? DEFAULT_EXTRAS
  const saveRole = (r: DutyRole) => { commit({ roles: settings.roles.some((x) => x.id === r.id) ? settings.roles.map((x) => (x.id === r.id ? r : x)) : [...settings.roles, r] }); setEditing(null) }

  return (
    <div className="max-w-3xl space-y-4">
      <Section title="Preise"><SportPrice /></Section>

      <Extras extras={extras} commit={(x) => commit({ extras: x })} />

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
