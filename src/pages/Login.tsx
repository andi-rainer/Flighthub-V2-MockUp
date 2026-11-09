
import { useState } from 'react'
import clsx from 'clsx'
import { members } from '../data'
import { initialAssignments, useApp } from '../state'
import { DEMO_PASSWORD, STEP_UP_POLICY } from '../session/policy'
import QrChallenge from '../session/QrChallenge'
import { useSession } from '../session/session'
import { Banner, Button, Card, Logo } from '../ui'

const accounts = ['m5', 'm8', 'm2', 'm3', 'm1']
type Tab = 'pw' | 'qr'

/**
 * Sign in as in V1: password, or QR code with a trusted phone. "Trust this device" is off by default.
 * A QR sign-in always gives an untrusted session. In the dummy you pick which demo account signs in.
 */
export default function Login() {
  const { login, notice } = useSession()
  const { club, fnName } = useApp()
  const [tab, setTab] = useState<Tab>('pw')
  const [user, setUser] = useState('m5')
  const [pw, setPw] = useState('')
  const [trusted, setTrusted] = useState(false)
  const [wrong, setWrong] = useState(0)
  const [lockedUntil, setLockedUntil] = useState(0)
  const locked = lockedUntil > Date.now()
  const fn = (id: string) => (initialAssignments[id] ?? []).map((a) => fnName(a.fn)).join(', ') || 'Mitglied'
  const name = members.find((m) => m.id === user)!.name
  const submit = () => {
    if (locked) return
    if (pw === DEMO_PASSWORD) return login(user, trusted, 'Passwort')
    const n = wrong + 1; setWrong(n); setPw('')
    if (n >= STEP_UP_POLICY.maxWrongPasswords) { setLockedUntil(Date.now() + STEP_UP_POLICY.lockMin * 60_000); setWrong(0) }
  }
  const who = (
    <label className="block text-sm font-medium">Demo-Konto
      <select value={user} onChange={(e) => setUser(e.target.value)} className="mt-1 h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm">{accounts.map((id) => <option key={id} value={id}>{members.find((m) => m.id === id)!.name} · {fn(id)}</option>)}</select>
    </label>
  )
  return (
    <div className="flex h-full flex-col overflow-y-auto lg:flex-row">
      <aside className="relative flex shrink-0 flex-col justify-between overflow-hidden bg-gradient-to-br from-[#04132f] via-[#06306e] to-[#0b5fff] p-6 text-white lg:w-[44%] lg:p-14">
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.12]" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" aria-hidden>
          <g fill="none" stroke="#fff" strokeWidth="1.2"><path d="M-20 520 C 120 440, 220 470, 420 360" /><path d="M-20 560 C 140 480, 240 520, 420 410" /><path d="M-20 600 C 160 520, 260 570, 420 460" /><circle cx="330" cy="110" r="70" /><circle cx="330" cy="110" r="110" /><circle cx="330" cy="110" r="150" /></g>
        </svg>
        <div className="relative flex items-center gap-3"><Logo size={44} /><span className="text-xl font-semibold tracking-tight">FlightHub</span></div>
        <div className="relative my-12 hidden lg:block">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">Dein Verein.<br />Dein Flugplatz.</h1>
          <p className="mt-4 max-w-sm text-white/70">Flug- und Sprungbetrieb, Mitglieder und Finanzen an einem Ort.</p>
        </div>
        <div className="relative hidden text-sm text-white/60 lg:block">{club.name}</div>
      </aside>
      <main className="grid flex-1 place-items-center bg-canvas p-5 lg:p-10">
        <div className="w-full max-w-lg space-y-5">
          <div><h2 className="text-2xl font-semibold tracking-tight">Anmelden</h2><p className="mt-0.5 text-sm text-muted">{club.name}</p></div>
        {notice && <Banner tone="warn">{notice}</Banner>}
        <Card className="space-y-5 p-6">
          <div className="inline-flex rounded-lg bg-slate-100 p-1">
            {([['pw', 'E-Mail und Passwort'], ['qr', 'Mit dem Handy (QR-Code)']] as [Tab, string][]).map(([id, l]) => <button key={id} onClick={() => setTab(id)} className={clsx('rounded-md px-3 py-1.5 text-sm font-medium', tab === id ? 'bg-surface shadow-sm' : 'text-muted')}>{l}</button>)}
          </div>
          {who}
          {tab === 'pw' ? (
            <div className="space-y-4">
              <label className="block text-sm font-medium">Passwort<input type="password" value={pw} disabled={locked} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} className="mt-1 h-11 w-full rounded-lg border border-line px-3 outline-none focus:border-brand disabled:bg-slate-50" /></label>
              <label className="flex items-start gap-3 rounded-xl border border-line p-3 text-sm">
                <input type="checkbox" checked={trusted} onChange={(e) => setTrusted(e.target.checked)} className="mt-0.5 h-5 w-5" />
                <span><span className="font-medium">Diesem Gerät vertrauen</span><span className="block text-xs text-muted">Nur auf deinem eigenen Gerät.</span></span>
              </label>
              {wrong > 0 && !locked && <p className="rounded-lg bg-bad-soft px-3 py-2 text-xs text-bad">E-Mail oder Passwort falsch. Noch {STEP_UP_POLICY.maxWrongPasswords - wrong} Versuche.</p>}
              {locked && <p className="rounded-lg bg-bad-soft px-3 py-2 text-xs text-bad">Zu viele Versuche. Gesperrt für {STEP_UP_POLICY.lockMin} Minuten. Melde dich mit dem Handy an.</p>}
              <Button variant="primary" size="lg" className="w-full" disabled={!pw || locked} onClick={submit}>Anmelden</Button>
              <p className="text-xs text-muted">Dummy: Das Passwort ist „{DEMO_PASSWORD}“.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <QrChallenge who={name} hint={`${name} scannt den Code mit dem Handy, auf dem FlightHub angemeldet und vertrauenswürdig ist, und wählt die Zahl.`} onApproved={() => login(user, false, 'QR-Code')} />
            </div>
          )}
        </Card>
        </div>
      </main>
    </div>
  )
}
