import { CheckCircle2, Clock, FileDown, Lock, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../state'
import { ClubMark } from './members/LetterHead'
import { Banner, Button, Card } from '../ui'
import { NOW_TXT, pdfName } from './members/appHelpers'
import { LANGS, lab, nameOf, type Lang } from './members/data'
import { ui } from './members/i18n'
import FormFields, { answersOf, missingFields } from './members/FormFields'
import PdfSheet from './members/PdfSheet'
import SignaturePad from './members/SignaturePad'

/**
 * What a person sees when they open the link from the mail: no login, no menu, just the form, the signature and the PDF
 * afterwards. Known data (name, current membership) is filled in and cannot be changed.
 */
export default function PublicApplication({ id }: { id: string }) {
  const nav = useNavigate()
  const { apps, setApps, forms, branding } = useApp()
  const app = apps.find((a) => a.id === id)
  const form = app && forms.find((f) => f.name === app.formName)
  const version = app && form?.versions.find((v) => v.v === app.formVersion)
  const [lang, setLang] = useState<Lang>(app?.lang ?? 'de')
  const t = ui(lang)
  const title = form ? nameOf(form, lang) : ''
  const [vals, setVals] = useState<Record<string, string>>({})
  const [inked, setInked] = useState(false)
  const [done, setDone] = useState(false)
  const values = { ...(app?.answers ?? {}), ...vals }
  const missing = version ? missingFields(version, values) : []
  const design = version?.design ?? branding

  const submit = () => {
    if (!app || !version) return
    const answers = answersOf(version, values)
    setApps(apps.map((a) => (a.id === app.id ? { ...a, ...(a.kind === 'Neu' && answers.Vorname !== '–' ? { person: `${answers.Vorname} ${answers.Nachname === '–' ? '' : answers.Nachname}`.trim() } : {}), status: 'Unterzeichnet', channel: 'Link', answers, pdf: pdfName(a.kind, a.person.split(' ').pop() ?? ''), signedAt: NOW_TXT } : a)))
    setDone(true)
  }

  const shell = (body: React.ReactNode) => (
    <div className="h-full overflow-y-auto bg-canvas">
      <div className="mx-auto max-w-xl space-y-4 p-4 md:py-10">
        <div className="flex items-center justify-between"><div className="flex items-center gap-3"><ClubMark b={design} size={36} /><div className="text-lg font-semibold tracking-tight">{design.name}</div></div><div className="flex items-center gap-3"><span className="hidden items-center gap-1 text-xs text-muted sm:inline-flex"><ShieldCheck size={14} /> {t.secure}</span><div className="flex overflow-hidden rounded-lg border border-line bg-surface text-xs font-medium">{LANGS.map((l) => <button key={l.id} onClick={() => setLang(l.id)} aria-pressed={lang === l.id} className={lang === l.id ? 'bg-brand px-2.5 py-1.5 text-white' : 'px-2.5 py-1.5 text-muted hover:bg-slate-50'}>{l.id.toUpperCase()}</button>)}</div></div></div>
        {body}
        <button onClick={() => nav('/mitglieder?tab=antraege')} className="block w-full text-center text-xs text-muted hover:text-ink">Nur im Klickdummy: zurück zur Verwaltung</button>
      </div>
    </div>
  )
  const note = (icon: React.ReactNode, title: string, text: string) => <Card className="space-y-2 p-8 text-center"><div className="mx-auto w-fit text-muted">{icon}</div><div className="text-lg font-semibold">{title}</div><p className="text-sm text-muted">{text}</p></Card>

  if (!app || !version) return shell(note(<Lock size={28} />, t.invalid, t.invalidText))
  if (app.status === 'Abgelaufen') return shell(note(<Clock size={28} />, t.expired, t.expiredText))
  if (app.status !== 'Link aktiv' && !done) {
    return shell(app.status === 'Papier erwartet'
      ? note(<Lock size={28} />, t.paper, t.paperText)
      : note(<CheckCircle2 size={28} />, t.received, t.receivedText))
  }
  if (done) {
    return shell(
      <>
        <Card className="space-y-3 p-6 text-center"><CheckCircle2 size={32} className="mx-auto text-ok" /><div className="text-lg font-semibold">{t.thanks}</div><p className="text-sm text-muted">{t.thanksText}</p><Button variant="primary" className="mx-auto"><FileDown size={16} /> {t.download}</Button></Card>
        <PdfSheet title={title} version={version} answers={answersOf(version, values)} signedAt={NOW_TXT} channel="Link" lang={lang} />
      </>,
    )
  }
  return shell(
    <Card className="space-y-5 p-5 md:p-6">
      <div><h1 className="text-xl font-semibold tracking-tight">{title}</h1><p className="mt-1 text-sm text-muted">{app.person.includes('@') ? t.welcome : t.hello(app.person.split(' ')[0])}, {t.fillIn(app.expires)}</p></div>
      <FormFields version={version} values={values} onChange={(k, v) => setVals({ ...vals, [k]: v })} currentType={app.answers['Bisherige Mitgliedschaft']} locked={app.fixed} lang={lang} />
      <div className="space-y-2"><div className="text-sm font-medium">{t.signature}</div><SignaturePad onInk={setInked} lang={lang} /></div>
      <Button variant="primary" size="lg" className="w-full" disabled={!inked || missing.length > 0} onClick={submit}>{t.sendGetPdf}</Button>
      {(!inked || missing.length > 0) && <p className="text-xs text-muted">{t.open}: {[...missing.map((k) => { const f = version.fields.find((x) => x.label === k); return f ? lab(f, lang) : k }), !inked && t.signature].filter(Boolean).join(', ')}</p>}
      <Banner>{t.privacy}</Banner>
    </Card>,
  )
}
