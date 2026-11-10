import { eur } from '../../data'
import { useApp } from '../../state'
import { Badge, Card } from '../../ui'
import { dmy } from '../manifest/data'
import { fullName, type PayProof } from '../tickets/data'

/** Guests who may fly because the confirmation of their transfer was checked: the money is still missing here and must be assigned. */
export default function AwaitingMoney() {
  const { vouchers, tickets, loads } = useApp()
  const rows: { code: string; what: string; buyer: string; price: number; proof: PayProof; flown: boolean }[] = [
    ...vouchers.filter((v) => !v.paid && v.proof && v.status !== 'cancelled').map((v) => ({ code: v.code, what: 'Gutschein', buyer: fullName(v.buyer), price: v.price, proof: v.proof!, bookingId: v.bookingId })),
    ...tickets.filter((t) => !t.paid && t.proof && t.status !== 'cancelled').map((t) => ({ code: t.code, what: 'Ticket', buyer: fullName(t.buyer), price: t.price, proof: t.proof!, bookingId: t.bookingId })),
  ].map(({ bookingId, ...r }) => ({ ...r, flown: !!bookingId && loads.some((l) => l.status === 'gelandet' && l.jumpers.some((j) => j.bookingId === bookingId && !j.noShow)) }))
  if (rows.length === 0) return null
  return (
    <Card className="px-3 py-2">
      <div className="mb-1 flex items-center justify-between text-sm font-semibold"><span>Eingang erwartet ({rows.length})</span><span className="text-xs font-normal text-muted">Nachweis geprüft, Geld fehlt noch in Finanzen</span></div>
      <ul className="divide-y divide-line text-sm">
        {rows.map((r) => (
          <li key={r.code} className="flex flex-wrap items-center gap-3 py-1.5">
            <span className="min-w-0 flex-1"><span className="font-mono">{r.code}</span> · {r.buyer} <span className="text-xs text-muted">· {r.what}, geprüft von {r.proof.by} am {dmy(r.proof.at)}{r.proof.note ? ` (${r.proof.note})` : ''}</span></span>
            {r.flown && <Badge tone="info">Schon geflogen</Badge>}
            <span className="font-medium tabular-nums">{eur(r.price)}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

