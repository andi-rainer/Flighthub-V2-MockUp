
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { CASH_ID, eur, members, type Jumper, type Pay } from '../data'
import { useSession } from '../session/session'
import { useApp } from '../state'
import { Badge, Button, Card, PageHeader, Segmented } from '../ui'
import { CashCountDialog } from './finance/CashCount'
import { DayReportDrawer } from './finance/DayReport'
import { type DayHow, type DayReport, type DayReportLine } from './finance/cashDocs'
import { dmy, weekday, type ManifestDay } from './manifest/data'
import { guestPay, type GuestPay } from './manifest/payState'
import { payTarget } from './tickets/payments'
import { useActor } from './tickets/parts'

/**
 * Closing an operation day.
 * Rules (from the club):
 *  1. Every flown ticket of a member is ALWAYS charged to the member's Betriebskonto (transparency).
 *  2. A payment is optional and never forced at the end of the day:
 *       "Nur belasten"  -> only the charge. The member pays later (transfer or cash) or from credit.
 *       "Bar erhalten"  -> cash deposit booked now; the amount may be higher than the price (prepayment).
 *     A bank transfer is simply a deposit that is booked in Finanzen > Buchungen once it arrived.
 *  3. Nothing is booked automatically. The user sees every posting and where it lands, and confirms.
 *  4. Members get their Kontoauszug at month end, after the treasurer approved it (Finanzen > Betriebskonten).
 *  5. [Entwurf] A tandem guest has no Betriebskonto: voucher, online and paid tickets are revenue without money today; a guest who pays
 *     cash is booked in the Kassa (ticket or voucher marked as paid); a transfer that is still open stays open.
 *  6. [Entwurf] All cash of the day is ONE Kassa booking ("Tageskasse"), its document is the Tagesabschluss-Beleg.
 */

type Kind = 'Belastung' | 'Einzahlung' | 'Tandem bar' | 'Ertrag' | 'Offen'
interface Posting { kind: Kind; text: string; amount: number; to: string }

/** What a line of a sport jumper covers when it is more than one plain jump: several jumps, paid empty seats. */
const detail = (j: Jumper) => [(j.jumps ?? 1) > 1 ? `${j.jumps} Sprünge` : '', (j.paidSeats ?? 0) > 0 ? `${j.paidSeats === 1 ? 'ein Platz' : `${j.paidSeats} Plätze`} bezahlt, nicht gesprungen` : ''].filter(Boolean).join(', ')
const balanceOf = (name: string) => members.find((m) => m.name === name)?.balance
const kindTone = { Belastung: 'bad', Einzahlung: 'ok', 'Tandem bar': 'ok', Ertrag: 'info', Offen: 'warn' } as const

export default function Closing({ day, flights, jumped, notFlown, onBack, onDiscard, onBooked }: { day: ManifestDay; /** Flights flown that day. */ flights: number; jumped: Jumper[]; notFlown: Jumper[]; onBack: () => void; onDiscard: (id: string) => void; onBooked: () => void }) {
  const { ledger, bookings, vouchers, tickets } = useApp()
  const { guarded } = useSession()
  const actor = useActor()
  const [pay, setPay] = useState<Record<string, Pay>>({})
  const [cash, setCash] = useState<Record<string, number>>({})
  const [done, setDone] = useState<DayReport | null>(null)
  const [dialog, setDialog] = useState<null | 'beleg' | 'zaehlen'>(null)

  const guestOf = (j: Jumper): GuestPay | undefined => { const b = j.kind === 'tandem' ? bookings.find((x) => x.id === j.bookingId) : undefined; return b ? guestPay(b, vouchers, tickets) : undefined }
  /** A tandem guest has no Betriebskonto: the payment state of the ticket or voucher decides. */
  const isGuest = (j: Jumper) => j.kind === 'tandem'
  const guestState = (j: Jumper) => guestOf(j)?.state ?? (j.note ? 'bezahlt' : 'vor_ort')
  const payOf = (j: Jumper): Pay => pay[j.id] ?? (isGuest(j) ? 'bar' : 'konto')
  const cashOf = (j: Jumper) => (isGuest(j) ? j.price : cash[j.id] ?? j.price)
  const sparte = (j: Jumper) => (j.kind === 'tandem' ? 'Tandem' : 'Sportspringen')
  const guestName = (j: Jumper) => j.name.replace(/^Tandem: /, '')

  /** How a flown line is settled; guests: by their ticket or voucher. */
  const howOf = (j: Jumper): DayHow => {
    if (!isGuest(j)) return payOf(j) === 'bar' && cashOf(j) > 0 ? 'bar' : 'konto'
    const g = guestOf(j)
    switch (guestState(j)) {
      case 'bezahlt': return g?.what === 'Gutschein' ? 'voucher' : g?.what === 'Ticket' ? 'ticket' : 'online'
      case 'vor_ort': return payOf(j) === 'bar' ? 'gast' : 'offen'
      default: return 'offen'
    }
  }
  const lines: DayReportLine[] = jumped.map((j) => {
    const how = howOf(j), g = guestOf(j)
    return {
      who: isGuest(j) ? guestName(j) : j.name, memberId: j.memberId, what: isGuest(j) ? 'Tandem' : detail(j) || 'Sprung', price: j.price, how,
      cash: how === 'bar' || how === 'gast' ? cashOf(j) : 0, code: g?.code, ownLine: how === 'gast' && !!g?.item,
    }
  })

  const postings: Posting[] = jumped.flatMap((j, i): Posting[] => {
    const l = lines[i]
    if (isGuest(j)) {
      const who = guestName(j)
      if (l.how === 'gast') return [{ kind: 'Tandem bar', text: l.ownLine ? `${who} zahlt bar: ${guestOf(j)?.what} ${l.code} wird als bezahlt markiert, Ertrag Tandem` : `${who} zahlt bar vor Ort, Ertrag Tandem`, amount: l.cash, to: l.ownLine ? `Kassa, eigene Buchung` : 'Kassa, Tageskasse' }]
      if (l.how === 'offen') return [{ kind: 'Offen', text: `${who}: ${guestState(j) === 'vor_ort' ? 'Zahlung vor Ort bleibt offen' : guestState(j) === 'nachweis' ? 'Überweisungsbestätigung geprüft, Eingang in Finanzen fehlt' : 'Überweisung noch offen'}${l.code ? ` (${l.code})` : ''}`, amount: j.price, to: 'noch kein Geld' }]
      return [{ kind: 'Ertrag', text: `${who}: ${l.how === 'voucher' ? `Voucher ${l.code ?? ''} eingelöst` : l.how === 'ticket' ? `Ticket ${l.code ?? ''} bezahlt` : 'online bezahlt'}, Ertrag Tandem`, amount: j.price, to: 'Ertrag Tandem' }]
    }
    const out: Posting[] = [{ kind: 'Belastung', text: `${j.name}${detail(j) ? ` (${detail(j)})` : ''}, Ertrag ${sparte(j)}`, amount: -j.price, to: `Betriebskonto ${j.name}` }]
    if (l.how === 'bar') {
      const extra = l.cash - j.price
      out.push({ kind: 'Einzahlung', text: `${j.name} zahlt bar${extra > 0 ? ` (davon ${eur(extra)} Vorauszahlung)` : ''}`, amount: l.cash, to: `Kassa, Tageskasse · Betriebskonto ${j.name}` })
    }
    return out
  })
  const sum = (f: (p: Posting) => boolean) => postings.filter(f).reduce((n, p) => n + Math.abs(p.amount), 0)
  const charged = sum((p) => p.kind === 'Belastung')
  const cashIn = sum((p) => p.kind === 'Einzahlung' || p.kind === 'Tandem bar')
  const prepaid = sum((p) => p.kind === 'Ertrag')
  const open = sum((p) => p.kind === 'Offen')

  const finish = () => guarded('manifest.payments.update', () => {
    // A guest with a ticket or voucher who paid cash: the Kassa line belongs to the ticket, which becomes paid.
    jumped.forEach((j, i) => { const g = guestOf(j); if (lines[i].how === 'gast' && g?.item && g.what && g.code) ledger.bookCash(payTarget(g.what, g.code, g.item.buyer), j.price, day.date, actor) })
    const landed = jumped.filter((j) => !j.noShow)
    const report = ledger.closeDay({ dayId: day.id, date: day.date, aircraft: day.aircraft, flights, jumps: landed.length, lines, by: actor })
    setDone(report)
    onBooked()
  })

  if (done) {
    const total = lines.reduce((n, l) => n + l.cash, 0)
    return (
      <>
        <PageHeader title="Tag abgeschlossen" subtitle={`Sprungtag ${weekday(day.date)} ${dmy(day.date)}`} />
        <div className="max-w-2xl space-y-4">
          <Card className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><div className="text-sm text-muted">Bar in die Kassa gebucht</div><div className="text-2xl font-semibold tabular-nums">{eur(total)}</div></div>
              <div className="text-right text-sm text-muted">Kassa jetzt<div className="text-lg font-semibold tabular-nums text-ink">{eur(ledger.cash)}</div></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => setDialog('beleg')}>Tagesabschluss-Beleg ansehen</Button>
              <Button onClick={() => setDialog('zaehlen')}>Kassa zählen</Button>
              <Link to={`/finanzen?tab=bank&konto=${CASH_ID}`}><Button>Kassa in Finanzen</Button></Link>
            </div>
          </Card>
          <PostingList postings={postings} />
          <Button onClick={onBack}>Zurück zum Manifest</Button>
        </div>
        {dialog === 'beleg' && <DayReportDrawer report={done} onClose={() => setDialog(null)} />}
        {dialog === 'zaehlen' && <CashCountDialog accountId={CASH_ID} onClose={() => setDialog(null)} />}
      </>
    )
  }

  const step = (n: number) => (notFlown.length > 0 ? n : n - 1)

  return (
    <>
      <PageHeader title="Tag abschließen" subtitle={`Sprungtag ${weekday(day.date)} ${dmy(day.date)}`} actions={<Button onClick={onBack}>Zurück</Button>} />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {notFlown.length > 0 && (
            <Card className="p-4">
              <h2 className="mb-2 font-semibold">{step(1)} · Nicht geflogen ({notFlown.length})</h2>
              <div className="space-y-2">
                {notFlown.map((j) => (
                  <div key={j.id} className="flex min-h-12 items-center justify-between rounded-lg bg-warn-soft px-3 text-sm">
                    <span>{j.name}{j.kind === 'tandem' ? ' · Voucher bleibt gültig' : ''}</span>
                    <Button onClick={() => onDiscard(j.id)}>Kein Sprung</Button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-4">
            <h2 className="mb-1 font-semibold">{step(2)} · Geflogen ({jumped.filter((j) => !j.noShow).length}){jumped.some((j) => j.noShow) ? ` und bezahlte Plätze (${jumped.filter((j) => j.noShow).length})` : ''}: hat jemand bar bezahlt?</h2>
            <div className="divide-y divide-line">
              {jumped.map((j) => {
                const bal = balanceOf(j.name)
                const final = bal === undefined || isGuest(j) ? undefined : bal - j.price + (payOf(j) === 'bar' ? cashOf(j) : 0)
                const state = guestState(j)
                return (
                  <div key={j.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div>
                      <div className="font-medium">{j.name} <span className="font-normal text-muted">· {eur(j.price)}</span> {detail(j) && <span className="font-normal text-muted">· {detail(j)}</span>} {j.noShow && <Badge tone="warn">nicht gesprungen</Badge>}</div>
                      {final !== undefined && <div className="text-xs text-muted">Konto: {eur(bal!)} → {eur(final)}</div>}
                      {isGuest(j) && guestOf(j)?.code && <div className="text-xs text-muted"><span className="font-mono">{guestOf(j)?.code}</span></div>}
                    </div>
                    {isGuest(j) && state !== 'vor_ort' ? (
                      state === 'bezahlt' ? <Badge tone="ok">{guestOf(j)?.what ? `${guestOf(j)?.what} bezahlt` : j.note ?? 'Online bezahlt'}</Badge>
                        : <span className="flex flex-wrap items-center gap-2"><Badge tone="warn">{state === 'nachweis' ? 'Nachweis geprüft' : 'Überweisung offen'}</Badge><Link to="/finanzen?tab=bank" className="text-sm text-brand hover:underline">In Finanzen zuweisen</Link></span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        {!isGuest(j) && payOf(j) === 'bar' && (
                          <label className="flex items-center gap-1 text-sm">
                            <input inputMode="decimal" value={cashOf(j)} onChange={(e) => setCash((c) => ({ ...c, [j.id]: Number(e.target.value.replace(',', '.')) || 0 }))} className="h-10 w-20 rounded-lg border border-line text-right tabular-nums" /> €
                          </label>
                        )}
                        <Segmented<Pay>
                          value={payOf(j)}
                          onChange={(v) => setPay((p) => ({ ...p, [j.id]: v }))}
                          options={isGuest(j) ? [{ value: 'bar', label: 'Bar erhalten' }, { value: 'konto', label: 'Noch offen' }] : [{ value: 'konto', label: 'Nur belasten' }, { value: 'bar', label: 'Bar erhalten' }]}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>

          <div>
            <h2 className="mb-2 font-semibold">{step(3)} · Das wird gebucht</h2>
            <PostingList postings={postings} />
          </div>
        </div>

        <aside className="space-y-3">
          <Card className="divide-y divide-line text-sm">
            <Row label="Betriebskonten belastet" value={`− ${eur(charged)}`} />
            <Row label="Bar in die Kassa" value={eur(cashIn)} hint={`Kassa danach ${eur(ledger.cash + cashIn)}`} />
            <Row label="Vorher bezahlt (Ertrag)" value={eur(prepaid)} />
            {open > 0 && <Row label="Noch offen" value={eur(open)} tone="warn" />}
          </Card>
          <Button variant="primary" size="lg" className="w-full" disabled={notFlown.length > 0} onClick={finish}>
            Diese {postings.length} Buchungen durchführen
          </Button>
          {notFlown.length > 0 && <p className="text-xs text-muted">Erst alle Nicht-Geflogenen klären.</p>}
        </aside>
      </div>
    </>
  )
}

function Row({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'warn' }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-3">
      <span><span className={tone === 'warn' ? 'text-warn' : 'text-muted'}>{label}</span>{hint && <span className="block text-xs text-muted">{hint}</span>}</span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
    </div>
  )
}

function PostingList({ postings }: { postings: Posting[] }) {
  return (
    <Card className="divide-y divide-line">
      {postings.map((p, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 text-sm">
          <span className="w-24 shrink-0"><Badge tone={kindTone[p.kind]}>{p.kind}</Badge></span>
          <span className="min-w-0 flex-1">{p.text}<span className="block text-xs text-muted">→ {p.to}</span></span>
          <span className="font-medium tabular-nums">{p.kind === 'Belastung' ? `− ${eur(-p.amount)}` : eur(p.amount)}</span>
        </div>
      ))}
      {postings.length === 0 && <div className="px-4 py-3 text-sm text-muted">Noch nichts zu buchen.</div>}
    </Card>
  )
}
