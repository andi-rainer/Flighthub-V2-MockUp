import { Check, Copy, Mail } from 'lucide-react'
import { useState } from 'react'
import { type AppKind, type Application } from './data'

export const TODAY_TXT = '07.11.2026'
export const NOW_TXT = '07.11.2026 10:15'
/** Links work 72 hours. */
export const EXPIRES_TXT = '10.11.2026 10:15'
export const antragLink = (id: string) => `${window.location.origin}${window.location.pathname}#/antrag/${id}`
const SHORT: Record<AppKind, string> = { Neu: 'Aufnahme', Änderung: 'Aenderung', Beendigung: 'Austritt' }
export const pdfName = (kind: AppKind, last: string) => `${SHORT[kind]}-${last || 'Antrag'}-2026-11-07.pdf`

export const statusTone: Record<Application['status'], 'neutral' | 'info' | 'ok' | 'bad' | 'warn'> = {
  Entwurf: 'neutral', 'Link aktiv': 'warn', 'Papier erwartet': 'warn', Abgelaufen: 'bad', Unterzeichnet: 'info', Genehmigt: 'ok', Abgelehnt: 'bad',
}
/** What happens next, in one line, shown in the list and at the top of the detail. */
export const nextStep: Record<Application['status'], string> = {
  Entwurf: 'Entwurf', 'Link aktiv': 'Wartet auf die Person', 'Papier erwartet': 'Wartet auf das unterschriebene Formular', Abgelaufen: 'Link abgelaufen, neuen Link erzeugen',
  Unterzeichnet: 'Wartet auf deine Entscheidung', Genehmigt: 'Erledigt', Abgelehnt: 'Abgelehnt',
}

/** The 72 hour link with a copy button. */
export function LinkBox({ id, expires }: { id: string; expires?: string }) {
  const [copied, setCopied] = useState(false)
  const url = antragLink(id)
  const copy = () => { navigator.clipboard?.writeText(url).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1800) }
  return (
    <div>
      <div className="flex gap-2">
        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-slate-50 px-3 font-mono text-xs" aria-label="Link zum Antrag" />
        <button onClick={copy} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-medium hover:bg-slate-50">{copied ? <Check size={14} className="text-ok" /> : <Copy size={14} />}{copied ? 'Kopiert' : 'Kopieren'}</button>
      </div>
      {expires && <p className="mt-1 text-xs text-muted">Gültig bis {expires} (72 Stunden). Die Person braucht kein Login.</p>}
    </div>
  )
}

/**
 * Step 2 of the link: the link exists now. Either copy it or send it by mail, one after the other and both optional.
 * Sending by mail asks for the address here, so nothing is needed when the application is created.
 */
export function LinkShare({ app, onMail }: { app: Application; onMail: (email: string) => void }) {
  const [email, setEmail] = useState(app.mailedTo ?? app.email ?? '')
  const valid = /\S+@\S+\.\S+/.test(email)
  return (
    <div className="space-y-4">
      <div><div className="mb-1 text-sm font-medium">Link kopieren</div><LinkBox id={app.id} expires={app.expires} /></div>
      <div>
        <div className="mb-1 text-sm font-medium">Oder per Mail senden</div>
        <div className="flex gap-2">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.at" className="h-10 min-w-0 flex-1 rounded-lg border border-line px-3 text-sm outline-none focus:border-brand" aria-label="E-Mail für den Link" />
          <button disabled={!valid} onClick={() => onMail(email)} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"><Mail size={14} />{app.mailedTo ? 'Erneut senden' : 'Senden'}</button>
        </div>
        {app.mailedTo && <p className="mt-1 text-xs text-ok">Mail mit dem Link an {app.mailedTo} gesendet.</p>}
      </div>
    </div>
  )
}
