import { ChevronRight, Download, Plus } from 'lucide-react'
import { useState } from 'react'
import { eur } from '../../data'
import { useSession } from '../../session/session'
import { TODAY_ISO, useApp } from '../../state'
import { Badge, Button, Card, Segmented, usePaging } from '../../ui'
import { dayName, dmy, windowLabel } from '../manifest/data'
import { daysLeft, expiresSoon, fullName, PAY_NAME, VOUCHER_STATUS, type Voucher, type VoucherStatus } from './data'
import { downloadCsv, FilterBar, inRange, matches, NO_FILTERS, type Filters } from './parts'
import NewVoucher from './NewVoucher'
import VoucherDetail, { type VoucherAction } from './VoucherDetail'

type Quick = 'alle' | 'offen' | 'bald' | 'zahlung'
const QUICK: { value: Quick; label: string; test: (v: Voucher) => boolean }[] = [
  { value: 'alle', label: 'Alle', test: () => true },
  { value: 'offen', label: 'Ohne Termin', test: (v) => v.status === 'active' || v.status === 'pre_scheduled' },
  { value: 'bald', label: 'Laufen bald ab', test: (v) => expiresSoon(v, TODAY_ISO) },
  { value: 'zahlung', label: 'Zahlung offen', test: (v) => !v.paid && v.status !== 'cancelled' },
]
/** The one action a row offers in its last column: the usual next step. Everything else is in the detail view. */
const next = (v: Voucher): { label: string; action: VoucherAction } | null =>
  v.status === 'unpaid' ? { label: 'Zahlung erfassen', action: 'pay' } : v.status === 'active' || v.status === 'pre_scheduled' ? { label: 'Termin buchen', action: 'redeem' } : null

/** All vouchers: search, filter, open one for its facts, actions and history. */
export default function VoucherTab({ openCode, onOpen }: { openCode?: string; onOpen: (code?: string) => void }) {
  const { vouchers, catalog, bookings, days, can } = useApp()
  const { guarded } = useSession()
  const [f, setF] = useState<Filters>(NO_FILTERS)
  const [quick, setQuick] = useState<Quick>('alle')
  const [action, setAction] = useState<VoucherAction | undefined>()
  const [creating, setCreating] = useState(false)
  const test = QUICK.find((q) => q.value === quick)!.test
  const list = vouchers
    .filter((v) => test(v) && matches(f.q, v.code, fullName(v.buyer), v.buyer.email) && (f.status.length === 0 || f.status.includes(v.status)) && (!f.type || v.typeId === f.type) && (!f.pay || (f.pay === 'paid') === v.paid) && inRange(v.bought, f.from, f.to))
    .sort((a, b) => b.bought.localeCompare(a.bought) || b.code.localeCompare(a.code))
  const paging = usePaging(list, JSON.stringify([f, quick]))
  /** Day and window of the booking in the manifest, or the pencilled wish day. */
  const dateOf = (v: Voucher) => {
    const b = bookings.find((x) => x.id === v.bookingId && x.state !== 'storniert')
    const day = days.find((d) => d.id === b?.dayId)
    const win = day?.windows.find((w) => w.id === b?.windowId)
    return day ? { day: dayName(day.date), window: win ? windowLabel(win) : 'ohne Fenster', wish: false } : v.wishDay ? { day: dayName(v.wishDay), window: 'Wunsch, kein Platz belegt', wish: true } : null
  }
  const typeName = (id: string) => catalog.find((c) => c.id === id)?.name ?? '?'
  const open = (code: string, a?: VoucherAction) => { setAction(a); onOpen(code) }

  const exportCsv = () => guarded('vouchers.export', () => downloadCsv('gutscheine.csv', ['Code', 'Art', 'Status', 'Käufer', 'E-Mail', 'Gekauft', 'Gültig bis', 'Preis', 'Zahlung', 'Bezahlt'],
    list.map((v) => [v.code, typeName(v.typeId), VOUCHER_STATUS[v.status].label, fullName(v.buyer), v.buyer.email, dmy(v.bought), dmy(v.validUntil), v.price, PAY_NAME[v.pay], v.paid ? 'ja' : 'nein'])))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented value={quick} onChange={setQuick} options={QUICK.map((q) => ({ value: q.value, label: `${q.label} (${vouchers.filter(q.test).length})` }))} />
        <div className="flex gap-2">
          {can('vouchers.export') && <Button onClick={exportCsv}><Download size={14} /> Exportieren</Button>}
          {can('vouchers.create') && <Button variant="primary" onClick={() => setCreating(true)}><Plus size={14} /> Gutschein ausstellen</Button>}
        </div>
      </div>
      <FilterBar f={f} onChange={setF} count={list.length} dateLabel="Gekauft"
        statuses={(Object.keys(VOUCHER_STATUS) as VoucherStatus[]).map((s) => ({ value: s, label: VOUCHER_STATUS[s].label }))}
        types={catalog.filter((c) => c.kind === 'voucher').map((c) => ({ value: c.id, label: c.name }))} />
      <Card className="divide-y divide-line">
        {paging.rows.map((v) => {
          const n = next(v)
          const left = daysLeft(v.validUntil, TODAY_ISO)
          const when = dateOf(v)
          return (
            <div key={v.code} onClick={() => open(v.code)} className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 hover:bg-slate-50">
              <div className="min-w-0 flex-1 basis-56">
                <div className="font-medium"><span className="font-mono">{v.code}</span> <span className="font-normal text-muted">· {typeName(v.typeId)}</span></div>
                <div className="truncate text-sm text-muted">{fullName(v.buyer)} · {v.buyer.email}</div>
              </div>
              <div className="w-36 text-sm"><Badge tone={VOUCHER_STATUS[v.status].tone}>{VOUCHER_STATUS[v.status].label}</Badge><div className={expiresSoon(v, TODAY_ISO) ? 'mt-0.5 text-xs font-medium text-warn' : 'mt-0.5 text-xs text-muted'}>bis {dmy(v.validUntil)}{expiresSoon(v, TODAY_ISO) && ` · noch ${left} ${left === 1 ? 'Tag' : 'Tage'}`}</div></div>
              <div className="w-40 text-sm">{when ? <><div className={when.wish ? 'text-muted' : 'font-medium'}>{when.day}</div><div className="text-xs text-muted">{when.window}</div></> : <span className="text-muted">–</span>}</div>
              <div className="w-28 text-right text-sm"><div className="font-semibold tabular-nums">{eur(v.price)}</div><div className={v.paid ? 'text-xs text-muted' : v.proof ? 'text-xs font-medium text-warn' : 'text-xs font-medium text-bad'}>{v.paid ? PAY_NAME[v.pay] : v.proof ? 'Nachweis geprüft, Eingang offen' : 'Zahlung offen'}</div></div>
              <div className="flex w-40 justify-end" onClick={(e) => e.stopPropagation()}>{n && can('vouchers.manage') ? <Button onClick={() => open(v.code, n.action)}>{n.label}</Button> : <ChevronRight size={16} className="text-muted" />}</div>
            </div>
          )
        })}
        {list.length === 0 && <p className="px-5 py-8 text-center text-sm text-muted">Kein Gutschein passt zu den Filtern.</p>}
        {paging.bar}
      </Card>
      {openCode && <VoucherDetail key={`${openCode}-${action}`} code={openCode} initial={action} onClose={() => { setAction(undefined); onOpen(undefined) }} />}
      {creating && <NewVoucher onClose={() => setCreating(false)} onCreated={(code) => { setCreating(false); open(code) }} />}
    </div>
  )
}
