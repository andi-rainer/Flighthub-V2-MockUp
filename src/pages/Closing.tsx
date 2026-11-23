import clsx from 'clsx'
import { ArrowLeft, ArrowRight, Check, ChevronLeft, CircleCheck, Mail, Plane, Printer, Ticket, Users } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import MemberPicker from '../MemberPicker'
import { CASH_ID, eur, members, type Jumper } from '../data'
import { useSession } from '../session/session'
import { flightNo, useApp, type Load } from '../state'
import { Button, Card } from '../ui'
import { CashCountDialog } from './finance/CashCount'
import { DayCheckBadge, DayReportDrawer } from './finance/DayReport'
import { daySummary, HOW_WORDS, jumpsLabel, type DayHow, type DayReport, type DayReportLine } from './finance/cashDocs'
import { dmy, fullName, weekday, type ManifestDay } from './manifest/data'
import { useDayCheck } from './manifest/dayCheck'
import { GuestPayDrawer } from './manifest/GuestPayment'
import { guestPay, type GuestPay } from './manifest/payState'
import { payTarget } from './tickets/payments'
import { useActor } from './tickets/parts'
import QuickTicket from './tickets/QuickTicket'

/**
 * Closing an operation day, done by the person at the manifest (a member, usually on a tablet). [Entwurf] A short guided flow:
 *   1. Prüfen: every flight is down and has a pilot, everybody who did not fly is cleared ("Nicht geflogen").
 *   2. Bezahlung: who pays how. Members default to "vom Konto", guests follow their ticket or voucher; only exceptions need a tap.
 *   3. Übersicht: what will happen, in plain words; members who end up in minus are named. One button closes the day.
 *   4. Fertig: the Tagesabschluss (print, PDF). [Entwurf] The day is then "Abgeschlossen, Prüfung offen" until the treasurer or the chairman
 *      checks and locks it (see `manifest/dayCheck.ts`); members in minus after the day get a message ("Konto im Minus").
 * [Entwurf] A tandem guest without a ticket gets one on the spot ("Ticket anlegen") and pays it in cash: buy a ticket, then jump.
 * Booking rules (from the club): every flown jump of a member is charged to the Betriebskonto; cash is optional and may be more than the
 * price (prepayment); a guest with voucher, ticket or online payment brings no money today; a guest who pays cash goes into the Kassa; an
 * open transfer stays open. All cash of the day is ONE Kassa booking ("Tageskasse"), its receipt is the Tagesabschluss-Beleg.
 */

type Step = 'pruefen' | 'bezahlung' | 'uebersicht'
const STEPS: { id: Step | 'fertig'; label: string }[] = [
  { id: 'pruefen', label: 'Flüge prüfen' },
  { id: 'bezahlung', label: 'Bezahlung' },
  { id: 'uebersicht', label: 'Übersicht' },
  { id: 'fertig', label: 'Fertig' },
]
type MemberPay = 'konto' | 'bar'
type GuestChoice = 'bar' | 'offen'

const parseEur = (s: string) => { const n = Number(s.replace(/\s|€/g, '').replace(',', '.')); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0 }
const now = () => new Date().toTimeString().slice(0, 5)

export default function Closing({ day, flights, jumped, notFlown, onBack, onDiscard, onBooked }: { day: ManifestDay; /** Flights flown that day. */ flights: number; jumped: Jumper[]; notFlown: Jumper[]; onBack: () => void; onDiscard: (id: string) => void; onBooked: () => void }) {
  const { ledger, bookings, vouchers, tickets, loads, setLoads, memberCan } = useApp()
  const { guarded } = useSession()
  const actor = useActor()
  const [step, setStep] = useState<Step>('pruefen')
  const [memberPay, setMemberPay] = useState<Record<string, MemberPay>>({})
  const [cashText, setCashText] = useState<Record<string, string>>({})
  const [guestChoice, setGuestChoice] = useState<Record<string, GuestChoice>>({})
  const [done, setDone] = useState<DayReport | null>(null)
  const [dialog, setDialog] = useState<null | 'beleg' | 'zaehlen'>(null)
  const [payFor, setPayFor] = useState<string | null>(null)
  const [ticketFor, setTicketFor] = useState<string | null>(null)
  const [sent, setSent] = useState(0)
  const dayCheck = useDayCheck()

  // ---------- Flights of the day ----------
  const dayLoads = loads.filter((l) => l.dayId === day.id).sort((a, b) => a.time.localeCompare(b.time) || a.id - b.id)
  const landed = dayLoads.filter((l) => l.status === 'gelandet')
  const notLanded = dayLoads.filter((l) => l.status !== 'gelandet')
  const noPilot = landed.filter((l) => !l.pilotId)
  // People on a flight that is not down are cleared with their flight (Gelandet, Flug streichen), not one by one.
  const onOpenFlight = new Set(notLanded.flatMap((l) => l.jumpers.map((j) => j.id)))
  const waiting = notFlown.filter((j) => !onOpenFlight.has(j.id))
  const openIssues = notLanded.length + noPilot.length + waiting.length
  const patchLoad = (id: number, p: Partial<Load>) => setLoads((ls) => ls.map((l) => (l.id === id ? { ...l, ...p } : l)))
  const dropLoad = (id: number) => setLoads((ls) => ls.filter((l) => l.id !== id))
  const flightsOf = (id: string) => { const n = landed.filter((l) => l.jumpers.some((x) => x.id === id)).map((l) => flightNo(loads, l)); return n.length ? `Flug ${n.join(', ')}` : undefined }

  // ---------- Who pays how ----------
  const isGuest = (j: Jumper) => j.kind === 'tandem'
  const bookingOf = (j: Jumper) => (isGuest(j) ? bookings.find((x) => x.id === j.bookingId) : undefined)
  const guestOf = (j: Jumper): GuestPay | undefined => { const b = bookingOf(j); return b ? guestPay(b, vouchers, tickets) : undefined }
  const guestState = (j: Jumper) => guestOf(j)?.state ?? (j.note ? 'bezahlt' : 'vor_ort')
  const nameOf = (j: Jumper) => { const b = bookingOf(j); return b ? fullName(b) : j.name.replace(/^Tandem: /, '') }
  const payOf = (j: Jumper): MemberPay => memberPay[j.id] ?? 'konto'
  const cashOf = (j: Jumper) => (cashText[j.id] === undefined ? j.price : parseEur(cashText[j.id]))
  const choiceOf = (j: Jumper): GuestChoice => guestChoice[j.id] ?? (guestState(j) === 'vor_ort' ? 'bar' : 'offen')
  /** A guest who pays on site but has no ticket yet. */
  const noTicket = (j: Jumper) => isGuest(j) && !!bookingOf(j) && !guestOf(j)?.item && guestState(j) === 'vor_ort'
  /** A guest pays the price of the ticket or voucher, a member the price of the day. */
  const priceOf = (j: Jumper) => guestOf(j)?.item?.price ?? j.price

  const howOf = (j: Jumper): DayHow => {
    if (!isGuest(j)) return payOf(j) === 'bar' && cashOf(j) > 0 ? 'bar' : 'konto'
    if (guestState(j) === 'bezahlt') { const g = guestOf(j); return g?.what === 'Gutschein' ? 'voucher' : g?.what === 'Ticket' ? 'ticket' : 'online' }
    return choiceOf(j) === 'bar' ? 'gast' : 'offen'
  }
  const lines: DayReportLine[] = jumped.map((j) => {
    const how = howOf(j), g = guestOf(j)
    return {
      who: isGuest(j) ? nameOf(j) : j.name, memberId: j.memberId,
      what: isGuest(j) ? 'Tandem' : jumpsLabel(j.jumps ?? 1, j.paidSeats ?? 0) || 'Sprung',
      price: priceOf(j), how, cash: how === 'bar' ? cashOf(j) : how === 'gast' ? priceOf(j) : 0,
      code: g?.code, ownLine: how === 'gast' && !!g?.item,
      before: j.memberId ? ledger.balances[j.memberId] ?? members.find((m) => m.id === j.memberId)?.balance : undefined,
      jumps: j.jumps, paidSeats: j.paidSeats, flight: flightsOf(j.id),
    }
  })
  const sum = daySummary({ lines, cashBefore: ledger.cash })
  const jumpCount = jumped.filter((j) => !j.noShow).reduce((n, j) => n + (isGuest(j) ? 1 : j.jumps ?? 1), 0)
  const sportRows = jumped.filter((j) => !isGuest(j))
  const guestRows = jumped.filter(isGuest)
  const afterMinus = sum.members.filter((m) => m.after !== undefined && m.after < 0)
  const withoutTicket = guestRows.filter(noTicket).length

  const finish = () => guarded('manifest.payments.update', () => {
    const cashBefore = ledger.cash
    // A guest with a ticket or voucher who paid cash: the Kassa line belongs to the ticket, which becomes paid.
    jumped.forEach((j, i) => { const g = guestOf(j); if (lines[i].how === 'gast' && g?.item && g.what && g.code) ledger.bookCash(payTarget(g.what, g.code, g.item.buyer), priceOf(j), day.date, actor) })
    const report = ledger.closeDay({ dayId: day.id, date: day.date, aircraft: day.aircraft, flights, jumps: jumpCount, lines, by: actor, time: now(), cashBefore })
    // [Entwurf] Charged today and in minus afterwards: mail "Konto im Minus" and the notice in the app.
    const minus = daySummary(report).members.filter((m) => m.after !== undefined && m.before !== undefined && m.after < 0 && m.after < m.before)
    dayCheck.sendMinus(minus.map((m) => ({ memberId: m.line.memberId!, balance: m.after!, dayDate: day.date, reportId: report.id })))
    setSent(minus.length)
    setDone(report)
    onBooked()
  })

  const title = `${weekday(day.date)} ${dmy(day.date)} · ${day.aircraft}`
  const current = done ? 'fertig' : step
  const go = (s: Step) => { setStep(s); document.querySelector('main')?.scrollTo({ top: 0 }) }

  return (
    <div className="mx-auto max-w-3xl">
      <button onClick={onBack} className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-ink"><ChevronLeft size={16} /> Zurück zum Tag</button>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">{done ? 'Tag abgeschlossen' : 'Tag abschließen'}</h1>
        <p className="mt-1 text-sm text-muted">{title}</p>
      </div>
      <Stepper current={current} />

      {!done && step === 'pruefen' && (
        <div className="space-y-6">
          <Group title="Flüge" count={`${landed.length} gelandet`}>
            {dayLoads.map((l) => {
              const no = flightNo(loads, l), people = l.jumpers.filter((j) => !j.noShow).length
              const pilot = members.find((m) => m.id === l.pilotId)?.name
              if (l.status === 'gelandet' && l.pilotId) return (
                <Item key={l.id} icon={<Done />} title={`Flug ${no} · ${l.time}`} sub={`${pilot} · ${people} ${people === 1 ? 'Person' : 'Personen'}`} />
              )
              if (l.status === 'gelandet') return (
                <Item key={l.id} tone="warn" icon={<Plane size={18} />} title={`Flug ${no} · ${l.time}`} sub="Pilot fehlt">
                  <MemberPicker ariaLabel={`Pilot von Flug ${no}`} className="w-full @2xl:w-64" value="" placeholder="Pilot wählen" onChange={(id) => id && patchLoad(l.id, { pilotId: id })} allow={(m) => memberCan(m.id, 'manifest.flights.pilot')} />
                </Item>
              )
              return (
                <Item key={l.id} tone="warn" icon={<Plane size={18} />} title={`Flug ${no} · ${l.time}`} sub={`${l.status === 'in_air' ? 'In der Luft' : l.status === 'boarding' ? 'Boarding' : 'Nicht geflogen'} · ${people === 0 ? 'leer' : `${people} ${people === 1 ? 'Person' : 'Personen'}`}`}>
                  {l.status === 'in_air'
                    ? <Big onClick={() => patchLoad(l.id, { status: 'gelandet' })}>Gelandet</Big>
                    : <Big onClick={() => dropLoad(l.id)}>Flug streichen</Big>}
                </Item>
              )
            })}
            {dayLoads.length === 0 && <Empty>Kein Flug an diesem Tag.</Empty>}
          </Group>

          {waiting.length > 0 && (
            <Group title="Nicht geflogen" count={`${waiting.length}`}>
              {waiting.map((j) => (
                <Item key={j.id} tone="warn" icon={<Users size={18} />} title={isGuest(j) ? nameOf(j) : j.name} sub={isGuest(j) ? `Tandem${guestOf(j)?.code ? ` · ${guestOf(j)?.code}` : ''}` : 'Sportspringer'}>
                  <Big onClick={() => onDiscard(j.id)}>Nicht geflogen</Big>
                </Item>
              ))}
            </Group>
          )}

          <Footer>
            <span className={clsx('text-sm font-medium', openIssues > 0 ? 'text-warn' : 'text-ok')}>{openIssues > 0 ? `Noch ${openIssues} offen` : 'Alles geklärt'}</span>
            <Big variant="primary" disabled={openIssues > 0} onClick={() => go('bezahlung')}>Weiter <ArrowRight size={18} /></Big>
          </Footer>
        </div>
      )}

      {!done && step === 'bezahlung' && (
        <div className="space-y-6">
          {sportRows.length > 0 && (
            <Group title="Mitglieder" count={eur(sum.memberTotal)}>
              {sportRows.map((j) => {
                const l = lines[jumped.indexOf(j)], m = sum.members.find((x) => x.line === l)
                return (
                  <Item key={j.id} title={j.name} amount={eur(j.price)} sub={[l.what, l.flight].filter(Boolean).join(' · ')}
                    foot={m?.after !== undefined && <span className="whitespace-nowrap text-sm text-muted">Konto {eur(m.before!)} → <Money n={m.after} /></span>}>
                    <div className="flex w-full flex-wrap items-center gap-2 @2xl:flex-nowrap">
                      <Choice<MemberPay> label={`Bezahlung ${j.name}`} value={payOf(j)} onChange={(v) => setMemberPay((p) => ({ ...p, [j.id]: v }))} options={[{ value: 'konto', label: 'vom Konto' }, { value: 'bar', label: 'bar' }]} />
                      {payOf(j) === 'bar' && (
                        <label className="flex h-12 min-w-[7rem] flex-1 items-center gap-1 rounded-xl border border-line bg-surface px-3 focus-within:border-brand @2xl:flex-none">
                          <span className="sr-only">Bar erhalten von {j.name}</span>
                          <input inputMode="decimal" value={cashText[j.id] ?? String(j.price).replace('.', ',')} onChange={(e) => setCashText((c) => ({ ...c, [j.id]: e.target.value }))} onFocus={(e) => e.target.select()}
                            className="h-full w-full min-w-0 bg-transparent text-right @2xl:w-20 text-base tabular-nums outline-none" />
                          <span className="text-muted">€</span>
                        </label>
                      )}
                    </div>
                  </Item>
                )
              })}
            </Group>
          )}

          {guestRows.length > 0 && (
            <Group title="Tandem-Gäste" count={eur(sum.guestTotal)}>
              {guestRows.map((j) => {
                const state = guestState(j), g = guestOf(j), b = bookingOf(j), how = howOf(j)
                if (noTicket(j) && b) return (
                  <Item key={j.id} tone="warn" icon={<Ticket size={18} />} title={nameOf(j)} amount={eur(j.price)} sub={['Kein Ticket', flightsOf(j.id)].filter(Boolean).join(' · ')}>
                    <Big variant="primary" onClick={() => setTicketFor(b.id)}>Ticket anlegen</Big>
                  </Item>
                )
                return (
                  <Item key={j.id} title={nameOf(j)} amount={eur(priceOf(j))} sub={[g?.code, flightsOf(j.id)].filter(Boolean).join(' · ') || 'Tandem'}
                    foot={(state === 'offen' || state === 'nachweis') && g?.item && b ? <button onClick={() => setPayFor(b.id)} className="min-h-11 text-sm font-medium text-brand">Überweisung ist da? Zahlung klären</button> : undefined}>
                    {state === 'bezahlt'
                      ? <span className="inline-flex h-12 items-center gap-2 rounded-xl bg-ok-soft px-4 text-sm font-medium text-ok"><Check size={16} /> {HOW_WORDS[how]}</span>
                      : <Choice<GuestChoice> label={`Bezahlung ${nameOf(j)}`} value={choiceOf(j)} onChange={(v) => setGuestChoice((p) => ({ ...p, [j.id]: v }))} options={[{ value: 'bar', label: 'bar' }, { value: 'offen', label: 'Überweisung offen' }]} />}
                  </Item>
                )
              })}
            </Group>
          )}

          {jumped.length === 0 && <Empty>Niemand ist geflogen. Es gibt nichts zu bezahlen.</Empty>}

          <Footer>
            <Big onClick={() => go('pruefen')}><ArrowLeft size={18} /> Zurück</Big>
            {withoutTicket > 0
              ? <span className="text-sm font-medium text-warn">Noch {withoutTicket} ohne Ticket</span>
              : <span className="hidden text-sm text-muted @md:inline">Bar heute <b className="text-base tabular-nums text-ink">{eur(sum.cash)}</b></span>}
            <Big variant="primary" disabled={withoutTicket > 0} onClick={() => go('uebersicht')}>Weiter <ArrowRight size={18} /></Big>
          </Footer>
        </div>
      )}

      {!done && step === 'uebersicht' && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="p-5">
              <div className="text-sm text-muted">Bargeld heute</div>
              <div className="mt-1 text-3xl font-semibold tabular-nums">{eur(sum.cash)}</div>
              <div className="mt-2 space-y-0.5 text-sm text-muted">
                <div className="flex justify-between gap-3"><span>Mitglieder</span><span className="tabular-nums">{eur(sum.memberCash)}</span></div>
                <div className="flex justify-between gap-3"><span>Tandem-Gäste</span><span className="tabular-nums">{eur(sum.guestCash)}</span></div>
              </div>
            </Card>
            <Card className="p-5">
              <div className="text-sm text-muted">Kassa</div>
              <div className="mt-1 text-3xl font-semibold tabular-nums">{eur(sum.cashAfter ?? ledger.cash)}</div>
              <div className="mt-2 text-sm text-muted">vorher {eur(ledger.cash)}</div>
            </Card>
          </div>

          {afterMinus.length > 0 && (
            <div className="rounded-xl border border-line bg-slate-50 px-5 py-4">
              <div className="font-medium">{afterMinus.length === 1 ? '1 Mitglied ist' : `${afterMinus.length} Mitglieder sind`} danach im Minus</div>
              <ul className="mt-2 space-y-1 text-sm">
                {afterMinus.map((m) => (
                  <li key={m.line.memberId} className="flex flex-wrap justify-between gap-x-3">
                    <span>{m.line.who}{m.before! < 0 && <span className="text-muted"> · schon vorher im Minus</span>}</span>
                    <span className="tabular-nums"><span className="text-muted">{eur(m.before!)} →</span> <Money n={m.after!} /></span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {sum.members.length > 0 && (
            <Group title="Mitglieder" count={eur(sum.memberTotal)}>
              {sum.members.map(({ line: l }) => (
                <Sentence key={l.memberId} amount={eur(l.price)}>
                  <b className="font-medium">{l.who}</b> zahlt {l.what} {l.how === 'bar' ? <><Tag tone="ok">bar</Tag>{l.cash > l.price && <span className="text-muted"> · {eur(l.cash - l.price)} mehr aufs Konto</span>}</> : 'vom Konto'}
                </Sentence>
              ))}
            </Group>
          )}
          {sum.guests.length > 0 && (
            <Group title="Tandem-Gäste" count={eur(sum.guestTotal)}>
              {sum.guests.map((l, i) => (
                <Sentence key={i} amount={eur(l.price)}>
                  <b className="font-medium">{l.who}</b>{' '}
                  {l.how === 'voucher' ? <>löst Voucher <span className="font-mono">{l.code}</span> ein</>
                    : l.how === 'gast' ? <>zahlt {l.code && <>Ticket <span className="font-mono">{l.code}</span> </>}<Tag tone="ok">bar</Tag></>
                    : l.how === 'offen' ? <><Tag tone="warn">Überweisung offen</Tag></>
                    : <>hat {HOW_WORDS[l.how]}</>}
                </Sentence>
              ))}
            </Group>
          )}

          <Footer>
            <Big onClick={() => go('bezahlung')}><ArrowLeft size={18} /> Zurück</Big>
            <Big variant="primary" className="flex-1 @md:flex-none @md:px-10" onClick={finish}>Tag abschließen</Big>
          </Footer>
        </div>
      )}

      {done && (
        <div className="space-y-6">
          <Card className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <CircleCheck size={56} className="text-ok" strokeWidth={1.5} />
            <div className="text-xl font-semibold">Erledigt</div>
            <div className="text-sm text-muted">{done.number} · {done.time ?? ''} · {done.by}</div>
            <div className="mt-1"><DayCheckBadge report={done} /></div>
            <div className="mt-4 text-sm text-muted">Bar in die Kassa</div>
            <div className="text-3xl font-semibold tabular-nums">{eur(daySummary(done).cash)}</div>
            {sent > 0 && <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm"><Mail size={16} className="text-muted" /> Nachricht an {sent === 1 ? '1 Mitglied' : `${sent} Mitglieder`} gesendet</div>}
          </Card>
          <div className="grid gap-3 sm:grid-cols-2">
            <Big variant="primary" className="w-full" onClick={() => setDialog('beleg')}><Printer size={18} /> Tagesabschluss ansehen / drucken</Big>
            <Big className="w-full" onClick={() => setDialog('zaehlen')}>Kassa zählen</Big>
          </div>
          <Big variant="ghost" className="w-full" onClick={onBack}>Zurück zum Tag</Big>
        </div>
      )}

      {dialog === 'beleg' && done && <DayReportDrawer report={done} onClose={() => setDialog(null)} />}
      {dialog === 'zaehlen' && <CashCountDialog accountId={CASH_ID} onClose={() => setDialog(null)} />}
      {ticketFor && bookings.find((x) => x.id === ticketFor) && <QuickTicket booking={bookings.find((x) => x.id === ticketFor)!} onClose={() => setTicketFor(null)} />}
      {payFor && bookings.find((x) => x.id === payFor) && <GuestPayDrawer booking={bookings.find((x) => x.id === payFor)!} onClose={() => setPayFor(null)} />}
    </div>
  )
}

// ---------- Building blocks, sized for a finger on a tablet ----------

function Stepper({ current }: { current: string }) {
  const at = STEPS.findIndex((s) => s.id === current)
  return (
    <div className="@container mb-6">
    <ol className="grid grid-cols-4 gap-2" aria-label="Schritte">
      {STEPS.map((s, i) => (
        <li key={s.id} aria-current={i === at ? 'step' : undefined} className="min-w-0">
          <div className={clsx('h-1.5 rounded-full', i <= at ? 'bg-brand' : 'bg-slate-200')} />
          <div className={clsx('mt-2 hidden items-center gap-1.5 text-sm @xl:flex', i === at ? 'font-semibold text-ink' : i < at ? 'text-ink' : 'text-muted')}>
            <span className={clsx('grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs', i < at ? 'bg-brand text-white' : i === at ? 'bg-brand-soft text-brand' : 'bg-slate-100 text-muted')}>{i < at ? <Check size={13} /> : i + 1}</span>
            <span className="hidden truncate @xl:inline">{s.label}</span>
          </div>
        </li>
      ))}
    </ol>
    <div className="mt-2 text-sm @xl:hidden"><span className="text-muted">Schritt {at + 1} von {STEPS.length} · </span><b className="font-semibold">{STEPS[at].label}</b></div>
    </div>
  )
}

function Group({ title, count, children }: { title: string; count?: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
        {count && <span className="text-sm tabular-nums text-muted">{count}</span>}
      </div>
      <Card className="divide-y divide-line overflow-visible">{children}</Card>
    </section>
  )
}

/** One person or flight: name and detail on the left, the one action on the right; below each other when narrow. */
function Item({ title, sub, amount, icon, tone, foot, children }: { title: string; sub?: string; amount?: string; icon?: ReactNode; tone?: 'warn'; foot?: ReactNode; children?: ReactNode }) {
  return (
    <div className={clsx('@container', tone === 'warn' && 'bg-warn-soft/40')}>
      <div className="flex flex-col gap-3 px-4 py-4 @2xl:flex-row @2xl:items-center @2xl:gap-4 @2xl:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {icon && <span className={clsx('grid h-10 w-10 shrink-0 place-items-center rounded-full', tone === 'warn' ? 'bg-warn-soft text-warn' : 'bg-ok-soft text-ok')}>{icon}</span>}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-base font-medium">{title}</span>
              {amount && <span className="shrink-0 text-base font-semibold tabular-nums @2xl:hidden">{amount}</span>}
            </div>
            {sub && <div className="truncate text-sm text-muted">{sub}</div>}
            {foot && <div className="mt-0.5">{foot}</div>}
          </div>
          {amount && <span className="hidden w-24 shrink-0 text-right text-base font-semibold tabular-nums @2xl:block">{amount}</span>}
        </div>
        {children && <div className={clsx('flex w-full shrink-0 [&>button]:w-full @2xl:[&>button]:w-auto', amount ? '@2xl:w-[22rem]' : '@2xl:w-auto @2xl:justify-end')}>{children}</div>}
      </div>
    </div>
  )
}

function Sentence({ amount, children }: { amount: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3.5 sm:px-5">
      <span className="min-w-0 text-base leading-relaxed">{children}</span>
      <span className="shrink-0 text-base tabular-nums">{amount}</span>
    </div>
  )
}

function Choice<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid min-w-[13rem] flex-[2] auto-cols-fr grid-flow-col gap-1 rounded-xl bg-slate-100 p-1 @2xl:flex-none">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button key={o.value} role="radio" aria-checked={on} onClick={() => onChange(o.value)}
            className={clsx('h-10 whitespace-nowrap rounded-lg px-4 text-sm font-medium transition', on ? 'bg-surface text-brand shadow-sm ring-2 ring-brand' : 'text-muted hover:text-ink')}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function Big({ children, onClick, variant = 'secondary', disabled, className }: { children: ReactNode; onClick: () => void; variant?: 'primary' | 'secondary' | 'ghost'; disabled?: boolean; className?: string }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={clsx('inline-flex h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-5 text-base font-medium transition active:scale-[0.98] disabled:opacity-40',
        variant === 'primary' && 'bg-brand text-white hover:bg-blue-700',
        variant === 'secondary' && 'border border-line bg-surface hover:bg-slate-50',
        variant === 'ghost' && 'text-muted hover:bg-slate-100 hover:text-ink',
        className)}>
      {children}
    </button>
  )
}

/** The action bar of a step: stays at the bottom of the screen while the list scrolls. */
function Footer({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
      <div className="@container"><div className="flex items-center justify-between gap-3">{children}</div></div>
    </div>
  )
}

function Done() { return <Check size={18} /> }
function Empty({ children }: { children: ReactNode }) { return <div className="px-5 py-6 text-sm text-muted">{children}</div> }
function Money({ n }: { n: number }) { return <b className={clsx('whitespace-nowrap font-semibold tabular-nums', n < 0 ? 'text-bad' : 'text-ink')}>{eur(n)}</b> }
function Tag({ tone, children }: { tone: 'ok' | 'warn'; children: ReactNode }) {
  return <span className={clsx('inline-flex items-center rounded-md px-1.5 py-0.5 text-sm font-medium', tone === 'ok' ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn')}>{children}</span>
}
