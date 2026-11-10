import { useState } from 'react'
import { type Category, type CostCenter } from '../../data'
import { Badge, Button, Card, Segmented } from '../../ui'
import { type Ledger } from './ledger'

const field = 'h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-brand'
const GROUPS: { kind: CostCenter['kind']; title: string; hint?: string }[] = [
  { kind: 'Flugzeug', title: 'Flugzeuge', hint: 'wird bei den Flugzeugen verwaltet' },
  { kind: 'Sparte', title: 'Sparten' },
  { kind: 'Allgemein', title: 'Allgemein' },
]

/** Where a cost arises (cost centers) and what it was (categories). Nothing is hard-coded: rename, add or archive. Archived ones stay on old bookings. */
export default function Config({ ledger }: { ledger: Ledger }) {
  // How often each cost center and category is used on bookings, so a person sees what is in use before archiving it.
  const ccUse = new Map<string, number>()
  const catUse = new Map<string, number>()
  for (const l of ledger.lines) {
    const codings = ledger.codingOfLine(l)
    for (const id of new Set(codings.map((c) => c.costCenterId))) ccUse.set(id, (ccUse.get(id) ?? 0) + 1)
    for (const id of new Set(codings.map((c) => c.categoryId))) catUse.set(id, (catUse.get(id) ?? 0) + 1)
  }
  return (
    <div className="grid gap-5 2xl:grid-cols-2">
      <CostCenters ledger={ledger} use={ccUse} />
      <Categories ledger={ledger} use={catUse} />
    </div>
  )
}

const Uses = ({ n }: { n: number }) => <span className="w-24 shrink-0 text-right text-xs text-muted">{n === 0 ? 'ungenutzt' : `${n} Buchungen`}</span>
const ArchiveButton = ({ archived, onClick }: { archived?: boolean; onClick: () => void }) => (
  <button onClick={onClick} title={archived ? undefined : 'Wird bei neuen Buchungen nicht mehr angeboten, alte bleiben unverändert'} className="w-24 shrink-0 text-right text-sm text-brand hover:underline">{archived ? 'Wiederherstellen' : 'Archivieren'}</button>
)

function CostCenters({ ledger, use }: { ledger: Ledger; use: Map<string, number> }) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'' | 'Sparte' | 'Allgemein'>('')
  const [showOld, setShowOld] = useState(false)
  const old = ledger.costCenters.filter((c) => c.archived)
  const row = (c: CostCenter) => (
    <div key={c.id} className="flex items-center gap-3 py-1.5">
      <input value={c.name} disabled={c.kind === 'Flugzeug' || c.archived} onChange={(e) => ledger.patchCostCenter(c.id, { name: e.target.value })} className={field} aria-label="Name" />
      <Uses n={use.get(c.id) ?? 0} />
      {c.kind === 'Flugzeug' ? <span className="w-24 shrink-0" /> : <ArchiveButton archived={c.archived} onClick={() => ledger.patchCostCenter(c.id, { archived: !c.archived })} />}
    </div>
  )
  return (
    <Card className="p-4">
      <h2 className="mb-1 font-semibold">Kostenstellen</h2>
      {GROUPS.map((g) => {
        const rows = ledger.costCenters.filter((c) => c.kind === g.kind && !c.archived)
        return (
          <section key={g.kind} className="mt-3">
            <div className="flex items-baseline justify-between text-xs font-medium uppercase tracking-wide text-muted"><span>{g.title}</span>{g.hint && <span className="font-normal normal-case">{g.hint}</span>}</div>
            <div className="divide-y divide-line">{rows.map(row)}</div>
            {rows.length === 0 && <p className="py-2 text-sm text-muted">Keine.</p>}
          </section>
        )
      })}
      {old.length > 0 && (
        <div className="mt-3 border-t border-line pt-2">
          <button onClick={() => setShowOld(!showOld)} className="text-sm text-brand">{showOld ? 'Archivierte ausblenden' : `${old.length} archivierte anzeigen`}</button>
          {showOld && <div className="mt-1 divide-y divide-line opacity-70">{old.map(row)}</div>}
        </div>
      )}
      <div className="mt-3 space-y-2 border-t border-line pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Neue Kostenstelle" className={field} />
          <Segmented value={kind} onChange={setKind} options={[{ value: 'Sparte', label: 'Sparte' }, { value: 'Allgemein', label: 'Allgemein' }]} />
          <Button variant="primary" disabled={!name.trim() || !kind} onClick={() => { if (kind) { ledger.addCostCenter(name.trim(), kind); setName(''); setKind('') } }}>Anlegen</Button>
        </div>
      </div>
    </Card>
  )
}

function Categories({ ledger, use }: { ledger: Ledger; use: Map<string, number> }) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'' | Category['type']>('')
  const [behaviour, setBehaviour] = useState<'' | 'var' | 'fix'>('')
  const [showOld, setShowOld] = useState(false)
  const old = ledger.categories.filter((c) => c.archived)
  const row = (c: Category) => (
    <div key={c.id} className="flex flex-wrap items-center gap-3 py-1.5">
      <input value={c.name} disabled={c.archived} onChange={(e) => ledger.patchCategory(c.id, { name: e.target.value })} className={field} aria-label="Name" />
      {c.type === 'Kosten' && <Segmented<'fix' | 'var'> value={c.fixed ? 'fix' : 'var'} onChange={(v) => ledger.patchCategory(c.id, { fixed: v === 'fix' })} options={[{ value: 'var', label: 'je Flugstunde' }, { value: 'fix', label: 'pro Jahr' }]} />}
      <Uses n={use.get(c.id) ?? 0} />
      <ArchiveButton archived={c.archived} onClick={() => ledger.patchCategory(c.id, { archived: !c.archived })} />
    </div>
  )
  const costs = ledger.categories.filter((c) => c.type === 'Kosten' && !c.archived)
  const incomes = ledger.categories.filter((c) => c.type === 'Ertrag' && !c.archived)
  const valid = !!name.trim() && !!type && (type === 'Ertrag' || !!behaviour)
  return (
    <Card className="p-4">
      <h2 className="mb-1 font-semibold">Kostenarten und Ertragsarten</h2>
      <section className="mt-3">
        <div className="text-xs font-medium uppercase tracking-wide text-muted">Kosten</div>
        <p className="mb-1 text-xs text-muted"><b className="font-medium text-ink">Je Flugstunde:</b> wächst mit dem Fliegen (Treibstoff, Wartung). <b className="font-medium text-ink">Pro Jahr:</b> fällt immer an (Versicherung, Hangar). Ergebnis rechnet daraus den kostendeckenden Satz je Flugstunde.</p>
        <div className="divide-y divide-line">{costs.map(row)}</div>
      </section>
      <section className="mt-4">
        <div className="text-xs font-medium uppercase tracking-wide text-muted">Erträge</div>
        <div className="divide-y divide-line">{incomes.map(row)}</div>
      </section>
      {old.length > 0 && (
        <div className="mt-3 border-t border-line pt-2">
          <button onClick={() => setShowOld(!showOld)} className="text-sm text-brand">{showOld ? 'Archivierte ausblenden' : `${old.length} archivierte anzeigen`}</button>
          {showOld && <div className="mt-1 divide-y divide-line opacity-70">{old.map(row)}</div>}
        </div>
      )}
      <div className="mt-3 space-y-2 border-t border-line pt-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Neue Kosten- oder Ertragsart" className={`${field} w-full`} />
        <div className="flex flex-wrap items-center gap-2">
          <Segmented value={type} onChange={(v) => { setType(v); setBehaviour('') }} options={[{ value: 'Kosten', label: 'Kosten' }, { value: 'Ertrag', label: 'Ertrag' }]} />
          {type === 'Kosten' && <Segmented value={behaviour} onChange={setBehaviour} options={[{ value: 'var', label: 'je Flugstunde' }, { value: 'fix', label: 'pro Jahr' }]} />}
          <Button className="ml-auto" variant="primary" disabled={!valid} onClick={() => { if (type) { ledger.addCategory(name.trim(), type, type === 'Kosten' && behaviour === 'fix'); setName(''); setType(''); setBehaviour('') } }}>Anlegen</Button>
        </div>
      </div>
    </Card>
  )
}
