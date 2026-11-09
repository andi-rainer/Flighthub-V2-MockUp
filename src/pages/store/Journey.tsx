import { Mail as MailIcon, Package, Type } from 'lucide-react'
import { Card } from '../../ui'
import { mails, shopPages } from './data'
import { isSent, type MailState } from './Mails'

export interface Nav { text: (page: string) => void; mail: (id: string) => void; tab: (t: 'produkte' | 'einstellungen') => void }

const steps = [
  { n: 1, title: 'Kunde kommt in den Shop', sees: 'Startseite mit drei Karten', pages: ['home'], mails: [] as string[], tab: null },
  { n: 2, title: 'Er wählt und bezahlt', sees: 'Produkte, AGB, Pflichtangaben, Zahlung', pages: ['vouchers', 'bookings', 'checkout'], mails: [], tab: 'produkte' as const },
  { n: 3, title: 'Nach dem Kauf', sees: 'Danke-Seite', pages: ['success'], mails: ['ticket', 'voucher'], tab: null },
  { n: 4, title: 'Der Termin steht', sees: 'Terminwahl, Einlösen', pages: [], mails: ['redemption', 'booking_assigned', 'booking_rescheduled'], tab: null },
  { n: 5, title: 'Am Sprungtag', sees: 'Kiosk und Boarding', pages: [], mails: ['operation_day_active', 'flight_ready', 'signed_agreement_customer', 'jump_completed'], tab: null },
  { n: 6, title: 'Wenn etwas schiefgeht', sees: 'Absage, Umbuchung', pages: [], mails: ['operation_day_cancelled', 'booking_cancelled_operator', 'booking_cancelled_contact'], tab: null },
]

export default function Journey({ nav, state }: { nav: Nav; state: MailState }) {
  return (
    <ol className="relative max-w-3xl space-y-3 before:absolute before:bottom-6 before:left-[19px] before:top-6 before:w-px before:bg-line">
      {steps.map((s) => (
        <li key={s.n} className="relative pl-12">
          <span className="absolute left-0 top-4 grid h-10 w-10 place-items-center rounded-full border-2 border-line bg-surface text-sm font-semibold text-muted">{s.n}</span>
          <Card className="p-4">
            <div className="font-semibold">{s.title}</div>
            <div className="text-sm text-muted">{s.sees}</div>
            <div className="mt-3 space-y-2">
              {s.pages.length > 0 && (
                <Row icon={<Type size={14} />} label="Texte">
                  {s.pages.map((p) => <Chip key={p} onClick={() => nav.text(p)}>{shopPages.find((x) => x.id === p)!.label}</Chip>)}
                </Row>
              )}
              {s.tab && <Row icon={<Package size={14} />} label="Produkte"><Chip onClick={() => nav.tab('produkte')}>Preise, Texte und PDF-Vorlagen</Chip></Row>}
              {s.mails.length > 0 && (
                <Row icon={<MailIcon size={14} />} label="Mails">
                  {s.mails.map((id) => {
                    const m = mails.find((x) => x.id === id)!
                    return <Chip key={id} onClick={() => nav.mail(id)}><i className={`mr-1.5 inline-block h-2 w-2 rounded-full ${isSent(m, state) ? 'bg-ok' : 'bg-slate-300'}`} />{m.name}</Chip>
                  })}
                </Row>
              )}
            </div>
          </Card>
        </li>
      ))}
    </ol>
  )
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2"><span className="flex w-20 items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">{icon}{label}</span>{children}</div>
}
function Chip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button onClick={onClick} className="inline-flex items-center rounded-lg border border-line bg-surface px-2.5 py-1 text-sm hover:border-brand hover:text-brand">{children}</button>
}
