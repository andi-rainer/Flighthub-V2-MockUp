
import { useState } from 'react'

import { eur, members, type Jumper, type Pay } from '../data'
import { Badge, Button, Card, PageHeader, Segmented, Stat } from '../ui'

/**
 * Closing an operation day.
 * Rules (from the club):
 *  1. Every flown ticket is ALWAYS charged to the member's Betriebskonto (transparency).
 *  2. A payment is optional and never forced at the end of the day:
 *       "Nur belasten"  -> only the charge. The member pays later (transfer or cash) or from credit.
 *       "Bar erhalten"  -> cash deposit booked now; the amount may be higher than the price (prepayment).
 *     A bank transfer is simply a deposit that is booked in Finanzen > Bank und Belege once it arrived.
 *  3. Nothing is booked automatically. The user sees every posting and confirms.
 *  4. Members get their Kontoauszug at month end, after the treasurer approved it (Finanzen > Betriebskonten).
 */

type Kind = 'Belastung' | 'Einzahlung' | 'Voucher'
interface Posting { kind: Kind; text: string; amount: number }

const balanceOf = (name: string) => members.find((m) => m.name === name)?.balance
const kindTone = { Belastung: 'bad', Einzahlung: 'ok', Voucher: 'info' } as const

export default function Closing({ jumped, notFlown, onBack, onDiscard }: { jumped: Jumper[]; notFlown: Jumper[]; onBack: () => void; onDiscard: (id: string) => void }) {
  const [pay, setPay] = useState<Record<string, Pay>>({})
  const [cash, setCash] = useState<Record<string, number>>({})
  const [booked, setBooked] = useState(false)
  const payOf = (j: Jumper): Pay => pay[j.id] ?? 'konto'
  const cashOf = (j: Jumper) => cash[j.id] ?? j.price
  const prepaid = (j: Jumper) => !!j.note
  const sparte = (j: Jumper) => (j.kind === 'tandem' ? 'Tandem' : 'Sportspringen')

  const postings: Posting[] = jumped.flatMap((j): Posting[] => {
    if (prepaid(j)) return [{ kind: 'Voucher', text: `${j.name}: Voucher eingelöst, Ertrag ${sparte(j)}`, amount: j.price }]
    const out: Posting[] = [{ kind: 'Belastung', text: `Betriebskonto ${j.name} belastet, Ertrag ${sparte(j)}`, amount: -j.price }]
    if (payOf(j) === 'bar' && cashOf(j) > 0) {
      const extra = cashOf(j) - j.price
      out.push({ kind: 'Einzahlung', text: `${j.name} zahlt bar: Kassa und Betriebskonto${extra > 0 ? ` (davon ${eur(extra)} Vorauszahlung)` : ''}`, amount: cashOf(j) })
    }
    return out
  })
  const total = (k: Kind) => postings.filter((p) => p.kind === k).reduce((n, p) => n + Math.abs(p.amount), 0)

  if (booked) {
    return (
      <>
        <PageHeader title="Sprungtag abgeschlossen" />
        <div className="max-w-2xl space-y-4">
          <PostingList postings={postings} />
          <Button onClick={onBack}>Zurück zum Sprungtag</Button>
        </div>
      </>
    )
  }

  const step = (n: number) => (notFlown.length > 0 ? n : n - 1)

  return (
    <>
      <PageHeader title="Tag abschließen" actions={<Button onClick={onBack}>Zurück</Button>} />
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
            <h2 className="mb-1 font-semibold">{step(2)} · Geflogen ({jumped.length}): hat jemand bar eingezahlt?</h2>
            <p className="mb-2 text-sm text-muted">Das Betriebskonto wird in jedem Fall belastet. Wer später überweist oder Guthaben hat, bleibt bei „Nur belasten“.</p>
            <div className="divide-y divide-line">
              {jumped.map((j) => {
                const bal = balanceOf(j.name)
                const final = bal === undefined ? undefined : bal - j.price + (payOf(j) === 'bar' ? cashOf(j) : 0)
                return (
                  <div key={j.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div>
                      <div className="font-medium">{j.name} <span className="font-normal text-muted">· {eur(j.price)}</span></div>
                      {!prepaid(j) && final !== undefined && <div className="text-xs text-muted">Konto: {eur(bal!)} → {eur(final)}</div>}
                    </div>
                    {prepaid(j) ? (
                      <Badge tone="ok">{j.note}</Badge>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        {payOf(j) === 'bar' && (
                          <label className="flex items-center gap-1 text-sm">
                            <input inputMode="decimal" value={cashOf(j)} onChange={(e) => setCash((c) => ({ ...c, [j.id]: Number(e.target.value.replace(',', '.')) || 0 }))} className="h-10 w-20 rounded-lg border border-line text-right tabular-nums" /> €
                          </label>
                        )}
                        <Segmented<Pay>
                          value={payOf(j)}
                          onChange={(v) => setPay((p) => ({ ...p, [j.id]: v }))}
                          options={[{ value: 'konto', label: 'Nur belasten' }, { value: 'bar', label: 'Bar erhalten' }]}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-muted">Mehr als der Preis eintragen = Vorauszahlung, das Konto geht ins Plus.</p>
          </Card>

          <div>
            <h2 className="mb-2 font-semibold">{step(3)} · Das wird gebucht</h2>
            <PostingList postings={postings} />
          </div>
        </div>

        <aside className="space-y-3">
          <Stat label="Betriebskonten belastet" value={eur(total('Belastung'))} />
          <Stat label="Bar in Kassa" value={eur(total('Einzahlung'))} hint="sofort gebucht" />
          <Button variant="primary" size="lg" className="w-full" disabled={notFlown.length > 0} onClick={() => setBooked(true)}>
            Diese {postings.length} Buchungen durchführen
          </Button>
          {notFlown.length > 0 && <p className="text-xs text-muted">Erst alle Nicht-Geflogenen klären.</p>}
        </aside>
      </div>
    </>
  )
}

function PostingList({ postings }: { postings: Posting[] }) {
  return (
    <Card className="divide-y divide-line">
      {postings.map((p, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 text-sm">
          <span className="w-24 shrink-0"><Badge tone={kindTone[p.kind]}>{p.kind}</Badge></span>
          <span className="flex-1">{p.text}</span>
          <span className="font-medium tabular-nums">{p.kind === 'Belastung' ? `− ${eur(-p.amount)}` : eur(p.amount)}</span>
        </div>
      ))}
      {postings.length === 0 && <div className="px-4 py-3 text-sm text-muted">Noch nichts zu buchen.</div>}
    </Card>
  )
}
