import clsx from 'clsx'
import { AlertCircle, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { eur } from '../../data'
import { dm } from './data'
import { useDayCheck } from './dayCheck'

/**
 * [Entwurf] The in-app copy of the mail "Konto im Minus": shown to a member whose Betriebskonto is in minus after a Sprungtag.
 * Only the newest message counts. `to` is where topping up happens (Mein Konto); on Mein Konto itself `onTopUp` opens the deposit instead.
 */
export default function MinusNotice({ memberId, to = '/mein-konto', onTopUp, className }: { memberId: string; to?: string; onTopUp?: () => void; className?: string }) {
  const msg = useDayCheck().messages.find((m) => m.memberId === memberId)
  if (!msg) return null
  return (
    <div role="status" className={clsx('flex flex-wrap items-center gap-3 rounded-xl border border-bad/30 bg-bad-soft px-4 py-3', className)}>
      <AlertCircle size={20} className="shrink-0 text-bad" />
      <span className="min-w-0 flex-1 basis-60 text-sm text-ink">Dein Konto ist im Minus: <b className="tabular-nums text-bad">{eur(msg.balance)}</b> nach dem Sprungtag {dm(msg.dayDate)}</span>
      {onTopUp
        ? <button onClick={onTopUp} className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand">Jetzt einzahlen <ArrowRight size={15} /></button>
        : <Link to={to} className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand">Jetzt einzahlen <ArrowRight size={15} /></Link>}
    </div>
  )
}
