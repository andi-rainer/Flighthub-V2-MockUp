import clsx from 'clsx'
import { FileText } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CASH_ID, eur } from '../../data'
import PrintFrame, { PRINT_PAGE } from '../../PrintFrame'
import { useSession } from '../../session/session'
import { TODAY_ISO, useApp } from '../../state'
import { Badge, Button, Drawer } from '../../ui'
import { DAY_CHECK, checkStateOf, useDayCheck } from '../manifest/dayCheck'
import { dmy, weekday } from '../manifest/data'
import LetterHead from '../members/LetterHead'
import { useActor } from '../tickets/parts'
import { dayCash, daySummary, HOW_WORDS, jumpsLabel, reportTotals, type DayReport, type DayReportLine } from './cashDocs'

/** [Entwurf] Members and guests together up to this many rows share one page; more get a page each. */
const ROWS_ON_ONE_PAGE = 18

const memberHow = (l: DayReportLine) => (l.how === 'bar' ? (l.cash > l.price ? `bar ${eur(l.cash)}` : 'bar') : 'vom Konto')
const memberWhat = (l: DayReportLine) => (l.jumps !== undefined ? jumpsLabel(l.jumps, l.paidSeats ?? 0) : l.what)
const sumOf = (ls: DayReportLine[], v: (l: DayReportLine) => number) => ls.reduce((n, l) => n + v(l), 0)

/**
 * [Entwurf] Tagesabschluss-Beleg: the document of a closed Sprungtag. It is the receipt of the Kassa booking (cash takings have no invoice),
 * so the principle "every booking has a document" holds for cash as well. Page 1: the day, the cash, who is in minus, redeemed vouchers.
 * Then every member and every tandem guest one row each, and the signatures. The layout is the print layout of every document of the club.
 */
export function DayReportSheet({ report: r }: { report: DayReport }) {
  const { branding, ledger } = useApp()
  const review = useDayCheck().reviewOf(r.id)
  const s = daySummary(r)
  const cashLine = ledger.lines.find((l) => l.id === r.cashLineId)
  const split = s.members.length + s.guests.length > ROWS_ON_ONE_PAGE
  const pages = split ? 3 : 2
  const closedAt = `${dmy(r.at)}${r.time ? `, ${r.time} Uhr` : ''}`
  const memberLines = s.members.map((m) => m.line)
  const viaKonto = sumOf(memberLines.filter((l) => l.how !== 'bar'), (l) => l.price)
  const ticketCash = reportTotals(r).ticketCash
  const prepaid = sumOf(s.guests.filter((l) => l.how === 'voucher' || l.how === 'online' || l.how === 'ticket'), (l) => l.price)

  const signatures = (
    <div className="mt-auto space-y-3 pt-10">
      <div className="grid grid-cols-2 gap-8 text-[10px] text-slate-500">
        <div className="border-t border-slate-400 pt-1">Abgeschlossen von {r.by}, {closedAt}</div>
        <div className="border-t border-slate-400 pt-1">{review.check
          ? <>Geprüft und festgeschrieben von <b className="font-semibold text-slate-800">{review.check.by}</b>, {dmy(review.check.at)}, {review.check.time} Uhr</>
          : 'Geprüft und festgeschrieben (Kassier oder Obmann)'}</div>
      </div>
      <div className="text-[10px] text-slate-500">
        {r.cashLineId && cashLine ? `Kassabuchung Tageskasse ${dmy(cashLine.date)}: ${eur(cashLine.amount)} auf ${ledger.accountName(cashLine.accountId)}.` : s.cash > 0 ? '' : 'Kein Bargeld an diesem Tag, keine Kassabuchung.'}
        {ticketCash > 0 && ` Bar von Tandem-Gästen mit Ticket oder Voucher, am Ticket gebucht: ${eur(ticketCash)}.`}
      </div>
    </div>
  )

  const membersTable = (
    <Block title="Mitglieder" right={`${s.members.length} ${s.members.length === 1 ? 'Person' : 'Personen'}`}>
      {s.members.length === 0 ? <None>Keine Mitglieder an diesem Tag.</None> : (
        <table className="w-full text-left text-[11px]">
          <thead><tr className="border-b border-slate-400 text-slate-500"><Th>Name</Th><Th>Sprünge</Th><Th>bezahlt</Th><Th right>Betrag</Th><Th right>Konto vorher → nachher</Th></tr></thead>
          <tbody>
            {s.members.map(({ line: l, before, after }, i) => (
              <tr key={i} className="break-inside-avoid border-b border-slate-200 align-top">
                <Td>{l.who}</Td>
                <Td>{memberWhat(l)}</Td>
                <Td>{memberHow(l)}</Td>
                <Td right>{eur(l.price)}</Td>
                <Td right>{before === undefined || after === undefined ? '–' : <>{eur(before)} → <span className={clsx('font-medium', after < 0 && 'text-red-700')}>{eur(after)}</span></>}</Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-400 font-semibold"><Td>Summe</Td><Td /><Td /><Td right>{eur(s.memberTotal)}</Td><Td /></tr>
            <tr className="text-slate-600"><Td>davon vom Konto</Td><Td /><Td /><Td right>{eur(viaKonto)}</Td><Td /></tr>
            <tr className="text-slate-600"><Td>bar erhalten</Td><Td /><Td /><Td right>{eur(s.memberCash)}</Td><Td /></tr>
          </tfoot>
        </table>
      )}
    </Block>
  )

  const guestsTable = (
    <Block title="Tandem-Gäste" right={`${s.guests.length} ${s.guests.length === 1 ? 'Gast' : 'Gäste'}`}>
      {s.guests.length === 0 ? <None>Keine Tandem-Gäste an diesem Tag.</None> : (
        <table className="w-full text-left text-[11px]">
          <thead><tr className="border-b border-slate-400 text-slate-500"><Th>Name</Th><Th>Ticket / Voucher</Th><Th>Flug</Th><Th>bezahlt</Th><Th right>Betrag</Th></tr></thead>
          <tbody>
            {s.guests.map((l, i) => (
              <tr key={i} className={clsx('break-inside-avoid border-b border-slate-200 align-top', l.how === 'offen' && 'bg-amber-50')}>
                <Td>{l.who}</Td>
                <Td><span className="font-mono">{l.code ?? '–'}</span></Td>
                <Td>{l.flight ?? '–'}</Td>
                <Td>{l.how === 'offen' ? <b className="font-semibold text-amber-800">Überweisung offen</b> : HOW_WORDS[l.how]}</Td>
                <Td right>{eur(l.price)}</Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-400 font-semibold"><Td>Summe</Td><Td /><Td /><Td /><Td right>{eur(s.guestTotal)}</Td></tr>
            <tr className="text-slate-600"><Td>davon vorher bezahlt</Td><Td /><Td /><Td>Voucher, Ticket, online</Td><Td right>{eur(prepaid)}</Td></tr>
            <tr className="text-slate-600"><Td>davon bar</Td><Td /><Td /><Td /><Td right>{eur(s.guestCash)}</Td></tr>
            {s.openTotal > 0 && <tr className="font-semibold text-amber-800"><Td>davon Überweisung offen</Td><Td /><Td /><Td /><Td right>{eur(s.openTotal)}</Td></tr>}
          </tfoot>
        </table>
      )}
    </Block>
  )

  return (
    <PrintFrame name={`Tagesabschluss ${dmy(r.date)}`}>
      <div className="space-y-6 overflow-x-auto pb-2 print:space-y-0 print:overflow-visible print:pb-0">
        <Page no={1} of={pages} number={r.number}>
          <LetterHead design={branding} compact />
          <div className="flex items-end justify-between gap-4 border-b border-slate-300 pb-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-500">Tagesabschluss</div>
              <div className="text-lg font-semibold">Sprungtag {weekday(r.date)} {dmy(r.date)}</div>
            </div>
            <div className="font-mono text-[11px]">{r.number}</div>
          </div>

          <dl className="grid grid-cols-4 gap-x-4 gap-y-2 text-[11px]">
            <Fact label="Datum">{weekday(r.date)} {dmy(r.date)}</Fact>
            <Fact label="Flugzeug">{r.aircraft}</Fact>
            <Fact label="Flüge">{r.flights}</Fact>
            <Fact label="Sprünge">{r.jumps}</Fact>
            <Fact label="Abgeschlossen von" wide>{r.by}</Fact>
            <Fact label="Zeitpunkt" wide>{closedAt}</Fact>
            <Fact label="Prüfung" wide>{review.check ? `Festgeschrieben von ${review.check.by}, ${dmy(review.check.at)}, ${review.check.time} Uhr` : 'offen'}</Fact>
          </dl>

          {!!review.corrections?.length && (
            <div className="rounded border border-amber-300 bg-amber-50 p-3 text-[11px]">
              <div className="mb-1 font-semibold text-amber-900">Korrekturen bei der Prüfung</div>
              {review.corrections.map((c, i) => <div key={i}>{c.who}: {eur(c.from)} → {eur(c.to)} · {c.reason} <span className="text-slate-600">({c.by}, {dmy(c.at)}, {c.time} Uhr)</span></div>)}
            </div>
          )}

          <Block title="Kassa">
            <div className="grid grid-cols-2 gap-4 rounded border border-slate-300 p-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Bargeld heute gesamt</div>
                <div className="text-xl font-semibold tabular-nums">{eur(s.cash)}</div>
                <Line label="von Mitgliedern" value={eur(s.memberCash)} />
                <Line label="von Tandem-Gästen" value={eur(s.guestCash)} />
              </div>
              <div className="border-l border-slate-200 pl-4">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Kassa danach</div>
                <div className="text-xl font-semibold tabular-nums">{s.cashAfter === undefined ? '–' : eur(s.cashAfter)}</div>
                <Line label="Kassa vorher" value={r.cashBefore === undefined ? '–' : eur(r.cashBefore)} />
                <Line label="+ Bargeld heute" value={eur(s.cash)} />
              </div>
            </div>
          </Block>

          <Block title="Der Tag in Zahlen">
            <Line label={`Mitglieder (${s.members.length})`} value={eur(s.memberTotal)} />
            <Line label={`Tandem-Gäste (${s.guests.length})`} value={eur(s.guestTotal)} />
            {s.openTotal > 0 && <Line label="davon Überweisung offen" value={eur(s.openTotal)} strong tone="warn" />}
          </Block>

          <div className={clsx('rounded border p-3', s.newMinus.length > 0 ? 'border-red-300 bg-red-50' : 'border-slate-300')}>
            <div className="mb-1 text-[12px] font-semibold">Durch diesen Tag ins Minus gekommen</div>
            {s.newMinus.length === 0 ? <None>Niemand.</None> : (
              <table className="w-full table-fixed text-left text-[11px]">
                <MinusCols />
                <thead><tr className="border-b border-red-200 text-slate-500"><Th>Name</Th><Th right>vorher</Th><Th right>neuer Stand</Th></tr></thead>
                <tbody>{s.newMinus.map((m, i) => <tr key={i} className="break-inside-avoid border-b border-red-100"><Td>{m.line.who}</Td><Td right>{eur(m.before!)}</Td><Td right><b className="text-red-700">{eur(m.after!)}</b></Td></tr>)}</tbody>
              </table>
            )}
            {s.oldMinus.length > 0 && (
              <>
                <div className="mb-1 mt-3 text-[11px] font-semibold text-slate-600">Schon vorher im Minus</div>
                <table className="w-full table-fixed text-left text-[11px]">
                  <MinusCols />
                  <tbody>{s.oldMinus.map((m, i) => <tr key={i} className="break-inside-avoid border-b border-slate-200"><Td>{m.line.who}</Td><Td right>{eur(m.before!)}</Td><Td right><span className={clsx(m.after! < 0 && 'text-red-700')}>{eur(m.after!)}</span></Td></tr>)}</tbody>
                </table>
              </>
            )}
          </div>

          <Block title="Eingelöste Voucher" right={s.vouchers.length > 0 ? `${s.vouchers.length} · ${eur(sumOf(s.vouchers, (l) => l.price))}` : undefined}>
            {s.vouchers.length === 0 ? <None>Keine.</None> : (
              <table className="w-full text-left text-[11px]">
                <thead><tr className="border-b border-slate-400 text-slate-500"><Th>Code</Th><Th>Gast</Th><Th>Flug</Th><Th right>Wert</Th></tr></thead>
                <tbody>{s.vouchers.map((l, i) => <tr key={i} className="break-inside-avoid border-b border-slate-200"><Td><span className="font-mono">{l.code}</span></Td><Td>{l.who}</Td><Td>{l.flight ?? '–'}</Td><Td right>{eur(l.price)}</Td></tr>)}</tbody>
              </table>
            )}
          </Block>
        </Page>

        {split ? (
          <>
            <Page no={2} of={pages} number={r.number}>{membersTable}</Page>
            <Page no={3} of={pages} number={r.number}>{guestsTable}{signatures}</Page>
          </>
        ) : (
          <Page no={2} of={pages} number={r.number}>{membersTable}{guestsTable}{signatures}</Page>
        )}
      </div>
    </PrintFrame>
  )
}

function Page({ no, of, number, children }: { no: number; of: number; number: string; children: ReactNode }) {
  return (
    <div {...PRINT_PAGE} className="mx-auto flex w-full min-w-[540px] max-w-[600px] print:min-w-0 flex-col gap-5 rounded-sm border border-line bg-white p-8 text-[12px] leading-relaxed text-slate-900 shadow-md" style={{ minHeight: 849 }}>
      {children}
      <div className={clsx('flex justify-between border-t border-slate-200 pt-2 text-[10px] text-slate-400', no === of ? 'mt-4' : 'mt-auto')}><span>Tagesabschluss {number}</span><span>Seite {no} von {of}</span></div>
    </div>
  )
}

function MinusCols() { return <colgroup><col /><col className="w-28" /><col className="w-28" /></colgroup> }
function Block({ title, right, children }: { title: string; right?: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-1.5 flex items-baseline justify-between gap-3"><h3 className="text-[12px] font-semibold">{title}</h3>{right && <span className="text-[11px] text-slate-500">{right}</span>}</div>
      {children}
    </section>
  )
}
function Fact({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return <div className={wide ? 'col-span-2' : undefined}><dt className="text-[10px] uppercase tracking-wider text-slate-500">{label}</dt><dd className="font-medium">{children}</dd></div>
}
function Line({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'warn' }) {
  return <div className={clsx('flex items-baseline justify-between gap-3 py-0.5 text-[11px]', strong && 'font-semibold', tone === 'warn' && 'text-amber-800')}><span>{label}</span><span className="tabular-nums">{value}</span></div>
}
function Th({ children, right }: { children?: ReactNode; right?: boolean }) { return <th className={clsx('py-1 pr-2 font-medium last:pr-0', right && 'text-right')}>{children}</th> }
function Td({ children, right }: { children?: ReactNode; right?: boolean }) { return <td className={clsx('py-1 pr-2 last:pr-0', right && 'text-right tabular-nums whitespace-nowrap')}>{children}</td> }
function None({ children }: { children: ReactNode }) { return <div className="text-[11px] text-slate-500">{children}</div> }

/**
 * [Entwurf] Check of a closed day by the treasurer or the chairman: "Prüfen und festschreiben" locks it, "Zurück zur Korrektur" reverses the
 * bookings of the closing (Storno) and opens the day again for the manifest. Whoever closed the day does not check it.
 */
export function useDayReview() {
  const { ledger, setDays, can } = useApp()
  const check = useDayCheck()
  const actor = useActor()
  const stamp = () => ({ by: actor, at: TODAY_ISO, time: new Date().toTimeString().slice(0, 5) })
  return {
    mayCheck: (r: DayReport) => can('manifest.close.confirm') && r.by !== actor && checkStateOf(check.reviewOf(r.id)) === 'pruefung',
    ownClosing: (r: DayReport) => r.by === actor,
    confirm: (r: DayReport) => { check.confirm(r.id, stamp()); ledger.notify(`Tagesabschluss ${r.number} festgeschrieben`) },
    /** The checker corrects a member's amount: the difference goes to the Betriebskonto, the correction stands on the report. */
    correct: (r: DayReport, i: number, to: number, reason: string) => {
      const l = r.lines[i]
      if (!l?.memberId || to === l.price) return
      ledger.charge(l.memberId, to - l.price, `Korrektur Sprungtag ${dmy(r.date).slice(0, 6)}: ${reason}`)
      check.correct(r.id, { ...stamp(), who: l.who, memberId: l.memberId, from: l.price, to, reason })
      ledger.notify(`${l.who}: ${eur(l.price)} → ${eur(to)} korrigiert`)
    },
  }
}

/** Status of the check of a closing. */
export function DayCheckBadge({ report }: { report: DayReport }) {
  const s = checkStateOf(useDayCheck().reviewOf(report.id))
  return <Badge tone={DAY_CHECK[s].tone}>{DAY_CHECK[s].label}</Badge>
}

/** The report in a drawer, with the way back to the day and its Kassa booking, and the check for the treasurer or the chairman. */
export function DayReportDrawer({ report, onClose }: { report: DayReport; onClose: () => void }) {
  const { guarded } = useSession()
  const review = useDayReview()
  const [fixing, setFixing] = useState(false)
  const [line, setLine] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const members = report.lines.map((l, i) => ({ l, i })).filter((x) => !!x.l.memberId)
  const to = Number(amount.replace(',', '.'))
  const valid = line !== '' && amount.trim() !== '' && Number.isFinite(to) && to >= 0 && reason.trim().length >= 3
  const reset = () => { setFixing(false); setLine(''); setAmount(''); setReason('') }
  const mayCheck = review.mayCheck(report)
  return (
    <Drawer open title={`Tagesabschluss ${dmy(report.date)}`} size="xl" onClose={onClose}
      footer={
        <div className="space-y-3">
          {mayCheck && fixing && (
            <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
              <select aria-label="Mitglied" value={line} onChange={(e) => { setLine(e.target.value); const l = report.lines[Number(e.target.value)]; setAmount(l ? String(l.price) : '') }} className="min-h-11 rounded-lg border border-line bg-surface px-2.5 text-base">
                <option value="">Mitglied wählen</option>
                {members.map(({ l, i }) => <option key={i} value={i}>{l.who} · {eur(l.price)}</option>)}
              </select>
              <input aria-label="Richtiger Betrag" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Betrag €" className="min-h-11 rounded-lg border border-line bg-surface px-2.5 text-right text-base tabular-nums" />
              <input aria-label="Grund" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Grund" className="min-h-11 rounded-lg border border-line bg-surface px-2.5 text-base sm:col-span-2" />
              <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
                <Button size="lg" onClick={reset}>Abbrechen</Button>
                <Button size="lg" variant="primary" disabled={!valid} onClick={() => guarded('manifest.close.confirm', () => { review.correct(report, Number(line), to, reason.trim()); reset() })}>Korrektur buchen</Button>
              </div>
            </div>
          )}
          {!fixing && (
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <DayCheckBadge report={report} />
                <Link to={`/manifest/${report.dayId}`} className="inline-flex min-h-11 items-center text-sm text-brand hover:underline">Zum Sprungtag</Link>
                {report.cashLineId && <Link to={`/finanzen?tab=bank&konto=${CASH_ID}`} className="inline-flex min-h-11 items-center text-sm text-brand hover:underline">Kassabuchung in Finanzen</Link>}
              </div>
              <div className="flex flex-wrap gap-2">
                {mayCheck ? <>
                  {members.length > 0 && <Button size="lg" onClick={() => setFixing(true)}>Betrag korrigieren</Button>}
                  <Button size="lg" variant="primary" onClick={() => guarded('manifest.close.confirm', () => review.confirm(report))}>Prüfen und festschreiben</Button>
                </> : <Button size="lg" onClick={onClose}>Schließen</Button>}
              </div>
            </div>
          )}
        </div>
      }>
      <DayReportSheet report={report} />
    </Drawer>
  )
}

/** A button for a closed day: opens its Tagesabschluss-Beleg. Nothing is shown for a day without one. */
export function DayReportLink({ dayId }: { dayId: string }) {
  const { ledger } = useApp()
  const [open, setOpen] = useState(false)
  const report = ledger.dayReports.find((r) => r.dayId === dayId)
  if (!report) return null
  return (
    <>
      <Button onClick={() => setOpen(true)}><FileText size={14} /> Tagesabschluss</Button>
      {open && <DayReportDrawer report={report} onClose={() => setOpen(false)} />}
    </>
  )
}
