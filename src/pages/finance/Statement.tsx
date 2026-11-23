import clsx from 'clsx'
import { useState } from 'react'
import PrintFrame, { PRINT_PAGE } from '../../PrintFrame'
import { eur, members, type Member } from '../../data'
import { useApp } from '../../state'
import { Badge, Drawer, Segmented } from '../../ui'
import LetterHead, { LetterFoot } from '../members/LetterHead'
import type { Entry } from './ledger'
import { chargeKey, interimOf, invoiceNo, isCharge, useMoneyDocs, type Interim } from './memberDocs'
import { dmy } from '../manifest/data'

/** [Entwurf] The reference a member writes on a transfer: one fixed number per Betriebskonto, so a transfer finds its account without guessing from names. */
export const payRef = (m: Pick<Member, 'id' | 'name'>) => `BK-${1000 + Number(m.id.replace(/\D/g, ''))} ${m.name}`

const MONTHS = ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
const monthName = (mm: string) => `${MONTHS[Number(mm) - 1]} 2026`

/**
 * [Entwurf] The Monatsrechnung of one month of one Betriebskonto: the invoice of everything charged (flights, jumps, fees, tickets …) with
 * its sum, then the payments received and the balance. It is the income document; each charge links to it. Charges already invoiced with a
 * Zwischenrechnung are named, not charged again. The dummy keeps only day and month of a booking, so the year is fixed.
 */
export function StatementSheet({ member, month, balance, history }: { member: Member; month: string; balance: number; history: Entry[] }) {
  const { branding, club, ledger } = useApp()
  const inMonth = history.filter((e) => e.date.slice(3, 5) === month).slice().reverse()
  const later = history.filter((e) => Number(e.date.slice(3, 5)) > Number(month)).reduce((n, e) => n + e.amount, 0)
  const closing = balance - later
  const opening = closing - inMonth.reduce((n, e) => n + e.amount, 0)
  const docs = useMoneyDocs()
  const charges = inMonth.filter(isCharge)
  const rest = charges.filter((e) => !interimOf(member.id, e, docs))
  const before = [...new Set(charges.map((e) => interimOf(member.id, e, docs)).filter((i): i is Interim => !!i))]
  const payments = inMonth.filter((e) => !isCharge(e))
  const sum = (l: Entry[]) => l.reduce((n, e) => n + e.amount, 0)
  const state = ledger.statements[`2026-${month}`]?.state ?? 'entwurf'
  const row = (e: Entry, i: number, sign = 1) => (
    <tr key={i}><td className="w-12 py-1.5 text-muted">{e.date}</td><td className={clsx('py-1.5', e.reversed && 'text-muted line-through')}>{e.text}</td><td className={clsx('py-1.5 text-right tabular-nums', e.reversed && 'text-muted')}>{eur(sign * e.amount)}</td></tr>
  )
  return (
    <PrintFrame name={`Monatsrechnung ${invoiceNo(member, month)} ${member.name}`}>
      <div {...PRINT_PAGE} className="rounded-xl border border-line bg-white p-5 text-sm shadow-sm">
        <LetterHead design={branding} />
        <div className="mt-4 flex items-start justify-between gap-4">
          <div><div className="text-xs text-muted">Betriebskonto</div><div className="font-medium">{member.name}</div><div className="text-xs text-muted">{payRef(member).split(' ')[0]}</div></div>
          <div className="text-right"><div className="font-semibold">Monatsrechnung</div><div className="text-xs text-muted">{invoiceNo(member, month)} · {monthName(month)}</div>{state !== 'versendet' && <div className="mt-1"><Badge tone="warn">{state === 'freigabe' ? 'Zur Freigabe' : 'Entwurf'}</Badge></div>}</div>
        </div>
        <table className="mt-4 w-full text-xs">
          <thead><tr className="text-left text-muted"><th className="py-1 font-medium" colSpan={3}>Leistungen</th></tr></thead>
          <tbody className="divide-y divide-line">
            {rest.map((e, i) => row(e, i, -1))}
            {rest.length === 0 && <tr><td className="py-1.5 text-muted" colSpan={3}>{before.length > 0 ? 'Keine weiteren Leistungen in diesem Monat.' : 'Keine Leistungen in diesem Monat.'}</td></tr>}
            {before.map((z) => { const part = charges.filter((e) => interimOf(member.id, e, docs) === z); return <tr key={z.no} className="text-muted"><td className="py-1.5" colSpan={2}>Bereits verrechnet mit Zwischenrechnung {z.no} vom {dmy(z.date)} ({part.length})</td><td className="py-1.5 text-right tabular-nums">({eur(-sum(part))})</td></tr> })}
            <tr className="font-semibold"><td className="py-2" colSpan={2}>Summe Leistungen</td><td className="py-2 text-right tabular-nums">{eur(-sum(rest))}</td></tr>
          </tbody>
        </table>
        <table className="mt-4 w-full text-xs">
          <thead><tr className="text-left text-muted"><th className="py-1 font-medium" colSpan={3}>Zahlungen und Gutschriften</th></tr></thead>
          <tbody className="divide-y divide-line">
            {payments.map((e, i) => row(e, i))}
            {payments.length === 0 && <tr><td className="py-1.5 text-muted" colSpan={3}>Keine Zahlungen in diesem Monat.</td></tr>}
          </tbody>
        </table>
        <table className="mt-4 w-full text-xs">
          <tbody className="divide-y divide-line">
            <tr><td className="py-1.5 text-muted">Stand am Monatsanfang</td><td className="py-1.5 text-right tabular-nums">{eur(opening)}</td></tr>
            <tr><td className="py-1.5 text-muted">Leistungen</td><td className="py-1.5 text-right tabular-nums">{eur(sum(charges))}</td></tr>
            <tr><td className="py-1.5 text-muted">Zahlungen und Gutschriften</td><td className="py-1.5 text-right tabular-nums">{eur(sum(payments))}</td></tr>
            <tr className="font-semibold"><td className="py-2">{closing > 0 ? 'Guthaben am Monatsende' : 'Stand am Monatsende'}</td><td className={clsx('py-2 text-right tabular-nums', closing < 0 && 'text-bad')}>{eur(closing)}</td></tr>
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

/** A Monatsrechnung in a drawer: month choice and the sheet with PDF and print. `released`: only months the treasurer released (Mein Konto). */
export function StatementDrawer({ memberId, month, onClose, released = false }: { memberId: string | null; month?: string; onClose: () => void; released?: boolean }) {
  const { ledger } = useApp()
  const [chosen, setChosen] = useState<string | null>(null)
  const member = members.find((m) => m.id === memberId)
  if (!member) return null
  const history = ledger.history[member.id] ?? []
  const months = [...new Set(history.map((e) => e.date.slice(3, 5)))].filter((mm) => !released || ledger.statements[`2026-${mm}`]?.state === 'versendet').sort().reverse()
  const mm = chosen ?? month ?? months[0] ?? '10'
  return (
    <Drawer open title={`Monatsrechnung ${member.name}`} onClose={() => { setChosen(null); onClose() }}>
      <div className="space-y-4">
        {months.length > 1 && <Segmented<string> value={mm} onChange={setChosen} options={months.map((m) => ({ value: m, label: monthName(m) }))} />}
        <StatementSheet member={member} month={mm} balance={ledger.balances[member.id] ?? 0} history={history} />
      </div>
    </Drawer>
  )
}

/** [Entwurf] A Zwischenrechnung: the charges up to the day it was asked for that were not invoiced yet, with its own number. */
export function InterimSheet({ interim: z }: { interim: Interim }) {
  const { branding, club, ledger } = useApp()
  const member = members.find((m) => m.id === z.memberId)
  if (!member) return null
  const charges = (ledger.history[member.id] ?? []).filter((e) => z.keys.includes(chargeKey(e))).slice().reverse()
  return (
    <PrintFrame name={`Zwischenrechnung ${z.no} ${member.name}`}>
      <div {...PRINT_PAGE} className="rounded-xl border border-line bg-white p-5 text-sm shadow-sm">
        <LetterHead design={branding} />
        <div className="mt-4 flex items-start justify-between gap-4">
          <div><div className="text-xs text-muted">Betriebskonto</div><div className="font-medium">{member.name}</div><div className="text-xs text-muted">{payRef(member).split(' ')[0]}</div></div>
          <div className="text-right"><div className="font-semibold">Zwischenrechnung</div><div className="text-xs text-muted">{z.no} · bis {dmy(z.date)} {z.time}</div></div>
        </div>
        <table className="mt-4 w-full text-xs">
          <thead><tr className="text-left text-muted"><th className="py-1 font-medium" colSpan={3}>Leistungen, noch nicht verrechnet</th></tr></thead>
          <tbody className="divide-y divide-line">
            {charges.map((e, i) => <tr key={i}><td className="w-12 py-1.5 text-muted">{e.date}</td><td className="py-1.5">{e.text}</td><td className="py-1.5 text-right tabular-nums">{eur(-e.amount)}</td></tr>)}
            <tr className="font-semibold"><td className="py-2" colSpan={2}>Summe</td><td className="py-2 text-right tabular-nums">{eur(z.total)}</td></tr>
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted">IBAN {club.iban}, Verwendungszweck {payRef(member)}.</p>
        <div className="mt-4 border-t border-line pt-2"><LetterFoot design={branding} /></div>
      </div>
    </PrintFrame>
  )
}

export function InterimDrawer({ interim, onClose }: { interim: Interim | null; onClose: () => void }) {
  if (!interim) return null
  return <Drawer open title={`Zwischenrechnung ${interim.no}`} onClose={onClose}><InterimSheet interim={interim} /></Drawer>
}
