import clsx from 'clsx'
import { Building2, Palette, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../state'
import { Badge, Button, Card, Drawer, PageHeader } from '../ui'
import DesignEditor from './forms/DesignEditor'
import FormEditor from './forms/FormEditor'
import PdfSheet from './members/PdfSheet'
import { cloneDesign, type FormKind, type FormTemplate } from './members/data'

const STANDARD = '__standard'
const groups: { title: string; kinds: FormKind[] }[] = [
  { title: 'Anträge', kinds: ['Neu', 'Änderung', 'Beendigung'] },
  { title: 'Tandem-Check-in', kinds: ['Beförderung'] },
  { title: 'Dokumente', kinds: ['Dokument'] },
  { title: 'Eigene Formulare', kinds: ['Eigenes'] },
]

/**
 * ALL forms and documents of the club in one place: applications, the tandem carriage agreement, the invoice and own forms.
 * Each one has fields, texts, design and versions together. The standard letterhead is the template for new forms and versions.
 */
export default function FormsPage() {
  const { forms, setForms, apps, branding, setLayout, can } = useApp()
  const [sel, setSel] = useState<string>(forms[0].id)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [nameEn, setNameEn] = useState('')
  const form = forms.find((f) => f.id === sel)
  const create = () => {
    const t: FormTemplate = { id: `f-${Date.now()}`, name: name.trim(), nameEn: nameEn.trim(), kind: 'Eigenes', purpose: 'Eigenes Formular', versions: [{ v: 1, status: 'entwurf', design: cloneDesign(branding), fields: [{ id: 'vn', label: 'Vorname', type: 'Text', required: true, en: { label: 'First name' } }, { id: 'nn', label: 'Nachname', type: 'Text', required: true, en: { label: 'Last name' } }] }] }
    setForms([...forms, t]); setSel(t.id); setCreating(false); setName(''); setNameEn('')
  }
  const used = (t: FormTemplate) => t.kind === 'Beförderung' ? 'beim Check-in' : t.kind === 'Dokument' ? 'beim Beitragslauf' : t.kind === 'Eigenes' ? '' : `${apps.filter((a) => a.kind === t.kind).length} ${apps.filter((a) => a.kind === t.kind).length === 1 ? 'Antrag' : 'Anträge'}`

  return (
    <>
      <PageHeader title="Formulare" actions={<div className="flex gap-2">{can('settings.edit.system') && <Link to="/verein"><Button><Building2 size={16} /> Vereinsdaten</Button></Link>}<Button variant="primary" onClick={() => setCreating(true)}><Plus size={16} /> Neues Formular</Button></div>} />
      <Card className="mb-5 flex flex-wrap gap-x-6 gap-y-3 p-4">
        {groups.map((g) => {
          const list = forms.filter((f) => g.kinds.includes(f.kind))
          return list.length > 0 && (
            <div key={g.title}>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{g.title}</div>
              <div className="flex flex-wrap gap-2">
                {list.map((t) => {
                  const act = t.versions.find((v) => v.status === 'aktiv')
                  const dr = t.versions.find((v) => v.status === 'entwurf')
                  return (
                    <button key={t.id} onClick={() => setSel(t.id)} className={clsx('flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm', sel === t.id ? 'border-brand bg-brand-soft' : 'border-line hover:bg-slate-50')}>
                      <span><span className="block font-medium leading-tight">{t.name}</span>{used(t) && <span className="block text-xs text-muted">{used(t)}</span>}</span>
                      {dr ? <Badge tone="warn">Entwurf</Badge> : <Badge tone="ok">V{act?.v}</Badge>}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Vorlage für neue Formulare</div>
          <button onClick={() => setSel(STANDARD)} className={clsx('flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium', sel === STANDARD ? 'border-brand bg-brand-soft' : 'border-line hover:bg-slate-50')}><Palette size={16} className="text-muted" />Standard-Gestaltung</button>
        </div>
      </Card>

      {sel === STANDARD && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
          <DesignEditor mode="standard" design={branding} onChange={(b) => setLayout({ align: b.align, show: b.show, accent: b.accent })} />
          <div className="xl:sticky xl:top-4 xl:self-start">{forms[0] && <PdfSheet title={forms[0].name} version={{ ...forms[0].versions[0], design: branding }} />}</div>
        </div>
      )}
      {form && <FormEditor key={form.id} form={form} />}

      <Drawer open={creating} title="Neues Formular" onClose={() => setCreating(false)} footer={<Button variant="primary" size="lg" className="w-full" disabled={!name.trim() || !nameEn.trim()} onClick={create}>Formular anlegen</Button>}>
        <div className="space-y-4">
          <label className="block text-sm font-medium">Name auf Deutsch<input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Einverständnis Jugendliche" className="mt-1 h-11 w-full rounded-lg border border-line px-3 text-sm outline-none focus:border-brand" /></label>
          <label className="block text-sm font-medium">Name in English<input value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="e.g. Consent for minors" className="mt-1 h-11 w-full rounded-lg border border-line px-3 text-sm outline-none focus:border-brand" /></label>
        </div>
      </Drawer>
    </>
  )
}
