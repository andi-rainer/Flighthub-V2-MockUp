import PrintFrame, { PRINT_PAGE } from '../../PrintFrame'
import { eur, members } from '../../data'
import { useApp } from '../../state'
import { Button, Drawer } from '../../ui'
import { textOf, type Branding, type Fee, type Lang } from './data'
import { ui } from './i18n'
import LetterHead, { LetterFoot } from './LetterHead'

export type Doc = { fee: Fee; kind: 'Rechnung' | 'Zahlungsaufforderung' }

/** Sending an invoice or a payment request. Shared by the Beiträge view and the member file, so there is one way to do it. */
export function useFeeActions() {
  const { fees, setFees } = useApp()
  const nextNo = () => `RE-2026-${String(150 + fees.filter((f) => f.invoice).length).padStart(4, '0')}`
  const send = (ids: string[], kind: Doc['kind']) => {
    setFees(fees.map((f, i) => (ids.includes(f.id) ? { ...f, state: kind === 'Rechnung' ? 'rechnung' : 'ueberfaellig', invoice: f.invoice ?? `RE-2026-${String(150 + i).padStart(4, '0')}` } : f)))
    return `${ids.length} ${kind === 'Rechnung' ? 'Rechnung(en)' : 'Zahlungsaufforderung(en)'} versendet. Die Zahlung ordnest du in Finanzen unter Bank und Belege zu.`
  }
  return { send, nextNo }
}

export function FeeDocDrawer({ doc, onClose, onSend }: { doc: Doc | null; onClose: () => void; onSend: (ids: string[], kind: Doc['kind']) => void }) {
  const { nextNo } = useFeeActions()
  const { profileOf } = useApp()
  const who = members.find((m) => m.name === doc?.fee.person)
  return (
    <Drawer open={!!doc} title={doc?.kind ?? ''} onClose={onClose} footer={doc && <div className="flex gap-2"><Button variant="primary" className="flex-1" onClick={() => onSend([doc.fee.id], doc.kind)}>Per Mail senden</Button><Button>Als PDF speichern</Button></div>}>
      {doc && <Invoice fee={doc.fee} kind={doc.kind} no={doc.fee.invoice ?? nextNo()} lang={who ? profileOf(who.id).lang : 'de'} />}
    </Drawer>
  )
}

/** The invoice with the design and text of one version of the invoice template. */
export function InvoiceSheet({ fee, kind, no, design, legal, lang = 'de' }: { fee: Fee; kind: Doc['kind']; no: string; design: Branding; legal?: string; lang?: Lang }) {
  const t = ui(lang)
  return (
    <PrintFrame name={`${kind === 'Rechnung' ? t.invoice : t.reminder} ${no}`}>
    <div {...PRINT_PAGE} className="rounded-xl border border-line bg-white p-5 text-sm shadow-sm">
      <LetterHead design={design} /><div className="mt-2 text-right"><div className="font-semibold">{kind === 'Rechnung' ? t.invoice : t.reminder}</div><div className="text-xs text-muted">{no}</div></div>
      <div className="mt-5"><div className="text-xs text-muted">{t.to}</div><div className="font-medium">{fee.person}</div></div>
      <div className="mt-5 flex justify-between border-y border-line py-3"><span>{t.fee} {fee.type}<span className="block text-xs text-muted">{fee.note}</span></span><span className="font-semibold tabular-nums">{eur(fee.amount)}</span></div>
      <div className="mt-3 flex justify-between"><span>{t.payableBy}</span><span className="font-medium">{kind === 'Rechnung' ? t.after14 : t.after7}</span></div>
      {kind === 'Zahlungsaufforderung' && <p className="mt-3 rounded-lg bg-warn-soft p-3 text-xs text-amber-900">{t.overdue(fee.due)}</p>}
      {legal && <p className="mt-3 text-xs text-muted">{legal}</p>}
      <div className="mt-4 text-xs text-muted">{design.iban ? `IBAN ${design.iban} · ` : ''}{t.paymentRef}: {no} {fee.person}</div>
      <div className="mt-4 border-t border-line pt-2"><LetterFoot design={design} /></div>
    </div>
    </PrintFrame>
  )
}

/** What is sent: the active version of the invoice template. */
export function Invoice({ fee, kind, no, lang = 'de' }: { fee: Fee; kind: Doc['kind']; no: string; lang?: Lang }) {
  const { forms } = useApp()
  const v = forms.find((x) => x.id === 'rechnung')!.versions.find((x) => x.status === 'aktiv')!
  return <div className="space-y-4"><InvoiceSheet fee={fee} kind={kind} no={no} design={v.design} legal={textOf(v, lang)} lang={lang} /></div>
}
