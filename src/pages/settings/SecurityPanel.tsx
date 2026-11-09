import { Check, Circle } from 'lucide-react'
import { useState } from 'react'
import { DEMO_PASSWORD } from '../../session/policy'
import { Banner, Button, Card } from '../../ui'

const inp = 'mt-1 h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-brand'

/** Change the password. The current one is needed, the rules are visible while typing, and other devices can be signed out right away. */
export default function SecurityPanel() {
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [signOutOthers, setSignOutOthers] = useState(true)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const rules = [
    { ok: next.length >= 10, label: 'Mindestens 10 Zeichen' },
    { ok: /[a-z]/.test(next) && /[A-Z]/.test(next), label: 'Groß- und Kleinbuchstaben' },
    { ok: /\d/.test(next), label: 'Mindestens eine Ziffer' },
    { ok: !!next && next === again, label: 'Beide Eingaben stimmen überein' },
  ]
  const valid = !!cur && rules.every((r) => r.ok)
  const submit = () => {
    if (cur !== DEMO_PASSWORD) return setMsg({ ok: false, text: 'Das aktuelle Passwort stimmt nicht.' })
    setCur(''); setNext(''); setAgain('')
    setMsg({ ok: true, text: `Passwort geändert.${signOutOthers ? ' Alle anderen Geräte wurden abgemeldet.' : ''} Eine Bestätigung ging per Mail an dich.` })
  }
  return (
    <div className="max-w-3xl space-y-4">
      {msg && <Banner tone={msg.ok ? 'info' : 'warn'}>{msg.text}</Banner>}
      <Card className="space-y-4 p-5">
        <div><h3 className="text-sm font-semibold">Passwort ändern</h3><p className="mt-0.5 text-xs text-muted">Zuletzt geändert vor 94 Tagen.</p></div>
        <label className="block text-sm font-medium sm:max-w-sm">Aktuelles Passwort<input type="password" value={cur} onChange={(e) => { setCur(e.target.value); setMsg(null) }} className={inp} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">Neues Passwort<input type="password" value={next} onChange={(e) => setNext(e.target.value)} className={inp} /></label>
          <label className="text-sm font-medium">Neues Passwort wiederholen<input type="password" value={again} onChange={(e) => setAgain(e.target.value)} className={inp} /></label>
        </div>
        <ul className="grid gap-1 text-sm sm:grid-cols-2">{rules.map((r) => <li key={r.label} className={`flex items-center gap-2 ${r.ok ? 'text-ok' : 'text-muted'}`}>{r.ok ? <Check size={14} /> : <Circle size={14} />}{r.label}</li>)}</ul>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={signOutOthers} onChange={(e) => setSignOutOthers(e.target.checked)} className="h-5 w-5" /> Danach auf allen anderen Geräten abmelden</label>
        <Button variant="primary" disabled={!valid} onClick={submit}>Passwort ändern</Button>
        <p className="text-xs text-muted">Dummy: Das aktuelle Passwort ist „{DEMO_PASSWORD}“.</p>
      </Card>
    </div>
  )
}
