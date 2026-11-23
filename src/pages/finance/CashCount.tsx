import clsx from 'clsx'
import { useState } from 'react'
import { eur } from '../../data'
import { useSession } from '../../session/session'
import { TODAY_ISO, useApp } from '../../state'
import { Badge, Button, Drawer, Field, field } from '../../ui'
import { dmy } from '../manifest/data'
import { useActor } from '../tickets/parts'
import { COINS, countedSum, DIFFERENCE_REASONS, denomLabel, NOTES } from './cashDocs'

/**
 * [Entwurf] "Kassa zählen": Soll is the balance in the books, Ist is counted by notes and coins. A difference is booked as a marked
 * Differenz-Buchung on the account (an exception with reason, person and day) that still has to get a cost center in Finanzen. The count is kept as
 * a Zählprotokoll. Reachable from the Kassa card, from the end of a Sprungtag and from the treasurer's start page.
 *
 *   <CashCountDialog accountId={CASH_ID} onClose={() => …} />
 */
export function CashCountDialog({ accountId, onClose }: { accountId: string; onClose: () => void }) {
  const { ledger } = useApp()
  const { guarded } = useSession()
  const actor = useActor()
  const account = ledger.accounts.find((a) => a.id === accountId)
  const [raw, setRaw] = useState<Record<string, string>>({})
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  if (!account) return null

  const pieces = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Math.max(0, Math.floor(Number(v.replace(/\D/g, '')) || 0))]))
  const counted = countedSum(pieces)
  const expected = Math.round(ledger.balanceOf(accountId) * 100) / 100
  const diff = Math.round((counted - expected) * 100) / 100
  const touched = Object.values(pieces).some((v) => v > 0) || Object.keys(raw).length > 0
  const valid = touched && (diff === 0 || reason !== '')
  const past = ledger.counts.filter((c) => c.accountId === accountId)

  const save = () => {
    guarded('billing.bank.manage', () => ledger.countCash({ accountId, date: TODAY_ISO, pieces, reason: diff === 0 ? undefined : `${reason}${note.trim() ? `: ${note.trim()}` : ''}`, by: actor }))
    onClose()
  }
  const col = (title: string, keys: readonly number[]) => (
    <div>
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">{title}</div>
      <div className="space-y-1">
        {keys.map((k) => {
          const n = pieces[String(k)] ?? 0
          return (
            <label key={k} className="grid grid-cols-[3.75rem_3.5rem_minmax(0,1fr)] items-center gap-1.5">
              <span className="text-sm">{denomLabel(k)}</span>
              <input aria-label={`${denomLabel(k)} Stück`} inputMode="numeric" value={raw[String(k)] ?? ''} placeholder="0" onChange={(e) => setRaw({ ...raw, [String(k)]: e.target.value })} className={clsx(field, 'w-full text-right tabular-nums')} />
              <span className="text-right text-xs tabular-nums text-muted">{n > 0 ? eur((n * k) / 100) : ''}</span>
            </label>
          )
        })}
      </div>
    </div>
  )

  return (
    <Drawer open title={`${account.name} zählen`} onClose={onClose}
      footer={<div className="flex justify-end gap-2"><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" disabled={!valid} onClick={save}>{diff === 0 ? 'Zählung festhalten' : `Differenz ${eur(diff)} buchen`}</Button></div>}>
      <div className="space-y-5 text-sm">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-muted">Soll (Buchungen)</div><div className="text-lg font-semibold tabular-nums">{eur(expected)}</div></div>
          <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-muted">Ist (gezählt)</div><div className="text-lg font-semibold tabular-nums">{eur(counted)}</div></div>
          <div className={clsx('rounded-xl p-3', !touched ? 'bg-slate-50' : diff === 0 ? 'bg-ok-soft' : 'bg-warn-soft')}><div className="text-xs text-muted">Differenz</div><div className={clsx('text-lg font-semibold tabular-nums', touched && diff === 0 && 'text-ok', diff !== 0 && 'text-bad')}>{touched ? eur(diff) : '–'}</div></div>
        </div>
        <div className="grid grid-cols-2 gap-5">{col('Scheine', NOTES)}{col('Münzen', COINS)}</div>

        {diff !== 0 && (
          <div className="space-y-3 rounded-xl border border-warn/40 bg-warn-soft/40 p-3">
            <Field label="Grund der Differenz"><select aria-label="Grund der Differenz" value={reason} onChange={(e) => setReason(e.target.value)} className={`${field} w-full`}><option value="">Bitte wählen</option>{DIFFERENCE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}</select></Field>
            <Field label="Anmerkung (optional)"><input aria-label="Anmerkung" value={note} onChange={(e) => setNote(e.target.value)} className={`${field} w-full`} /></Field>
            <p className="text-xs text-muted">Gebucht von {actor} am {dmy(TODAY_ISO)} als Ausnahme „Kassendifferenz“. Die Zuordnung zu einer Kostenstelle folgt in Finanzen.</p>
          </div>
        )}

        {past.length > 0 && (
          <div>
            <div className="mb-1 text-sm font-semibold">Frühere Zählungen</div>
            <div className="divide-y divide-line rounded-xl border border-line">
              {past.slice(0, 3).map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0"><span className="block">{dmy(c.date)} · {c.by}</span><span className="block truncate text-xs text-muted">Soll {eur(c.expected)}, Ist {eur(c.counted)}{c.reason ? ` · ${c.reason}` : ''}</span></span>
                  {c.counted === c.expected ? <Badge tone="ok">stimmt</Badge> : <Badge tone="warn">{eur(c.counted - c.expected)}</Badge>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Drawer>
  )
}
