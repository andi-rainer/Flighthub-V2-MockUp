import clsx from 'clsx'
import { Mail as MailIcon, Paperclip, Send } from 'lucide-react'
import { useState } from 'react'
import { Badge, Button, Card, Segmented, Switch } from '../../ui'
import { mails, phases, placeholders, type Lang, type Mail } from './data'

export interface MailState { master: boolean; on: Record<string, boolean> }
export const isSent = (m: Mail, s: MailState) => (m.rule === 'immer' ? true : m.rule === 'aktion' ? s.master : s.master && (s.on[m.id] ?? m.defaultOn))

export default function Mails({ mailId, onMail, state, setState }: { mailId: string; onMail: (id: string) => void; state: MailState; setState: (s: MailState) => void }) {
  const sel = mails.find((m) => m.id === mailId) ?? mails[0]
  const [lang, setLang] = useState<Lang>('de')
  const [edits, setEdits] = useState<Record<string, { subject?: string; body?: string }>>({})
  const subject = edits[`${sel.id}.${lang}`]?.subject ?? sel.subject[lang]
  const body = edits[`${sel.id}.${lang}`]?.body ?? sel.body[lang]
  const patch = (p: { subject?: string; body?: string }) => setEdits((e) => ({ ...e, [`${sel.id}.${lang}`]: { subject, body, ...p } }))
  const filled = (t: string) => t.replace('{Vorname}', 'Anna').replace('{Name}', 'Anna Berger').replace('{Datum}', '22.11.2026').replace('{Uhrzeit}', '10:30').replace('{Code}', 'GS-1042').replace('{Link}', 'shop.skydive-beispiel.at/x7k2').replace('{Ablaufdatum}', '07.11.2027').replace('{AlterTermin}', '15.11.2026').replace('{Position}', '2').replace('{Monat}', 'Oktober 2026').replace('{Kontostand}', '− 42,00 €')

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_400px]">
      <div className="space-y-5">
        <Card className="flex items-center justify-between gap-4 p-4">
          <div>
            <div className="font-semibold">Mails an Kunden und Mitglieder</div>
            <div className="text-sm text-muted">Hauptschalter. Aus = es gehen nur Pflichtmails (z. B. Vertrag, Kauf) raus.</div>
          </div>
          <Switch checked={state.master} onChange={(v) => setState({ ...state, master: v })} label="Mails aktiv" />
        </Card>

        {phases.map((ph) => (
          <section key={ph}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{ph}</h2>
            <Card className="divide-y divide-line">
              {mails.filter((m) => m.phase === ph).map((m) => {
                const sent = isSent(m, state)
                return (
                  <div key={m.id} onClick={() => onMail(m.id)} className={clsx('flex cursor-pointer items-center gap-3 px-4 py-3', sel.id === m.id ? 'bg-brand-soft' : 'hover:bg-slate-50')}>
                    <span className={clsx('h-2.5 w-2.5 shrink-0 rounded-full', sent ? 'bg-ok' : 'bg-slate-300')} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{m.name}</div>
                      <div className="text-sm text-muted">{m.when}</div>
                      <div className="mt-1 text-xs text-muted">an: {m.to}</div>
                    </div>
                    {m.rule === 'immer' && <Badge tone="neutral">immer</Badge>}
                    {m.rule === 'aktion' && <Badge tone="info">pro Aktion wählbar</Badge>}
                    {m.rule === 'schalter' && <Switch checked={state.on[m.id] ?? m.defaultOn} disabled={!state.master} onChange={(v) => setState({ ...state, on: { ...state.on, [m.id]: v } })} label={`${m.name} senden`} />}
                  </div>
                )
              })}
            </Card>
          </section>
        ))}
      </div>

      <aside className="lg:sticky lg:top-4 lg:self-start">
        <Card className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 font-semibold"><MailIcon size={16} /> {sel.name}</div>
              <div className="mt-1 text-xs text-muted">{isSent(sel, state) ? 'Wird gesendet' : 'Ist ausgeschaltet'}</div>
            </div>
            <Segmented<Lang> value={lang} onChange={setLang} options={[{ value: 'de', label: 'DE' }, { value: 'en', label: 'EN' }]} />
          </div>

          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
            <div><b>Wann:</b> {sel.when}</div>
            <div className="mt-1"><b>Ausgelöst durch:</b> {sel.whereTriggered}</div>
            {sel.conditions.length > 0 && <ul className="mt-1 list-disc pl-5 text-muted">{sel.conditions.map((c) => <li key={c}>{c}</li>)}</ul>}
          </div>

          <label className="mt-4 block text-sm font-medium">Betreff
            <input value={subject} onChange={(e) => patch({ subject: e.target.value })} className="mt-1 h-11 w-full rounded-lg border border-line px-3 font-normal outline-none focus:border-brand" />
          </label>
          <label className="mt-3 block text-sm font-medium">Text
            <textarea rows={5} value={body} onChange={(e) => patch({ body: e.target.value })} className="mt-1 w-full rounded-lg border border-line p-3 font-normal outline-none focus:border-brand" />
          </label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {placeholders.map((p) => <button key={p} onClick={() => patch({ body: body + ' ' + p })} className="rounded-md bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200">{p}</button>)}
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-line">
            <div className="border-b border-line bg-slate-50 px-4 py-2 text-xs"><span className="text-muted">Betreff:</span> <b>{filled(subject)}</b></div>
            <p className="p-4 text-sm leading-relaxed">{filled(body)}</p>
            {sel.attachment && <div className="flex items-center gap-2 border-t border-line px-4 py-2 text-xs text-muted"><Paperclip size={13} /> {sel.attachment}</div>}
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" className="flex-1">Speichern</Button>
            <Button><Send size={14} /> Testmail an mich</Button>
          </div>
        </Card>
      </aside>
    </div>
  )
}
