import clsx from 'clsx'
import { Lock } from 'lucide-react'
import { useState } from 'react'
import { eur } from '../../data'
import { useSession } from '../../session/session'
import { Badge, Button, Card, Drawer, Segmented } from '../../ui'
import { TODAY_ISO, useApp } from '../../state'
import { dmy } from '../manifest/data'
import { useActor } from '../tickets/parts'
import { monthOf, type Ledger } from './ledger'
import { monthLabel } from './parts'
import { isTodo, lineStatus } from './status'

/**
 * Release of a period. As long as a month is open, its bookings can change (cost center, text, invoices). The final release locks them;
 * it needs every booking assigned and covered by an invoice (or an exception). Lifting a release is possible, needs the same permission
 * and is shown on the month.
 */
export default function Periods({ ledger, onShow }: { ledger: Ledger; onShow: (month: string) => void }) {
  const { can } = useApp()
  const thisYear = Number(TODAY_ISO.slice(0, 4))
  const first = Math.min(thisYear, ...ledger.lines.map((l) => Number(l.date.slice(0, 4))))
  const years = Array.from({ length: thisYear - first + 1 }, (_, i) => String(thisYear - i))
  const [year, setYear] = useState(String(thisYear))
  const [act, setAct] = useState<null | { month: string; mode: 'release' | 'reopen' }>(null)
  const may = can('billing.periods.release')
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`).filter((m) => m <= monthOf(TODAY_ISO)).reverse()
  const stat = (m: string) => {
    const lines = ledger.lines.filter((l) => monthOf(l.date) === m)
    return {
      count: lines.length, todo: lines.filter((l) => isTodo(lineStatus(l, ledger))).length,
      income: lines.filter((l) => l.amount > 0).reduce((n, l) => n + l.amount, 0), cost: lines.filter((l) => l.amount < 0).reduce((n, l) => n + l.amount, 0),
    }
  }
  const open = months.filter((m) => !ledger.released[m] && stat(m).count > 0).length

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented value={year} onChange={setYear} options={years.map((y) => ({ value: y, label: y }))} />
        <span className="text-sm text-muted">{open > 0 ? `${open} Monate offen` : 'Alle Monate freigegeben'}</span>
      </div>
      <Card className="overflow-hidden">
        <div className="hidden grid-cols-[minmax(0,1.2fr)_5rem_7rem_7rem_7rem_minmax(0,1.6fr)] gap-x-3 border-b border-line bg-slate-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted md:grid">
          <span>Monat</span><span className="text-right">Buchungen</span><span className="text-right">Einnahmen</span><span className="text-right">Ausgaben</span><span>Zu bearbeiten</span><span>Freigabe</span>
        </div>
        <div className="divide-y divide-line">
          {months.map((m) => {
            const s = stat(m)
            const rel = ledger.released[m]
            return (
              <div key={m} className={clsx('grid items-center gap-x-3 gap-y-1 px-4 py-2.5 md:grid-cols-[minmax(0,1.2fr)_5rem_7rem_7rem_7rem_minmax(0,1.6fr)]', rel && 'bg-slate-50/70')}>
                <div className="flex items-center gap-2 font-medium">{rel && <Lock size={14} className="text-muted" />}{monthLabel(m)}</div>
                <div className="text-sm tabular-nums md:text-right">{s.count}</div>
                <div className="text-sm tabular-nums text-ok md:text-right">{eur(s.income)}</div>
                <div className="text-sm tabular-nums text-bad md:text-right">{eur(s.cost)}</div>
                <div>{s.todo > 0 ? <button onClick={() => onShow(m)} className="rounded-full bg-warn-soft px-2 py-px text-xs font-medium text-amber-900 hover:underline">{s.todo} offen</button> : <span className="text-xs text-muted">–</span>}</div>
                <div className="flex flex-wrap items-center gap-2">
                  {rel
                    ? <><span className="text-xs text-muted">Freigegeben von {rel.by} am {dmy(rel.at)}</span>{may && <Button variant="ghost" onClick={() => setAct({ month: m, mode: 'reopen' })}>Aufheben</Button>}</>
                    : s.count === 0 ? <span className="text-xs text-muted">keine Buchungen</span>
                    : <Button variant="primary" disabled={!may || s.todo > 0} onClick={() => setAct({ month: m, mode: 'release' })}>Freigeben</Button>}
                  {!rel && s.todo > 0 && <Badge tone="warn">erst zuordnen</Badge>}
                </div>
              </div>
            )
          })}
        </div>
      </Card>
      {act && <Confirm key={act.month + act.mode} month={act.month} mode={act.mode} ledger={ledger} onClose={() => setAct(null)} />}
    </div>
  )
}

function Confirm({ month, mode, ledger, onClose }: { month: string; mode: 'release' | 'reopen'; ledger: Ledger; onClose: () => void }) {
  const { guarded } = useSession()
  const actor = useActor()
  const [sure, setSure] = useState(false)
  const lines = ledger.lines.filter((l) => monthOf(l.date) === month)
  const invoices = ledger.receipts.filter((r) => lines.some((l) => l.id === r.lineId)).length
  const income = lines.filter((l) => l.amount > 0).reduce((n, l) => n + l.amount, 0)
  const cost = lines.filter((l) => l.amount < 0).reduce((n, l) => n + l.amount, 0)
  const release = mode === 'release'
  const run = () => { guarded('billing.periods.release', () => (release ? ledger.release(month, actor) : ledger.reopen(month, actor))); onClose() }
  return (
    <Drawer open title={`${monthLabel(month)} ${release ? 'freigeben' : ': Freigabe aufheben'}`} onClose={onClose}
      footer={<div className="flex justify-end gap-2"><Button onClick={onClose}>Abbrechen</Button><Button variant={release ? 'primary' : 'danger'} disabled={release && !sure} onClick={run}>{release ? 'Freigeben und sperren' : 'Freigabe aufheben'}</Button></div>}>
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-slate-50 p-3"><div className="text-lg font-semibold tabular-nums">{lines.length}</div><div className="text-xs text-muted">Buchungen</div></div>
          <div className="rounded-xl bg-slate-50 p-3"><div className="text-lg font-semibold tabular-nums">{invoices}</div><div className="text-xs text-muted">Rechnungen</div></div>
          <div className="rounded-xl bg-slate-50 p-3"><div className="text-lg font-semibold tabular-nums">{eur(income + cost)}</div><div className="text-xs text-muted">Saldo</div></div>
        </div>
        {release ? (
          <>
            <p>Diese {lines.length} Buchungen und ihre Rechnungen werden gesperrt. Kostenstelle, Buchungstext und Rechnungen lassen sich danach nicht mehr ändern.</p>
            <label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5" checked={sure} onChange={(e) => setSure(e.target.checked)} />Ich habe {monthLabel(month)} geprüft.</label>
          </>
        ) : (
          <p>Die Buchungen von {monthLabel(month)} sind danach wieder änderbar. Wer die Freigabe aufhebt, steht bei der Buchung.</p>
        )}
      </div>
    </Drawer>
  )
}
