import clsx from 'clsx'
import { FileText } from 'lucide-react'
import { eur, members } from '../data'
import { useApp } from '../state'
import { Card, PageHeader } from '../ui'

/** Strictly the own account. Looking at other accounts needs the permission of the treasurer (Mitglieder or Finanzen). */
export default function MyAccount() {
  const { persona, ledger, can } = useApp()
  const m = members.find((x) => x.id === persona.memberId)!
  const balance = ledger.balances[m.id] ?? 0
  const history = ledger.history[m.id] ?? []

  return (
    <>
      <PageHeader title="Mein Konto" subtitle={m.name} />
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <div className="space-y-5">
          <Card className="p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-muted">Kontostand</div>
            <div className={clsx('mt-1 text-3xl font-semibold tabular-nums', balance < 0 && 'text-bad')}>{eur(balance)}</div>
            <p className="mt-1 text-sm text-muted">{balance < 0 ? 'Offener Betrag.' : balance > 0 ? 'Guthaben, wird mit den nächsten Sprüngen verbraucht.' : 'Ausgeglichen.'}</p>
          </Card>
          <Card className="space-y-2 p-5 text-sm">
            <div className="font-semibold">Einzahlen</div>
            <p className="text-muted">Du kannst jederzeit einzahlen, auch im Voraus, zum Beispiel vor einem Sprungwochenende. Bar beim Kassier oder per Überweisung:</p>
            <div className="rounded-lg bg-slate-50 p-3">IBAN AT12 3456 7890 1234 5678<br />Verwendungszweck: <b>Betriebskonto {m.name}</b></div>
            <p className="text-xs text-muted">Überweisungen erscheinen hier, sobald der Kassier sie zugeordnet hat.</p>
          </Card>
          <Card className="p-5 text-sm">
            <div className="mb-2 font-semibold">Kontoauszüge</div>
            <div className="divide-y divide-line">
              <div className="flex items-center justify-between py-2"><span className="inline-flex items-center gap-2"><FileText size={14} />September 2026</span><span className="text-muted">PDF</span></div>
              <div className="flex items-center justify-between py-2 text-muted"><span className="inline-flex items-center gap-2"><FileText size={14} />Oktober 2026</span><span>kommt nach Freigabe</span></div>
            </div>
          </Card>
        </div>
        <Card className="self-start">
          <div className="border-b border-line px-5 py-3 font-semibold">Buchungen</div>
          <div className="divide-y divide-line">
            {history.map((e, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className={clsx(e.reversed && 'text-muted line-through')}><span className="text-muted">{e.date}</span> {e.text}</span>
                <span className={clsx('font-medium tabular-nums', e.amount < 0 ? 'text-bad' : 'text-ok')}>{e.amount > 0 ? '+ ' : '− '}{eur(Math.abs(e.amount))}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}
