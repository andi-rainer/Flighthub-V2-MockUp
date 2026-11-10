import clsx from 'clsx'
import { FileCheck2, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { eur, members, type BankLine, type Part, type SingleTarget, type Split, type Target } from '../../data'
import MemberPicker from '../../MemberPicker'
import { Badge, Button, Drawer, Segmented } from '../../ui'
import { useApp } from '../../state'
import { dmy } from '../manifest/data'
import { field } from '../tickets/parts'
import { fullName, refundOpen } from '../tickets/data'
import { payTarget } from '../tickets/payments'
import LineReceipts from './LineReceipts'
import { type Ledger } from './ledger'
import { cents, confLabel, Dot, euros } from './parts'

/** One part of the amount as it is edited: a target of its own. A line with one part books the whole amount. */
interface Draft { key: number; amount: string; mode: 'konto' | 'buchung' | 'zahlung'; memberId: string; payCode: string; splits: Split[]; receiptId?: string }
let draftKey = 1

/**
 * Where the money of a bank line goes. By default ONE target for the whole amount; "Betrag aufteilen" makes parts, each with its own
 * target (ticket + donation, flight costs + membership fee) or its own invoice (a collective debit settling several invoices). The parts
 * must add up to the whole amount before the booking is possible.
 */
export function Assign({ line, ledger, onClose }: { line: BankLine; ledger: Ledger; onClose: () => void }) {
  const { hasAccount, vouchers, tickets, loads } = useApp()
  const accountMembers = members.filter((m) => hasAccount(m.id))
  const type = line.amount < 0 ? 'Kosten' : 'Ertrag'
  const sug = line.suggestion?.target
  const total = Math.round(Math.abs(line.amount) * 100)
  const ccs = ledger.costCenters.filter((c) => !c.archived)
  const cats = ledger.categories.filter((c) => !c.archived && c.type === type)
  const flown = (bookingId?: string) => !!bookingId && loads.some((l) => l.status === 'gelandet' && l.jumpers.some((j) => j.bookingId === bookingId && !j.noShow))
  /** Open payments (incoming) or open refunds (outgoing) of vouchers and tickets. A checked transfer confirmation comes first, a guest who already flew even more so. */
  const payables = [
    ...(line.amount > 0 ? vouchers.filter((v) => !v.paid && v.status !== 'cancelled').map((v) => ({ code: v.code, what: 'Gutschein' as const, buyer: v.buyer, price: v.price, proof: v.proof, flown: flown(v.bookingId) })) : []),
    ...tickets.filter((t) => (line.amount > 0 ? !t.paid && t.status !== 'cancelled' : refundOpen(t))).map((t) => ({ code: t.code, what: 'Ticket' as const, buyer: t.buyer, price: t.price, proof: t.proof, flown: flown(t.bookingId) })),
  ].sort((a, b) => Number(!!b.proof) - Number(!!a.proof) || Number(b.flown) - Number(a.flown))
  const defaultSplits = (): Split[] => [{ costCenterId: ccs[0].id, categoryId: cats[0]?.id ?? '', percent: 100 }]
  const draftOf = (t: SingleTarget | undefined, amount: string, receiptId?: string): Draft => ({
    key: draftKey++, amount, receiptId, mode: t && t.kind !== 'umbuchung' && t.kind !== 'auslage' ? t.kind : (line.amount > 0 && /ÜW/.test(line.text) ? 'konto' : 'buchung'),
    memberId: t?.kind === 'konto' ? t.memberId : accountMembers[0].id, payCode: t?.kind === 'zahlung' ? t.code : '', splits: t?.kind === 'buchung' ? t.splits : defaultSplits(),
  })
  const likely = payables.filter((p) => p.proof && Math.round(p.price * 100) === total)
  const [drafts, setDrafts] = useState<Draft[]>(() => {
    if (sug?.kind === 'teilung') return sug.parts.map((p) => draftOf(p.target, euros(Math.round(p.amount * 100)), p.receiptId))
    if (!sug && likely.length === 1) return [{ ...draftOf(undefined, ''), mode: 'zahlung', payCode: likely[0].code }]
    return [draftOf(sug, '')]
  })
  const [hidden, setHidden] = useState(false)
  const [adding, setAdding] = useState<null | 'cc' | 'cat'>(null)
  const [newName, setNewName] = useState('')
  const single = drafts.length === 1
  const own = (d: Draft) => (single ? total : cents(d.amount) || 0)
  const remaining = total - drafts.reduce((n, d) => n + own(d), 0)
  const draftValid = (d: Draft) => own(d) > 0 && (d.mode === 'konto' ? !!d.memberId : d.mode === 'zahlung' ? d.payCode !== '' : d.splits.reduce((n, s) => n + s.percent, 0) === 100 && d.splits.every((s) => s.categoryId))
  const valid = remaining === 0 && drafts.every(draftValid)
  const patch = (key: number, p: Partial<Draft>) => setDrafts((all) => all.map((d) => (d.key === key ? { ...d, ...p } : d)))
  const lineReceipts = ledger.receipts.filter((r) => r.lineId === line.id)

  const single1 = (d: Draft): SingleTarget => {
    if (d.mode === 'konto') return { kind: 'konto', memberId: d.memberId }
    if (d.mode === 'zahlung') { const p = payables.find((x) => x.code === d.payCode)!; return payTarget(p.what, p.code, p.buyer) }
    return { kind: 'buchung', splits: d.splits }
  }
  const build = (): Target => single ? single1(drafts[0]) : { kind: 'teilung', parts: drafts.map((d): Part => ({ amount: own(d) / 100, target: single1(d), receiptId: d.receiptId })) }
  const fromReceipts = () => setDrafts(lineReceipts.map((r) => draftOf(undefined, euros(Math.round(r.amount * 100)), r.id)).map((d) => ({ ...d, mode: 'buchung' as const })))

  return (
    <Drawer open={!hidden} title={line.suggestion ? 'Vorschlag prüfen' : 'Zuordnen'} size={single ? 'md' : 'xl'} onClose={onClose} footer={<Button variant="primary" size="lg" className="w-full" disabled={!valid} onClick={() => { ledger.assign(line.id, build()); onClose() }}>{line.suggestion ? 'Bestätigen und buchen' : 'Zuordnen und buchen'}</Button>}>
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><div className="text-sm">{line.text}</div><div className="shrink-0 text-lg font-semibold tabular-nums">{eur(line.amount)}</div></div>
        {line.suggestion && <div className="flex items-center gap-1.5 text-xs text-muted"><Dot c={line.suggestion.confidence} /><span>{confLabel(line.suggestion.confidence)} · {line.suggestion.why}</span></div>}
        {!single && <div className={clsx('flex items-center justify-between rounded-lg px-3 py-1.5 text-sm font-medium', remaining === 0 ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-amber-900')}><span>{remaining === 0 ? 'Alles verteilt' : remaining > 0 ? 'Noch zu verteilen' : 'Zu viel verteilt'}</span><span className="tabular-nums">{remaining === 0 ? eur(Math.abs(line.amount)) : eur(Math.abs(remaining) / 100)}</span></div>}

        {drafts.map((d, i) => {
          const receipt = ledger.receipts.find((r) => r.id === d.receiptId)
          const taken = drafts.filter((x) => x.key !== d.key && x.mode === 'zahlung').map((x) => x.payCode)
          return (
            <div key={d.key} className={clsx('space-y-3', !single && 'rounded-xl border border-line p-3')}>
              {!single && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">Teil {i + 1}</span>
                  {receipt && <span className="inline-flex items-center gap-1 rounded-full bg-ok-soft px-2 py-px text-[11px] font-medium text-ok"><FileCheck2 size={11} />{receipt.supplier}{receipt.number ? ` ${receipt.number}` : ''}</span>}
                  <span className="ml-auto flex items-center gap-1"><input aria-label={`Betrag Teil ${i + 1}`} inputMode="decimal" value={d.amount} onChange={(e) => patch(d.key, { amount: e.target.value })} className="h-9 w-24 rounded-lg border border-line px-2 text-right tabular-nums" />€</span>
                  <button aria-label={`Teil ${i + 1} entfernen`} onClick={() => setDrafts((all) => all.filter((x) => x.key !== d.key))} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-slate-100"><X size={15} /></button>
                </div>
              )}
              <Segmented<Draft['mode']> value={d.mode} onChange={(mode) => patch(d.key, { mode })} options={[{ value: 'konto', label: 'Betriebskonto' }, { value: 'buchung', label: 'Kostenstelle' }, { value: 'zahlung', label: 'Gutschein / Ticket' }]} />
              {d.mode === 'zahlung' ? (
                <PayablePicker key={d.key} payables={payables.filter((p) => !taken.includes(p.code))} value={d.payCode} single={single} total={total}
                  title={line.amount > 0 ? 'Welche Zahlung ist das?' : 'Welche Erstattung ist das?'} empty={line.amount > 0 ? 'Keine offene Zahlung bei Gutscheinen und Tickets.' : 'Keine offene Erstattung bei Tickets.'}
                  onPick={(p) => patch(d.key, { payCode: p.code, ...(single ? {} : { amount: euros(Math.round(p.price * 100)) }) })} />
              ) : d.mode === 'konto' ? (
                <div className="block text-sm">Mitglied
                  <MemberPicker ariaLabel="Mitglied" className="mt-1" value={d.memberId} allow={(m) => hasAccount(m.id)} rank={(m) => (sug?.kind === 'konto' && m.id === sug.memberId ? -1 : 0)} rankHint="Vorschlag zuerst" info={(m) => eur(ledger.balances[m.id] ?? m.balance)} onChange={(id) => id && patch(d.key, { memberId: id })} />
                </div>
              ) : (
                <SplitsEditor type={type} splits={d.splits} amount={own(d) / 100 * (line.amount < 0 ? -1 : 1)} ccs={ccs} cats={cats} onChange={(splits) => patch(d.key, { splits })} />
              )}
            </div>
          )
        })}

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setDrafts((prev) => {
            const base = prev.length === 1 ? [{ ...prev[0], amount: euros(total) }] : prev
            const rest = total - base.reduce((n, d) => n + (cents(d.amount) || 0), 0)
            return [...base, draftOf(undefined, rest > 0 ? euros(rest) : '')]
          })}><Plus size={14} /> Betrag aufteilen</Button>
          {lineReceipts.length > 1 && <Button onClick={fromReceipts}>Nach Belegen aufteilen ({lineReceipts.length})</Button>}
        </div>

        <div className="border-t border-line pt-3"><LineReceipts line={line} ledger={ledger} booked={false} onDialog={setHidden} /></div>

        <div className="border-t border-line pt-3 text-sm">
          {adding ? (
            <div className="flex gap-2"><input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={adding === 'cc' ? 'Name der Kostenstelle' : `Name der ${type === 'Kosten' ? 'Kostenart' : 'Ertragsart'}`} className={`${field} w-full`} />
              <Button variant="primary" disabled={!newName.trim()} onClick={() => { adding === 'cc' ? ledger.addCostCenter(newName.trim(), 'Allgemein') : ledger.addCategory(newName.trim(), type, false); setNewName(''); setAdding(null) }}>Anlegen</Button>
              <Button onClick={() => setAdding(null)}>Abbrechen</Button></div>
          ) : (
            <div className="flex gap-4 text-brand"><button onClick={() => setAdding('cc')}>+ Neue Kostenstelle</button><button onClick={() => setAdding('cat')}>+ Neue {type === 'Kosten' ? 'Kostenart' : 'Ertragsart'}</button></div>
          )}
        </div>
      </div>
    </Drawer>
  )
}

/** The booking on cost centers of one part: one or several cost centers with percentages. */
export function SplitsEditor({ type, splits, amount, ccs, cats, onChange }: { type: string; splits: Split[]; amount: number; ccs: { id: string; name: string; kind: string }[]; cats: { id: string; name: string; fixed?: boolean }[]; onChange: (s: Split[]) => void }) {
  const sum = splits.reduce((n, s) => n + s.percent, 0)
  const patch = (i: number, p: Partial<Split>) => onChange(splits.map((s, k) => (k === i ? { ...s, ...p } : s)))
  const spreadAircraft = () => {
    const ac = ccs.filter((c) => c.kind === 'Flugzeug')
    if (ac.length === 0) return
    const each = Math.floor(100 / ac.length)
    onChange(ac.map((c, i) => ({ costCenterId: c.id, categoryId: splits[0].categoryId, percent: i === 0 ? 100 - each * (ac.length - 1) : each })))
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm"><span className="font-medium">{type} auf Kostenstelle(n)</span><span className={clsx('tabular-nums', sum === 100 ? 'text-ok' : 'text-bad')}>{sum} %</span></div>
      {splits.map((s, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-2">
          <select aria-label="Kostenstelle" className={`${field} min-w-0 flex-1`} value={s.costCenterId} onChange={(e) => patch(i, { costCenterId: e.target.value })}>{ccs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select aria-label={type === 'Kosten' ? 'Kostenart' : 'Ertragsart'} className={`${field} min-w-0 flex-1`} value={s.categoryId} onChange={(e) => patch(i, { categoryId: e.target.value })}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}{c.fixed ? ' (fix)' : ''}</option>)}</select>
          <div className="flex items-center gap-1"><input aria-label="Prozent" inputMode="numeric" value={s.percent} onChange={(e) => patch(i, { percent: Number(e.target.value) || 0 })} className="h-11 w-14 rounded-lg border border-line text-right tabular-nums" />%</div>
          <span className="w-20 text-right text-xs text-muted">{eur((amount * s.percent) / 100)}</span>
          {splits.length > 1 && <button aria-label="Zeile entfernen" onClick={() => onChange(splits.filter((_, k) => k !== i))} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100"><X size={15} /></button>}
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => onChange([...splits, { costCenterId: ccs[0].id, categoryId: splits[0].categoryId, percent: Math.max(0, 100 - sum) }])}><Plus size={14} /> Weitere Kostenstelle</Button>
        <Button onClick={spreadAircraft}>Auf alle Flugzeuge verteilen</Button>
      </div>
    </div>
  )
}


interface Payable { code: string; what: 'Gutschein' | 'Ticket'; buyer: Parameters<typeof fullName>[0]; price: number; proof?: { by: string; at: string }; flown: boolean }
const SHOWN = 5

/**
 * The open vouchers and tickets to pick one from. With many open ones it starts short: the ones whose amount fits (best first: checked
 * proof, guest already flown), at most five; typing searches all of them (code, buyer), "Alle anzeigen" opens the rest.
 */
function PayablePicker({ payables, value, single, total, title, empty, onPick }: { payables: Payable[]; value: string; single: boolean; total: number; title: string; empty: string; onPick: (p: Payable) => void }) {
  const [q, setQ] = useState('')
  const [all, setAll] = useState(false)
  const fits = (p: Payable) => !single || Math.round(p.price * 100) === total
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  const matches = payables.filter((p) => words.every((w) => `${p.code} ${fullName(p.buyer)} ${p.what}`.toLowerCase().includes(w)))
  const ranked = [...matches].sort((a, b) => Number(fits(b)) - Number(fits(a)))
  const wide = all || words.length > 0
  const base = wide ? ranked : ranked.filter(fits).slice(0, SHOWN)
  const shown = base.some((p) => p.code === value) || !value ? base : [...base, ...payables.filter((p) => p.code === value)]
  const hidden = ranked.length - shown.length
  return (
    <div className="space-y-1.5 text-sm">
      <div className="flex items-center justify-between gap-2"><span className="font-medium">{title}</span>{payables.length > SHOWN && <span className="text-xs text-muted">{payables.length} offen</span>}</div>
      {payables.length > SHOWN && <input aria-label="Gutschein oder Ticket suchen" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Code oder Name suchen" className={`${field} w-full`} />}
      {shown.map((p) => {
        const ok = fits(p)
        return (
          <label key={p.code} className={clsx('flex items-center gap-3 rounded-lg border px-3 py-1.5', ok ? 'cursor-pointer hover:bg-slate-50' : 'opacity-50', value === p.code ? 'border-brand bg-slate-50' : 'border-line')}>
            <input type="radio" disabled={!ok} checked={value === p.code} onChange={() => onPick(p)} />
            <span className="min-w-0 flex-1"><span className="block truncate"><span className="font-mono">{p.code}</span> · {fullName(p.buyer)}</span><span className="text-xs text-muted">{p.what}{p.proof && ` · Bestätigung geprüft von ${p.proof.by} am ${dmy(p.proof.at)}`}</span></span>
            {p.flown && <Badge tone="info">Schon geflogen</Badge>}
            {p.proof && <Badge tone="warn">Nachweis</Badge>}
            {!ok && <Badge>Betrag weicht ab</Badge>}
            <span className="font-medium tabular-nums">{eur(p.price)}</span>
          </label>
        )
      })}
      {payables.length === 0 && <p className="rounded-lg border border-dashed border-line px-3 py-3 text-muted">{empty}</p>}
      {payables.length > 0 && shown.length === 0 && <p className="rounded-lg border border-dashed border-line px-3 py-3 text-muted">{words.length > 0 ? 'Nichts gefunden.' : 'Kein offener Eintrag mit diesem Betrag.'}</p>}
      {hidden > 0 && <button onClick={() => setAll(true)} className="text-xs font-medium text-brand">Alle anzeigen ({hidden} weitere)</button>}
      {all && !words.length && <button onClick={() => setAll(false)} className="text-xs font-medium text-brand">Weniger anzeigen</button>}
    </div>
  )
}
