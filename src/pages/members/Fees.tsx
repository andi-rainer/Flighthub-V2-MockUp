import { Receipt } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { eur, members } from '../../data'
import { comingFrom } from '../../backTo'
import { useApp } from '../../state'
import { Badge, Banner, Button, Card, Drawer, RowMenu, Segmented, Stat, usePaging } from '../../ui'
import { feeIsOpen, feeLabel, feeTone } from './data'
import { FeeDocDrawer, useFeeActions, type Doc } from './FeeDoc'

type View = 'alle' | 'offen' | 'bezahlt'

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
  const due = fees.filter((f) => f.state === 'faellig')
  const overdue = fees.filter((f) => f.state === 'ueberfaellig')
  const rows = fees.filter((f) => view === 'alle' || (view === 'offen' ? feeIsOpen(f) : f.state === 'bezahlt'))
  const paging = usePaging(rows, view)
  const idOf = (name: string) => members.find((m) => m.name === name)?.id

  const doSend = (ids: string[], kind: Doc['kind']) => { setNote(send(ids, kind)); setDoc(null); setRun(false) }

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

      <Segmented<View> value={view} onChange={setView} options={[{ value: 'alle', label: 'Alle' }, { value: 'offen', label: `Offen (${fees.filter(feeIsOpen).length})` }, { value: 'bezahlt', label: 'Bezahlt' }]} />

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
                  <td className="px-4 py-3"><Badge tone={feeTone[f.state]}>{feeLabel[f.state]}</Badge>{f.invoice && <div className="mt-0.5 text-xs text-muted">{f.invoice}</div>}</td>
                  <td className="px-2 py-3"><div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    {f.state === 'faellig' && <Button onClick={() => setDoc({ fee: f, kind: 'Rechnung' })}>Rechnung erstellen</Button>}
                    {f.state === 'ueberfaellig' && <Button onClick={() => setDoc({ fee: f, kind: 'Zahlungsaufforderung' })}>Zahlungsaufforderung</Button>}
                    <RowMenu actions={[...(f.invoice ? [{ label: 'Rechnung ansehen', onSelect: () => setDoc({ fee: f, kind: 'Rechnung' }) }] : []), ...(id ? [{ label: 'Akte öffnen', onSelect: () => nav(`/mitglieder/${id}?tab=mitgliedschaft`, FROM_FEES) }] : [])]} />
                  </div></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {paging.bar}
      </Card>

      <FeeDocDrawer doc={doc} onClose={() => setDoc(null)} onSend={doSend} />

      <Drawer open={run} title="Beitragslauf prüfen" onClose={() => setRun(false)} footer={<Button variant="primary" size="lg" className="w-full" onClick={() => doSend(due.map((f) => f.id), 'Rechnung')}>Freigeben und {due.length} Rechnungen senden</Button>}>
        <div className="space-y-3">
          <Banner>Nur Personen mit der Berechtigung „Rechnungen freigeben“ sehen den Button. Nichts geht automatisch raus.</Banner>
          {due.map((f, i) => <div key={f.id} className="flex items-center justify-between rounded-xl border border-line p-3 text-sm"><div><div className="font-medium">{f.person}</div><div className="text-xs text-muted">RE-2026-{String(150 + i).padStart(4, '0')} · {f.note}</div></div><div className="font-semibold tabular-nums">{eur(f.amount)}</div></div>)}
        </div>
      </Drawer>
    </div>
  )
}
