import { Plus } from 'lucide-react'
import { useState } from 'react'
import { eur } from '../../data'
import { TODAY_ISO } from '../../state'
import { Badge, Button, Card, Drawer, Field, field, RowMenu, Segmented, usePaging } from '../../ui'
import { dmy } from '../manifest/data'
import { type Ledger } from './ledger'
import { missingPeriods, newSupplierId, periodLabel, RHYTHM_LABEL, useSuppliers, type Rhythm, type Supplier } from './supplierStore'

const YEAR = TODAY_ISO.slice(0, 4)

/**
 * [Entwurf] Lieferanten: master data (IBAN, where the invoices usually go) and recurring invoices. Suppliers that only appear on invoices
 * are listed too and can be taken over. A row opens the supplier; "Rechnungen" shows its invoices.
 */
export default function Suppliers({ ledger, onInvoices, onCreate }: { ledger: Ledger; onInvoices: (supplier: string) => void; onCreate: (supplier: string) => void }) {
  const sup = useSuppliers()
  const [edit, setEdit] = useState<Supplier | null>(null)
  const loose = [...new Set(ledger.receipts.map((r) => r.supplier))].filter((n) => !sup.byName(n)).map((name): Supplier => ({ id: '', name }))
  const rows = [...sup.list, ...loose].sort((a, b) => a.name.localeCompare(b.name, 'de'))
  const paging = usePaging(rows, String(rows.length))
  const cc = (id?: string) => ledger.costCenters.find((c) => c.id === id)?.name
  const cat = (id?: string) => ledger.categories.find((c) => c.id === id)?.name
  return (
    <>
      <div className="flex justify-end"><Button onClick={() => setEdit({ id: newSupplierId(), name: '' })}><Plus size={16} /> Lieferant anlegen</Button></div>
      <Card className="overflow-hidden">
        <div className="hidden gap-x-3 border-b border-line bg-slate-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted md:grid md:grid-cols-[minmax(0,1.5fr)_minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,1fr)_7rem_2.5rem]">
          <span>Lieferant</span><span>IBAN</span><span>Üblich gebucht auf</span><span>Wiederkehrend</span><span className="text-right">{YEAR}</span><span />
        </div>
        <div className="divide-y divide-line">
          {paging.rows.map((s) => {
            const mine = ledger.receipts.filter((r) => r.supplier === s.name)
            const year = mine.filter((r) => r.date.startsWith(YEAR)).reduce((n, r) => n + r.amount, 0)
            const miss = missingPeriods(s, ledger.receipts)
            const open = () => setEdit(s.id ? s : { ...s, id: newSupplierId() })
            return (
              <div key={s.id || s.name} role="button" tabIndex={0} onClick={open} onKeyDown={(e) => e.key === 'Enter' && open()} className="grid cursor-pointer gap-x-3 gap-y-1 px-4 py-2.5 text-sm hover:bg-slate-50 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,1fr)_7rem_2.5rem] md:items-center">
                <div className="min-w-0"><div className="truncate font-medium">{s.name}</div><div className="text-xs text-muted">{mine.length} Rechnungen{!s.id && ' · nicht angelegt'}</div></div>
                <div className="truncate text-xs tabular-nums text-muted">{s.iban ?? '–'}</div>
                <div className="truncate">{cc(s.costCenterId) || cat(s.categoryId) ? [cc(s.costCenterId), cat(s.categoryId)].filter(Boolean).join(' · ') : <span className="text-muted">–</span>}</div>
                <div className="flex flex-wrap items-center gap-1.5">{s.recurring ? <span>{RHYTHM_LABEL[s.recurring.rhythm]}</span> : <span className="text-muted">–</span>}{miss.length > 0 && <Badge tone="warn">{miss.length} fehlt</Badge>}</div>
                <div className="text-right font-medium tabular-nums">{year ? eur(year) : '–'}</div>
                <RowMenu actions={[{ label: 'Rechnungen anzeigen', onSelect: () => onInvoices(s.name) }, { label: 'Beleg erstellen', onSelect: () => onCreate(s.name) }]} />
              </div>
            )
          })}
        </div>
        {paging.bar}
      </Card>
      {edit && <SupplierDrawer key={edit.id} supplier={edit} ledger={ledger} onInvoices={onInvoices} onClose={() => setEdit(null)} />}
    </>
  )
}

function SupplierDrawer({ supplier, ledger, onInvoices, onClose }: { supplier: Supplier; ledger: Ledger; onInvoices: (s: string) => void; onClose: () => void }) {
  const sup = useSuppliers()
  const [s, setS] = useState<Supplier>(supplier)
  const [rec, setRec] = useState<'nein' | 'ja'>(supplier.recurring ? 'ja' : 'nein')
  const set = (p: Partial<Supplier>) => setS({ ...s, ...p })
  const r = s.recurring ?? { rhythm: 'monatlich' as Rhythm, since: TODAY_ISO.slice(0, 7) }
  const setR = (p: Partial<NonNullable<Supplier['recurring']>>) => set({ recurring: { ...r, ...p } })
  const clash = sup.list.some((x) => x.id !== s.id && x.name.toLowerCase() === s.name.trim().toLowerCase())
  const valid = !!s.name.trim() && !clash
  const mine = ledger.receipts.filter((x) => x.name && x.supplier === supplier.name).sort((a, b) => b.date.localeCompare(a.date))
  const miss = missingPeriods({ ...s, recurring: rec === 'ja' ? r : undefined }, ledger.receipts)
  const save = () => { sup.save({ ...s, name: s.name.trim(), recurring: rec === 'ja' ? r : undefined }); onClose() }
  const ccs = ledger.costCenters.filter((c) => !c.archived)
  const cats = ledger.categories.filter((c) => !c.archived && c.type === 'Kosten')
  return (
    <Drawer open title={supplier.name || 'Lieferant anlegen'} onClose={onClose} footer={<div className="flex justify-end gap-2"><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" disabled={!valid} onClick={save}>Speichern</Button></div>}>
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" className="col-span-2"><input aria-label="Name" value={s.name} onChange={(e) => set({ name: e.target.value })} className={`${field} w-full`} />{clash && <span className="text-xs text-bad">Diesen Lieferanten gibt es schon.</span>}</Field>
          <Field label="IBAN"><input aria-label="IBAN" value={s.iban ?? ''} onChange={(e) => set({ iban: e.target.value || undefined })} className={`${field} w-full tabular-nums`} /></Field>
          <Field label="E-Mail der Rechnungen"><input aria-label="E-Mail" value={s.email ?? ''} onChange={(e) => set({ email: e.target.value || undefined })} className={`${field} w-full`} /></Field>
          <Field label="Kostenstelle"><select aria-label="Kostenstelle" value={s.costCenterId ?? ''} onChange={(e) => set({ costCenterId: e.target.value || undefined })} className={`${field} w-full`}><option value="">Je Rechnung wählen</option>{ccs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Kostenart"><select aria-label="Kostenart" value={s.categoryId ?? ''} onChange={(e) => set({ categoryId: e.target.value || undefined })} className={`${field} w-full`}><option value="">Je Rechnung wählen</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        </div>
        <div className="space-y-2">
          <div className="font-medium">Wiederkehrende Rechnung</div>
          <Segmented<'nein' | 'ja'> value={rec} onChange={setRec} options={[{ value: 'nein', label: 'Nein' }, { value: 'ja', label: 'Ja' }]} />
          {rec === 'ja' && (
            <div className="grid grid-cols-3 gap-3">
              <Field label="Rhythmus"><select aria-label="Rhythmus" value={r.rhythm} onChange={(e) => setR({ rhythm: e.target.value as Rhythm })} className={`${field} w-full`}>{(Object.keys(RHYTHM_LABEL) as Rhythm[]).map((k) => <option key={k} value={k}>{RHYTHM_LABEL[k]}</option>)}</select></Field>
              <Field label="Ab"><input type="month" aria-label="Ab" value={r.since} onChange={(e) => setR({ since: e.target.value })} className={`${field} w-full`} /></Field>
              <Field label="Betrag etwa (€)"><input aria-label="Betrag etwa" inputMode="decimal" value={r.amount ?? ''} onChange={(e) => setR({ amount: Number(e.target.value.replace(',', '.')) || undefined })} className={`${field} w-full text-right tabular-nums`} /></Field>
            </div>
          )}
          {miss.length > 0 && <div className="flex flex-wrap gap-1.5">{miss.map((p) => <Badge key={p} tone="warn">fehlt: {periodLabel(p)}</Badge>)}</div>}
        </div>
        {mine.length > 0 && (
          <div>
            <div className="mb-1.5 flex items-center justify-between font-semibold"><span>Letzte Rechnungen</span><button onClick={() => { onClose(); onInvoices(supplier.name) }} className="text-xs font-normal text-brand">Alle {mine.length} anzeigen</button></div>
            <ul className="divide-y divide-line rounded-lg border border-line">{mine.slice(0, 5).map((x) => <li key={x.id} className="flex justify-between gap-3 px-3 py-1.5"><span className="truncate">{dmy(x.date)} · {x.number ?? 'ohne Nummer'}</span><span className="tabular-nums">{eur(x.amount)}</span></li>)}</ul>
          </div>
        )}
      </div>
    </Drawer>
  )
}
