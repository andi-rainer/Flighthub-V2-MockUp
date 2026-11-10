import { ChevronRight, Download, Plus } from 'lucide-react'
import { useState } from 'react'
import { eur } from '../../data'
import { useSession } from '../../session/session'
import { TODAY_ISO, useApp } from '../../state'
import { Badge, Button, Card, Segmented, usePaging } from '../../ui'
import { dayName, dmy } from '../manifest/data'
import { fullName, PAY_NAME, refundOpen, TICKET_STATUS, type Ticket, type TicketStatus } from './data'
import NewTicket from './NewTicket'
import { downloadCsv, FilterBar, inRange, matches, NO_FILTERS, type Filters } from './parts'
import TicketDetail, { type TicketAction } from './TicketDetail'

type Quick = 'alle' | 'kommend' | 'zahlung' | 'erstattung'
const QUICK: { value: Quick; label: string; test: (t: Ticket) => boolean }[] = [
  { value: 'alle', label: 'Alle', test: () => true },
  { value: 'kommend', label: 'Kommende', test: (t) => t.status === 'booked' && t.day >= TODAY_ISO },
  { value: 'zahlung', label: 'Zahlung offen', test: (t) => !t.paid && t.status !== 'cancelled' },
  { value: 'erstattung', label: 'Erstattung offen', test: refundOpen },
]
/** The one action a row offers in its last column: the usual next step. Everything else is in the detail view. */
const next = (t: Ticket): { label: string; action: TicketAction } | null =>
  refundOpen(t) ? { label: 'Erstattung erfassen', action: 'refund' } : !t.paid && t.status !== 'cancelled' ? { label: 'Zahlung erfassen', action: 'pay' } : t.status === 'booked' && t.day >= TODAY_ISO ? { label: 'Umbuchen', action: 'move' } : null

/** All tickets (tandem bookings bought for a day): search, filter, open one for facts, actions and history. */
export default function TicketTab({ openCode, onOpen }: { openCode?: string; onOpen: (code?: string) => void }) {
  const { tickets, catalog, can } = useApp()
  const { guarded } = useSession()
  const [f, setF] = useState<Filters>(NO_FILTERS)
  const [quick, setQuick] = useState<Quick>('alle')
  const [action, setAction] = useState<TicketAction | undefined>()
  const [creating, setCreating] = useState(false)
  const test = QUICK.find((q) => q.value === quick)!.test
  const list = tickets
    .filter((t) => test(t) && matches(f.q, t.code, t.guest, fullName(t.buyer), t.buyer.email) && (f.status.length === 0 || f.status.includes(t.status)) && (!f.type || t.typeId === f.type) && (!f.pay || (f.pay === 'paid') === t.paid) && inRange(t.day, f.from, f.to))
    .sort((a, b) => b.day.localeCompare(a.day) || b.code.localeCompare(a.code))
  const paging = usePaging(list, JSON.stringify([f, quick]))
  const typeName = (id: string) => catalog.find((c) => c.id === id)?.name ?? '?'
  const open = (code: string, a?: TicketAction) => { setAction(a); onOpen(code) }

  const exportCsv = () => guarded('vouchers.export', () => downloadCsv('tickets.csv', ['Code', 'Art', 'Status', 'Gast', 'Käufer', 'E-Mail', 'Sprungtag', 'Fenster', 'Preis', 'Zahlung', 'Bezahlt', 'Erstattet'],
    list.map((t) => [t.code, typeName(t.typeId), TICKET_STATUS[t.status].label, t.guest, fullName(t.buyer), t.buyer.email, dmy(t.day), t.windowLabel, t.price, PAY_NAME[t.pay], t.paid ? 'ja' : 'nein', t.refunded ? 'ja' : 'nein'])))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented value={quick} onChange={setQuick} options={QUICK.map((q) => ({ value: q.value, label: `${q.label} (${tickets.filter(q.test).length})` }))} />
        <div className="flex gap-2">
          {can('vouchers.export') && <Button onClick={exportCsv}><Download size={14} /> Exportieren</Button>}
          {can('vouchers.create') && <Button variant="primary" onClick={() => setCreating(true)}><Plus size={14} /> Ticket ausstellen</Button>}
        </div>
      </div>
      <FilterBar f={f} onChange={setF} count={list.length} dateLabel="Sprungtag"
        statuses={(Object.keys(TICKET_STATUS) as TicketStatus[]).map((s) => ({ value: s, label: TICKET_STATUS[s].label }))}
        types={catalog.filter((c) => c.kind === 'ticket').map((c) => ({ value: c.id, label: c.name }))} />
      <Card className="divide-y divide-line">
        {paging.rows.map((t) => {
          const n = next(t)
          return (
            <div key={t.code} onClick={() => open(t.code)} className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 hover:bg-slate-50">
              <div className="min-w-0 flex-1 basis-56">
                <div className="font-medium"><span className="font-mono">{t.code}</span> <span className="font-normal text-muted">· {typeName(t.typeId)}</span></div>
                <div className="truncate text-sm text-muted">{t.guest}{fullName(t.buyer) !== t.guest ? ` · gebucht von ${fullName(t.buyer)}` : ''} · {t.buyer.email}</div>
              </div>
              <div className="flex w-36 flex-wrap gap-1"><Badge tone={TICKET_STATUS[t.status].tone}>{TICKET_STATUS[t.status].label}</Badge>{t.refunded && <Badge tone="ok">Erstattet</Badge>}</div>
              <div className="w-32 text-sm"><div>{dayName(t.day)}</div><div className="text-xs text-muted">{t.windowLabel}</div></div>
              <div className="w-28 text-right text-sm"><div className="font-semibold tabular-nums">{eur(t.price)}</div><div className={t.paid || t.status === 'cancelled' ? 'text-xs text-muted' : t.proof ? 'text-xs font-medium text-warn' : 'text-xs font-medium text-bad'}>{t.paid ? PAY_NAME[t.pay] : t.status === 'cancelled' ? 'nicht bezahlt' : t.proof ? 'Nachweis geprüft, Eingang offen' : 'Zahlung offen'}</div></div>
              <div className="flex w-40 justify-end" onClick={(e) => e.stopPropagation()}>{n && can('vouchers.manage') ? <Button onClick={() => open(t.code, n.action)}>{n.label}</Button> : <ChevronRight size={16} className="text-muted" />}</div>
            </div>
          )
        })}
        {list.length === 0 && <p className="px-5 py-8 text-center text-sm text-muted">Kein Ticket passt zu den Filtern.</p>}
        {paging.bar}
      </Card>
      {openCode && <TicketDetail key={`${openCode}-${action}`} code={openCode} initial={action} onClose={() => { setAction(undefined); onOpen(undefined) }} />}
      {creating && <NewTicket onClose={() => setCreating(false)} onCreated={(code) => { setCreating(false); open(code) }} />}
    </div>
  )
}
