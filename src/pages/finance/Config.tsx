import { useState } from 'react'
import { type Category, type CostCenter } from '../../data'
import { Badge, Button, Card, Segmented, Switch } from '../../ui'
import { type Ledger } from './ledger'

const field = 'h-10 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-brand'

/** Cost centers and categories are owned by the club. Nothing is hard-coded, everything can be renamed or archived. */
export default function Config({ ledger }: { ledger: Ledger }) {
  const [ccName, setCcName] = useState('')
  const [ccKind, setCcKind] = useState<CostCenter['kind']>('Allgemein')
  const [catName, setCatName] = useState('')
  const [catType, setCatType] = useState<Category['type']>('Kosten')

  return (
    <div className="space-y-4">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="font-semibold">Kostenstellen</h2>
          <p className="mb-3 text-sm text-muted">Flugzeuge, Sparten und alles, was zu keinem Flugzeug gehört.</p>
          <div className="divide-y divide-line">
            {ledger.costCenters.map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-2">
                <input value={c.name} disabled={c.kind === 'Flugzeug'} onChange={(e) => ledger.patchCostCenter(c.id, { name: e.target.value })} className={field} aria-label="Name" />
                <Badge tone={c.kind === 'Flugzeug' ? 'info' : 'neutral'}>{c.kind}</Badge>
                <Switch checked={!c.archived} onChange={(v) => ledger.patchCostCenter(c.id, { archived: !v })} label={`${c.name} aktiv`} />
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">Flugzeug-Kostenstellen entstehen automatisch mit jedem Flugzeug.</p>
          <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
            <input value={ccName} onChange={(e) => setCcName(e.target.value)} placeholder="Neue Kostenstelle" className={field} />
            <select value={ccKind} onChange={(e) => setCcKind(e.target.value as CostCenter['kind'])} className="h-10 rounded-lg border border-line px-2 text-sm"><option>Allgemein</option><option>Sparte</option></select>
            <Button variant="primary" disabled={!ccName.trim()} onClick={() => { ledger.addCostCenter(ccName.trim(), ccKind); setCcName('') }}>Anlegen</Button>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="font-semibold">Kostenarten und Ertragsarten</h2>
          <p className="mb-3 text-sm text-muted">Was gebucht wird, zum Beispiel Treibstoff oder Mitgliedsbeiträge.</p>
          <div className="divide-y divide-line">
            {ledger.categories.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-3 py-2">
                <input value={c.name} onChange={(e) => ledger.patchCategory(c.id, { name: e.target.value })} className={field} aria-label="Name" />
                <Badge tone={c.type === 'Kosten' ? 'warn' : 'ok'}>{c.type}</Badge>
                {c.type === 'Kosten' && <Segmented<'fix' | 'var'> value={c.fixed ? 'fix' : 'var'} onChange={(v) => ledger.patchCategory(c.id, { fixed: v === 'fix' })} options={[{ value: 'var', label: 'variabel' }, { value: 'fix', label: 'fix' }]} />}
                <Switch checked={!c.archived} onChange={(v) => ledger.patchCategory(c.id, { archived: !v })} label={`${c.name} aktiv`} />
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
            <input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Neue Kosten- oder Ertragsart" className={field} />
            <select value={catType} onChange={(e) => setCatType(e.target.value as Category['type'])} className="h-10 rounded-lg border border-line px-2 text-sm"><option>Kosten</option><option>Ertrag</option></select>
            <Button variant="primary" disabled={!catName.trim()} onClick={() => { ledger.addCategory(catName.trim(), catType, false); setCatName('') }}>Anlegen</Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
