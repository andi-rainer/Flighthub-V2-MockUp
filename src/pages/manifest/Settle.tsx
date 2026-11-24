import clsx from 'clsx'
import { CircleCheck, FileCheck2, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { CASH_ID, eur, members } from '../../data'
import { useSession } from '../../session/session'
import { flightNo, useApp } from '../../state'
import { Button, Drawer, useConfirm } from '../../ui'
import { flightText, jumpsLabel } from '../finance/cashDocs'
import { MoneyDocDrawer, recordDeposit, useMoneyDocs } from '../finance/memberDocs'
import { useActor } from '../tickets/parts'
import { LoadEditLink } from './LoadEdit'
import { DEFAULT_EXTRAS, dmy, extraPriceOn, sportPriceOn, type ManifestDay } from './data'
import { extrasTotal, nowHm, settledPrice, useSettleStore, type SettleExtra, type Settlement } from './settleStore'

const parseEur = (s: string) => { const n = Number(s.replace(/\s|€/g, '').replace(',', '.')); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0 }
const r2 = (n: number) => Math.round(n * 100) / 100
const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? ''
const euroText = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2)).replace('.', ',')

/** [Entwurf] How a member pays: from the Betriebskonto, or in cash with any amount (less: the rest from the Konto, more: credit on the Konto). */
export type PayMode = 'konto' | 'bar'
/** `text` null: the cash follows the total (prefilled). */
export const cashOf = (mode: PayMode, total: number, text: string | null) => (mode === 'konto' ? 0 : text === null ? total : parseEur(text))
/** "vom Konto", "bar", "bar 50,00 €" */
export const payLabel = (total: number, cash: number) => (cash <= 0 ? 'vom Konto' : cash === total ? 'bar' : `bar ${eur(cash)}`)

/** [Entwurf] One line for a confirmation: "Anna Berger: 30,00 € vom Konto · 50,00 € bar in die Kassa". */
export function payWords(name: string, total: number, cash: number) {
  if (cash <= 0) return `${name}: ${eur(total)} vom Konto`
  if (cash < total) return `${name}: ${eur(r2(total - cash))} vom Konto · ${eur(cash)} bar in die Kassa`
  if (cash === total) return `${name}: ${eur(total)} bar in die Kassa`
  return `${name}: ${eur(cash)} bar in die Kassa · ${eur(r2(cash - total))} Guthaben aufs Konto`
}

/**
 * [Entwurf] Settling sport jumpers during the day. `open(id)` are the landed flights of a member that no settlement covers yet; `settle` charges
 * them and the Zusatzkosten to the Betriebskonto at once and books cash as its own Kassa line with a Quittung. A member who checks in again
 * and jumps more has open jumps again.
 */
export function useSettle(day: ManifestDay) {
  const { loads, setLoads, ledger, settings, toggleCheckIn } = useApp()
  const store = useSettleStore()
  const actor = useActor()
  const price = sportPriceOn(settings, day.date)
  const dm = dmy(day.date).slice(0, 6)
  const landed = loads.filter((l) => l.dayId === day.id && l.status === 'gelandet')
  const done = store.of(day.id)
  const balance = (id: string) => ledger.balances[id] ?? members.find((m) => m.id === id)?.balance ?? 0
  const covered = (id: string) => new Set(done.filter((s) => s.memberId === id).flatMap((s) => s.loadIds))
  const open = (id: string) => {
    const c = covered(id), sid = `s-${id}`
    const mine = landed.filter((l) => !c.has(l.id) && l.jumpers.some((j) => j.id === sid))
    const jumped = mine.filter((l) => l.jumpers.some((j) => j.id === sid && !j.noShow)).map((l) => flightNo(loads, l))
    const seats = mine.filter((l) => l.jumpers.some((j) => j.id === sid && j.noShow)).map((l) => flightNo(loads, l))
    return { loadIds: mine.map((l) => l.id), jumps: jumped.length, paidSeats: seats.length, flight: flightText(jumped, seats), price: r2(mine.length * price) }
  }
  /** Members with flown jumps that nobody settled yet. */
  const openMembers = [...new Set(landed.flatMap((l) => l.jumpers.filter((j) => j.kind === 'sport' && j.memberId).map((j) => j.memberId!)))].filter((id) => open(id).loadIds.length > 0)
  const lastOf = (id: string) => [...done].reverse().find((s) => s.memberId === id)

  /** `withJumps: false` charges only the Zusatzkosten ("Kosten hinzufügen"); the open jumps stay open. */
  const settle = (memberId: string, cash: number, checkout: boolean, extras: SettleExtra[] = [], withJumps = true) => {
    const o = withJumps ? open(memberId) : { loadIds: [], jumps: 0, paidSeats: 0, flight: undefined, price: 0 }
    const before = balance(memberId), name = nameOf(memberId), total = r2(o.price + extrasTotal(extras))
    if (o.price > 0) ledger.charge(memberId, o.price, `Sprungtag ${dm}: ${jumpsLabel(o.jumps, o.paidSeats)}${o.flight ? ` (${o.flight})` : ''}`, 'sprungtag')
    // Every Zusatzkosten item is its own line on the Betriebskonto, so it reads clearly on the Monatsrechnung.
    extras.forEach((x) => x.price > 0 && ledger.charge(memberId, x.price, `${x.name} (Sprungtag ${dm})`, 'sprungtag'))
    let cashLineId: string | undefined, doc: string | undefined
    if (cash > 0) {
      cashLineId = ledger.cashDeposit(memberId, cash, `Bar Sprungtag ${dm}`, day.date)
      doc = recordDeposit({ memberId, amount: cash, balance: r2(before - total), via: 'kassa', dateIso: day.date, lineId: cashLineId, by: actor }).no
    }
    if (o.loadIds.length > 0 || extras.length > 0 || checkout) store.add({ dayId: day.id, memberId, name, loadIds: o.loadIds, jumps: o.jumps, paidSeats: o.paidSeats, flight: o.flight, price: o.price, extras, how: cash > 0 ? 'bar' : 'konto', cash, before, time: nowHm(), by: actor, checkedOut: checkout, cashLineId, doc })
    if (checkout) {
      toggleCheckIn(memberId, false)
      setLoads((ls) => ls.map((l) => (l.dayId === day.id && l.status === 'geplant' ? { ...l, jumpers: l.jumpers.filter((j) => j.id !== `s-${memberId}`) } : l)))
    }
    return doc
  }
  const deposit = (memberId: string, amount: number) => {
    const before = balance(memberId)
    const cashLineId = ledger.cashDeposit(memberId, amount, `Einzahlung bar Sprungtag ${dm}`, day.date)
    const doc = recordDeposit({ memberId, amount, balance: before, via: 'kassa', dateIso: day.date, lineId: cashLineId, by: actor }).no
    store.deposit({ dayId: day.id, memberId, name: nameOf(memberId), amount, time: nowHm(), by: actor, cashLineId, doc })
    return doc
  }
  /**
   * [Entwurf] Korrigieren changes what was set at "Abrechnen": the Zusatzkosten and the cash. Only the differences are booked: a Zusatzkosten
   * item more or less is charged or credited on the Betriebskonto; more cash is a Kassa booking with a Quittung, less cash goes out of the Kassa.
   */
  const correct = (s: Settlement, extras: SettleExtra[], toCash: number, reason: string) => {
    const why = reason ? `: ${reason}` : ''
    extrasDiff(s.extras, extras).forEach((d) => ledger.charge(s.memberId, d.amount, `Korrektur ${d.name} (Sprungtag ${dm})${why}`, 'sprungtag'))
    const diff = r2(toCash - s.cash)
    let cashLineId: string | undefined, doc: string | undefined
    if (diff > 0) {
      cashLineId = ledger.cashDeposit(s.memberId, diff, `Korrektur bar Sprungtag ${dm}${why}`, day.date)
      doc = recordDeposit({ memberId: s.memberId, amount: diff, balance: balance(s.memberId), via: 'kassa', dateIso: day.date, lineId: cashLineId, by: actor }).no
    } else if (diff < 0) {
      cashLineId = ledger.payout({ memberId: s.memberId, amount: -diff, accountId: CASH_ID, text: `Korrektur bar Sprungtag ${dm}${why}`, date: day.date })
    }
    store.fix(s.id, { fromCash: s.cash, toCash, reason, by: actor, time: nowHm(), cashLineId, doc, fromExtras: s.extras, changes: fixChanges(s.name, s.extras, extras, diff) }, extras)
    return doc
  }
  /** [Entwurf] "Load bearbeiten": the member was not on a flight that a settlement covers. The seat is credited back as a difference booking. */
  const uncover = (st: Settlement, loadId: number, no: number, noShow: boolean, flight: string | undefined) => {
    const seat = st.loadIds.length > 0 ? r2(st.price / st.loadIds.length) : price
    ledger.charge(st.memberId, -seat, `Korrektur Sprungtag ${dm}: nicht auf Flug ${no}`, 'sprungtag')
    store.uncover(st.id, { loadIds: st.loadIds.filter((x) => x !== loadId), jumps: noShow ? st.jumps : st.jumps - 1, paidSeats: noShow ? st.paidSeats - 1 : st.paidSeats, price: r2(st.price - seat), flight },
      { fromCash: st.cash, toCash: st.cash, reason: `nicht auf Flug ${no}`, by: actor, time: nowHm(), fromExtras: st.extras, changes: [`Flug ${no} nicht dabei: ${eur(seat)} zurück aufs Konto`], uncover: { amount: seat, noShow } })
    return seat
  }
  return { price, open, openMembers, done, deposits: store.deposits(day.id), lastOf, balance, settle, deposit, correct, uncover }
}

/** "abgerechnet · ausgecheckt 15:42" */
export const settledLabel = (s: Settlement | undefined) => (s ? `abgerechnet${s.checkedOut ? ' · ausgecheckt' : ''} ${s.time}` : undefined)

// ---------- Sheets, sized for a finger on a tablet ----------

/**
 * "Abrechnen und auschecken" (check-out), "Abrechnen" (closing), "Kosten hinzufügen" (`extrasOnly`) or "Korrigieren" (`fix`, prefilled with
 * the settlement): today's jumps, Zusatzkosten, how it is paid, the Betriebskonto before and after. Booking needs a confirmation.
 */
export function SettleSheet({ day, memberId, checkout, extrasOnly, fix: st, onClose }: { day: ManifestDay; memberId: string; checkout: boolean; extrasOnly?: boolean; fix?: Settlement; onClose: () => void }) {
  const s = useSettle(day)
  const { loads } = useApp()
  const { guarded } = useSession()
  const confirm = useConfirm()
  const [extras, setExtras] = useState<SettleExtra[]>(st?.extras ?? [])
  const [mode, setMode] = useState<PayMode>(st && st.cash > 0 ? 'bar' : 'konto')
  // A correction keeps the cash that came in, even when the Zusatzkosten change.
  const [text, setText] = useState<string | null>(st && st.cash > 0 ? euroText(st.cash) : null)
  const [reason, setReason] = useState('')
  const [doneDoc, setDoneDoc] = useState<string | null | undefined>(undefined)
  const o = st ? { loadIds: st.loadIds, jumps: st.jumps, paidSeats: st.paidSeats, flight: st.flight, price: st.price }
    : extrasOnly ? { loadIds: [] as number[], jumps: 0, paidSeats: 0, flight: undefined as string | undefined, price: 0 } : s.open(memberId)
  const total = r2(o.price + extrasTotal(extras))
  const cash = cashOf(mode, total, text)
  const before = s.balance(memberId)
  const cashDiff = st ? r2(cash - st.cash) : 0
  const after = st ? r2(before - r2(extrasTotal(extras) - extrasTotal(st.extras)) + cashDiff) : r2(before - total + cash)
  const name = nameOf(memberId)
  const changes = st ? fixChanges(name, st.extras, extras, cashDiff) : []
  const nothing = !st && total === 0 && o.loadIds.length === 0
  const title = st ? 'Korrigieren' : extrasOnly ? 'Kosten hinzufügen' : checkout ? 'Abrechnen und auschecken' : 'Abrechnen'
  const run = () => guarded('manifest.payments.update', () => setDoneDoc((st ? s.correct(st, extras, cash, reason.trim()) : s.settle(memberId, cash, checkout, extras, !extrasOnly)) ?? null))
  const go = () => {
    if (nothing) return run()
    confirm.ask({
      title: st ? 'Korrektur buchen?' : `${title}?`, confirm: st || extrasOnly ? 'Ja, buchen' : 'Ja, abrechnen', run,
      lines: st
        ? [<b className="font-semibold">{payWords(name, total, cash)}</b>, ...changes, ...(reason.trim() ? [`Grund: ${reason.trim()}`] : [])]
        : [
          <b className="font-semibold">{payWords(name, total, cash)}</b>,
          ...(o.loadIds.length > 0 ? [`${jumpsLabel(o.jumps, o.paidSeats)} · ${eur(o.price)}`] : []),
          ...extras.map((x) => `${x.name} · ${eur(x.price)}`),
          ...(checkout ? ['und auschecken'] : []),
        ],
    })
  }

  if (doneDoc !== undefined) return <DoneSheet title={title} name={name} line={st ? 'Korrigiert' : extrasOnly ? `${eur(total)} gebucht` : checkout ? `Ausgecheckt ${nowHm()}` : 'Abgerechnet'} doc={doneDoc} onClose={onClose} />
  const ready = !(mode === 'bar' && cash <= 0) && !(extrasOnly && extras.length === 0) && extras.every((x) => x.name.trim() && x.price > 0) && (!st || changes.length > 0)
  const label = st ? 'Korrektur buchen' : nothing ? (checkout ? 'Auschecken' : extrasOnly ? 'Buchen' : 'Schließen') : extrasOnly ? `Buchen · ${eur(total)}` : title
  return (
    <Drawer open title={`${title} · ${name}`} onClose={onClose}
      footer={<div className="flex gap-2"><Button size="lg" className="flex-1" onClick={onClose}>Abbrechen</Button><Button size="lg" variant="primary" className="flex-[2]" disabled={!ready} onClick={go}>{label}</Button></div>}>
      <div className="space-y-5">
        {!extrasOnly && (
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-sm text-muted">{st ? `Abgerechnet ${st.time} · ${payLabel(settledPrice(st), st.cash)}` : 'Heute offen'}</div>
            {o.loadIds.length === 0 ? <div className="mt-1 text-lg font-semibold">{st ? 'Nur Zusatzkosten' : 'Keine offenen Sprünge'}</div> : <>
              <div className="mt-1 flex items-baseline justify-between gap-3"><span className="text-lg font-semibold">{jumpsLabel(o.jumps, o.paidSeats)}</span><span className="text-2xl font-semibold tabular-nums">{eur(o.price)}</span></div>
              {o.flight && <div className="text-sm text-muted">{o.flight}</div>}
              <div className="mt-1 flex flex-wrap gap-x-4">{loads.filter((l) => o.loadIds.includes(l.id)).map((l) => <LoadEditLink key={l.id} day={day} load={l} focus={memberId} label={`Flug ${flightNo(loads, l)} bearbeiten`} onDone={st ? onClose : undefined} />)}</div>
            </>}
          </div>
        )}
        <ExtrasPick day={day} value={extras} onChange={setExtras} open={extrasOnly} />
        {(total > 0 || (st && st.cash > 0)) && <>
          {extras.length > 0 && !extrasOnly && o.price > 0 && (
            <div className="flex items-baseline justify-between px-1"><span className="text-sm text-muted">Gesamt</span><span className="text-2xl font-semibold tabular-nums">{eur(total)}</span></div>
          )}
          <PayPick total={total} mode={mode} onMode={setMode} text={text} onText={setText} before={before} after={after} />
        </>}
        {st && <>
          <input aria-label="Grund" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Grund (optional)" className="h-12 w-full rounded-xl border border-line bg-surface px-4 text-base outline-none focus:border-brand" />
          {changes.length > 0 && (
            <div className="rounded-xl border border-brand/30 bg-brand-soft/40 px-4 py-3 text-sm">
              <div className="mb-1 font-medium text-brand">Wird gebucht</div>
              <ul className="space-y-0.5 tabular-nums">{changes.map((c) => <li key={c}>{c}</li>)}</ul>
            </div>
          )}
        </>}
      </div>
      {confirm.dialog}
    </Drawer>
  )
}

/**
 * [Entwurf] vom Konto or bar. With bar the amount is prefilled with the total and can be less or more; the effect on the Betriebskonto is
 * said plainly. Used in "Abrechnen und auschecken", "Noch offen" and "Korrigieren".
 */
export function PayPick({ total, mode, onMode, text, onText, before, after }: { total: number; mode: PayMode; onMode: (m: PayMode) => void; text: string | null; onText: (t: string | null) => void; before: number; after: number }) {
  const cash = cashOf(mode, total, text)
  const short = r2(total - cash)
  const effect = mode === 'konto' ? `${eur(total)} vom Konto`
    : short > 0 ? `${eur(short)} fehlen, gehen vom Konto`
    : short < 0 ? `${eur(-short)} mehr, kommt aufs Konto als Guthaben` : undefined
  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Bezahlung" className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
        {([['konto', 'vom Konto'], ['bar', 'bar']] as const).map(([v, label]) => (
          <button key={v} role="radio" aria-checked={mode === v} onClick={() => { if (v !== mode) { onMode(v); if (v === 'bar' && text !== null && parseEur(text) <= 0) onText(null) } }}
            className={clsx('h-12 rounded-lg text-base font-medium transition', mode === v ? 'bg-surface text-brand shadow-sm ring-2 ring-brand' : 'text-muted')}>{label}</button>
        ))}
      </div>
      {mode === 'bar' && (
        <label className="flex h-14 items-center gap-2 rounded-xl border border-line bg-surface px-4 focus-within:border-brand">
          <span className="text-sm text-muted">Bar erhalten</span>
          <input inputMode="decimal" aria-label="Bar erhalten" value={text ?? euroText(total)} placeholder="0" onChange={(e) => onText(e.target.value)} onFocus={(e) => e.target.select()} className="h-full min-w-0 flex-1 bg-transparent text-right text-xl tabular-nums outline-none" />
          <span className="text-muted">€</span>
        </label>
      )}
      <div className="rounded-xl border border-line px-4 py-3">
        {effect && <div className={clsx('mb-1 text-base font-medium', short < 0 && mode === 'bar' ? 'text-ok' : '')}>{effect}</div>}
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted">Betriebskonto</span>
          <span className="tabular-nums"><span className="text-muted">{eur(before)} →</span> <b className={clsx('font-semibold', after < 0 && 'text-bad')}>{eur(after)}</b></span>
        </div>
      </div>
    </div>
  )
}

/** [Entwurf] Zusatzkosten: the club's list from Manifest > Einstellungen (not archived, with the price of the day) and Sonstiges with own text. */
function ExtrasPick({ day, value, onChange, open }: { day: ManifestDay; value: SettleExtra[]; onChange: (x: SettleExtra[]) => void; open?: boolean }) {
  const { settings } = useApp()
  const list = (settings.extras ?? DEFAULT_EXTRAS).filter((x) => !x.archived).map((x) => ({ id: x.id, name: x.name, price: extraPriceOn(x, day.date) }))
  const [show, setShow] = useState(!!open)
  const [other, setOther] = useState(false)
  const [otherName, setOtherName] = useState('')
  const [otherPrice, setOtherPrice] = useState('')
  const add = (x: SettleExtra) => onChange([...value, x])
  const patch = (i: number, price: number) => onChange(value.map((x, j) => (j === i ? { ...x, price } : x)))
  if (!show && value.length === 0) return <button onClick={() => setShow(true)} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-brand"><Plus size={16} /> Zusatzkosten</button>
  return (
    <section className="space-y-2">
      <div className="text-sm text-muted">Zusatzkosten</div>
      {value.map((x, i) => (
        <div key={`${value.length}-${i}`} className="flex min-h-12 items-center gap-2 rounded-xl border border-line px-3">
          <span className="min-w-0 flex-1 truncate text-base">{x.name}</span>
          <AmountInput label={`Betrag ${x.name}`} value={x.price} onChange={(n) => patch(i, n)} />
          <span className="text-muted">€</span>
          <button aria-label={`${x.name} entfernen`} onClick={() => onChange(value.filter((_, j) => j !== i))} className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-slate-100"><X size={16} /></button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {list.map((x) => (
          <button key={x.id} onClick={() => add({ name: x.name, price: x.price })} className="inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-surface px-3 text-sm font-medium hover:bg-slate-50">
            <Plus size={14} /> {x.name} <span className="tabular-nums text-muted">{eur(x.price)}</span>
          </button>
        ))}
        {!other && <button onClick={() => setOther(true)} className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-dashed border-line px-3 text-sm font-medium text-muted hover:bg-slate-50"><Plus size={14} /> Sonstiges</button>}
      </div>
      {other && (
        <div className="flex gap-2">
          <input autoFocus aria-label="Wofür" value={otherName} onChange={(e) => setOtherName(e.target.value)} placeholder="Wofür" className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-base outline-none focus:border-brand" />
          <input inputMode="decimal" aria-label="Betrag Sonstiges" value={otherPrice} onChange={(e) => setOtherPrice(e.target.value)} placeholder="€" className="h-12 w-20 rounded-xl border border-line bg-surface px-2 text-right tabular-nums outline-none focus:border-brand" />
          <Button size="lg" disabled={!otherName.trim() || parseEur(otherPrice) <= 0} onClick={() => { add({ name: otherName.trim(), price: parseEur(otherPrice) }); setOther(false); setOtherName(''); setOtherPrice('') }}>Dazu</Button>
        </div>
      )}
    </section>
  )
}

/** A euro amount typed freely ("6,5"); the number follows every keystroke, the text stays as typed. */
function AmountInput({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(euroText(value))
  return <input inputMode="decimal" aria-label={label} value={text} onChange={(e) => { setText(e.target.value); onChange(parseEur(e.target.value)) }} onBlur={() => setText(euroText(value))} onFocus={(e) => e.target.select()} className="h-10 w-20 rounded-lg border border-line bg-surface px-2 text-right tabular-nums outline-none focus:border-brand" />
}

/** "Bar einzahlen" during the day: own Kassa booking and a Quittung at once. */
export function DepositSheet({ day, memberId, onClose }: { day: ManifestDay; memberId: string; onClose: () => void }) {
  const s = useSettle(day)
  const { guarded } = useSession()
  const confirm = useConfirm()
  const [text, setText] = useState('')
  const [doneDoc, setDoneDoc] = useState<string | undefined>(undefined)
  const amount = parseEur(text), before = s.balance(memberId), name = nameOf(memberId)
  const go = () => confirm.ask({ title: 'Bar einzahlen?', confirm: 'Ja, einzahlen', lines: [<b className="font-semibold">{name}: {eur(amount)} bar in die Kassa</b>, `Konto ${eur(before)} → ${eur(r2(before + amount))}`], run: () => guarded('manifest.payments.update', () => setDoneDoc(s.deposit(memberId, amount))) })
  if (doneDoc) return <DoneSheet title="Bar einzahlen" name={name} line={`${eur(amount)} eingezahlt`} doc={doneDoc} onClose={onClose} />
  return (
    <Drawer open title={`Bar einzahlen · ${name}`} onClose={onClose}
      footer={<div className="flex gap-2"><Button size="lg" className="flex-1" onClick={onClose}>Abbrechen</Button><Button size="lg" variant="primary" className="flex-[2]" disabled={amount <= 0} onClick={go}>Bar einzahlen</Button></div>}>
      <div className="space-y-4">
        <label className="flex h-14 items-center gap-2 rounded-xl border border-line bg-surface px-4 focus-within:border-brand">
          <span className="text-sm text-muted">Betrag</span>
          <input autoFocus inputMode="decimal" aria-label="Betrag" value={text} onChange={(e) => setText(e.target.value)} placeholder="0" className="h-full min-w-0 flex-1 bg-transparent text-right text-xl tabular-nums outline-none" />
          <span className="text-muted">€</span>
        </label>
        <div className="flex items-center justify-between rounded-xl border border-line px-4 py-3">
          <span className="text-sm text-muted">Konto</span>
          <span className="tabular-nums"><span className="text-muted">{eur(before)} →</span> <b className="font-semibold">{eur(r2(before + amount))}</b></span>
        </div>
      </div>
      {confirm.dialog}
    </Drawer>
  )
}

/** [Entwurf] Zusatzkosten before and after a correction, per item: positive is charged, negative credited. */
export function extrasDiff(from: SettleExtra[], to: SettleExtra[]) {
  const sum = (xs: SettleExtra[]) => xs.reduce((m, x) => m.set(x.name, r2((m.get(x.name) ?? 0) + x.price)), new Map<string, number>())
  const a = sum(from), b = sum(to)
  return [...new Set([...a.keys(), ...b.keys()])].map((name) => ({ name, was: a.get(name) ?? 0, now: b.get(name) ?? 0, amount: r2((b.get(name) ?? 0) - (a.get(name) ?? 0)) })).filter((d) => d.amount !== 0)
}

/** [Entwurf] The bookings of a correction in plain words: Zusatzkosten more or less, and the cash difference. */
export function fixChanges(name: string, from: SettleExtra[], to: SettleExtra[], cashDiff: number) {
  const extras = extrasDiff(from, to).map((d) => d.was === 0 ? `${d.name} dazu: ${eur(d.amount)} vom Konto`
    : d.now === 0 ? `${d.name} entfernt: ${eur(-d.amount)} zurück aufs Konto`
    : `${d.name} ${eur(d.was)} → ${eur(d.now)}: ${eur(Math.abs(d.amount))} ${d.amount > 0 ? 'vom Konto' : 'zurück aufs Konto'}`)
  const cash = cashDiff === 0 ? [] : cashDiff > 0
    ? [`Kassa: ${eur(cashDiff)} Eingang bar von ${name} · Quittung`, `Betriebskonto ${name}: ${eur(cashDiff)} Eingang`]
    : [`Kassa: ${eur(-cashDiff)} Ausgang bar an ${name}`, `Betriebskonto ${name}: ${eur(-cashDiff)} Ausgang`]
  return [...extras, ...cash]
}

function DoneSheet({ title, name, line, doc, onClose }: { title: string; name: string; line: string; doc: string | null; onClose: () => void }) {
  const docs = useMoneyDocs().docs
  const [show, setShow] = useState(false)
  const d = doc ? docs.find((x) => x.no === doc) ?? null : null
  return (
    <>
      <Drawer open title={`${title} · ${name}`} onClose={onClose} footer={<Button size="lg" variant="primary" className="w-full" onClick={onClose}>Fertig</Button>}>
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <CircleCheck size={48} className="text-ok" strokeWidth={1.5} />
          <div className="text-lg font-semibold">{line}</div>
          {d && <button onClick={() => setShow(true)} className="mt-3 inline-flex h-12 items-center gap-2 rounded-xl border border-line px-4 text-base font-medium hover:bg-slate-50"><FileCheck2 size={18} className="text-ok" /> Quittung {d.no}</button>}
        </div>
      </Drawer>
      {show && <MoneyDocDrawer doc={d} onClose={() => setShow(false)} />}
    </>
  )
}

