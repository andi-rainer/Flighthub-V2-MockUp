import clsx from 'clsx'
import { useState } from 'react'
import PrintFrame, { PRINT_PAGE } from '../../PrintFrame'
import { eur, members, type Member } from '../../data'
import { useApp } from '../../state'
import { Drawer, Segmented } from '../../ui'
import LetterHead, { LetterFoot } from '../members/LetterHead'
import type { Entry } from './ledger'

/** [Entwurf] The reference a member writes on a transfer: one fixed number per Betriebskonto, so a transfer finds its account without guessing from names. */
export const payRef = (m: Pick<Member, 'id' | 'name'>) => `BK-${1000 + Number(m.id.replace(/\D/g, ''))} ${m.name}`

const MONTHS = ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
const monthName = (mm: string) => `${MONTHS[Number(mm) - 1]} 2026`

/** The statement of one month of one Betriebskonto. The dummy keeps only day and month of a booking, so the year is fixed. */
export function StatementSheet({ member, month, balance, history }: { member: Member; month: string; balance: number; history: Entry[] }) {
  const { branding, club } = useApp()
  const inMonth = history.filter((e) => e.date.slice(3, 5) === month).slice().reverse()
  const later = history.filter((e) => Number(e.date.slice(3, 5)) > Number(month)).reduce((n, e) => n + e.amount, 0)
  const closing = balance - later
  const opening = closing - inMonth.reduce((n, e) => n + e.amount, 0)
  return (
    <PrintFrame name={`Kontoauszug ${monthName(month)} ${member.name}`}>
      <div {...PRINT_PAGE} className="rounded-xl border border-line bg-white p-5 text-sm shadow-sm">
        <LetterHead design={branding} />
        <div className="mt-4 flex items-start justify-between gap-4">
          <div><div className="text-xs text-muted">Betriebskonto</div><div className="font-medium">{member.name}</div><div className="text-xs text-muted">{payRef(member).split(' ')[0]}</div></div>
          <div className="text-right"><div className="font-semibold">Kontoauszug</div><div className="text-xs text-muted">{monthName(month)}</div></div>
        </div>
        <table className="mt-4 w-full text-xs">
          <tbody className="divide-y divide-line">
            <tr><td className="py-1.5 text-muted" colSpan={2}>Stand am Monatsanfang</td><td className="py-1.5 text-right tabular-nums">{eur(opening)}</td></tr>
            {inMonth.map((e, i) => (
              <tr key={i}><td className="w-12 py-1.5 text-muted">{e.date}</td><td className={clsx('py-1.5', e.reversed && 'text-muted line-through')}>{e.text}</td><td className={clsx('py-1.5 text-right tabular-nums', e.reversed && 'text-muted')}>{eur(e.amount)}</td></tr>
            ))}
            {inMonth.length === 0 && <tr><td className="py-1.5 text-muted" colSpan={3}>Keine Buchungen in diesem Monat.</td></tr>}
            <tr className="font-semibold"><td className="py-2" colSpan={2}>Stand am Monatsende</td><td className={clsx('py-2 text-right tabular-nums', closing < 0 && 'text-bad')}>{eur(closing)}</td></tr>
          </tbody>
        </table>
        {closing < 0 && (
          <p className="mt-3 rounded-lg bg-warn-soft p-3 text-xs text-amber-900">
            Offener Betrag {eur(-closing)}. Bitte auf IBAN {club.iban} überweisen, Verwendungszweck {payRef(member)}.
          </p>
        )}
        <div className="mt-4 border-t border-line pt-2"><LetterFoot design={branding} /></div>
      </div>
    </PrintFrame>
  )
}

/** A statement in a drawer: month choice and the sheet with PDF and print. */
export function StatementDrawer({ memberId, month, onClose }: { memberId: string | null; month?: string; onClose: () => void }) {
  const { ledger } = useApp()
  const [chosen, setChosen] = useState<string | null>(null)
  const member = members.find((m) => m.id === memberId)
  if (!member) return null
  const history = ledger.history[member.id] ?? []
  const months = [...new Set(history.map((e) => e.date.slice(3, 5)))].sort().reverse()
  const mm = chosen ?? month ?? months[0] ?? '10'
  return (
    <Drawer open title={`Kontoauszug ${member.name}`} onClose={() => { setChosen(null); onClose() }}>
      <div className="space-y-4">
        {months.length > 1 && <Segmented<string> value={mm} onChange={setChosen} options={months.map((m) => ({ value: m, label: monthName(m) }))} />}
        <StatementSheet member={member} month={mm} balance={ledger.balances[member.id] ?? 0} history={history} />
      </div>
    </Drawer>
  )
}
