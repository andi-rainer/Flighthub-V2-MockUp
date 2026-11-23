import { Copy, Loader2, Mail, Smartphone, Upload } from 'lucide-react'
import { useState } from 'react'
import { Badge, Button, Card, Drawer, RowMenu, usePaging } from '../../ui'
import { dmy } from '../manifest/data'
import { fakeRead } from './capture'
import { INBOX_ADDRESS, useInbox, type InboxItem } from './inbox'
import { type Ledger } from './ledger'
import { openReceiptFile } from './parts'
import { duplicatesOf, ReceiptForm } from './ReceiptDialogs'

const icon = (from: string) => (from === 'Handy-Scan' ? <Smartphone size={14} /> : from === 'Upload' ? <Upload size={14} /> : <Mail size={14} />)

/**
 * [Entwurf] Belegeingang: what was mailed to the club's receipt address, uploaded or scanned and is not a receipt yet. The data is read at
 * once; "Daten prüfen" opens the receipt with the read data, saving it makes it an invoice. A file that is no invoice is discarded.
 */
export default function Inbox({ ledger }: { ledger: Ledger }) {
  const inbox = useInbox()
  const [open, setOpen] = useState<InboxItem | null>(null)
  const [discard, setDiscard] = useState<InboxItem | null>(null)
  const [copied, setCopied] = useState(false)
  const paging = usePaging(inbox.list, String(inbox.list.length))
  const check = (x: InboxItem) => { if (!x.read) inbox.readNow(x.id); setOpen(x) }
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <Mail size={15} /> <span className="font-medium text-ink">{INBOX_ADDRESS}</span>
        <button onClick={() => { void navigator.clipboard?.writeText(INBOX_ADDRESS); setCopied(true); setTimeout(() => setCopied(false), 1500) }} className="inline-flex items-center gap-1 text-brand"><Copy size={13} /> {copied ? 'Kopiert' : 'Kopieren'}</button>
      </div>
      <Card className="divide-y divide-line">
        {paging.rows.map((x) => {
          const dup = x.read ? duplicatesOf(ledger, x.read).length > 0 : false
          return (
            <div key={x.id} role="button" tabIndex={0} onClick={() => check(x)} onKeyDown={(e) => e.key === 'Enter' && check(x)} className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 border-l-4 border-l-warn px-4 py-2.5 text-sm hover:bg-slate-50">
              <div className="w-20 text-xs text-muted">{dmy(x.at)}</div>
              <div className="min-w-0 flex-1 basis-56">
                <div className="truncate font-medium">{x.read ? `${x.read.supplier}${x.read.number ? ` · ${x.read.number}` : ''}` : x.file}</div>
                <div className="flex items-center gap-1.5 truncate text-xs text-muted">{icon(x.from)} {x.from}{x.read && ` · ${x.file}`}</div>
              </div>
              {dup && <Badge tone="bad">Mögliches Duplikat</Badge>}
              {x.read ? <span className="w-24 text-right font-semibold tabular-nums">€ {x.read.total}</span> : <span className="inline-flex items-center gap-1.5 text-xs text-muted"><Loader2 size={13} className="animate-spin" /> Noch nicht gelesen</span>}
              <Button variant="primary" onClick={() => check(x)}>Daten prüfen</Button>
              <RowMenu actions={[{ label: 'Datei öffnen', onSelect: () => openReceiptFile(x.file) }, { label: 'Verwerfen', danger: true, onSelect: () => setDiscard(x) }]} />
            </div>
          )
        })}
        {inbox.list.length === 0 && <p className="p-6 text-center text-sm text-muted">Der Eingang ist leer.</p>}
        {inbox.list.length > 25 && paging.bar}
      </Card>
      {open && <ReceiptForm ledger={ledger} start={open.read ?? fakeRead(open.file, false)} onSaved={() => inbox.remove(open.id)} onClose={() => setOpen(null)} />}
      {discard && (
        <Drawer open title="Datei verwerfen" onClose={() => setDiscard(null)} footer={<div className="flex justify-end gap-2"><Button onClick={() => setDiscard(null)}>Abbrechen</Button><Button variant="danger" onClick={() => { inbox.remove(discard.id); setDiscard(null) }}>Verwerfen</Button></div>}>
          <div className="space-y-2 text-sm"><div className="font-medium">{discard.file}</div><div className="text-muted">{discard.from} · {dmy(discard.at)}</div><p>Die Datei ist keine Rechnung und wird aus dem Eingang entfernt.</p></div>
        </Drawer>
      )}
    </>
  )
}
