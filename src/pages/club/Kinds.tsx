import { ChevronRight, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { aircraft, eur } from '../../data'
import { areaOn } from '../../modules'
import { saveKind, splitSum, type OperationKind, type SplitPart } from '../../kinds'
import { useSession } from '../../session/session'
import { useApp } from '../../state'
import { Badge, Button, ConfirmDelete, Drawer, Row, Section, Switch } from '../../ui'

const input = 'h-11 rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-brand'
const pilotKey = 'pilot'

/** Who pays, in words: "50 % Pilot, 50 % Kostenstelle Verein allgemein". */
function useSplitText() {
  const { ledger } = useApp()
  return (k: Pick<OperationKind, 'split'>) => k.split.map((p) => `${p.percent} % ${p.target.kind === 'pilot' ? 'Pilot' : ledger.costCenters.find((c) => c.id === (p.target as { id: string }).id)?.name ?? '?'}`).join(', ')
}

/** The operation kinds of the club: price per flight minute and default booking. Changes need a confirmation on public devices. */
export default function Kinds() {
  const { kinds, setKinds, modules } = useApp()
  const { guarded } = useSession()
  const [editing, setEditing] = useState<OperationKind | 'new' | null>(null)
  const text = useSplitText()
  const commit = (next: OperationKind[]) => guarded('settings.edit.system', () => setKinds(next))
  return (
    <div className="max-w-3xl">
      <Section title="Betriebsarten" action={<Button onClick={() => setEditing('new')}><Plus size={14} /> Betriebsart</Button>}>
        {kinds.map((k) => (
          <Row key={k.id} onClick={() => setEditing(k)}
            label={<span className="flex flex-wrap items-center gap-2">{k.name} {k.manifest && <Badge tone="info">Flüge aus dem Manifest</Badge>} {!areaOn(modules, k.area) && <Badge>Betrieb ausgeschaltet</Badge>}</span>}
            hint={<>{Object.entries(k.rates).map(([reg, r]) => `${reg} ${eur(r)}`).join(' · ')} je Minute<br />{text(k)} · seit {k.since}</>}>
            <Switch checked={k.active} disabled={k.manifest} label={`${k.name} wählbar`} onChange={(v) => commit(kinds.map((x) => (x.id === k.id ? { ...x, active: v } : x)))} />
            <ChevronRight size={16} className="text-muted" />
          </Row>
        ))}
      </Section>
      {editing && <KindDrawer kind={editing} onClose={() => setEditing(null)} onSave={(k) => { const old = kinds.find((x) => x.id === k.id); const saved = saveKind(old, k); commit(old ? kinds.map((x) => (x.id === k.id ? saved : x)) : [...kinds, saved]); setEditing(null) }} onDelete={(id) => { commit(kinds.filter((x) => x.id !== id)); setEditing(null) }} />}
    </div>
  )
}

function KindDrawer({ kind, onSave, onDelete, onClose }: { kind: OperationKind | 'new'; onSave: (k: OperationKind) => void; onDelete: (id: string) => void; onClose: () => void }) {
  const { ledger } = useApp()
  const text = useSplitText()
  const cur = kind === 'new' ? undefined : kind
  const [name, setName] = useState(cur?.name ?? '')
  // One price per aircraft; an empty field means the aircraft cannot fly in this kind.
  const [rates, setRates] = useState<Record<string, string>>(() => Object.fromEntries(aircraft.map((a) => [a.reg, cur?.rates[a.reg] !== undefined ? String(cur.rates[a.reg]) : ''])))
  const [split, setSplit] = useState<SplitPart[]>(cur?.split ?? [{ target: { kind: 'pilot' }, percent: 100 }])
  const num = (v: string) => Number(v.replace(',', '.'))
  const priced = aircraft.filter((a) => rates[a.reg]?.trim() !== '' && Number.isFinite(num(rates[a.reg])) && num(rates[a.reg]) >= 0)
  const pricesOk = priced.length > 0 && aircraft.every((a) => rates[a.reg]?.trim() === '' || (Number.isFinite(num(rates[a.reg])) && num(rates[a.reg]) >= 0))
  const sum = splitSum({ split })
  const valid = !!name.trim() && pricesOk && sum === 100 && split.length > 0
  const keyOf = (p: SplitPart) => (p.target.kind === 'pilot' ? pilotKey : p.target.id)
  const setTarget = (i: number, key: string) => setSplit((s) => s.map((p, k) => (k === i ? { ...p, target: key === pilotKey ? { kind: 'pilot' } : { kind: 'costCenter', id: key } } : p)))
  const centers = ledger.costCenters.filter((c) => !c.archived)
  const exampleAc = priced[0]
  const example = exampleAc ? 30 * num(rates[exampleAc.reg]) : 0
  const label = (p: SplitPart) => (p.target.kind === 'pilot' ? 'Pilot' : centers.find((c) => c.id === (p.target as { id: string }).id)?.name ?? '?')
  return (
    <Drawer open title={cur ? `Betriebsart · ${cur.name}` : 'Neue Betriebsart'} onClose={onClose}
      footer={<div className="flex flex-wrap items-center justify-between gap-2"><div>{cur && !cur.manifest && <ConfirmDelete what={cur.name} onConfirm={() => onDelete(cur.id)} />}</div><div className="flex gap-2"><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" disabled={!valid} onClick={() => onSave({ id: cur?.id ?? `k-${Date.now()}`, name: name.trim(), rates: Object.fromEntries(priced.map((a) => [a.reg, num(rates[a.reg])])), split, manifest: cur?.manifest, area: cur?.area, active: cur?.active ?? true, since: cur?.since ?? '', history: cur?.history ?? [] })}>Speichern</Button></div></div>}>
      <div className="space-y-5">
        <label className="block text-sm font-medium">Name<input value={name} onChange={(e) => setName(e.target.value)} className={`${input} mt-1 w-full`} /></label>
        <div>
          <div className="mb-1 text-sm font-medium">Preis je Flugminute und Flugzeug</div>
          <div className="space-y-2">
            {aircraft.map((a) => (
              <label key={a.id} className="flex items-center gap-3 text-sm">
                <span className="min-w-0 flex-1"><b>{a.reg}</b> <span className="text-muted">{a.type}</span></span>
                <input inputMode="decimal" aria-label={`Preis ${a.reg}`} placeholder="nicht möglich" value={rates[a.reg]} onChange={(e) => setRates({ ...rates, [a.reg]: e.target.value })} className={`${input} w-32 text-right tabular-nums`} />
                <span className="text-muted">€</span>
              </label>
            ))}
          </div>
          {!pricesOk && <p className="mt-1 text-xs text-bad">Mindestens ein Flugzeug braucht einen Preis.</p>}
        </div>
        <div>
          <div className="mb-1 text-sm font-medium">Wer bezahlt</div>
          <div className="space-y-2">
            {split.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <select aria-label="Wer" value={keyOf(p)} onChange={(e) => setTarget(i, e.target.value)} className={`${input} min-w-0 flex-1`}>
                  <option value={pilotKey}>Pilot (Betriebskonto)</option>
                  {centers.map((c) => <option key={c.id} value={c.id}>Kostenstelle {c.name}</option>)}
                </select>
                <input aria-label="Prozent" inputMode="numeric" value={p.percent} onChange={(e) => setSplit((s) => s.map((x, k) => (k === i ? { ...x, percent: Number(e.target.value.replace(/\D/g, '')) || 0 } : x)))} className={`${input} w-20 text-right tabular-nums`} />
                <span className="text-sm text-muted">%</span>
                <button aria-label="Entfernen" disabled={split.length === 1} onClick={() => setSplit((s) => s.filter((_, k) => k !== i))} className="grid h-9 w-9 place-items-center rounded-md text-muted hover:bg-slate-100 disabled:opacity-30"><X size={14} /></button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <button className="font-medium text-brand hover:underline" onClick={() => setSplit((s) => [...s, { target: { kind: 'costCenter', id: centers[0]?.id ?? '' }, percent: Math.max(0, 100 - sum) }])}>+ Aufteilung</button>
            <span className={sum === 100 ? 'text-muted' : 'font-medium text-bad'}>Summe {sum} %{sum !== 100 && ' · muss 100 ergeben'}</span>
          </div>
        </div>
        {cur && cur.history.length > 0 && (
          <div>
            <div className="mb-1 text-sm font-medium">Frühere Preise</div>
            <ul className="divide-y divide-line rounded-xl border border-line text-sm">
              {cur.history.map((h) => (
                <li key={h.until} className="px-3 py-2">
                  <div className="font-medium">{h.since} bis {h.until}</div>
                  <div className="text-muted">{Object.entries(h.rates).map(([reg, r]) => `${reg} ${eur(r)}`).join(' · ')} je Minute</div>
                  <div className="text-muted">{text(h)}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
        {valid && (
          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <div className="mb-1 text-xs text-muted">Beispiel: 30 Minuten mit {exampleAc?.reg} = {eur(example)}</div>
            {split.map((p, i) => <div key={i} className="flex justify-between"><span>{label(p)}</span><span className="tabular-nums">{eur((example * p.percent) / 100)}</span></div>)}
          </div>
        )}
      </div>
    </Drawer>
  )
}
