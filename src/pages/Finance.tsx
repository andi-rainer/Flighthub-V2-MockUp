import clsx from 'clsx'
import { useSearchParams } from 'react-router-dom'
import { currentCharterRatePerMin, eur, fixedCostsYear, varPerMinute } from '../data'
import { type Permission } from '../permissions'
import { TODAY_ISO, useApp } from '../state'
import { Banner, Card, PageHeader, Stat } from '../ui'
import Accounts from './finance/Accounts'
import Config from './finance/Config'
import Expenses from './finance/Expenses'
import Flights from './finance/Flights'
import Invoices from './finance/Invoices'
import Journal from './finance/Journal'
import MoneyAccounts from './finance/MoneyAccounts'
import Periods from './finance/Periods'
import { fuelStats, perLiter } from './finance/parts'
import { isTodo, lineStatus } from './finance/status'
import { computeSparten } from './finance/results'

type Tab = 'bank' | 'auslagen' | 'rechnungen' | 'geldkonten' | 'zeitraeume' | 'verrechnen' | 'konten' | 'ergebnis' | 'konfig'

export default function Finance() {
  // The tab lives in the address, so coming back from a member file lands on the same tab.
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) ?? 'bank'
  const setTab = (t: Tab) => setParams({ tab: t }, { replace: true })
  /** The bookings tab, opened on an account or on the open items of a month. */
  const showBookings = (p: { konto?: string; monat?: string }) => setParams({ tab: 'bank', ...(p.konto ? { konto: p.konto } : {}), ...(p.monat ? { monat: p.monat, offen: '1' } : {}) })

  const { ledger, flights, can } = useApp()
  const open = ledger.lines.filter((l) => isTodo(lineStatus(l, ledger))).length
  const unpaid = ledger.receipts.filter((r) => !r.lineId && !ledger.expenseOf(r.id)).length
  const expenses = ledger.expenses.filter((x) => x.status === 'offen').length
  const toCharge = flights.filter((f) => f.state === 'offen').length
  const all: { id: Tab; label: string; badge?: number; perm?: Permission }[] = [
    { id: 'bank', label: 'Buchungen', badge: open },
    { id: 'auslagen', label: 'Auslagen', badge: expenses, perm: 'billing.bank.manage' },
    { id: 'rechnungen', label: 'Rechnungen', badge: unpaid },
    { id: 'geldkonten', label: 'Geldkonten' },
    { id: 'zeitraeume', label: 'Zeiträume' },
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
      {tab === 'bank' && <Journal key={`${params.get('konto')}|${params.get('monat')}`} ledger={ledger} preset={{ account: params.get('konto') ?? undefined, month: params.get('monat') ?? undefined, todo: params.get('offen') === '1' }} />}
      {tab === 'auslagen' && <Expenses ledger={ledger} />}
      {tab === 'rechnungen' && <Invoices ledger={ledger} />}
      {tab === 'geldkonten' && <MoneyAccounts ledger={ledger} onShow={(konto) => showBookings({ konto })} />}
      {tab === 'zeitraeume' && <Periods ledger={ledger} onShow={(monat) => showBookings({ monat })} />}
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
  const { ledger } = useApp()
  const yearAgo = `${Number(TODAY_ISO.slice(0, 4)) - 1}${TODAY_ISO.slice(4)}`
  const fuel = fuelStats(ledger.receipts.filter((r) => r.date >= yearAgo))
  const { rows, totalMin, income, cost, perMin } = computeSparten()
  const charter = rows.find((r) => r.id === 's3')!
  const charterRate = charter.minutes ? charter.cost / charter.minutes : 0

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat compact label="Einnahmen 2026" value={eur(income)} hint="aus gebuchten Tickets und Rechnungen" />
        <Stat compact label="Kosten 2026" value={eur(cost)} hint={`variabel ${eur(totalMin * varPerMinute)} · fix ${eur(fixedCostsYear)}`} />
        <Stat compact label="Ergebnis" value={eur(income - cost)} tone={income - cost >= 0 ? 'ok' : 'bad'} />
        {fuel && <Stat compact label="Ø Treibstoffpreis" value={perLiter(fuel.avg)} hint={`${Math.round(fuel.liters)} L, letzte 12 Monate`} />}
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 py-2 font-semibold">Ergebnis je Sparte (OE-DZA)</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
            <tr><th className="px-5 py-2 font-medium">Sparte</th><th className="px-3 py-2 text-right font-medium">Minuten</th><th className="px-3 py-2 text-right font-medium">Einnahmen</th><th className="px-3 py-2 text-right font-medium">Kosten</th><th className="px-5 py-2 text-right font-medium">Ergebnis</th></tr>
          </thead>
          <tbody className="divide-y divide-line tabular-nums">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-5 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2 text-right">{r.minutes.toLocaleString('de-AT')}</td>
                <td className="px-3 py-2 text-right">{eur(r.income)}</td>
                <td className="px-3 py-2 text-right">{eur(r.cost)}</td>
                <td className={clsx('px-5 py-2 text-right font-semibold', r.result >= 0 ? 'text-ok' : 'text-bad')}>{eur(r.result)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold">Kostendeckender Satz OE-DZA</div>
            <div className="text-2xl font-semibold tabular-nums">{eur(perMin)} <span className="text-base font-normal text-muted">pro Minute · {eur(perMin * 60)} pro Stunde</span></div>
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
