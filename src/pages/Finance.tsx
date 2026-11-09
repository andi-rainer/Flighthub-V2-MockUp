import clsx from 'clsx'
import { useSearchParams } from 'react-router-dom'
import { currentCharterRatePerMin, eur, fixedCostsYear, varPerMinute } from '../data'
import { type Permission } from '../permissions'
import { useApp } from '../state'
import { Banner, Card, PageHeader, Stat } from '../ui'
import Accounts from './finance/Accounts'
import Bank from './finance/Bank'
import Config from './finance/Config'
import Flights from './finance/Flights'
import { computeSparten } from './finance/results'

type Tab = 'bank' | 'verrechnen' | 'konten' | 'ergebnis' | 'konfig'

export default function Finance() {
  // The tab lives in the address, so coming back from a member file lands on the same tab.
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) ?? 'bank'
  const setTab = (t: Tab) => setParams({ tab: t }, { replace: true })

  const { ledger, flights, can } = useApp()
  const open = ledger.lines.filter((l) => !ledger.done[l.id]).length
  const toCharge = flights.filter((f) => f.state === 'offen').length
  const all: { id: Tab; label: string; badge?: number; perm?: Permission }[] = [
    { id: 'bank', label: 'Bank und Belege', badge: open },
    { id: 'verrechnen', label: 'Flüge verrechnen', badge: toCharge, perm: 'billing.flights.charge' },
    { id: 'konten', label: 'Betriebskonten', perm: 'billing.accounts.view' },
    { id: 'ergebnis', label: 'Ergebnis', perm: 'manifest.reports.view' },
    { id: 'konfig', label: 'Kostenstellen', perm: 'billing.cost_centers.view' },
  ]
  const tabs = all.filter((t) => can(t.perm))
  return (
    <>
      <PageHeader title="Finanzen" />
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={clsx('flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium', tab === t.id ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink')}>
            {t.label}{!!t.badge && <span className="rounded-full bg-brand px-1.5 text-xs text-white">{t.badge}</span>}
          </button>
        ))}
      </div>
      {tab === 'bank' && <Bank ledger={ledger} />}
      {tab === 'verrechnen' && <Flights />}
      {tab === 'konten' && <Accounts ledger={ledger} />}
      {tab === 'ergebnis' && <Result />}
      {tab === 'konfig' && <Config ledger={ledger} />}
      {ledger.toast && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink px-5 py-3 text-sm font-medium text-white shadow-lg md:bottom-8">{ledger.toast}</div>
      )}
    </>
  )
}

function Result() {
  const { rows, totalMin, income, cost, perMin } = computeSparten()
  const charter = rows.find((r) => r.id === 's3')!
  const charterRate = charter.minutes ? charter.cost / charter.minutes : 0

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Einnahmen 2026" value={eur(income)} hint="aus gebuchten Tickets und Rechnungen" />
        <Stat label="Kosten 2026" value={eur(cost)} hint={`variabel ${eur(totalMin * varPerMinute)} · fix ${eur(fixedCostsYear)}`} />
        <Stat label="Ergebnis" value={eur(income - cost)} tone={income - cost >= 0 ? 'ok' : 'bad'} hint="echte Zahlen, keine Schätzung" />
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 py-3 font-semibold">Ergebnis je Sparte (OE-DZA)</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
            <tr><th className="px-5 py-2 font-medium">Sparte</th><th className="px-3 py-2 text-right font-medium">Minuten</th><th className="px-3 py-2 text-right font-medium">Einnahmen</th><th className="px-3 py-2 text-right font-medium">Kosten</th><th className="px-5 py-2 text-right font-medium">Ergebnis</th></tr>
          </thead>
          <tbody className="divide-y divide-line tabular-nums">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-5 py-3 font-medium">{r.name}</td>
                <td className="px-3 py-3 text-right">{r.minutes.toLocaleString('de-AT')}</td>
                <td className="px-3 py-3 text-right">{eur(r.income)}</td>
                <td className="px-3 py-3 text-right">{eur(r.cost)}</td>
                <td className={clsx('px-5 py-3 text-right font-semibold', r.result >= 0 ? 'text-ok' : 'text-bad')}>{eur(r.result)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold">Kostendeckender Satz OE-DZA</div>
            <div className="mt-1 text-3xl font-semibold tabular-nums">{eur(perMin)} <span className="text-base font-normal text-muted">pro Minute · {eur(perMin * 60)} pro Stunde</span></div>
            <div className="mt-1 text-sm text-muted">{eur(varPerMinute)}/min variabel + {eur(fixedCostsYear / totalMin)}/min Fixkosten bei {Math.round(totalMin / 60)} Flugstunden</div>
          </div>
          {charterRate > currentCharterRatePerMin && (
            <Banner tone="warn">Mitglieder-Charter kostet heute {eur(currentCharterRatePerMin * 60)}/h und deckt die Kosten nicht. Kostendeckend wären {eur(charterRate * 60)}/h.</Banner>
          )}
        </div>
      </Card>
    </div>
  )
}
