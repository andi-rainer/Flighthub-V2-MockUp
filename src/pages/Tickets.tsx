import clsx from 'clsx'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../ui'
import Catalog from './tickets/Catalog'
import TicketTab from './tickets/TicketTab'
import VoucherTab from './tickets/VoucherTab'

const tabs = [{ id: 'gutscheine', label: 'Gutscheine' }, { id: 'tickets', label: 'Tickets' }, { id: 'arten', label: 'Arten und Preise' }] as const

/**
 * Vouchers and tickets of the tandem shop: what was sold (two lists, kept apart) and what can be sold at which price (catalog).
 * `?open=<code>` opens one entry, e.g. from the manifest.
 */
export default function Tickets() {
  const [params, setParams] = useSearchParams()
  const tab = tabs.find((t) => t.id === params.get('tab'))?.id ?? 'gutscheine'
  const openCode = params.get('open') ?? undefined
  const go = (next: Record<string, string>) => setParams(next, { replace: true })
  const onOpen = (code?: string) => go(code ? { tab, open: code } : { tab })

  return (
    <>
      <PageHeader title="Tickets und Voucher" />
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t) => <button key={t.id} onClick={() => go({ tab: t.id })} className={clsx('shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium', tab === t.id ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink')}>{t.label}</button>)}
      </div>
      {tab === 'gutscheine' ? <VoucherTab openCode={openCode} onOpen={onOpen} /> : tab === 'tickets' ? <TicketTab openCode={openCode} onOpen={onOpen} /> : <Catalog />}
    </>
  )
}
