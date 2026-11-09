import clsx from 'clsx'
import { Laptop, Link2, Printer, Scale } from 'lucide-react'
import { useState } from 'react'
import { members } from '../../data'
import { useApp } from '../../state'
import { Badge, Banner, Button, Drawer } from '../../ui'
import { isInput, KIND_LABEL, LANGS, nameOf, type AppKind, type Application, type Channel, type FormTemplate, type Lang } from './data'
import FormFields, { answersOf, fieldInput, missingFields } from './FormFields'
import PdfSheet from './PdfSheet'
import SignaturePad from './SignaturePad'
import { EXPIRES_TXT, LinkShare, NOW_TXT, TODAY_TXT, pdfName } from './appHelpers'
import VerifyDialog, { type Method } from '../../session/VerifyDialog'
import { useSession } from '../../session/session'

const kinds: { id: AppKind; blurb: string }[] = [
  { id: 'Neu', blurb: 'Eine Person will Mitglied werden.' },
  { id: 'Änderung', blurb: 'Ein Mitglied wechselt die Mitgliedschaft.' },
  { id: 'Beendigung', blurb: 'Austritt, oder Ausschluss durch den Vorstand.' },
]

/**
 * One path for every application: which kind, for whom, how it gets filled in. Only applications that make sense can be created:
 * an admission is for somebody who is not a member, a change or an exit for a member who has not left yet, and from the member file
 * the kind and the member are fixed. The form is always the active version of the form definition, and every way ends in the same PDF.
 */
export default function AppCreate({ forms, preset, onClose, onCreate, onUpdate, onOpen }: {
  forms: FormTemplate[]; preset?: { kind?: AppKind; memberId?: string }
  onClose: () => void
  /** Saves the application and returns how many unfinished applications of the same kind for the same person it replaced. */
  onCreate: (a: Application) => number
  onUpdate: (id: string, p: Partial<Application>) => void
  onOpen: (id: string) => void
}) {
  const { can, typeOf, types, apps, addHistory, profileOf } = useApp()
  const { guarded } = useSession()
  // Opened from the member file: kind and member are fixed. Remembered once, because the preset is cleared after it was read.
  const [fromMember] = useState(() => !!preset?.kind && !!preset.memberId)
  const [verifying, setVerifying] = useState(false)
  const [kind, setKind] = useState<AppKind>(preset?.kind ?? 'Neu')
  const [memberId, setMemberId] = useState(preset?.memberId ?? '')
  const [email, setEmail] = useState('')
  const [channel, setChannel] = useState<Channel>('Link')
  const [langPicked, setLang] = useState<Lang | null>(null)
  const [vals, setVals] = useState<Record<string, string>>({})
  const [inked, setInked] = useState(false)
  const [art, setArt] = useState<'Austritt' | 'Ausschluss'>('Ausschluss')
  const [zum, setZum] = useState('')
  const [grund, setGrund] = useState('')
  const [result, setResult] = useState<{ app: Application; blank?: boolean; replaced: number } | null>(null)

  const form = forms.find((f) => f.kind === kind)!
  const v = form.versions.find((x) => x.status === 'aktiv')!
  const member = members.find((m) => m.id === memberId)
  const existing = kind !== 'Neu'
  const left = (name: string) => apps.some((a) => a.kind === 'Beendigung' && a.status === 'Genehmigt' && a.person === name)
  const candidates = members.filter((m) => !left(m.name))
  const current = member ? typeOf(member.id).name : ''
  const known: Record<string, string> = existing && member
    ? { Vorname: member.name.split(' ')[0], Nachname: member.name.split(' ').slice(1).join(' '), 'Bisherige Mitgliedschaft': current }
    : email ? { 'E-Mail': email } : {}
  const values = { ...known, ...vals }
  // Change: what to change to and from when can already be set here. Then it is fixed in the form, otherwise the person chooses.
  const fixed = kind === 'Änderung' ? ['Neue Mitgliedschaft', 'Gültig ab'].filter((k) => vals[k]) : []
  const person = existing ? member?.name ?? '' : `${values.Vorname ?? ''} ${values.Nachname ?? ''}`.trim() || email || 'Neue Person'
  const mail = existing ? (member ? `${member.name.toLowerCase().replace(' ', '.')}@example.at` : '') : email
  const prefilled = Object.fromEntries(Object.entries(values).filter(([, x]) => x).map(([k, x]) => [k, /^\d{4}-\d{2}-\d{2}$/.test(x) ? x.split('-').reverse().join('.') : x]))
  const prefillVersion = { ...v, fields: v.fields.filter((f) => !isInput(f) || ((f.type === 'Text' || f.type === 'Datum') && f.label !== 'E-Mail')).map((f) => ({ ...f, required: false })) }
  const missing = missingFields(v, values)
  const boardOk = channel !== 'Vorstand' || (!!zum && (art === 'Austritt' || !!grund.trim()))
  const canBoard = kind === 'Beendigung' && can('members.applications.decide')
  const channels: { id: Channel; icon: typeof Link2; title: string; text: string; show: boolean }[] = [
    { id: 'Link', icon: Link2, title: 'Per Link', text: 'Du erzeugst einen Link (72 Stunden) und kopierst ihn oder schickst ihn per Mail. Die Person füllt aus und unterschreibt ohne Login, am Handy oder am PC.', show: true },
    { id: 'Papier', icon: Printer, title: 'Blanko-PDF zum Ausdrucken', text: 'Die Person füllt von Hand aus. Das Foto oder der Scan wird hochgeladen, die Daten übernimmst du danach.', show: true },
    { id: 'Vor Ort', icon: Laptop, title: 'Jetzt hier ausfüllen und unterschreiben', text: 'Für Mitglieder, zum Beispiel am Platz auf dem Tablet. Das Mitglied bestätigt vorher mit Passwort oder QR-Code und unterschreibt auf dem Bildschirm.', show: existing },
    { id: 'Vorstand', icon: Scale, title: 'Durch den Vorstand, ohne Unterschrift', text: 'Austritt oder Ausschluss, den der Vorstand beschlossen hat. Ein Grund wird festgehalten.', show: canBoard },
  ]

  const lang: Lang = langPicked ?? (member ? profileOf(member.id).lang : 'de')
  const base = (): Application => ({
    id: `a-${Date.now()}`, kind, person, memberId: member?.id, email: mail || undefined, date: TODAY_TXT, status: 'Link aktiv', channel,
    formName: form.name, formVersion: v.v, lang, answers: {}, ...(fixed.length ? { fixed } : {}),
  })
  const finish = (a: Application, blank?: boolean) => setResult({ app: a, blank, replaced: onCreate(a) })
  const submit = (method?: Method) => {
    const a = base()
    const lastName = person.split(' ').pop() ?? ''
    if (channel === 'Link') {
      a.answers = prefilled; a.expires = EXPIRES_TXT
      finish(a)
    } else if (channel === 'Papier') {
      a.status = 'Papier erwartet'; a.answers = prefilled
      finish(a, true)
    } else if (channel === 'Vor Ort') {
      a.status = 'Unterzeichnet'; a.answers = answersOf(v, values); a.pdf = pdfName(kind, lastName); a.signedAt = NOW_TXT; a.verified = `${method}, ${NOW_TXT}`
      finish(a)
    } else {
      a.status = 'Genehmigt'; a.pdf = pdfName(kind, lastName); a.signedAt = NOW_TXT; a.decidedBy = `Vorstand, ${TODAY_TXT}`
      a.answers = { ...known, 'Austritt zum': zum.split('-').reverse().join('.'), 'Grund (optional)': grund || '–', Art: art }
      a.note = `${art} durch den Vorstand ohne Unterschrift. Grund: ${grund || 'nicht angegeben'}.`
      if (member) addHistory(member.id, 'Mitgliedschaft', `${art} zum ${zum.split('-').reverse().join('.')}`, { appId: a.id, details: grund ? [`Grund: ${grund}`] : undefined })
      finish(a)
    }
  }
  const ready = (!existing || !!member) && boardOk && (channel !== 'Vor Ort' || (inked && missing.length === 0))
  const verb = { Link: 'Link erzeugen', Papier: 'PDF erzeugen', 'Vor Ort': 'Unterzeichnen und als PDF speichern', Vorstand: art === 'Austritt' ? 'Austritt durchführen' : 'Ausschluss durchführen' }[channel]
  const title = fromMember ? `${KIND_LABEL[kind]}: ${member?.name}` : 'Neuer Antrag'

  if (result) {
    const a = result.app
    return (
      <Drawer open title="Antrag angelegt" onClose={onClose} size="xl" footer={<Button variant="primary" size="lg" className="w-full" onClick={() => onOpen(a.id)}>Antrag öffnen</Button>}>
        <div className="space-y-4">
          {result.replaced > 0 && <Banner tone="warn">Ein noch nicht fertiger Antrag derselben Art für dieselbe Person wurde ersetzt. Sein Link funktioniert nicht mehr.</Banner>}
          {a.channel === 'Link' && <>
            <Banner>Der Link ist erzeugt und 72 Stunden gültig. Kopiere ihn oder schicke ihn per Mail. Du kannst das auch später im Antrag tun.</Banner>
            <LinkShare app={a} onMail={(to) => { onUpdate(a.id, { mailedTo: to, email: to }); setResult({ ...result, app: { ...a, mailedTo: to, email: to } }) }} />
          </>}
          {result.blank && <>
            <Banner>Das Formular ist bereit{Object.keys(a.answers).length > 0 ? ', bekannte Angaben sind schon eingetragen' : ''}. Drucke es aus, lass es ausfüllen und unterschreiben und lade danach das Foto oder den Scan beim Antrag hoch.</Banner>
            <PdfSheet title={nameOf(form, lang)} version={v} answers={a.answers} prefilled lang={lang} />
          </>}
          {a.channel === 'Vor Ort' && <Banner>Identität bestätigt ({a.verified}), gespeichert und als PDF beim Mitglied abgelegt. Der Antrag wartet auf deine Entscheidung.</Banner>}
          {a.channel === 'Vorstand' && <><Banner>{a.note} Das PDF liegt in der Akte. Die Entscheidung ist mit Datum und Person protokolliert.</Banner><PdfSheet title={nameOf(form, lang)} lang={lang} version={v} answers={a.answers} signedAt={a.signedAt} channel="Vorstand" note={a.note} /></>}
        </div>
      </Drawer>
    )
  }

  return (
    <>
      <Drawer open title={title} onClose={onClose} size="xl"
        footer={<div className="space-y-2"><Button variant="primary" size="lg" className="w-full" disabled={!ready} onClick={() => (channel === 'Vor Ort' ? setVerifying(true) : channel === 'Vorstand' ? guarded('members.applications.decide', () => submit()) : submit())}>{verb}</Button>{!ready && <p className="text-xs text-muted">Noch offen: {[existing && !member && 'Mitglied wählen', !boardOk && 'Datum und Grund', channel === 'Vor Ort' && missing.length > 0 && missing.join(', '), channel === 'Vor Ort' && !inked && 'Unterschrift'].filter(Boolean).join(', ')}</p>}</div>}>
        <div className="space-y-7">
          {!fromMember && (
            <section>
              <h3 className="mb-2 text-sm font-semibold">1 · Welcher Antrag?</h3>
              <div className="grid gap-2 sm:grid-cols-3">
                {kinds.map((k) => (
                  <button key={k.id} onClick={() => { setKind(k.id); setVals({}); setChannel('Link'); if (k.id === 'Neu') setMemberId('') }} className={clsx('rounded-xl border p-3 text-left text-sm', kind === k.id ? 'border-brand bg-brand-soft' : 'border-line hover:bg-slate-50')}>
                    <div className="font-medium">{KIND_LABEL[k.id]}</div><div className="mt-0.5 text-xs text-muted">{k.blurb}</div>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-sm font-semibold">{fromMember ? '1' : '2'} · {existing ? 'Für wen?' : 'Angaben (alles optional)'}</h3>
            {existing ? (
              <div className="space-y-3">
                {fromMember ? <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm"><b>{member?.name}</b></div>
                  : <select value={memberId} onChange={(e) => { setMemberId(e.target.value); setVals({}) }} className={fieldInput} aria-label="Mitglied"><option value="">Mitglied wählen</option>{candidates.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>}
                {member && <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">Bisherige Mitgliedschaft: <b>{current}</b> <span className="text-muted">· ist bekannt und kann im Formular nicht gewählt oder geändert werden.</span></div>}
                {kind === 'Änderung' && member && (
                  <div className="space-y-3 rounded-xl border border-line p-3">
                    <div className="text-sm font-medium">Worauf und ab wann? <span className="font-normal text-muted">(optional)</span></div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-sm font-medium">Neue Mitgliedschaft<select value={vals['Neue Mitgliedschaft'] ?? ''} onChange={(e) => setVals({ ...vals, 'Neue Mitgliedschaft': e.target.value })} className={`${fieldInput} mt-1`}><option value="">Die Person wählt selbst</option>{types.filter((t) => t.name !== current).map((t) => <option key={t.id}>{t.name}</option>)}</select></label>
                      <label className="text-sm font-medium">Gültig ab<input type="date" value={vals['Gültig ab'] ?? ''} onChange={(e) => setVals({ ...vals, 'Gültig ab': e.target.value })} className={`${fieldInput} mt-1`} /></label>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <details className="rounded-xl border border-line">
                  <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium">Angaben schon eintragen</summary>
                  <div className="space-y-3 border-t border-line p-3">
                    <label className="block text-sm font-medium">E-Mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.at" className={`${fieldInput} mt-1`} /></label>
                    <FormFields version={prefillVersion} values={values} onChange={(k, val) => setVals({ ...vals, [k]: val })} />
                  </div>
                </details>
              </div>
            )}
          </section>

          <section>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-semibold">{fromMember ? '2' : '3'} · Wie wird ausgefüllt? <Badge tone="neutral">{form.name}, Version {v.v}</Badge></h3><div className="flex items-center gap-2 text-sm"><span className="text-muted">Sprache der Person</span><div className="flex overflow-hidden rounded-lg border border-line text-xs font-medium">{LANGS.map((l) => <button key={l.id} onClick={() => setLang(l.id)} aria-pressed={lang === l.id} className={clsx('px-3 py-1.5', lang === l.id ? 'bg-brand text-white' : 'text-muted hover:bg-slate-50')}>{l.label}</button>)}</div></div></div>
            <div className="grid gap-2 sm:grid-cols-2">
              {channels.filter((c) => c.show).map((c) => (
                <button key={c.id} onClick={() => setChannel(c.id)} className={clsx('flex gap-3 rounded-xl border p-3 text-left text-sm', channel === c.id ? 'border-brand bg-brand-soft' : 'border-line hover:bg-slate-50')}>
                  <c.icon size={18} className="mt-0.5 shrink-0 text-brand" /><span><span className="font-medium">{c.title}</span><span className="mt-0.5 block text-xs text-muted">{c.text}</span></span>
                </button>
              ))}
            </div>
          </section>

          {channel === 'Vor Ort' && (
            <section className="space-y-4">
              <h3 className="text-sm font-semibold">{fromMember ? '3' : '4'} · Formular</h3>
              <FormFields version={v} values={values} onChange={(k, val) => setVals({ ...vals, [k]: val })} currentType={current} locked={fixed} lang={lang} />
              <SignaturePad onInk={setInked} lang={lang} />
            </section>
          )}

          {channel === 'Vorstand' && (
            <section className="space-y-4">
              <h3 className="text-sm font-semibold">{fromMember ? '3' : '4'} · Beschluss</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium">Art<select value={art} onChange={(e) => setArt(e.target.value as typeof art)} className={`${fieldInput} mt-1`}><option>Ausschluss</option><option>Austritt</option></select></label>
                <label className="text-sm font-medium">Wirksam zum<input type="date" value={zum} onChange={(e) => setZum(e.target.value)} className={`${fieldInput} mt-1`} /></label>
              </div>
              <label className="block text-sm font-medium">Grund{art === 'Ausschluss' ? ' *' : ' (optional)'}<textarea rows={3} value={grund} onChange={(e) => setGrund(e.target.value)} className="mt-1 w-full rounded-lg border border-line p-3 text-sm font-normal outline-none focus:border-brand" /></label>
              <Banner tone="warn">Dieser Antrag wird sofort wirksam und ohne Unterschrift des Mitglieds abgelegt. Das PDF nennt den Grund, die Entscheidung steht mit Person und Datum im Verlauf.</Banner>
            </section>
          )}
        </div>
      </Drawer>
      <VerifyDialog open={verifying} title="Identität bestätigen" subject={person} onClose={() => setVerifying(false)} onVerified={(m) => { setVerifying(false); submit(m) }} />
    </>
  )
}
