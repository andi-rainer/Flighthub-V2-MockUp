import { ChevronDown, KeyRound, LogOut, Monitor, ShieldCheck, ShieldQuestion, User } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { members } from '../data'
import { useApp } from '../state'
import { useSession } from './session'

const demoAccounts = ['m5', 'm8', 'm2', 'm3', 'm1']

/** Top right, like V1: who is signed in, my profile, security, devices, sign out. "Ansicht als" is a dummy tool, not part of the product. */
export default function UserMenu() {
  const { persona, setPersonaId, functionNames, profileOf } = useApp()
  const { session, logout } = useSession()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close)
  }, [])
  const me = members.find((m) => m.id === persona.memberId)!
  const p = profileOf(me.id)
  const initials = `${p.first[0] ?? ''}${p.last[0] ?? ''}`
  const fns = functionNames(me.id).join(', ') || 'Mitglied'
  const link = (to: string, icon: React.ReactNode, label: string) => <Link to={to} onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-slate-50">{icon}{label}</Link>
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label="Benutzermenü" className="flex h-8 items-center gap-2 rounded-full pl-0.5 pr-2 hover:bg-slate-100">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand">{initials}</span>
        <span className="hidden text-sm font-medium md:inline">{p.first} {p.last}</span><ChevronDown size={14} className="text-muted" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-xl border border-line bg-surface p-1.5 shadow-lg">
          <div className="px-3 py-2"><div className="font-semibold">{p.first} {p.last}</div><div className="text-xs text-muted">{fns}</div>
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">{session?.trusted ? <><ShieldCheck size={13} className="text-ok" /> Vertrauenswürdiges Gerät</> : <><ShieldQuestion size={13} className="text-warn" /> Öffentliches Gerät</>}</div></div>
          <div className="my-1 border-t border-line" />
          {link('/einstellungen?tab=profil', <User size={16} className="text-muted" />, 'Mein Profil')}
          {link('/einstellungen?tab=sicherheit', <KeyRound size={16} className="text-muted" />, 'Passwort und Sicherheit')}
          {link('/einstellungen?tab=geraete', <Monitor size={16} className="text-muted" />, 'Meine Geräte')}
          <div className="my-1 border-t border-line" />
          <label className="block px-3 py-1.5 text-xs text-muted">Ansicht als (nur Dummy)
            <select value={persona.id} onChange={(e) => setPersonaId(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2 text-sm text-ink">
              {demoAccounts.map((id) => <option key={id} value={id}>{members.find((m) => m.id === id)!.name} · {functionNames(id).join(', ') || 'Mitglied'}</option>)}
            </select>
          </label>
          <div className="my-1 border-t border-line" />
          <button onClick={() => { setOpen(false); logout() }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"><LogOut size={16} className="text-muted" /> Abmelden</button>
        </div>
      )}
    </div>
  )
}
