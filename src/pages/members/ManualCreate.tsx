import clsx from 'clsx'
import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { eur, type Member } from '../../data'
import { useApp } from '../../state'
import { Banner, Button, Drawer } from '../../ui'
import { useSession } from '../../session/session'
import { fmtDate, parseDate } from './data'

const inp = 'h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-brand'
const reasons = ['Test des Systems', 'Schulung oder Vorführung', 'Datenübernahme aus dem alten System', 'Vorstandsbeschluss']

/**
 * Creating a person WITHOUT a form is the exception (test accounts, data take-over). The normal way is an admission application:
 * it is signed and stored as PDF. Here there is no signature and no PDF, so it asks what and why, shows a summary, needs one more
 * explicit confirmation, and the person is marked in the list, the member file and the history with the reason.
 */
export default function ManualCreate({ open, onClose, onAdmission }: { open: boolean; onClose: () => void; onAdmission: () => void }) {
  const nav = useNavigate()
  const { types, addMember } = useApp()
  const { guarded } = useSession()
  const choices = types.filter((t) => !t.checkin)
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [email, setEmail] = useState('')
  const [typeId, setTypeId] = useState('')
  const [from, setFrom] = useState('2026-11-07')
  const [reason, setReason] = useState('')
  const [phase, setPhase] = useState<'form' | 'confirm' | 'done'>('form')
  const [sure, setSure] = useState(false)
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null)

  const type = choices.find((t) => t.id === typeId)
  const name = `${first.trim()} ${last.trim()}`.trim()
  const mailOk = /^\S+@\S+\.\S+$/.test(email.trim())
  const ok = !!first.trim() && !!last.trim() && mailOk && !!type && !!from && reason.trim().length >= 10
  const reset = () => { setPhase('form'); setSure(false); setFirst(''); setLast(''); setEmail(''); setTypeId(''); setReason(''); setCreated(null) }
  const close = () => { reset(); onClose() }
  const apply = () => guarded('members.create', () => {
    const at = fmtDate(parseDate(from))
    const m: Member = { id: `m-${Date.now()}`, type: 'ord', name, functions: [], balance: 0, membership: 'aktiv', docs: [], manual: { reason: reason.trim(), at, by: 'Du' } }
    addMember(m, type!.id, { first: first.trim(), last: last.trim(), email: email.trim() }, { from: at, reason: reason.trim() })
    setCreated({ id: m.id, name })
    setPhase('done')
  })

  return (
    <Drawer open={open} title="Person ohne Formular anlegen" onClose={close} size="xl"
      footer={phase === 'form' ? <Button variant="primary" size="lg" className="w-full" disabled={!ok} onClick={() => setPhase('confirm')}>Weiter zur Bestätigung</Button>
        : phase === 'confirm' ? <div className="flex gap-2"><Button size="lg" onClick={() => { setPhase('form'); setSure(false) }}>Zurück</Button><Button variant="danger" size="lg" className="flex-1" disabled={!sure} onClick={apply}>Jetzt ohne Formular anlegen</Button></div>
        : <div className="flex gap-2"><Button size="lg" onClick={close}>Fertig</Button><Button variant="primary" size="lg" className="flex-1" onClick={() => { const id = created!.id; close(); nav(`/mitglieder/${id}`) }}>Akte öffnen</Button></div>}>
      {phase === 'done' ? (
        <Banner>Angelegt: {created?.name}. Eine Einladung mit Zugangslink ging an {email.trim()}. Die Ausnahme steht mit Grund und deinem Namen im Verlauf der Person.</Banner>
      ) : phase === 'confirm' ? (
        <div className="space-y-4">
          <Banner tone="warn"><span className="flex items-start gap-2"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>Bitte noch einmal prüfen. Ohne Formular gibt es <b>keine Unterschrift und kein PDF</b>. Das ist die Ausnahme.</span></span></Banner>
          <div className="divide-y divide-line rounded-xl border border-line text-sm">
            <Row k="Person" v={name} />
            <Row k="E-Mail (Einladung)" v={email.trim()} />
            <Row k="Mitgliedschaft" v={`${type?.name} · ${eur(type?.amount ?? 0)}`} />
            <Row k="Mitglied ab" v={fmtDate(parseDate(from))} />
            <div className="px-4 py-3"><div className="text-muted">Grund</div><div className="mt-0.5 font-medium">{reason.trim()}</div></div>
          </div>
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} className="mt-0.5 h-5 w-5" />Ich bestätige das Anlegen ohne Formular. Es wird mit meinem Namen, dem Zeitpunkt und dem Grund protokolliert.</label>
        </div>
      ) : (
        <div className="space-y-6">
          <Banner><span className="block"><b>Normalerweise läuft die Aufnahme über ein Formular.</b> Es wird unterschrieben und als PDF abgelegt. Nimm diesen Weg nur, wenn das nicht geht, zum Beispiel für einen Testzugang oder eine Datenübernahme.</span><button onClick={() => { close(); onAdmission() }} className="mt-2 font-medium underline">Stattdessen Aufnahme-Antrag erstellen</button></Banner>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">1 · Wer wird angelegt?</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">Vorname<input value={first} onChange={(e) => setFirst(e.target.value)} className={clsx(inp, 'mt-1')} /></label>
              <label className="text-sm font-medium">Nachname<input value={last} onChange={(e) => setLast(e.target.value)} className={clsx(inp, 'mt-1')} /></label>
            </div>
            <label className="block text-sm font-medium">E-Mail für die Einladung<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.at" className={clsx(inp, 'mt-1')} /></label>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">2 · Mitgliedschaft und Beginn</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {choices.map((t) => (
                <button key={t.id} onClick={() => setTypeId(t.id)} className={clsx('rounded-xl border p-3 text-left text-sm', typeId === t.id ? 'border-brand bg-brand-soft' : 'border-line hover:bg-slate-50')}>
                  <div className="flex items-baseline justify-between gap-2 font-medium">{t.name}<span className="tabular-nums">{eur(t.amount)}</span></div>
                  <div className="mt-0.5 text-xs text-muted">{t.account ? 'mit Betriebskonto' : 'ohne Betriebskonto'}</div>
                </button>
              ))}
            </div>
            <label className="block text-sm font-medium">Mitglied ab<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={clsx(inp, 'mt-1 max-w-48')} /></label>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">3 · Grund (Pflicht)</h3>
            <div className="flex flex-wrap gap-2">{reasons.map((r) => <button key={r} onClick={() => setReason(r)} className={clsx('rounded-lg border px-3 py-1.5 text-sm', reason === r ? 'border-brand bg-brand-soft text-brand' : 'border-line hover:bg-slate-50')}>{r}</button>)}</div>
            <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Warum geht das nicht mit einem Formular? Mindestens 10 Zeichen." className="w-full rounded-lg border border-line p-3 text-sm outline-none focus:border-brand" />
          </section>
        </div>
      )}
    </Drawer>
  )
}

const Row = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between gap-3 px-4 py-3"><span className="text-muted">{k}</span><span className="font-medium">{v}</span></div>
