import clsx from 'clsx'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Fragment, useState } from 'react'
import { eur } from '../../data'
import { TODAY_ISO, useApp } from '../../state'
import { Badge, Card, Segmented, Stat } from '../../ui'
import { fuelStats, perLiter } from './parts'
import { computeResults, resultYears, type CcResult } from './results'

const TH = 'px-3 py-2 text-right font-medium'

/**
 * The result of a year from the bookings: costs per aircraft with the price an hour has to bring in, income and costs of every other cost
 * center. Any number of aircraft and cost centers; nothing is fixed in the page.
 */
export default function Result({ onOpenLines }: { onOpenLines: () => void }) {
  const { ledger, entries, kinds } = useApp()
  const current = TODAY_ISO.slice(0, 4)
  const years = resultYears(ledger, current)
  const [year, setYear] = useState(current)
  const [openId, setOpenId] = useState<string | null>(null)
  const r = computeResults(ledger, entries, year)
  const yearAgo = `${Number(current) - 1}${TODAY_ISO.slice(4)}`
  const fuel = fuelStats(ledger.receipts.filter((x) => x.date >= yearAgo))
  const groups = (['Sparte', 'Allgemein'] as const).map((kind) => ({ kind, rows: r.rows.filter((x) => x.cc.kind === kind) })).filter((g) => g.rows.length > 0)
  const priceRange = (reg: string) => {
    const rates = kinds.filter((k) => k.active && k.rates[reg] !== undefined).map((k) => k.rates[reg] * 60)
    return rates.length ? { min: Math.min(...rates), max: Math.max(...rates) } : null
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented value={year} onChange={setYear} options={years.map((y) => ({ value: y, label: y === current ? `${y} bisher` : y }))} />
        {r.open > 0 && <button onClick={onOpenLines} className="rounded-full bg-warn-soft px-3 py-1 text-sm font-medium text-amber-900 hover:underline">{r.open} Buchungen noch nicht zugeordnet, sie fehlen hier</button>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat compact label={`Erträge ${year}`} value={eur(r.income)} />
        <Stat compact label={`Kosten ${year}`} value={eur(r.cost)} />
        <Stat compact label="Ergebnis" value={eur(r.result)} tone={r.result >= 0 ? 'ok' : 'bad'} />
        {fuel && <Stat compact label="Ø Treibstoffpreis" value={perLiter(fuel.avg)} hint={`${Math.round(fuel.liters)} L, letzte 12 Monate`} />}
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-4 py-2 font-semibold">Flugzeuge</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
              <tr><th className="px-4 py-2 font-medium">Flugzeug</th><th className={TH}>Flugstunden</th><th className={TH}>Kosten</th><th className={TH}>variabel je Std.</th><th className={TH}>Fixkosten</th><th className={TH}>Kostendeckend je Std.</th><th className={`${TH} pr-4`}>Preise heute je Std.</th></tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {r.aircraft.map((a) => {
                const price = priceRange(a.reg)
                const low = a.coverPerHour !== null && price !== null && price.min < a.coverPerHour
                return (
                  <tr key={a.cc.id}>
                    <td className="px-4 py-2 font-medium">{a.reg}</td>
                    <td className="px-3 py-2 text-right">{a.minutes ? (a.minutes / 60).toLocaleString('de-AT', { maximumFractionDigits: 1 }) : '–'}</td>
                    <td className="px-3 py-2 text-right">{eur(a.cost)}</td>
                    <td className="px-3 py-2 text-right">{a.variablePerHour === null ? '–' : eur(a.variablePerHour)}</td>
                    <td className="px-3 py-2 text-right">{eur(a.fixed)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{a.coverPerHour === null ? '–' : eur(a.coverPerHour)}</td>
                    <td className="px-3 py-2 pr-4 text-right">
                      {price ? <span className="inline-flex items-center gap-2">{price.min === price.max ? eur(price.min) : `${eur(price.min)} bis ${eur(price.max)}`}{low && <Badge tone="warn">deckt nicht</Badge>}</span> : '–'}
                    </td>
                  </tr>
                )
              })}
              {r.aircraft.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted">Keine Flugzeug-Kostenstelle.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-4 py-2 font-semibold">Sparten und Allgemein</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
              <tr><th className="px-4 py-2 font-medium">Kostenstelle</th><th className={TH}>Erträge</th><th className={TH}>Kosten</th><th className={`${TH} pr-4`}>Ergebnis</th></tr>
            </thead>
            <tbody className="tabular-nums">
              {groups.map((g) => (
                <Fragment key={g.kind}>
                  <tr className="bg-slate-50/60"><td colSpan={4} className="px-4 py-1 text-xs font-medium uppercase tracking-wide text-muted">{g.kind === 'Sparte' ? 'Sparten' : 'Allgemein'}</td></tr>
                  {g.rows.map((x) => <CostCenterRow key={x.cc.id} row={x} open={openId === x.cc.id} onToggle={() => setOpenId(openId === x.cc.id ? null : x.cc.id)} />)}
                </Fragment>
              ))}
              <tr className="border-t-2 border-line font-semibold">
                <td className="px-4 py-2">Gesamt, mit Flugzeugen</td>
                <td className="px-3 py-2 text-right">{eur(r.income)}</td>
                <td className="px-3 py-2 text-right">{eur(r.cost)}</td>
                <td className={clsx('px-3 py-2 pr-4 text-right', r.result >= 0 ? 'text-ok' : 'text-bad')}>{eur(r.result)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function CostCenterRow({ row: x, open, onToggle }: { row: CcResult; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr onClick={onToggle} className="cursor-pointer border-t border-line hover:bg-slate-50">
        <td className="px-4 py-2 font-medium"><span className="inline-flex items-center gap-1.5">{open ? <ChevronDown size={14} className="text-muted" /> : <ChevronRight size={14} className="text-muted" />}{x.cc.name}</span></td>
        <td className="px-3 py-2 text-right">{eur(x.income)}</td>
        <td className="px-3 py-2 text-right">{eur(x.cost)}</td>
        <td className={clsx('px-3 py-2 pr-4 text-right font-semibold', x.result >= 0 ? 'text-ok' : 'text-bad')}>{eur(x.result)}</td>
      </tr>
      {open && x.parts.map((p) => (
        <tr key={p.categoryId} className="text-xs text-muted">
          <td className="py-1 pl-11 pr-3">{p.name}</td>
          <td className="px-3 py-1 text-right">{p.type === 'Ertrag' ? eur(p.amount) : ''}</td>
          <td className="px-3 py-1 text-right">{p.type === 'Kosten' ? eur(p.amount) : ''}</td>
          <td className="px-3 py-1 pr-4" />
        </tr>
      ))}
      {open && x.parts.length === 0 && <tr className="text-xs text-muted"><td colSpan={4} className="py-1 pl-11">Keine Buchungen in diesem Jahr.</td></tr>}
    </>
  )
}
