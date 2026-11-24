import clsx from 'clsx'
import { Check, ChevronDown, Eye, Mail } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { CASH_ID, eur } from '../../data'
import { useApp } from '../../state'
import { Card, Drawer } from '../../ui'
import { mails } from '../store/data'
import { dmy } from './data'
import { useDayCheck } from './dayCheck'

/**
 * [Entwurf] The last step of "Tag abschließen" before the big button: the mails that go out (each can be switched off and previewed as it
 * will be sent) and every new booking of the day per account (Kassa, Bank, each Betriebskonto). Everything of the day is "vorläufig" until
 * Kassier or Obmann check it and lock it ("Prüfen und festschreiben").
 */

export type DayMailId = 'tandem_postponed' | 'booking_cancelled_contact' | 'account_minus'
export interface DayMail { key: string; mailId: DayMailId; /** Guest or member. */ who: string; /** Address, or who gets it. */ to: string; vars: Record<string, string> }

/** The mail as it will be sent: subject and text of the catalog (Shop und Mails), with the placeholders filled. */
export function renderMail(m: DayMail) {
  const def = mails.find((x) => x.id === m.mailId)
  const fill = (t: string) => t.replace(/\{(\w+)\}/g, (all, k: string) => m.vars[k] ?? all)
  return { name: def?.name ?? m.mailId, subject: fill(def?.subject.de ?? ''), body: fill(def?.body.de ?? '') }
}

/** [Entwurf] Small mark of a booking that is not final yet. */
export function Provisional({ className }: { className?: string }) {
  return <span className={clsx('inline-flex items-center rounded-md bg-warn-soft px-1.5 py-0.5 text-xs font-medium text-warn', className)}>vorläufig</span>
}

/**
 * [Entwurf] Is a booking of a Betriebskonto still "vorläufig"? It belongs to a Sprungtag ("… Sprungtag 07.11. …") that is running or closed
 * but not yet locked by Kassier or Obmann.
 */
export function useProvisional() {
  const open = new Set(useOpenDays().map((iso) => dmy(iso).slice(0, 6)))
  return (text: string) => { const m = /Sprungtag (\d{2}\.\d{2}\.)/.exec(text); return !!m && open.has(m[1]) }
}

/** ISO dates of the Sprungtage that are running or closed but not yet locked. */
function useOpenDays() {
  const { days, ledger } = useApp()
  const check = useDayCheck()
  return days.filter((d) => {
    if (d.status === 'aktiv') return true
    const c = check.current(ledger.dayReports, d.id)
    return !!c && c.state === 'pruefung'
  }).map((d) => d.date)
}

/** [Beschlossen] A Kassa line in Finanzen › Buchungen is "vorläufig" while its Sprungtag is running or not yet locked. */
export function useProvisionalCash() {
  const open = new Set(useOpenDays())
  return (l: { accountId: string; date: string }) => l.accountId === CASH_ID && open.has(l.date)
}

/** One mail per row: "senden" (on by default) and "Vorschau". */
export function MailList({ list, off, onToggle }: { list: DayMail[]; off: string[]; onToggle: (key: string) => void }) {
  const [show, setShow] = useState<DayMail | null>(null)
  const on = list.filter((m) => !off.includes(m.key)).length
  const r = show ? renderMail(show) : null
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Mails</h2>
        <span className="text-sm tabular-nums text-muted">{on} von {list.length} senden</span>
      </div>
      <Card className="divide-y divide-line">
        {list.map((m) => {
          const sending = !off.includes(m.key)
          return (
            <div key={m.key} className="flex min-h-14 items-center gap-3 px-4 py-2 sm:px-5">
              <button role="checkbox" aria-checked={sending} aria-label={`${renderMail(m).name} an ${m.who} senden`} onClick={() => onToggle(m.key)}
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg pr-2 text-sm font-medium">
                <span className={clsx('grid h-6 w-6 place-items-center rounded-md border-2 transition', sending ? 'border-brand bg-brand text-white' : 'border-line bg-surface')}>{sending && <Check size={14} strokeWidth={3} />}</span>
                <span className={sending ? 'text-ink' : 'text-muted'}>senden</span>
              </button>
              <span className={clsx('min-w-0 flex-1', !sending && 'opacity-50')}>
                <span className="block truncate text-base"><b className="font-medium">{m.who}</b> · {renderMail(m).name}</span>
                <span className="block truncate text-sm text-muted">{m.to}</span>
              </span>
              <button onClick={() => setShow(m)} className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-medium hover:bg-slate-50"><Eye size={15} /> Vorschau</button>
            </div>
          )
        })}
      </Card>
      {show && r && (
        <Drawer open title={`Vorschau · ${r.name}`} onClose={() => setShow(null)}>
          <div className="overflow-hidden rounded-xl border border-line">
            <div className="space-y-1 border-b border-line bg-slate-50 px-4 py-3 text-sm">
              <div className="flex gap-2"><span className="w-14 shrink-0 text-muted">An</span><span className="min-w-0 break-words">{show.to}</span></div>
              <div className="flex gap-2"><span className="w-14 shrink-0 text-muted">Betreff</span><b className="min-w-0 font-semibold">{r.subject}</b></div>
            </div>
            <div className="flex gap-3 px-4 py-5"><Mail size={18} className="mt-0.5 shrink-0 text-muted" /><p className="whitespace-pre-line text-base leading-relaxed">{r.body}</p></div>
          </div>
        </Drawer>
      )}
    </section>
  )
}

export interface PreviewEntry { time?: string; text: string; amount: number; doc?: string }
/** One account in the preview: the Kassa, a bank account (open transfers expected) or a member's Betriebskonto. */
export interface PreviewAccount { key: string; title: string; sub: string; entries: PreviewEntry[]; before?: number; after?: number; expected?: boolean }

/** [Entwurf] All new bookings of the day per account, compact; a row opens its bookings. */
export function BookingsPreview({ money, members }: { money: PreviewAccount[]; members: PreviewAccount[] }) {
  const n = [...money, ...members].reduce((k, a) => k + a.entries.length, 0)
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">Neue Buchungen <Provisional className="normal-case tracking-normal" /></h2>
        <span className="text-sm tabular-nums text-muted">{n}</span>
      </div>
      <Card className="divide-y divide-line">
        {money.map((a) => <AccountRow key={a.key} a={a} />)}
        {members.length > 0 && <div className="bg-slate-50/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted sm:px-5">Mitglieder-Konten</div>}
        {members.map((a) => <AccountRow key={a.key} a={a} />)}
        {n === 0 && <div className="px-5 py-6 text-sm text-muted">Keine Buchungen.</div>}
      </Card>
    </section>
  )
}

function AccountRow({ a }: { a: PreviewAccount }) {
  const [open, setOpen] = useState(false)
  const sum = Math.round(a.entries.reduce((k, e) => k + e.amount, 0) * 100) / 100
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-slate-50/60 sm:px-5">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-medium">{a.title}</span>
          <span className="block truncate text-sm text-muted">{a.sub} · {a.entries.length} {a.entries.length === 1 ? 'Buchung' : 'Buchungen'}</span>
        </span>
        <span className="shrink-0 text-right tabular-nums">
          {a.before !== undefined && a.after !== undefined
            ? <><span className="text-sm text-muted">{eur(a.before)} → </span><b className={clsx('font-semibold', a.after < 0 && 'text-bad')}>{eur(a.after)}</b></>
            : <b className={clsx('font-semibold', a.expected && 'font-normal italic text-muted')}>{sum > 0 ? '+' : ''}{eur(sum)}</b>}
        </span>
        <ChevronDown size={18} className={clsx('shrink-0 text-muted transition', open && 'rotate-180')} />
      </button>
      {open && (
        <ul className="space-y-0.5 border-t border-line/60 bg-slate-50/60 px-4 py-2 text-sm sm:px-5">
          {a.entries.map((e, i) => (
            <Li key={i} amount={e.amount} expected={a.expected}>
              {e.time && <span className="mr-2 tabular-nums text-muted">{e.time}</span>}{e.text}{e.doc && <span className="ml-2 font-mono text-xs text-muted">{e.doc}</span>}
            </Li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Li({ amount, expected, children }: { amount: number; expected?: boolean; children: ReactNode }) {
  return (
    <li className="flex items-baseline justify-between gap-4 py-0.5">
      <span className="min-w-0">{children}</span>
      <span className={clsx('shrink-0 tabular-nums', expected ? 'italic text-muted' : amount < 0 ? 'text-bad' : 'text-ok')}>{amount > 0 ? '+' : ''}{eur(amount)}</span>
    </li>
  )
}
