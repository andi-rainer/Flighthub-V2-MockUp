import clsx from 'clsx'
import { ArrowDown, ArrowUp, Check, Lock, X } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../../state'
import { Badge, Banner, Button, Card, Segmented, Switch } from '../../ui'
import { cloneDesign, EFFECT_LABEL, enState, isInput, KIND_LABEL, durationText, nameOf, openCount, outdatedParts, PLACEHOLDERS, SAMPLE, SOURCES, syncDesign, type Effect, type FieldType, type FormField, type FormTemplate, type FormVersion, type Lang } from '../members/data'
import { choicesOf } from '../members/FormFields'
import { TODAY } from './clubSync'
import DesignEditor from './DesignEditor'
import FormPreview from './FormPreview'

type Tab = 'inhalt' | 'gestaltung' | 'versionen'
type NewItem = 'feld' | 'bestaetigung' | 'text' | 'ueberschrift' | 'seite'
const inp = 'h-10 rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-brand disabled:bg-slate-50 disabled:text-muted'
const area = 'w-full rounded-lg border border-line bg-surface p-3 text-sm outline-none focus:border-brand disabled:bg-slate-50 disabled:text-muted'
const application = (k: string) => k === 'Neu' || k === 'Änderung' || k === 'Beendigung'

const ADD: Record<NewItem, { label: string; make: () => FormField }> = {
  feld: { label: 'Feld', make: () => ({ id: `n${Date.now()}`, label: 'Neues Feld', type: 'Text', required: false }) },
  bestaetigung: { label: 'Bestätigung', make: () => ({ id: `n${Date.now()}`, label: 'Ich bestätige, dass …', type: 'Zustimmung', required: true }) },
  text: { label: 'Text', make: () => ({ id: `n${Date.now()}`, label: 'Text', type: 'Absatz', required: false, text: '' }) },
  ueberschrift: { label: 'Überschrift', make: () => ({ id: `n${Date.now()}`, label: 'Neue Überschrift', type: 'Überschrift', required: false }) },
  seite: { label: 'Neue Seite', make: () => ({ id: `n${Date.now()}`, label: 'Neue Seite', type: 'Seitenumbruch', required: false }) },
}

/** Buttons that add something to the form. Between two items a slim version appears on hover, at the end the full row. */
function AddBar({ items, onAdd, slim }: { items: NewItem[]; onAdd: (k: NewItem) => void; slim?: boolean }) {
  const buttons = items.map((k) => <button key={k} onClick={() => onAdd(k)} className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs font-medium text-brand hover:bg-brand-soft">+ {ADD[k].label}</button>)
  return slim
    ? <div className="group relative -my-1 flex h-5 items-center justify-center"><div className="absolute inset-x-0 top-1/2 border-t border-dashed border-line opacity-0 group-focus-within:opacity-100 group-hover:opacity-100" /><div className="relative flex gap-1 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">{buttons}</div></div>
    : <div className="flex flex-wrap gap-2">{buttons}</div>
}

/**
 * One form, all in one place: content (fields and texts in one order), design and versions. Everything that makes up the look and the
 * content of a form is part of ONE version. A published version is locked, so a form that was used never changes; changes go into a new version.
 */
export default function FormEditor({ form }: { form: FormTemplate }) {
  const { forms, setForms, types, branding, club } = useApp()
  const [tab, setTab] = useState<Tab>('inhalt')
  const [viewV, setViewV] = useState<number | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [lang, setLang] = useState<Lang>('de')
  const [onlyOpen, setOnlyOpen] = useState(false)
  const draft = form.versions.find((v) => v.status === 'entwurf')
  const active = form.versions.find((v) => v.status === 'aktiv')
  const shown: FormVersion = form.versions.find((v) => v.v === viewV) ?? draft ?? active!
  const editable = shown.status === 'entwurf'
  const update = (fn: (t: FormTemplate) => FormTemplate) => setForms(forms.map((x) => (x.id === form.id ? fn(x) : x)))
  const patch = (p: Partial<FormVersion>) => update((t) => ({ ...t, versions: t.versions.map((v) => (v.v === shown.v ? { ...v, ...p } : v)) }))
  const next = Math.max(...form.versions.map((v) => v.v)) + 1
  /** A new version starts with the content of the shown one and the CURRENT club data (parts that are overridden stay). */
  const newVersion = () => { update((t) => ({ ...t, versions: [{ v: next, status: 'entwurf', fields: shown.fields.map((x) => ({ ...x })), design: syncDesign(cloneDesign(shown.design), club) }, ...t.versions] })); setViewV(next); setNote(null) }
  const discard = () => { update((t) => ({ ...t, versions: t.versions.filter((v) => v.status !== 'entwurf') })); setViewV(null) }
  const publish = () => {
    update((t) => ({ ...t, versions: t.versions.map((v) => (v.status === 'entwurf' ? { ...v, status: 'aktiv', since: TODAY } : v.status === 'aktiv' ? { ...v, status: 'archiviert' } : v)) }))
    setNote(`Version ${shown.v} ist veröffentlicht und gesperrt. Bereits ausgefüllte Formulare behalten ihre Version und ihr Aussehen.`); setViewV(null)
  }
  /** Changing the German text marks an existing English text as "check again". */
  const patchField = (i: number, p: Partial<FormField>) => patch({ fields: shown.fields.map((x, k) => (k !== i ? x : { ...x, ...p, ...(('label' in p || 'text' in p) && x.en ? { en: { ...x.en, stale: true } } : {}) })) })
  const setEn = (i: number, p: NonNullable<FormField['en']>) => patch({ fields: shown.fields.map((x, k) => (k === i ? { ...x, en: { ...x.en, ...p, stale: false } } : x)) })
  const open = openCount(form, shown)
  /** An effect belongs to ONE field: giving it to another field takes it away from the first. */
  const setEffect = (i: number, effect?: Effect) => patch({ fields: shown.fields.map((x, k) => (k === i ? { ...x, effect } : effect && x.effect === effect ? { ...x, effect: undefined } : x)) })
  const insert = (at: number, kind: NewItem) => patch({ fields: [...shown.fields.slice(0, at), ADD[kind].make(), ...shown.fields.slice(at)] })
  const move = (i: number, by: -1 | 1) => { const a = [...shown.fields]; [a[i], a[i + by]] = [a[i + by], a[i]]; patch({ fields: a }) }
  const remove = (i: number) => patch({ fields: shown.fields.filter((_, k) => k !== i) })
  const sources = SOURCES[form.kind]
  const isApp = application(form.kind)
  const system = form.kind === 'Dokument'
  const addable: NewItem[] = system ? ['text'] : ['feld', 'bestaetigung', 'text', 'ueberschrift', 'seite']
  const stale = shown.status !== 'archiviert' ? outdatedParts(shown.design, club) : []

  /** Move up/down/remove for every item. */
  const tools = (i: number, locked?: boolean) => editable && !locked && (
    <span className="flex shrink-0 items-center">
      <button aria-label="Nach oben" disabled={i === 0} onClick={() => move(i, -1)} className="grid h-9 w-8 place-items-center rounded-md hover:bg-slate-100 disabled:opacity-30"><ArrowUp size={14} /></button>
      <button aria-label="Nach unten" disabled={i === shown.fields.length - 1} onClick={() => move(i, 1)} className="grid h-9 w-8 place-items-center rounded-md hover:bg-slate-100 disabled:opacity-30"><ArrowDown size={14} /></button>
      <button aria-label="Entfernen" onClick={() => remove(i)} className="grid h-9 w-9 place-items-center rounded-md hover:bg-slate-100"><X size={14} /></button>
    </span>
  )

  const blockCard = (fl: FormField, i: number) => {
    if (fl.type === 'Seitenumbruch') {
      return <div key={fl.id} className="flex items-center gap-3 rounded-xl border border-dashed border-line px-3 py-1.5 text-xs text-muted"><span className="h-px flex-1 bg-line" />Neue Seite im PDF<span className="h-px flex-1 bg-line" />{tools(i)}</div>
    }
    if (fl.type === 'Überschrift') {
      return (
        <div key={fl.id} className="flex items-center gap-2 rounded-xl border border-line p-3">
          <Badge>Überschrift</Badge>
          <input disabled={!editable} value={fl.label} onChange={(e) => patchField(i, { label: e.target.value })} aria-label="Überschrift" className={clsx(inp, 'min-w-0 flex-1 font-semibold')} />
          {tools(i)}
        </div>
      )
    }
    return (
      <div key={fl.id} className="space-y-2 rounded-xl border border-line p-3">
        <div className="flex items-center justify-between gap-2"><Badge>{fl.highlight ? 'Text, hervorgehoben' : 'Text'}</Badge>{tools(i, fl.system)}</div>
        <textarea disabled={!editable} rows={Math.min(8, Math.max(3, (fl.text ?? '').split('\n').length + 1))} value={fl.text ?? ''} onChange={(e) => patchField(i, { text: e.target.value })} aria-label="Text" className={area} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm"><Switch disabled={!editable} checked={!!fl.highlight} onChange={(v) => patchField(i, { highlight: v })} label="Hervorheben" />Hervorheben (z. B. Haftungsausschluss)</label>
          {editable && (
            <div className="flex flex-wrap items-center gap-1 text-xs text-muted">Vereinsdaten einfügen:
              {PLACEHOLDERS.map(([k]) => <button key={k} onClick={() => patchField(i, { text: `${fl.text ?? ''}{${k}}` })} className="rounded-full border border-line px-2 py-0.5 hover:bg-slate-50">{k}</button>)}
            </div>
          )}
        </div>
      </div>
    )
  }

  const fieldCard = (fl: FormField, i: number) => {
    const sample = fl.source ? SAMPLE[fl.source.split(': ')[1]] : undefined
    const opts = fl.options
    const long = fl.type === 'Zustimmung'
    return (
      <div key={fl.id} className="space-y-2.5 rounded-xl border border-line p-3">
        <div className="flex flex-wrap items-start gap-2">
          {long
            ? <textarea disabled={!editable || fl.system} rows={2} value={fl.label} onChange={(e) => patchField(i, { label: e.target.value })} aria-label="Bestätigungstext" className={clsx(area, 'min-w-0 flex-1')} />
            : <input disabled={!editable || fl.system} value={fl.label} onChange={(e) => patchField(i, { label: e.target.value })} aria-label="Feldname" className={clsx(inp, 'min-w-0 flex-1')} />}
          <select disabled={!editable || fl.system} value={fl.type} onChange={(e) => { const type = e.target.value as FieldType; patchField(i, { type, options: type === 'Auswahl' ? { kind: 'mitgliedschaften', exclude: [], hideCurrent: false } : undefined, effect: undefined, source: type === 'Zustimmung' ? undefined : fl.source }) }} aria-label="Feldtyp" className={inp}><option value="Text">Text</option><option value="Datum">Datum</option><option value="Zustimmung">Bestätigung</option><option value="Auswahl">Auswahl</option></select>
          <label className="flex h-10 items-center gap-1.5 text-xs text-muted">Pflicht<Switch disabled={!editable || !!fl.source || fl.system} checked={fl.required} onChange={(v) => patchField(i, { required: v })} label={`${fl.label} Pflichtfeld`} /></label>
          {tools(i, fl.system)}
        </div>

        {!fl.system && sources && fl.type !== 'Zustimmung' && (
          <label className="flex flex-wrap items-center gap-2 text-sm"><span className="text-muted">Wer füllt es aus?</span>
            <select disabled={!editable} value={fl.source ?? ''} onChange={(e) => patchField(i, e.target.value ? { source: e.target.value, required: true, options: undefined, effect: undefined } : { source: undefined })} aria-label="Wer füllt es aus" className={inp}>
              <option value="">Die Person trägt es ein</option>
              {sources.items.map((it) => <option key={it} value={`${sources.group}: ${it}`}>Vorbelegt aus {sources.group}: {it}</option>)}
            </select>
          </label>
        )}

        {fl.type === 'Auswahl' && !fl.source && (
          <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
            <label className="flex flex-wrap items-center gap-2"><span className="text-muted">Auswahl aus</span>
              <select disabled={!editable} value={opts?.kind ?? 'mitgliedschaften'} onChange={(e) => patchField(i, { options: e.target.value === 'liste' ? { kind: 'liste', items: ['Option 1', 'Option 2'] } : { kind: 'mitgliedschaften', exclude: [], hideCurrent: false } })} aria-label="Auswahl aus" className={inp}><option value="mitgliedschaften">den Mitgliedschaften des Vereins</option><option value="liste">einer eigenen Liste</option></select>
            </label>
            {(!opts || opts.kind === 'mitgliedschaften') && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {types.filter((t) => !t.checkin).map((t) => {
                    const off = opts?.kind === 'mitgliedschaften' && opts.exclude.includes(t.id)
                    return <button key={t.id} disabled={!editable} onClick={() => patchField(i, { options: { kind: 'mitgliedschaften', hideCurrent: opts?.kind === 'mitgliedschaften' ? opts.hideCurrent : false, exclude: off ? (opts as { exclude: string[] }).exclude.filter((x) => x !== t.id) : [...(opts?.kind === 'mitgliedschaften' ? opts.exclude : []), t.id] } })} className={clsx('rounded-full border px-3 py-1 text-xs', off ? 'border-line text-muted line-through' : 'border-brand bg-brand-soft text-brand')}>{t.name}</button>
                  })}
                </div>
                {isApp && form.kind !== 'Neu' && <label className="flex items-center gap-2"><Switch disabled={!editable} checked={opts?.kind === 'mitgliedschaften' && opts.hideCurrent} onChange={(v) => patchField(i, { options: { kind: 'mitgliedschaften', exclude: opts?.kind === 'mitgliedschaften' ? opts.exclude : [], hideCurrent: v } })} label="Bisherige Mitgliedschaft nicht anbieten" />Bisherige Mitgliedschaft des Mitglieds nicht anbieten</label>}
              </>
            )}
            {opts?.kind === 'liste' && <ListEditor items={opts.items} disabled={!editable} onChange={(items) => patchField(i, { options: { kind: 'liste', items } })} />}
          </div>
        )}

        {isApp && !fl.source && (fl.type === 'Auswahl' || fl.type === 'Datum') && (
          <label className="flex flex-wrap items-center gap-2 text-sm"><span className="text-muted">Wirkung bei Genehmigung</span>
            <select disabled={!editable} value={fl.effect ?? ''} onChange={(e) => setEffect(i, (e.target.value || undefined) as Effect | undefined)} aria-label="Wirkung bei Genehmigung" className={inp}>
              <option value="">Keine, wird nur gespeichert</option>
              {fl.type === 'Auswahl' && <option value="mitgliedschaft">{EFFECT_LABEL.mitgliedschaft}</option>}
              {fl.type === 'Datum' && <option value="gueltigAb">{EFFECT_LABEL.gueltigAb}</option>}
              {fl.type === 'Datum' && <option value="austrittZum">{EFFECT_LABEL.austrittZum}</option>}
            </select>
          </label>
        )}

        <div className="text-xs text-muted">
          {fl.system ? `Wird automatisch eingesetzt aus ${fl.source}.`
            : fl.type === 'Zustimmung' ? <>Die Person bestätigt diesen Punkt einzeln mit einem Häkchen.{fl.required ? ' Ohne Häkchen kann sie nicht abschicken.' : ' Pflicht ist aus, das Häkchen ist freiwillig.'}</>
            : fl.source ? <>Vorbelegt aus <b>{fl.source}</b>, die Person kann es nicht ändern. Beispiel: „{sample ?? '–'}“</>
            : fl.type === 'Auswahl' ? <>Die Person wählt: <b>{choicesOf(fl, types, 'Ordentlich').join(', ') || 'nichts zur Wahl'}</b>{opts?.kind === 'mitgliedschaften' && opts.hideCurrent ? ' (Beispiel: Mitglied mit „Ordentlich“)' : ''}</>
            : 'Die Person trägt es selbst ein.'}
          {fl.effect && <span className="ml-1 font-medium text-ink">· Bei Genehmigung: {EFFECT_LABEL[fl.effect]}</span>}
        </div>
      </div>
    )
  }

  const typeName = (f: FormField) => (f.type === 'Überschrift' ? 'Überschrift' : f.type === 'Absatz' ? 'Text' : f.type === 'Zustimmung' ? 'Bestätigung' : 'Feld')
  const total = shown.fields.filter((f) => enState(f)).length + 1
  const stateBadge = (st?: 'ok' | 'fehlt' | 'pruefen') => st === 'ok' ? <Badge tone="ok"><Check size={11} className="mr-1" />fertig</Badge> : st === 'pruefen' ? <Badge tone="warn">Deutsch geändert, prüfen</Badge> : <Badge tone="warn">fehlt</Badge>
  /** The English view: every German text with its English text below. Structure is edited in German only. */
  const trCard = (fl: FormField, i: number) => {
    if (fl.type === 'Seitenumbruch') return onlyOpen ? null : <div key={fl.id} className="flex items-center gap-3 px-3 py-0.5 text-xs text-muted"><span className="h-px flex-1 bg-line" />Neue Seite<span className="h-px flex-1 bg-line" /></div>
    const st = enState(fl)
    if (!st || (onlyOpen && st === 'ok')) return null
    const para = fl.type === 'Absatz'
    const de = para ? fl.text : fl.label
    const val = para ? fl.en?.text ?? '' : fl.en?.label ?? ''
    const set = (v: string) => setEn(i, para ? { text: v } : { label: v })
    return (
      <div key={fl.id} className={clsx('space-y-2 rounded-xl border p-3', st === 'ok' ? 'border-line' : 'border-warn')}>
        <div className="flex items-center justify-between gap-2"><span className="text-xs font-medium uppercase tracking-wide text-muted">{typeName(fl)}</span>{stateBadge(st)}</div>
        <div className="whitespace-pre-line rounded-lg bg-slate-50 px-3 py-2 text-sm text-muted">{de}</div>
        {para || fl.type === 'Zustimmung'
          ? <textarea disabled={!editable} rows={para ? Math.min(8, Math.max(2, (de ?? '').split('\n').length + 1)) : 2} value={val} onChange={(e) => set(e.target.value)} placeholder="English" aria-label="English" className={area} />
          : <input disabled={!editable} value={val} onChange={(e) => set(e.target.value)} placeholder="English" aria-label="English" className={clsx(inp, 'w-full')} />}
        {st === 'pruefen' && editable && <div className="flex items-center justify-between gap-2 text-xs text-muted">Der deutsche Text wurde geändert.<Button onClick={() => setEn(i, {})}>Übersetzung passt</Button></div>}
      </div>
    )
  }
  const translateView = (
    <div className="space-y-3">
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm"><b>English</b> · {total - open} von {total} fertig</div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={onlyOpen} onChange={setOnlyOpen} label="Nur offene zeigen" />Nur offene zeigen</label>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-ok" style={{ width: `${((total - open) / total) * 100}%` }} /></div>
        {!editable && <div className="text-xs text-muted">Übersetzungen ändert man nur in einem Entwurf.</div>}
      </Card>
      {!(onlyOpen && form.nameEn?.trim()) && (
        <div className={clsx('space-y-2 rounded-xl border p-3', form.nameEn?.trim() ? 'border-line' : 'border-warn')}>
          <div className="flex items-center justify-between gap-2"><span className="text-xs font-medium uppercase tracking-wide text-muted">Titel des Formulars</span>{stateBadge(form.nameEn?.trim() ? 'ok' : 'fehlt')}</div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-muted">{form.name}</div>
          <input disabled={!editable} value={form.nameEn ?? ''} onChange={(e) => update((t) => ({ ...t, nameEn: e.target.value }))} placeholder="English" aria-label="English title" className={clsx(inp, 'w-full')} />
        </div>
      )}
      {shown.fields.map(trCard)}
      {onlyOpen && open === 0 && <Card className="p-5 text-center text-sm text-muted">Alles übersetzt.</Card>}
    </div>
  )

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
      <div className="space-y-4">
        <Card className="space-y-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><div className="text-xs uppercase tracking-wide text-muted">{KIND_LABEL[form.kind]}</div>
              <div className="flex flex-wrap items-center gap-2 text-lg font-semibold">{nameOf(form, lang)} · Version {shown.v} {shown.status === 'entwurf' ? <Badge tone="warn">Entwurf</Badge> : shown.status === 'aktiv' ? <Badge tone="ok"><Lock size={11} className="mr-1" />aktiv seit {shown.since}</Badge> : <Badge>archiviert</Badge>}</div></div>
            <div className="flex flex-wrap gap-2">
              {draft && shown.status === 'entwurf' && <><Button onClick={discard}>Entwurf verwerfen</Button><Button variant="primary" disabled={open > 0} onClick={publish}>Veröffentlichen</Button></>}
              {!draft && <Button variant="primary" onClick={newVersion}>Neue Version erstellen</Button>}
              {draft && shown.status !== 'entwurf' && <Button onClick={() => setViewV(draft.v)}>Zum Entwurf</Button>}
            </div>
          </div>
          {form.kind === 'Beförderung' && (() => { const t = types.find((x) => x.checkin); return t && <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">Mitgliedschaft nach dem Check-in: <b>{t.name}</b>{t.duration ? `, endet nach ${durationText(t.duration)}` : ''}</div> })()}
          {!editable && <Banner><span className="flex flex-wrap items-center justify-between gap-2"><span>Version {shown.v} ist {shown.status === 'aktiv' ? 'veröffentlicht' : 'archiviert'} und gesperrt. Änderungen gehen in eine neue Version.</span>{!draft && <Button onClick={newVersion}>Neue Version erstellen</Button>}</span></Banner>}
          {stale.length > 0 && <Banner tone="warn"><span className="flex flex-wrap items-center justify-between gap-2"><span>Die Vereinsdaten haben sich geändert ({stale.join(', ')}). Diese Version zeigt noch die alten Angaben.</span>{editable ? <Button onClick={() => patch({ design: syncDesign(shown.design, club) })}>Aktuelle Vereinsdaten übernehmen</Button> : !draft && <Button onClick={newVersion}>Neue Version mit aktuellen Daten</Button>}</span></Banner>}
          {note && <Banner>{note}</Banner>}
          {editable && open > 0 && <Banner tone="warn"><span className="flex flex-wrap items-center justify-between gap-2"><span>Veröffentlichen geht erst, wenn Deutsch und Englisch vollständig sind. Englisch: {open} offen.</span>{lang === 'de' && <Button onClick={() => { setLang('en'); setTab('inhalt'); setOnlyOpen(true) }}>Englisch ergänzen</Button>}</span></Banner>}
          <div className="flex flex-wrap items-center gap-2 text-sm"><span className="text-muted">Sprache</span>
            <Segmented<Lang> value={lang} onChange={setLang} options={[{ value: 'de', label: 'Deutsch' }, { value: 'en', label: open > 0 ? `English · ${open} offen` : 'English ✓' }]} />
          </div>
          <div className="-mb-3 flex gap-1 overflow-x-auto border-b border-line">
            {([['inhalt', 'Inhalt'], ['gestaltung', 'Gestaltung'], ['versionen', `Versionen (${form.versions.length})`]] as [Tab, string][]).map(([id, l]) => <button key={id} onClick={() => setTab(id)} className={clsx('shrink-0 border-b-2 px-3 py-2 text-sm font-medium', tab === id ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink')}>{l}</button>)}
          </div>
        </Card>

        {tab === 'inhalt' && lang === 'en' && translateView}
        {tab === 'inhalt' && lang === 'de' && (
          <div className="space-y-3">
            {shown.fields.map((fl, i) => (
              <div key={fl.id} className="space-y-3">
                {editable && i > 0 && <AddBar slim items={addable} onAdd={(k) => insert(i, k)} />}
                {isInput(fl) ? fieldCard(fl, i) : blockCard(fl, i)}
              </div>
            ))}
            {editable && <AddBar items={addable} onAdd={(k) => insert(shown.fields.length, k)} />}
          </div>
        )}
        {tab === 'gestaltung' && <DesignEditor design={shown.design} disabled={!editable} onChange={(design) => patch({ design })} extra={editable && <Button onClick={() => patch({ design: cloneDesign(branding) })}>Standard-Gestaltung übernehmen</Button>} />}
        {tab === 'versionen' && (
          <Card className="divide-y divide-line overflow-hidden">
            {form.versions.map((v) => (
              <div key={v.v} className={clsx('flex items-center justify-between gap-3 px-5 py-3 text-sm', v.v === shown.v && 'bg-brand-soft')}>
                <span>Version {v.v}{v.since ? <span className="text-muted"> · seit {v.since}</span> : ''}</span>
                <span className="flex items-center gap-3"><Badge tone={v.status === 'aktiv' ? 'ok' : v.status === 'entwurf' ? 'warn' : 'neutral'}>{v.status}</Badge>{v.v !== shown.v && <button onClick={() => setViewV(v.v)} className="text-brand hover:underline">Ansehen</button>}</span>
              </div>
            ))}
          </Card>
        )}
      </div>
      <div className="xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:self-start xl:overflow-y-auto"><FormPreview form={form} version={shown} lang={lang} /></div>
    </div>
  )
}

function ListEditor({ items, onChange, disabled }: { items: string[]; onChange: (i: string[]) => void; disabled: boolean }) {
  const [text, setText] = useState('')
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">{items.map((it) => <span key={it} className="inline-flex items-center gap-1 rounded-full border border-brand bg-brand-soft px-3 py-1 text-xs text-brand">{it}{!disabled && <button aria-label={`${it} entfernen`} onClick={() => onChange(items.filter((x) => x !== it))}><X size={12} /></button>}</span>)}</div>
      {!disabled && <div className="flex gap-2"><input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && text.trim()) { onChange([...items, text.trim()]); setText('') } }} placeholder="Möglichkeit hinzufügen" className={clsx(inp, 'flex-1')} /><Button disabled={!text.trim()} onClick={() => { onChange([...items, text.trim()]); setText('') }}>Hinzufügen</Button></div>}
    </div>
  )
}
