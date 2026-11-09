import clsx from 'clsx'
import { AlertTriangle, Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Banner, Button, Drawer, Segmented } from '../../ui'
import { CATEGORY_LABELS, PERMISSION_CATALOG, labelOf, permissionsFor, type Assignment, type Grants } from '../../permissions'
import { TODAY_ISO, useApp } from '../../state'

type Span = 'unbefristet' | '6' | '12' | 'datum'
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const plusMonths = (n: number) => { const d = new Date(TODAY_ISO); d.setMonth(d.getMonth() + n); return iso(d) }
const de = (isoDate: string) => isoDate.split('-').reverse().join('.')

/**
 * Assign or change a function in three clear steps on one panel: pick the function, say how long it is valid, see what the
 * person is allowed to do with it afterwards. Nothing is saved before the button at the bottom.
 */
export default function FunctionAssign({ open, person, current, editing, grants, onClose, onSave }: {
  open: boolean; person: string; current: Assignment[]; editing?: Assignment; grants: Grants; onClose: () => void; onSave: (a: Assignment) => void
}) {
  const { functions: FUNCTIONS, fnName: functionName } = useApp()
  const [fn, setFn] = useState('')
  const [span, setSpan] = useState<Span>('unbefristet')
  const [date, setDate] = useState('')
  useEffect(() => {
    if (!open) return
    setFn(editing?.fn ?? '')
    setSpan(editing?.until ? 'datum' : 'unbefristet')
    setDate(editing?.until ?? '')
  }, [open, editing])

  const until = span === 'unbefristet' ? undefined : span === 'datum' ? date || undefined : plusMonths(Number(span))
  const others = current.filter((a) => a.fn !== fn)
  const before = permissionsFor(others, grants, TODAY_ISO)
  const after = permissionsFor(fn ? [...others, { fn, until }] : others, grants, TODAY_ISO)
  const added = PERMISSION_CATALOG.filter((p) => after.has(p.code) && !before.has(p.code))
  const sensitive = added.filter((p) => p.sensitive)
  const free = FUNCTIONS.filter((x) => editing ? x.code === editing.fn : !current.some((a) => a.fn === x.code))
  const groups = [...new Set(free.map((x) => x.group))]
  const valid = !!fn && (span !== 'datum' || (!!date && date >= TODAY_ISO))

  return (
    <Drawer open={open} title={editing ? `${functionName(editing.fn)}: Gültigkeit ändern` : `Funktion zuweisen: ${person}`} onClose={onClose}
      footer={<Button variant="primary" size="lg" className="w-full" disabled={!valid} onClick={() => onSave({ fn, ...(until ? { until } : {}) })}><Check size={18} /> {editing ? 'Speichern' : 'Funktion zuweisen'}</Button>}>
      <div className="space-y-6">
        {!editing && (
          <section>
            <h3 className="mb-2 text-sm font-semibold">1 · Welche Funktion?</h3>
            {free.length === 0 && <p className="text-sm text-muted">{person} hat bereits alle Funktionen.</p>}
            <div className="space-y-3">
              {groups.map((g) => (
                <div key={g}>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{g}</div>
                  <div className="grid grid-cols-2 gap-2">
                    {free.filter((x) => x.group === g).map((x) => (
                      <button key={x.code} onClick={() => setFn(x.code)} className={clsx('rounded-xl border px-3 py-2.5 text-left text-sm', fn === x.code ? 'border-brand bg-brand-soft font-medium text-brand' : 'border-line hover:bg-slate-50')}>
                        {x.name}<span className="block text-xs font-normal text-muted">{(grants[x.code] ?? []).length} Rechte</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h3 className="mb-2 text-sm font-semibold">{editing ? '1' : '2'} · Wie lange gilt sie?</h3>
          <Segmented<Span> value={span} onChange={setSpan} options={[{ value: 'unbefristet', label: 'Unbefristet' }, { value: '6', label: '6 Monate' }, { value: '12', label: '1 Jahr' }, { value: 'datum', label: 'Bis Datum' }]} />
          {span === 'datum' && <input type="date" min={TODAY_ISO} value={date} onChange={(e) => setDate(e.target.value)} className="mt-3 h-10 rounded-lg border border-line px-3 text-sm" aria-label="gültig bis" />}
          <p className="mt-2 text-xs text-muted">{until ? `Gültig bis ${de(until)}. Danach verliert ${person} die Rechte automatisch.` : 'Gilt, bis die Funktion entfernt wird.'}</p>
        </section>

        {fn && (
          <section>
            <h3 className="mb-2 text-sm font-semibold">{editing ? '2' : '3'} · Das ändert sich für {person}</h3>
            {added.length === 0 ? <p className="text-sm text-muted">Keine zusätzlichen Rechte, {person} darf das bereits.</p> : (
              <div className="space-y-2">
                <p className="text-sm">{person} bekommt <b>{added.length} zusätzliche Rechte</b>:</p>
                <div className="space-y-1">
                  {[...new Set(added.map((p) => p.category))].map((c) => (
                    <details key={c} className="rounded-lg border border-line">
                      <summary className="cursor-pointer px-3 py-2 text-sm">{CATEGORY_LABELS[c]} <span className="text-muted">({added.filter((p) => p.category === c).length})</span></summary>
                      <ul className="space-y-1 border-t border-line px-3 py-2 text-sm">{added.filter((p) => p.category === c).map((p) => <li key={p.code}>{labelOf(p.code)}</li>)}</ul>
                    </details>
                  ))}
                </div>
                {sensitive.length > 0 && <Banner tone="warn"><span className="flex items-start gap-2"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>Dazu gehören {sensitive.length} sensible Rechte, die auf öffentlichen Geräten eine zusätzliche Bestätigung brauchen.</span></span></Banner>}
              </div>
            )}
          </section>
        )}
      </div>
    </Drawer>
  )
}
