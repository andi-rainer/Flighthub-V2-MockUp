import clsx from 'clsx'
import { useState } from 'react'
import { Banner, Button, Drawer } from '../ui'
import { DEMO_PASSWORD, STEP_UP_POLICY } from './policy'
import QrChallenge from './QrChallenge'

export type Method = 'Passwort' | 'QR-Code'

/**
 * One dialog for every confirmation. `subject` is the person who has to confirm: the signed-in user for a step-up on an untrusted
 * device, or the member who signs at the club. Password (5 wrong attempts lock for 5 minutes) or QR code on their phone.
 */
export default function VerifyDialog({ open, title, subject, onVerified, onClose }: {
  open: boolean; title: string; subject: string; onVerified: (m: Method) => void; onClose: () => void
}) {
  const modes: Method[] = ['Passwort', 'QR-Code']
  const [picked, setMode] = useState<Method>(modes[0])
  const mode = modes.includes(picked) ? picked : modes[0]
  const [pw, setPw] = useState('')
  const [wrong, setWrong] = useState(0)
  const [lockedUntil, setLockedUntil] = useState(0)
  const locked = lockedUntil > Date.now()
  const done = (m: Method) => { setPw(''); setWrong(0); onVerified(m) }
  const tryPassword = () => {
    if (locked) return
    if (pw === DEMO_PASSWORD) return done('Passwort')
    const n = wrong + 1
    setWrong(n); setPw('')
    if (n >= STEP_UP_POLICY.maxWrongPasswords) { setLockedUntil(Date.now() + STEP_UP_POLICY.lockMin * 60_000); setWrong(0) }
  }
  return (
    <Drawer open={open} title={title} onClose={onClose} size="xl">
      <div className="space-y-5">
        <Banner>Bitte bestätige, dass {subject} das selbst macht. Das geht mit dem Passwort oder per QR-Code am Handy.</Banner>
        {modes.length > 1 && <div className="inline-flex rounded-lg bg-slate-100 p-1">{modes.map((m) => <button key={m} onClick={() => setMode(m)} className={clsx('rounded-md px-3 py-1.5 text-sm font-medium', mode === m ? 'bg-surface shadow-sm' : 'text-muted')}>{m === 'QR-Code' ? 'Handy (QR-Code)' : m}</button>)}</div>}

        {mode === 'Passwort' && (
          <div className="max-w-sm space-y-3">
            <label className="block text-sm font-medium">Passwort von {subject}
              <input type="password" autoComplete="off" value={pw} disabled={locked} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && tryPassword()} className="mt-1 h-11 w-full rounded-lg border border-line px-3 outline-none focus:border-brand disabled:bg-slate-50" />
            </label>
            {wrong > 0 && !locked && <p className="rounded-lg bg-bad-soft px-3 py-2 text-xs text-bad">Falsches Passwort. Noch {STEP_UP_POLICY.maxWrongPasswords - wrong} Versuche, dann ist es {STEP_UP_POLICY.lockMin} Minuten gesperrt.</p>}
            {locked && <p className="rounded-lg bg-bad-soft px-3 py-2 text-xs text-bad">Zu viele falsche Versuche. Gesperrt für {STEP_UP_POLICY.lockMin} Minuten. Nimm den QR-Code.</p>}
            <Button variant="primary" size="lg" className="w-full" disabled={!pw || locked} onClick={tryPassword}>Bestätigen</Button>
            <p className="text-xs text-muted">Dummy: Das Passwort ist „{DEMO_PASSWORD}“.</p>
          </div>
        )}
        {mode === 'QR-Code' && <QrChallenge who={subject} onApproved={() => done('QR-Code')} />}
      </div>
    </Drawer>
  )
}
