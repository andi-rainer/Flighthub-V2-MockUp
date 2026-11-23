import { useState } from 'react'
import { eur, type Category, type CostCenter } from '../../data'
import { useSession } from '../../session/session'
import { TODAY_ISO, useApp } from '../../state'
import { ActionPanel, Badge, Button, Card, RowMenu, Segmented } from '../../ui'
import { type Ledger } from './ledger'
import { computeResults, useExtras, type Budget } from './results'

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
  // Without the right to manage, the page is read-only.
  const may = useApp().can('billing.cost_centers.manage')
  return (
    <div className="space-y-5">
      <div className="grid gap-5 2xl:grid-cols-2">
        <CostCenters ledger={ledger} use={ccUse} may={may} />
        <Categories ledger={ledger} use={catUse} may={may} />
      </div>
      <Budgets ledger={ledger} may={may} />
    </div>
  )
}

/** Choose where an archived cost center or category goes: its bookings move to the target, the old one is archived. */
function MergePanel({ name, targets, onCancel, onMerge }: { name: string; targets: { id: string; name: string }[]; onCancel: () => void; onMerge: (into: string) => void }) {
  const [into, setInto] = useState('')
  return (
    <div className="py-2">
      <ActionPanel title={`„${name}“ zusammenführen`} confirm="Zusammenführen" disabled={!into} onCancel={onCancel} onConfirm={() => onMerge(into)}>
        <label className="block text-sm font-medium">Mit<select value={into} onChange={(e) => setInto(e.target.value)} className={`${field} mt-1 w-full`}><option value="">Wählen …</option>{targets.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      </ActionPanel>
    </div>
  )
}

const Uses = ({ n }: { n: number }) => <span className="w-24 shrink-0 text-right text-xs text-muted">{n === 0 ? 'ungenutzt' : `${n} Buchungen`}</span>
const ArchiveButton = ({ archived, onClick }: { archived?: boolean; onClick: () => void }) => (
  <button onClick={onClick} title={archived ? undefined : 'Wird bei neuen Buchungen nicht mehr angeboten, alte bleiben unverändert'} className="w-24 shrink-0 text-right text-sm text-brand hover:underline">{archived ? 'Wiederherstellen' : 'Archivieren'}</button>
)

function CostCenters({ ledger, use, may }: { ledger: Ledger; use: Map<string, number>; may: boolean }) {
  const { guarded } = useSession()
  const { merged, merge } = useExtras()
  const [merging, setMerging] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'' | 'Sparte' | 'Allgemein'>('')
  const [showOld, setShowOld] = useState(false)
  const old = ledger.costCenters.filter((c) => c.archived)
  const into = (id: string) => ledger.costCenters.find((x) => x.id === merged[id])?.name
  const row = (c: CostCenter) => (
    <div key={c.id}>
      <div className="flex items-center gap-3 py-1.5">
        <input value={c.name} disabled={!may || c.kind === 'Flugzeug' || c.archived} onChange={(e) => ledger.patchCostCenter(c.id, { name: e.target.value })} className={field} aria-label="Name" />
        <Uses n={use.get(c.id) ?? 0} />
        {c.kind === 'Flugzeug' || !may ? <span className="w-24 shrink-0" />
          : c.archived ? (into(c.id) ? <span className="w-24 shrink-0 text-right text-xs text-muted">in {into(c.id)}</span> : <ArchiveButton archived onClick={() => ledger.patchCostCenter(c.id, { archived: false })} />)
          : <span className="flex w-24 shrink-0 justify-end"><RowMenu actions={[{ label: 'Archivieren', onSelect: () => ledger.patchCostCenter(c.id, { archived: true }) }, { label: 'Zusammenführen mit …', onSelect: () => setMerging(c.id) }]} /></span>}
      </div>
      {merging === c.id && (
        <MergePanel name={c.name} targets={ledger.costCenters.filter((x) => x.id !== c.id && !x.archived)} onCancel={() => setMerging(null)}
          onMerge={(to) => { guarded('billing.cost_centers.manage', () => { merge(c.id, to); ledger.patchCostCenter(c.id, { archived: true }) }); setMerging(null) }} />
      )}
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
      {may && <div className="mt-3 space-y-2 border-t border-line pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Neue Kostenstelle" className={field} />
          <Segmented value={kind} onChange={setKind} options={[{ value: 'Sparte', label: 'Sparte' }, { value: 'Allgemein', label: 'Allgemein' }]} />
          <Button variant="primary" disabled={!name.trim() || !kind} onClick={() => { if (kind) { ledger.addCostCenter(name.trim(), kind); setName(''); setKind('') } }}>Anlegen</Button>
        </div>
      </div>}
    </Card>
  )
}

function Categories({ ledger, use, may }: { ledger: Ledger; use: Map<string, number>; may: boolean }) {
  const { guarded } = useSession()
  const { merged, merge } = useExtras()
  const [merging, setMerging] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [type, setType] = useState<'' | Category['type']>('')
  const [behaviour, setBehaviour] = useState<'' | 'var' | 'fix'>('')
  const [showOld, setShowOld] = useState(false)
  const old = ledger.categories.filter((c) => c.archived)
  const into = (id: string) => ledger.categories.find((x) => x.id === merged[id])?.name
  const row = (c: Category) => (
    <div key={c.id}>
      <div className="flex flex-wrap items-center gap-3 py-1.5">
        <input value={c.name} disabled={!may || c.archived} onChange={(e) => ledger.patchCategory(c.id, { name: e.target.value })} className={field} aria-label="Name" />
        {c.type === 'Kosten' && (may ? <Segmented<'fix' | 'var'> value={c.fixed ? 'fix' : 'var'} onChange={(v) => ledger.patchCategory(c.id, { fixed: v === 'fix' })} options={[{ value: 'var', label: 'je Flugstunde' }, { value: 'fix', label: 'pro Jahr' }]} /> : <span className="text-xs text-muted">{c.fixed ? 'pro Jahr' : 'je Flugstunde'}</span>)}
        <Uses n={use.get(c.id) ?? 0} />
        {!may ? <span className="w-24 shrink-0" />
          : c.archived ? (into(c.id) ? <span className="w-24 shrink-0 text-right text-xs text-muted">in {into(c.id)}</span> : <ArchiveButton archived onClick={() => ledger.patchCategory(c.id, { archived: false })} />)
          : <span className="flex w-24 shrink-0 justify-end"><RowMenu actions={[{ label: 'Archivieren', onSelect: () => ledger.patchCategory(c.id, { archived: true }) }, { label: 'Zusammenführen mit …', onSelect: () => setMerging(c.id) }]} /></span>}
      </div>
      {merging === c.id && (
        <MergePanel name={c.name} targets={ledger.categories.filter((x) => x.id !== c.id && !x.archived && x.type === c.type)} onCancel={() => setMerging(null)}
          onMerge={(to) => { guarded('billing.cost_centers.manage', () => { merge(c.id, to); ledger.patchCategory(c.id, { archived: true }) }); setMerging(null) }} />
      )}
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
      {may && <div className="mt-3 space-y-2 border-t border-line pt-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Neue Kosten- oder Ertragsart" className={`${field} w-full`} />
        <div className="flex flex-wrap items-center gap-2">
          <Segmented value={type} onChange={(v) => { setType(v); setBehaviour('') }} options={[{ value: 'Kosten', label: 'Kosten' }, { value: 'Ertrag', label: 'Ertrag' }]} />
          {type === 'Kosten' && <Segmented value={behaviour} onChange={setBehaviour} options={[{ value: 'var', label: 'je Flugstunde' }, { value: 'fix', label: 'pro Jahr' }]} />}
          <Button className="ml-auto" variant="primary" disabled={!valid} onClick={() => { if (type) { ledger.addCategory(name.trim(), type, type === 'Kosten' && behaviour === 'fix'); setName(''); setType(''); setBehaviour('') } }}>Anlegen</Button>
        </div>
      </div>}
    </Card>
  )
}

const num = (s: string) => Math.max(0, Math.round(Number(s.replace(/\./g, '').replace(',', '.')) || 0))

/** The plan of a year per cost center (income and costs). Ergebnis compares it with what is booked. */
function Budgets({ ledger, may }: { ledger: Ledger; may: boolean }) {
  const { entries } = useApp()
  const { guarded } = useSession()
  const x = useExtras()
  const current = Number(TODAY_ISO.slice(0, 4))
  const [year, setYear] = useState(String(current))
  const prevYear = String(Number(year) - 1)
  const prevIst = computeResults(ledger, entries, prevYear)
  const ccs = ledger.costCenters.filter((c) => !c.archived)
  const get = (id: string): Budget => x.budgetOf(year, id) ?? { income: 0, cost: 0 }
  const total = ccs.reduce((n, c) => ({ income: n.income + get(c.id).income, cost: n.cost + get(c.id).cost }), { income: 0, cost: 0 })
  const copy = (from: 'plan' | 'ist') => guarded('billing.cost_centers.manage', () => x.setBudgets(year, Object.fromEntries(ccs.map((c) => {
    if (from === 'plan') return [c.id, x.budgetOf(prevYear, c.id) ?? { income: 0, cost: 0 }]
    const r = prevIst.rows.find((y) => y.cc.id === c.id)
    return [c.id, { income: Math.round(r?.income ?? 0), cost: Math.round(r?.cost ?? 0) }]
  }))))
  const input = (value: number, onChange: (n: number) => void, label: string) => (
    <input defaultValue={value ? String(value) : ''} key={`${year}-${value}`} disabled={!may} onBlur={(e) => onChange(num(e.target.value))} inputMode="numeric" placeholder="0" aria-label={label} className={`${field} w-28 flex-none text-right`} />
  )
  return (
    <Card className="p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Budget</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented value={year} onChange={setYear} options={[String(current), String(current + 1)].map((y) => ({ value: y, label: y }))} />
          {may && <><Button onClick={() => copy('plan')}>Plan {prevYear} übernehmen</Button><Button onClick={() => copy('ist')}>Ist {prevYear} übernehmen</Button></>}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm tabular-nums">
          <thead className="text-left text-xs uppercase tracking-wide text-muted"><tr><th className="py-2 font-medium">Kostenstelle</th><th className="py-2 text-right font-medium">Erträge</th><th className="py-2 text-right font-medium">Kosten</th><th className="py-2 text-right font-medium">Ergebnis</th><th className="py-2 text-right font-medium">Ist {prevYear}</th></tr></thead>
          <tbody className="divide-y divide-line">
            {ccs.map((c) => {
              const b = get(c.id)
              const r = prevIst.rows.find((y) => y.cc.id === c.id)
              return (
                <tr key={c.id}>
                  <td className="py-1.5">{c.name}</td>
                  <td className="py-1.5 text-right">{input(b.income, (n) => x.setBudget(year, c.id, { ...b, income: n }), `Erträge ${c.name}`)}</td>
                  <td className="py-1.5 text-right">{input(b.cost, (n) => x.setBudget(year, c.id, { ...b, cost: n }), `Kosten ${c.name}`)}</td>
                  <td className="py-1.5 text-right">{eur(b.income - b.cost)}</td>
                  <td className="py-1.5 text-right text-muted">{r ? eur(r.result) : '–'}</td>
                </tr>
              )
            })}
            <tr className="font-semibold"><td className="py-2">Gesamt</td><td className="py-2 text-right">{eur(total.income)}</td><td className="py-2 text-right">{eur(total.cost)}</td><td className="py-2 text-right">{eur(total.income - total.cost)}</td><td className="py-2 text-right text-muted">{eur(prevIst.result)}</td></tr>
          </tbody>
        </table>
      </div>
    </Card>
  )
}
