import clsx from 'clsx'
import { FileText, Lock, Plus, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { eur, members } from '../../data'
import { useApp } from '../../state'
import { Badge, Banner, Button, Card, Drawer, Segmented, usePaging } from '../../ui'
import AppCreate from './AppCreate'
import { EXPIRES_TXT, LinkShare, NOW_TXT, TODAY_TXT, nextStep, pdfName, statusTone } from './appHelpers'
import { KIND_LABEL, durationText, fmtDate, nameOf, schedule, type AppKind, type Application, type Effect } from './data'
import FormFields, { answersOf, missingFields } from './FormFields'
import PdfSheet from './PdfSheet'
import { useSession } from '../../session/session'

type Filter = 'alle' | 'entscheiden' | 'wartet' | 'erledigt'
/** Not finished yet: a new application of the same kind for the same person or address replaces it. */
const unfinished = (a: Application) => a.status === 'Entwurf' || a.status === 'Link aktiv' || a.status === 'Papier erwartet' || a.status === 'Abgelaufen'
const sameTarget = (x: Application, a: Application) => x.kind === a.kind && unfinished(x) && ((!!a.memberId && x.memberId === a.memberId) || (!!a.email && !!x.email && x.email.toLowerCase() === a.email.toLowerCase()))
const waiting = (a: Application) => a.status === 'Link aktiv' || a.status === 'Papier erwartet' || a.status === 'Abgelaufen'

/**
 * Every application, whichever way it came in (link without login, paper upload, at the club, board decision).
 * The first tab is the work list, the second tab defines the forms and prints the blank PDF.
 */
export default function Applications({ preset, initialOpen, onConsumed }: { preset?: { kind?: AppKind; memberId?: string } | null; initialOpen?: string | null; onConsumed?: () => void }) {
  const nav = useNavigate()
  const { apps, setApps, can } = useApp()
  const [filter, setFilter] = useState<Filter>('alle')
  const [openId, setOpenId] = useState<string | null>(initialOpen ?? null)
  const [creating, setCreating] = useState(!!preset)
  const { forms } = useApp()
  useEffect(() => { if (preset || initialOpen) onConsumed?.() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const open = apps.find((a) => a.id === openId) ?? null
  const patch = (id: string, p: Partial<Application>) => setApps(apps.map((a) => (a.id === id ? { ...a, ...p } : a)))
  const todo = apps.filter((a) => a.status === 'Unterzeichnet').length
  const rows = apps.filter((a) => filter === 'alle' || (filter === 'entscheiden' ? a.status === 'Unterzeichnet' : filter === 'wartet' ? waiting(a) : a.status === 'Genehmigt' || a.status === 'Abgelehnt'))
  const paging = usePaging(rows, filter)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<Filter> value={filter} onChange={setFilter} options={[
          { value: 'alle', label: 'Alle' }, { value: 'entscheiden', label: `Zu entscheiden (${todo})` },
          { value: 'wartet', label: `Wartet auf Person (${apps.filter(waiting).length})` }, { value: 'erledigt', label: 'Erledigt' },
        ]} />
        <div className="flex gap-2">
          {can('pdf_templates.manage') && <Button onClick={() => nav('/formulare')}><FileText size={16} /> Formulare verwalten</Button>}
          <Button variant="primary" onClick={() => setCreating(true)}><Plus size={16} /> Neuer Antrag</Button>
        </div>
      </div>

      <Card className="divide-y divide-line">
        {paging.rows.map((a) => (
          <div key={a.id} onClick={() => setOpenId(a.id)} className="flex cursor-pointer flex-wrap items-center gap-3 px-5 py-3.5 hover:bg-slate-50">
            <div className="min-w-0 flex-1 basis-56">
              <div className="font-medium">{a.person} <Badge tone={a.kind === 'Beendigung' ? 'warn' : 'info'}>{KIND_LABEL[a.kind]}</Badge></div>
              <div className="text-sm text-muted">{a.date} · {a.formName}, Version {a.formVersion}{a.channel && ` · ${a.channel}`}</div>
            </div>
            <span className="text-xs text-muted">{a.status === 'Link aktiv' && a.expires ? `Link bis ${a.expires}` : nextStep[a.status]}</span>
            <Badge tone={statusTone[a.status]}>{a.status}</Badge>
          </div>
        ))}
        {rows.length === 0 && <p className="p-8 text-center text-muted">Nichts in dieser Ansicht.</p>}
        {paging.bar}
      </Card>

      {open && <Detail key={open.id} app={open} onClose={() => setOpenId(null)} onPatch={(p) => patch(open.id, p)} onRemove={() => { setApps(apps.filter((a) => a.id !== open.id)); setOpenId(null) }} />}
      {creating && <AppCreate forms={forms} preset={preset ?? undefined} onClose={() => setCreating(false)} onCreate={(a) => { const old = apps.filter((x) => sameTarget(x, a)); setApps([a, ...apps.filter((x) => !old.includes(x))]); return old.length }} onUpdate={patch} onOpen={(id) => { setCreating(false); setFilter('alle'); setOpenId(id) }} />}
    </div>
  )
}

function Detail({ app, onClose, onPatch, onRemove }: { app: Application; onClose: () => void; onPatch: (p: Partial<Application>) => void; onRemove: () => void }) {
  const nav = useNavigate()
  const { guarded } = useSession()
  const { can, types, patterns, changeMembership, addHistory, forms } = useApp()
  const [result, setResult] = useState<string | null>(null)
  const [showPdf, setShowPdf] = useState(false)
  const [blank, setBlank] = useState(false)
  const form = forms.find((f) => f.name === app.formName)
  const version = form?.versions.find((v) => v.v === app.formVersion) ?? form!.versions[0]

  /** Approving does the work: assigns the membership and says what it means for the fees. */
  // What the answers do is set on the fields of the form ("Wirkung bei Genehmigung"), not guessed from their labels.
  const byEffect = (e: Effect) => { const fld = version.fields.find((x) => x.effect === e); return fld ? app.answers[fld.label] : undefined }
  const approve = () => {
    const exitDate = byEffect('austrittZum') ?? app.answers['Austritt zum']
    const validFrom = byEffect('gueltigAb') ?? app.answers['Gültig ab']
    onPatch({ status: 'Genehmigt', decidedBy: `Schriftführer, ${TODAY_TXT}` })
    const who = members.find((m) => m.id === app.memberId) ?? members.find((m) => m.name === app.person)
    if (app.kind === 'Beendigung') { if (who) addHistory(who.id, 'Mitgliedschaft', `${app.answers.Art === 'Ausschluss' ? 'Ausschluss' : 'Austritt'} zum ${exitDate}`, { appId: app.id }); return setResult(`Mitgliedschaft endet zum ${exitDate}. Offene Beiträge bleiben fällig. In der Mitgliederliste steht jetzt „Austritt zum …“.`) }
    const person = members.find((m) => m.id === app.memberId) ?? members.find((m) => m.name === app.person)
    const t = types.find((x) => x.name === (byEffect('mitgliedschaft') ?? (app.kind === 'Neu' ? app.answers['Gewünschte Mitgliedschaft'] : app.answers['Neue Mitgliedschaft']))) ?? types[0]
    if (person) changeMembership(person.id, t.id, { appId: app.id, text: app.kind === 'Neu' ? `Aufnahme: ${t.name}` : undefined, details: validFrom ? [`Gültig ab ${validFrom}`] : undefined })
    const pattern = patterns.find((x) => x.id === t.patternId)!
    const [first, second] = schedule(new Date(2026, 10, 7), t.amount, pattern, 2, t.renew)
    setResult(`${app.person} hat jetzt die Mitgliedschaft ${t.name} (${pattern.name}). Erster Beitrag: ${eur(first.amount)} (${first.note})${second ? `, danach ${eur(second.amount)} am ${fmtDate(second.date)}` : t.duration ? `, einmalig, die Mitgliedschaft endet nach ${durationText(t.duration)}` : ''}.${app.kind === 'Änderung' && validFrom ? ` Gültig ab ${validFrom}.` : ''}`)
  }

  const knownKeys = new Set(version.fields.filter((f) => f.source).map((f) => f.label))

  return (
    <Drawer open title={`${KIND_LABEL[app.kind]}: ${app.person}`} onClose={onClose} size="xl"
      footer={app.status === 'Unterzeichnet' && can('members.applications.decide') ? (
        <div className="flex gap-2"><Button variant="primary" className="flex-1" onClick={() => guarded('members.applications.decide', approve)}>Genehmigen</Button><Button variant="danger" onClick={() => guarded('members.applications.decide', () => onPatch({ status: 'Abgelehnt', decidedBy: `Schriftführer, ${TODAY_TXT}` }))}>Ablehnen</Button></div>
      ) : undefined}>
      <div className="space-y-5">
        {result && <Banner>{result}</Banner>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2"><Badge tone={statusTone[app.status]}>{app.status}</Badge>{app.lang === 'en' && <Badge>English</Badge>}{app.channel && <Badge>{app.channel === 'Link' ? 'online per Link' : app.channel === 'Papier' ? 'Papierformular' : app.channel === 'Vor Ort' ? 'vor Ort' : 'Vorstand, ohne Unterschrift'}</Badge>}<span className="text-sm text-muted">{nextStep[app.status]}</span></div>
          <span className="inline-flex items-center gap-1 text-xs text-muted"><Lock size={12} /> {app.formName}, Version {app.formVersion}, unveränderlich</span>
        </div>

        {(app.status === 'Link aktiv' || app.status === 'Abgelaufen') && (
          <Card className="space-y-4 p-4">
            <div className="text-sm font-medium">{app.status === 'Link aktiv' ? 'Die Person füllt den Antrag ohne Login aus.' : 'Der Link ist abgelaufen. Erzeuge einen neuen, den kopierst du oder schickst ihn per Mail.'}</div>
            {app.status === 'Link aktiv' && <LinkShare app={app} onMail={(to) => { onPatch({ mailedTo: to, email: to }); setResult(`Mail mit dem Link an ${to} gesendet.`) }} />}
            <div className="flex flex-wrap gap-2">
              <Button variant={app.status === 'Abgelaufen' ? 'primary' : 'secondary'} onClick={() => { onPatch({ status: 'Link aktiv', expires: EXPIRES_TXT, mailedTo: undefined }); setResult(`Neuer Link erzeugt, gültig bis ${EXPIRES_TXT}. Der alte Link funktioniert nicht mehr.`) }}>Neuen Link erzeugen (72 h)</Button>
              {app.status === 'Link aktiv' && <Button onClick={() => nav(`/antrag/${app.id}`)}>Link öffnen (Vorschau)</Button>}
              <Button variant="danger" onClick={onRemove}>Zurückziehen</Button>
            </div>
          </Card>
        )}

        {app.status === 'Papier erwartet' && <PaperPanel app={app} version={version} onPatch={onPatch} onBlank={() => setBlank(true)} onRemove={onRemove} />}

        <section>
          <h3 className="mb-2 text-sm font-semibold">Angaben</h3>
          <div className="divide-y divide-line rounded-xl border border-line">
            {Object.entries(app.answers).map(([k, v]) => <div key={k} className="flex justify-between gap-4 px-4 py-2.5 text-sm"><span className="text-muted">{k}{knownKeys.has(k) && <Lock size={11} className="ml-1 inline" />}</span><span className="text-right font-medium">{v}</span></div>)}
            {Object.keys(app.answers).length === 0 && <p className="px-4 py-3 text-sm text-muted">Noch nichts ausgefüllt.</p>}
          </div>
          {app.note && <p className="mt-2 rounded-lg bg-warn-soft px-3 py-2 text-xs text-amber-900">{app.note}</p>}
        </section>

        {app.pdf ? (
          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <div className="flex items-center justify-between"><span className="flex items-center gap-2"><FileText size={16} /><span><b>{app.pdf}</b><span className="block text-xs text-muted">{app.channel === 'Vorstand' ? 'ohne Unterschrift abgelegt' : `unterzeichnet ${app.signedAt}`}, beim Mitglied gespeichert</span></span></span><div className="flex gap-2"><Button onClick={() => setShowPdf(!showPdf)}>{showPdf ? 'Vorschau schließen' : 'PDF ansehen'}</Button></div></div>
            {showPdf && <div className="mt-3"><PdfSheet title={form ? nameOf(form, app.lang) : app.formName} lang={app.lang} version={version} answers={app.answers} signedAt={app.signedAt} channel={app.channel} note={app.note} verified={app.verified} no={`A-${app.id.toUpperCase()}`} /></div>}
          </div>
        ) : null}

        <ol className="space-y-2 text-sm">
          <Step done label={`Antrag angelegt ${app.date}`} />
          <Step done={!!app.signedAt} label={app.signedAt ? `Ausgefüllt und unterschrieben ${app.signedAt}` : 'Ausfüllen und Unterschrift fehlen'} />
          <Step done={app.status === 'Genehmigt' || app.status === 'Abgelehnt'} label={app.decidedBy ? `${app.status}: ${app.decidedBy}` : 'Entscheidung offen'} />
        </ol>
      </div>

      <Drawer open={blank} title={`Blanko-PDF: ${app.formName}`} onClose={() => setBlank(false)} size="xl">
        <PdfSheet title={form ? nameOf(form, app.lang) : app.formName} lang={app.lang} version={version} answers={app.answers} prefilled />
      </Drawer>
    </Drawer>
  )
}

/**
 * A paper form came back: upload the scan or photo, type the data in, then it continues like any other signed application.
 * The upload alone changes nothing, the data is entered here by hand and checked against the paper.
 */
function PaperPanel({ app, version, onPatch, onBlank, onRemove }: { app: Application; version: Parameters<typeof FormFields>[0]['version']; onPatch: (p: Partial<Application>) => void; onBlank: () => void; onRemove: () => void }) {
  const [file, setFile] = useState('')
  const [vals, setVals] = useState<Record<string, string>>({})
  const ref = useRef<HTMLInputElement>(null)
  const values = { ...app.answers, ...vals }
  const missing = missingFields(version, values)
  const last = app.person.split(' ').pop() ?? ''
  return (
    <Card className="space-y-4 p-4">
      <div className="text-sm font-medium">Das ausgefüllte Formular ist da? Scan hochladen und die Angaben übernehmen.</div>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onBlank}>Blanko-PDF nochmal ansehen</Button>
        <input ref={ref} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0]?.name ?? '')} />
        <Button onClick={() => ref.current?.click()}><Upload size={14} /> {file ? 'Andere Datei wählen' : 'Scan oder Foto hochladen'}</Button>
        {file && <Badge tone="ok">{file}</Badge>}
        <Button variant="danger" onClick={onRemove}>Antrag verwerfen</Button>
      </div>
      {file && (
        <>
          <FormFields version={version} values={values} onChange={(k, v) => setVals({ ...vals, [k]: v })} currentType={app.answers['Bisherige Mitgliedschaft']} locked={app.fixed} lang={app.lang} />
          <Button variant="primary" size="lg" className="w-full" disabled={missing.length > 0} onClick={() => onPatch({ status: 'Unterzeichnet', channel: 'Papier', pdf: file || pdfName(app.kind, last), signedAt: NOW_TXT, answers: answersOf(version, values), ...(app.kind === 'Neu' && values.Vorname ? { person: `${values.Vorname} ${values.Nachname ?? ''}`.trim() } : {}) })}>Angaben übernehmen, unterschrieben</Button>
          {missing.length > 0 && <p className="text-xs text-muted">Noch offen: {missing.join(', ')}</p>}
        </>
      )}
    </Card>
  )
}

const Step = ({ done, label }: { done: boolean; label: string }) => <li className="flex items-center gap-2"><span className={clsx('h-2.5 w-2.5 rounded-full', done ? 'bg-ok' : 'bg-slate-300')} /><span className={done ? '' : 'text-muted'}>{label}</span></li>
