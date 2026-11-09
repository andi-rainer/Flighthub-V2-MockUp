import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { members } from '../data'
import { PERMISSION_CATALOG } from '../permissions'
import { useApp } from '../state'
import { Button } from '../ui'
import { SESSION_POLICY, STEP_UP_POLICY } from './policy'
import VerifyDialog, { type Method } from './VerifyDialog'

/**
 * The V1 session model. A TRUSTED device stays signed in until sign-out. An UNTRUSTED (public) device ends after 30 minutes without
 * activity or 3 hours in total, and permissions flagged "sensitive" need a fresh confirmation there (password or QR code), valid 15 minutes.
 */
interface Session { userId: string; trusted: boolean; since: number; lastActive: number; elevatedUntil: number; via: 'Passwort' | 'QR-Code' }
interface Ctx {
  session: Session | null
  /** Milliseconds until an untrusted session ends (idle or absolute, whichever is first). Infinity when trusted. */
  msLeft: number
  elevated: boolean
  login: (userId: string, trusted: boolean, via: Session['via']) => void
  logout: (note?: string) => void
  trustDevice: () => void
  untrustDevice: () => void
  /** Run `then` right away on trusted devices or while confirmed, otherwise ask for the confirmation first. */
  stepUp: (then: () => void) => void
  /** Like stepUp, but only for permissions flagged sensitive in the catalog. */
  guarded: (perm: string, then: () => void) => void
  /** Dummy helper: jump to the last minutes of the session to see the warning. */
  fastForward: () => void
  notice: string | null
}
const C = createContext<Ctx | null>(null)
export const useSession = () => { const c = useContext(C); if (!c) throw new Error('SessionProvider missing'); return c }
const KEY = 'fh-session'
const load = (): Session | null => { try { return JSON.parse(sessionStorage.getItem(KEY) ?? 'null') } catch { return null } }

export function SessionProvider({ children }: { children: ReactNode }) {
  const { setPersonaId, persona } = useApp()
  const [session, setSession] = useState<Session | null>(load)
  const [now, setNow] = useState(Date.now())
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState<(() => void) | null>(null)
  const lastTouch = useRef(0)

  useEffect(() => { try { session ? sessionStorage.setItem(KEY, JSON.stringify(session)) : sessionStorage.removeItem(KEY) } catch { /* private mode */ } }, [session])
  useEffect(() => { if (session) setPersonaId(session.userId) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])

  const touch = useCallback(() => {
    const t = Date.now()
    if (t - lastTouch.current < 1000) return
    lastTouch.current = t
    setSession((s) => (s && !s.trusted ? { ...s, lastActive: t } : s))
  }, [])
  useEffect(() => {
    window.addEventListener('pointerdown', touch); window.addEventListener('keydown', touch)
    return () => { window.removeEventListener('pointerdown', touch); window.removeEventListener('keydown', touch) }
  }, [touch])

  const idleLeft = session && !session.trusted ? session.lastActive + SESSION_POLICY.untrustedIdleMin * 60_000 - now : Infinity
  const absLeft = session && !session.trusted ? session.since + SESSION_POLICY.untrustedAbsoluteMin * 60_000 - now : Infinity
  const msLeft = Math.min(idleLeft, absLeft)
  const elevated = !!session && (session.trusted || session.elevatedUntil > now)

  const logout = useCallback((n?: string) => { setSession(null); setNotice(n ?? null) }, [])
  useEffect(() => { if (session && !session.trusted && msLeft <= 0) logout('Du wurdest abgemeldet, weil das Gerät nicht vertrauenswürdig ist und zu lange nichts passiert ist.') }, [msLeft, session, logout])

  const stepUp = (then: () => void) => { if (elevated) then(); else setPending(() => then) }
  const me = members.find((m) => m.id === persona.memberId)

  const value: Ctx = {
    session, msLeft, elevated, notice,
    login: (userId, trusted, via) => { setNotice(null); setPersonaId(userId); setSession({ userId, trusted, via, since: Date.now(), lastActive: Date.now(), elevatedUntil: 0 }) },
    logout,
    untrustDevice: () => setSession((s) => (s ? { ...s, trusted: false, lastActive: Date.now(), since: Date.now(), elevatedUntil: 0 } : s)),
    trustDevice: () => stepUp(() => setSession((s) => (s ? { ...s, trusted: true } : s))),
    stepUp,
    guarded: (perm, then) => (PERMISSION_CATALOG.find((p) => p.code === perm)?.sensitive ? stepUp(then) : then()),
    fastForward: () => setSession((s) => (s ? { ...s, lastActive: Date.now() - (SESSION_POLICY.untrustedIdleMin * 60_000 - 4 * 60_000 - 50_000) } : s)),
  }
  const warn = !!session && !session.trusted && msLeft > 0 && msLeft <= SESSION_POLICY.warnBeforeMin * 60_000
  const mm = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`

  return (
    <C.Provider value={value}>
      {children}
      <VerifyDialog open={!!pending} title="Bitte bestätigen" subject={me?.name ?? 'du'}
        onClose={() => setPending(null)}
        onVerified={(_m: Method) => { setSession((s) => (s ? { ...s, elevatedUntil: Date.now() + STEP_UP_POLICY.elevatedMin * 60_000 } : s)); const p = pending; setPending(null); p?.() }} />
      {warn && !pending && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm space-y-3 rounded-2xl bg-surface p-6 text-center shadow-2xl">
            <div className="text-lg font-semibold">Du wirst gleich abgemeldet</div>
            <div className="text-4xl font-semibold tabular-nums">{mm(msLeft)}</div>
            <p className="text-sm text-muted">Auf einem öffentlichen Gerät endet die Sitzung nach {SESSION_POLICY.untrustedIdleMin} Minuten ohne Aktivität.</p>
            <div className="flex gap-2"><Button variant="primary" className="flex-1" onClick={() => { lastTouch.current = 0; touch() }}>Weiterarbeiten</Button><Button onClick={() => logout()}>Abmelden</Button></div>
          </div>
        </div>
      )}
    </C.Provider>
  )
}
