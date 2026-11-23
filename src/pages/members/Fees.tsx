import clsx from 'clsx'
import { Receipt } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CASH_ID, eur, members } from '../../data'
import { comingFrom } from '../../backTo'
import { TODAY_ISO, useApp } from '../../state'
import { Badge, Banner, Button, Card, Drawer, RowMenu, Segmented, Stat, usePaging } from '../../ui'
import { dmy } from '../manifest/data'
import { feeIsOpen, feeLabel, feeTone, type Fee, type FeeState } from './data'
import { FeeDocDrawer, useFeeActions, type Doc } from './FeeDoc'

type View = 'alle' | FeeState

/**
 * [Entwurf] A membership fee is paid: in cash (booked in the Kassa) or by an incoming transfer of the bank (assigned to the fee).
 * Both are booked as income on Verein allgemein / Mitgliedsbeiträge at once; the fee turns "Bezahlt" and links to the booking.
 */
export function FeePayDrawer({ fee, onClose }: { fee: Fee | null; onClose: () => void }) {
  const { ledger, fees, setFees } = useApp()
  const [method, setMethod] = useState<'bar' | 'bank'>('bank')
  const [day, setDay] = useState(TODAY_ISO)
  const [lineId, setLineId] = useState('')
  if (!fee) return null
  const parts = fee.person.toLowerCase().split(' ')
  // Incoming transfers that are not booked yet; the ones that fit the amount or the name come first.
  const rank = (l: { text: string; amount: number }) => (l.amount === fee.amount ? 0 : 2) + (parts.some((p) => l.text.toLowerCase().includes(p)) ? 0 : 1)
  const lines = ledger.lines.filter((l) => l.amount > 0 && !ledger.done[l.id]).sort((a, b) => rank(a) - rank(b))
  const line = lines.find((l) => l.id === lineId)
  const differs = method === 'bank' && !!line && line.amount !== fee.amount
  const ok = method === 'bar' ? !!day && day <= TODAY_ISO : !!line && !differs
  const close = () => { setLineId(''); setDay(TODAY_ISO); onClose() }
  const pay = () => {
    ledger.payFee({ feeId: fee.id, person: fee.person, invoice: fee.invoice, amount: fee.amount, method, lineId: line?.id, dateIso: method === 'bar' ? day : line!.date })
    setFees(fees.map((f) => (f.id === fee.id ? { ...f, state: 'bezahlt' } : f)))
    close()
  }
  return (
    <Drawer open title="Zahlung erfassen" onClose={close} footer={<Button variant="primary" size="lg" className="w-full" disabled={!ok} onClick={pay}>Beitrag {eur(fee.amount)} als bezahlt buchen</Button>}>
      <div className="space-y-4 text-sm">
        <div className="rounded-xl bg-slate-50 p-4"><div className="font-semibold">{fee.person}</div><div className="text-xs text-muted">{fee.note}{fee.invoice && ` · ${fee.invoice}`}</div><div className="mt-1 text-2xl font-semibold tabular-nums">{eur(fee.amount)}</div></div>
        <Segmented<'bar' | 'bank'> value={method} onChange={setMethod} options={[{ value: 'bank', label: 'Überweisung' }, { value: 'bar', label: 'Bar' }]} />
        {method === 'bar' ? (
          <div className="space-y-2">
            <label className="block text-xs text-muted">Bezahlt am<input type="date" value={day} max={TODAY_ISO} onChange={(e) => setDay(e.target.value)} className="mt-0.5 block h-10 rounded-lg border border-line px-2 text-sm text-ink outline-none focus:border-brand" /></label>
            <div className="text-xs text-muted">Kassa {eur(ledger.cash)} → <b className="text-ink">{eur(ledger.cash + fee.amount)}</b></div>
          </div>
        ) : (
          <div className="space-y-2">
            {lines.length === 0 && <p className="text-muted">Keine offene Überweisung auf dem Konto. <Link to="/finanzen?tab=bank" className="text-brand hover:underline">Zu den Buchungen</Link></p>}
            {lines.map((l) => (
              <label key={l.id} className={clsx('flex cursor-pointer items-center gap-3 rounded-xl border p-3', lineId === l.id ? 'border-brand bg-brand-soft/40' : 'border-line hover:bg-slate-50')}>
                <input type="radio" name="line" checked={lineId === l.id} onChange={() => setLineId(l.id)} />
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{l.text}</span><span className="text-xs text-muted">{dmy(l.date)}{l.amount === fee.amount && ' · Betrag passt'}</span></span>
                <span className={clsx('font-semibold tabular-nums', l.amount !== fee.amount && 'text-muted')}>{eur(l.amount)}</span>
              </label>
            ))}
            {differs && <Banner tone="warn">Der Betrag weicht ab ({eur(line!.amount)} statt {eur(fee.amount)}). Zuerst die Zeile in den Buchungen aufteilen.</Banner>}
          </div>
        )}
      </div>
    </Drawer>
  )
}

/** The status of a fee; a paid one names how it was paid and links to the booking. */
export function FeeStatus({ f }: { f: Fee }) {
  const { ledger } = useApp()
  const p = ledger.feePayments[f.id]
  return (
    <>
      <Badge tone={feeTone[f.state]}>{feeLabel[f.state]}</Badge>
      {f.invoice && <div className="mt-0.5 text-xs text-muted">{f.invoice}</div>}
      {p && <Link to={`/finanzen?tab=bank&konto=${p.method === 'bar' ? CASH_ID : 'acc-bank'}&line=${p.lineId}`} onClick={(e) => e.stopPropagation()} className="mt-0.5 block text-xs text-brand hover:underline">{p.method === 'bar' ? 'bar, Kassa' : 'Überweisung'} am {dmy(p.at).slice(0, 6)}</Link>}
    </>
  )
}

/**
 * The fee run for the whole club. The same fees show up per person in the Mitgliederliste (status column) and in the
 * member file (Mitgliedschaft), where invoices and payment requests are sent in the same way.
 */
const FROM_FEES = comingFrom({ label: 'Beiträge', to: '/mitglieder?tab=beitraege' })

export default function Fees() {
  const nav = useNavigate()
  const { patterns, types, fees } = useApp()
  const { send } = useFeeActions()
  const [doc, setDoc] = useState<Doc | null>(null)
  const [run, setRun] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [view, setView] = useState<View>('alle')
  const [paying, setPaying] = useState<Fee | null>(null)
  const due = fees.filter((f) => f.state === 'faellig')
  const overdue = fees.filter((f) => f.state === 'ueberfaellig')
  const rows = fees.filter((f) => view === 'alle' || f.state === view)
  const paging = usePaging(rows, view)
  const idOf = (name: string) => members.find((m) => m.name === name)?.id

  const doSend = (ids: string[], kind: Doc['kind']) => { send(ids, kind); setNote(`${ids.length} ${kind === 'Rechnung' ? 'Rechnung(en)' : 'Zahlungsaufforderung(en)'} versendet. Ist sie bezahlt, hier „Zahlung erfassen“.`); setDoc(null); setRun(false) }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Zu verrechnen" value={eur(due.reduce((n, f) => n + f.amount, 0))} hint={`${due.length} Mitglieder fällig`} />
        <Stat label="Überfällig" value={eur(overdue.reduce((n, f) => n + f.amount, 0))} tone={overdue.length ? 'bad' : undefined} hint={`${overdue.length} offen`} />
        <Stat label="Beitragsmuster" value={`${patterns.length}`} hint={`${types.length} Mitgliedschaften, unter Mitgliedschaft einrichten`} />
      </div>

      {note && <Banner>{note}</Banner>}

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div><div className="font-semibold">Beitragslauf</div><div className="text-sm text-muted">{due.length > 0 ? `${due.length} Rechnungen sind bereit. Du siehst jede einzelne, bevor sie rausgeht.` : 'Aktuell ist nichts fällig.'}</div></div>
        <Button variant="primary" disabled={due.length === 0} onClick={() => setRun(true)}><Receipt size={16} /> Rechnungen vorbereiten ({due.length})</Button>
      </Card>

      <Segmented<View> value={view} onChange={setView} options={[{ value: 'alle', label: 'Alle' }, ...(['faellig', 'rechnung', 'ueberfaellig', 'bezahlt'] as const).map((s) => ({ value: s as View, label: `${feeLabel[s]} (${fees.filter((f) => f.state === s).length})` }))]} />

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted"><tr><th className="px-4 py-3 font-medium">Mitglied</th><th className="hidden px-4 py-3 font-medium sm:table-cell">Beitrag</th><th className="px-4 py-3 text-right font-medium">Betrag</th><th className="hidden px-4 py-3 font-medium md:table-cell">Fällig</th><th className="px-4 py-3 font-medium">Status</th><th className="w-52 px-2 py-3" /></tr></thead>
          <tbody className="divide-y divide-line">
            {paging.rows.map((f) => {
              const id = idOf(f.person)
              return (
                <tr key={f.id} onClick={() => id && nav(`/mitglieder/${id}?tab=mitgliedschaft`, FROM_FEES)} className={id ? 'cursor-pointer hover:bg-slate-50' : ''}>
                  <td className="px-4 py-3"><div className="font-medium">{f.person}</div><div className="text-xs text-muted">{f.type}</div></td>
                  <td className="hidden px-4 py-3 text-muted sm:table-cell">{f.note}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{f.state === 'beendet' ? '–' : eur(f.amount)}</td>
                  <td className="hidden px-4 py-3 text-muted md:table-cell">{f.due}</td>
                  <td className="px-4 py-3"><FeeStatus f={f} /></td>
                  <td className="px-2 py-3"><div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    {f.state === 'faellig' && <Button onClick={() => setDoc({ fee: f, kind: 'Rechnung' })}>Rechnung erstellen</Button>}
                    {f.state === 'rechnung' && <Button onClick={() => setPaying(f)}>Zahlung erfassen</Button>}
                    {f.state === 'ueberfaellig' && <Button onClick={() => setDoc({ fee: f, kind: 'Zahlungsaufforderung' })}>Zahlungsaufforderung</Button>}
                    <RowMenu actions={[...(f.state === 'ueberfaellig' ? [{ label: 'Zahlung erfassen', onSelect: () => setPaying(f) }] : []), ...(f.invoice ? [{ label: 'Rechnung ansehen', onSelect: () => setDoc({ fee: f, kind: 'Rechnung' }) }] : []), ...(id ? [{ label: 'Akte öffnen', onSelect: () => nav(`/mitglieder/${id}?tab=mitgliedschaft`, FROM_FEES) }] : [])]} />
                  </div></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {paging.bar}
      </Card>

      <FeeDocDrawer doc={doc} onClose={() => setDoc(null)} onSend={doSend} />
      <FeePayDrawer fee={paying} onClose={() => setPaying(null)} />

      <Drawer open={run} title="Beitragslauf prüfen" onClose={() => setRun(false)} footer={<Button variant="primary" size="lg" className="w-full" onClick={() => doSend(due.map((f) => f.id), 'Rechnung')}>Freigeben und {due.length} Rechnungen senden</Button>}>
        <div className="space-y-3">
          <Banner>Nur Personen mit der Berechtigung „Rechnungen freigeben“ sehen den Button. Nichts geht automatisch raus.</Banner>
          {due.map((f, i) => <div key={f.id} className="flex items-center justify-between rounded-xl border border-line p-3 text-sm"><div><div className="font-medium">{f.person}</div><div className="text-xs text-muted">RE-2026-{String(150 + i).padStart(4, '0')} · {f.note}</div></div><div className="font-semibold tabular-nums">{eur(f.amount)}</div></div>)}
        </div>
      </Drawer>
    </div>
  )
}
