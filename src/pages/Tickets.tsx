import { useState } from 'react'
import { eur, tickets } from '../data'
import { Badge, Button, Card, Drawer, PageHeader, RowMenu, Segmented, usePaging } from '../ui'

type T = (typeof tickets)[number]

export default function Tickets() {
  const [filter, setFilter] = useState<'alle' | 'offen' | 'bald'>('alle')
  const [open, setOpen] = useState<T | null>(null)
  const list = tickets.filter((t) => filter === 'alle' || (filter === 'offen' ? t.status === 'offen' : t.status.includes('läuft ab')))
  const paging = usePaging(list, filter)
  return (
    <>
      <PageHeader title="Tickets und Voucher" actions={<Button variant="primary">Ticket ausstellen</Button>} />
      <div className="mb-4"><Segmented value={filter} onChange={setFilter} options={[{ value: 'alle', label: 'Alle' }, { value: 'offen', label: 'Noch offen' }, { value: 'bald', label: 'Laufen bald ab' }]} /></div>
      <Card className="divide-y divide-line">
        {paging.rows.map((t) => (
          <div key={t.id} onClick={() => setOpen(t)} className="flex cursor-pointer flex-wrap items-center gap-3 px-5 py-4 hover:bg-slate-50">
            <div className="min-w-0 flex-1">
              <div className="font-medium">{t.type} <span className="font-normal text-muted">· {t.id}</span></div>
              <div className="text-sm text-muted">{t.holder} · {t.source}</div>
            </div>
            <Badge tone={t.status === 'offen' ? 'info' : t.status.includes('läuft ab') ? 'warn' : 'neutral'}>{t.status}</Badge>
            <div className="w-20 text-right tabular-nums">{eur(t.price)}</div>
            <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
              {t.status === 'offen' && <Button>Für Sprungtag einlösen</Button>}
              <RowMenu actions={[{ label: 'Details', onSelect: () => setOpen(t) }, { label: 'Gültigkeit verlängern', onSelect: () => {} }, { label: 'PDF erneut senden', onSelect: () => {} }, { label: 'Stornieren', onSelect: () => {}, danger: true }]} />
            </div>
          </div>
        ))}
        {paging.bar}
      </Card>
      <Drawer open={!!open} title={open?.id ?? ''} onClose={() => setOpen(null)}>
        {open && <dl className="space-y-3 text-sm"><div><dt className="text-muted">Art</dt><dd className="font-medium">{open.type}</dd></div><div><dt className="text-muted">Inhaber</dt><dd className="font-medium">{open.holder}</dd></div><div><dt className="text-muted">Status</dt><dd className="font-medium">{open.status}</dd></div><div><dt className="text-muted">Verbuchter Ertrag</dt><dd className="font-medium">{eur(open.price)} auf Tandem</dd></div></dl>}
      </Drawer>
    </>
  )
}
