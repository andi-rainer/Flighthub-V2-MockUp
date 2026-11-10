import { ChevronRight, ExternalLink, FileText, Plus } from 'lucide-react'
import { useState } from 'react'
import { ActionPanel, Badge, Button, ConfirmDelete, Drawer, field, Field, FilePick, Row, Section, Segmented, Switch } from '../../ui'
import { TODAY_ISO, useApp } from '../../state'
import { useActor } from '../tickets/parts'
import { docState, type AcDoc, type DocVersion } from './data'
import { dmy, useAircraft } from './parts'

type Filter = 'alle' | 'bald' | 'abgelaufen'
const tone = { ok: 'ok', warn: 'warn', bad: 'bad', none: 'neutral' } as const

/**
 * Opens a document. Every member can read the documents of the aircraft (insurance, ARC, handbook ...), so the file is kept and opens for
 * everybody. The dummy keeps nothing: a file picked in this session opens, a seed document shows a placeholder.
 */
function openDoc(file: string, url?: string) {
  const href = url ?? URL.createObjectURL(new Blob([`Klickdummy: Hier würde die Datei „${file}“ geöffnet.`], { type: 'text/plain;charset=utf-8' }))
  window.open(href, '_blank', 'noopener')
}

/**
 * Aircraft documents (insurance, ARC, handbook ...). EVERY member can see and open them; uploading needs `aircraft.documents.upload`,
 * deleting `aircraft.documents.manage`. They can expire; a blocking one that ran out stops reservations. Versions are optional per club.
 */
export default function Documents({ id }: { id: string }) {
  const { d } = useAircraft(id)
  const { docVersioning, can } = useApp()
  const mayEdit = can('aircraft.documents.upload')
  const [filter, setFilter] = useState<Filter>('alle')
  const [open, setOpen] = useState<AcDoc | 'new' | null>(null)
  const state = (x: AcDoc) => docState(x, TODAY_ISO)
  const list = [...d.docs].filter((x) => filter === 'alle' || (filter === 'bald' ? state(x).tone === 'warn' : state(x).tone === 'bad')).sort((a, b) => (a.expires ?? '9999').localeCompare(b.expires ?? '9999'))
  const count = (f: Filter) => d.docs.filter((x) => (f === 'bald' ? state(x).tone === 'warn' : state(x).tone === 'bad')).length
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented value={filter} onChange={setFilter} options={[{ value: 'alle', label: `Alle (${d.docs.length})` }, { value: 'bald', label: `Laufen bald ab (${count('bald')})` }, { value: 'abgelaufen', label: `Abgelaufen (${count('abgelaufen')})` }]} />
        {mayEdit && <Button variant="primary" onClick={() => setOpen('new')}><Plus size={14} /> Dokument hochladen</Button>}
      </div>
      <Section title="Dokumente">
        {list.map((x) => {
          const s = state(x)
          return (
            <Row key={x.id} onClick={() => setOpen(x)}
              label={<span className="flex flex-wrap items-center gap-2"><FileText size={15} className="text-muted" />{x.name}{x.blocks && <Badge tone="info">Sperrt Reservierungen</Badge>}{docVersioning && x.versions.length > 0 && <Badge>Version {x.versions.length + 1}</Badge>}</span>}
              hint={`${x.file} · ${x.size} · hochgeladen ${dmy(x.uploadedAt)}${x.tags.length ? ` · ${x.tags.join(', ')}` : ''}`}>
              <button aria-label={`${x.name} öffnen`} title="Öffnen" onClick={() => openDoc(x.file, x.url)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-slate-100 hover:text-ink"><ExternalLink size={15} /></button>
              <div className="text-right"><Badge tone={tone[s.tone]}>{s.label}</Badge>{x.expires && <div className="mt-0.5 text-xs text-muted">bis {dmy(x.expires)}</div>}</div>
              <ChevronRight size={16} className="text-muted" />
            </Row>
          )
        })}
        {list.length === 0 && <p className="px-5 py-4 text-sm text-muted">Keine Dokumente in dieser Ansicht.</p>}
      </Section>
      {open && <DocDrawer id={id} item={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

function DocDrawer({ id, item, onClose }: { id: string; item: AcDoc | 'new'; onClose: () => void }) {
  const { d, editAs } = useAircraft(id)
  const { docVersioning, can } = useApp()
  const mayEdit = can('aircraft.documents.upload'), mayDelete = can('aircraft.documents.manage')
  const edit = (fn: Parameters<typeof editAs>[1]) => editAs('aircraft.documents.upload', fn)
  const actor = useActor()
  const cur = item === 'new' ? undefined : (d.docs.find((x) => x.id === item.id) ?? item)
  const [name, setName] = useState(cur?.name ?? '')
  const [tags, setTags] = useState(cur?.tags.join(', ') ?? '')
  const [expires, setExpires] = useState(cur?.expires ?? '')
  const [blocks, setBlocks] = useState(cur?.blocks ?? false)
  const [file, setFile] = useState<{ name: string; size: string; url?: string } | null>(null)
  const [replacing, setReplacing] = useState(false)
  const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean)
  const valid = name.trim() !== '' && (!!cur || !!file)

  const save = () => {
    edit((x) => {
      if (!cur) return { ...x, docs: [...x.docs, { id: `d-${Date.now()}`, name: name.trim(), tags: tagList, expires: expires || undefined, blocks, file: file!.name, size: file!.size, url: file!.url, uploadedAt: TODAY_ISO, uploadedBy: actor, versions: [] }] }
      return { ...x, docs: x.docs.map((y) => (y.id === cur.id ? { ...y, name: name.trim(), tags: tagList, expires: expires || undefined, blocks } : y)) }
    })
    onClose()
  }
  /** A new file replaces the current one; with versioning the old one stays as an earlier version. */
  const replace = (next: { name: string; size: string; url?: string }, newExpires: string) => {
    edit((x) => ({ ...x, docs: x.docs.map((y) => y.id === cur!.id ? {
      ...y, file: next.name, size: next.size, url: next.url, uploadedAt: TODAY_ISO, uploadedBy: actor, expires: newExpires || undefined,
      versions: docVersioning ? [{ file: y.file, size: y.size, url: y.url, uploadedAt: y.uploadedAt, uploadedBy: y.uploadedBy, expires: y.expires } as DocVersion, ...y.versions] : [],
    } : y) }))
    setExpires(newExpires); setReplacing(false)
  }
  const remove = () => { editAs('aircraft.documents.manage', (x) => ({ ...x, docs: x.docs.filter((y) => y.id !== cur!.id) })); onClose() }

  return (
    <Drawer open title={cur ? cur.name : 'Dokument hochladen'} onClose={onClose}
      footer={!mayEdit ? undefined : <div className="flex flex-wrap items-center justify-between gap-2"><div>{cur && mayDelete && <ConfirmDelete what={cur.name} onConfirm={remove} />}</div><div className="flex gap-2"><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" disabled={!valid} onClick={save}>{cur ? 'Speichern' : 'Hochladen'}</Button></div></div>}>
      <div className="space-y-5 text-sm">
        {!cur && <FilePick file={file} onPick={(f) => { setFile(f); if (!name) setName(f.name.replace(/\.[^.]+$/, '')) }} />}
        {cur && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
              <div className="min-w-0"><div className="truncate font-medium">{cur.file}</div><div className="text-xs text-muted">{cur.size} · {dmy(cur.uploadedAt)} · {cur.uploadedBy}</div></div>
              <div className="flex shrink-0 gap-2"><Button onClick={() => openDoc(cur.file, cur.url)}><ExternalLink size={14} /> Öffnen</Button>{mayEdit && !replacing && <Button onClick={() => setReplacing(true)}>{docVersioning ? 'Neue Version hochladen' : 'Datei ersetzen'}</Button>}</div>
            </div>
            {replacing && <Replace doc={cur} versioning={docVersioning} onDone={replace} onCancel={() => setReplacing(false)} />}
          </div>
        )}
        <fieldset disabled={!mayEdit} className="space-y-4">
          <Field label="Name"><input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} className={`${field} w-full`} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Gültig bis (optional)"><input type="date" aria-label="Gültig bis" value={expires} onChange={(e) => setExpires(e.target.value)} className={`${field} w-full`} /></Field>
            <Field label="Schlagworte"><input aria-label="Schlagworte" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="z. B. Versicherung, Zulassung" className={`${field} w-full`} /></Field>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5"><span className="font-medium">Sperrt Reservierungen, wenn abgelaufen</span><Switch checked={blocks} onChange={setBlocks} label="Sperrt Reservierungen" disabled={!mayEdit} /></div>
        </fieldset>
        {cur && docVersioning && (
          <div>
            <div className="mb-1 font-medium">Versionen</div>
            <ul className="divide-y divide-line rounded-xl border border-line">
              <li className="flex items-center justify-between gap-2 px-3 py-2"><span><b>Version {cur.versions.length + 1}</b> · {cur.file}<span className="block text-xs text-muted">{dmy(cur.uploadedAt)} · {cur.uploadedBy}{cur.expires ? ` · gültig bis ${dmy(cur.expires)}` : ''}</span></span><Badge tone="ok">Aktuell</Badge></li>
              {cur.versions.map((v, i) => <li key={v.uploadedAt + i} className="px-3 py-2"><b>Version {cur.versions.length - i}</b> · <button onClick={() => openDoc(v.file, v.url)} className="text-brand hover:underline">{v.file}</button><span className="block text-xs text-muted">{dmy(v.uploadedAt)} · {v.uploadedBy}{v.expires ? ` · war gültig bis ${dmy(v.expires)}` : ''}</span></li>)}
            </ul>
          </div>
        )}
      </div>
    </Drawer>
  )
}

function Replace({ doc, versioning, onDone, onCancel }: { doc: AcDoc; versioning: boolean; onDone: (f: { name: string; size: string; url?: string }, expires: string) => void; onCancel: () => void }) {
  const [file, setFile] = useState<{ name: string; size: string; url?: string } | null>(null)
  const [expires, setExpires] = useState(doc.expires ?? '')
  return (
    <ActionPanel title={versioning ? 'Neue Version hochladen' : 'Datei ersetzen'} confirm={versioning ? 'Als neue Version speichern' : 'Ersetzen'} disabled={!file || (!!doc.expires && !expires)} onConfirm={() => onDone(file!, expires)} onCancel={onCancel}>
      <FilePick file={file} onPick={setFile} />
      {doc.expires !== undefined && <Field label="Neu gültig bis"><input type="date" aria-label="Neu gültig bis" min={TODAY_ISO} value={expires} onChange={(e) => setExpires(e.target.value)} className={`${field} w-full`} /></Field>}
      {!versioning && <p className="text-xs text-muted">Die bisherige Datei wird überschrieben.</p>}
    </ActionPanel>
  )
}
