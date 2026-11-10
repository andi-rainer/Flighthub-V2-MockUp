import { CheckCircle2, Clock, FileDown, Lock } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../state'
import PublicShell, { Notice } from './PublicShell'
import { Banner, Button, Card } from '../ui'
import { NOW_TXT, pdfName } from './members/appHelpers'
import { lab, nameOf, type Lang } from './members/data'
import { ui } from './members/i18n'
import FormFields, { answersOf, missingFields } from './members/FormFields'
import PdfSheet from './members/PdfSheet'
import SignaturePad from './members/SignaturePad'

/**
 * What a person sees when they open the link from the mail: no login, no menu, just the form, the signature and the PDF
 * afterwards. Known data (name, current membership) is filled in and cannot be changed.
 */
export default function PublicApplication({ id }: { id: string }) {
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

  const shell = (body: React.ReactNode) => <PublicShell design={design} lang={lang} onLang={setLang} back={{ label: 'Nur im Klickdummy: zurück zur Verwaltung', to: '/mitglieder?tab=antraege' }}>{body}</PublicShell>
  const note = (icon: React.ReactNode, title: string, text: string) => <Notice icon={icon} title={title} text={text} />

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
