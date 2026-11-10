import clsx from 'clsx'
import { useSearchParams } from 'react-router-dom'
import { type Permission } from '../permissions'
import { useApp } from '../state'
import { PageHeader } from '../ui'
import Accounts from './finance/Accounts'
import Config from './finance/Config'
import Expenses from './finance/Expenses'
import Flights from './finance/Flights'
import Invoices from './finance/Invoices'
import Journal from './finance/Journal'
import Periods from './finance/Periods'
import Result from './finance/Result'
import { isTodo, lineStatus } from './finance/status'

type Tab = 'bank' | 'auslagen' | 'rechnungen' | 'zeitraeume' | 'verrechnen' | 'konten' | 'ergebnis' | 'konfig'

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
      {tab === 'bank' && <Journal key={`${params.get('konto')}|${params.get('monat')}|${params.get('offen')}`} ledger={ledger} preset={{ account: params.get('konto') ?? undefined, month: params.get('monat') ?? undefined, todo: params.get('offen') === '1' }} />}
      {tab === 'auslagen' && <Expenses ledger={ledger} />}
      {tab === 'rechnungen' && <Invoices ledger={ledger} />}
      {tab === 'zeitraeume' && <Periods ledger={ledger} onShow={(monat) => showBookings({ monat })} />}
      {tab === 'verrechnen' && <Flights />}
      {tab === 'konten' && <Accounts ledger={ledger} />}
      {tab === 'ergebnis' && <Result onOpenLines={() => setParams({ tab: 'bank', offen: '1' })} />}
      {tab === 'konfig' && <Config ledger={ledger} />}
      {ledger.toast && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink px-5 py-3 text-sm font-medium text-white shadow-lg md:bottom-8">{ledger.toast}</div>
      )}
    </>
  )
}
