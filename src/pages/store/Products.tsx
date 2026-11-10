import clsx from 'clsx'
import { Copy, FileText, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { eur } from '../../data'
import { useApp } from '../../state'
import { Badge, Button, Card, Drawer, Segmented } from '../../ui'
import { KIND_NAME, type CatalogItem } from '../tickets/data'
import { pdfTemplates, type PdfTemplate } from './data'

type View = 'produkte' | 'vorlagen'

/** What the shop shows of the catalog: texts and PDFs. Name, price, validity and availability are managed under Tickets und Voucher. */
export default function Products({ onText }: { onText: (page: string) => void }) {
  const { catalog: products, can } = useApp()
  const nav = useNavigate()
  const [view, setView] = useState<View>('produkte')
  const [open, setOpen] = useState<CatalogItem | null>(null)
  const [tpl, setTpl] = useState<PdfTemplate | null>(null)
  const tplOf = (id: string) => pdfTemplates.find((t) => t.id === id)!
  const usedBy = (id: string) => products.filter((p) => p.templateId === id)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<View> value={view} onChange={setView} options={[{ value: 'produkte', label: 'Produkte' }, { value: 'vorlagen', label: 'PDF-Vorlagen' }]} />
        {view === 'produkte' ? (can('vouchers.catalog.manage') && <Button variant="primary" onClick={() => nav('/tickets?tab=arten')}>Produkte verwalten</Button>) : <Button variant="primary"><Plus size={16} /> Neue Vorlage</Button>}
      </div>

      {view === 'produkte' ? (
        <>
          <Card className="divide-y divide-line">
            {products.map((p) => (
              <div key={p.id} onClick={() => setOpen(p)} className="flex cursor-pointer flex-wrap items-center gap-3 px-5 py-4 hover:bg-slate-50">
                <div className="min-w-0 flex-1 basis-56">
                  <div className="font-medium">{p.name} <Badge tone={p.kind === 'voucher' ? 'info' : 'neutral'}>{KIND_NAME[p.kind]}</Badge>{!p.active && <> <Badge>Ausgeschaltet</Badge></>}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <FileText size={12} /> {tplOf(p.templateId).name}
                    <span>· sichtbar auf:</span>
                    {p.shownOn.map((s) => <button key={s.label} onClick={(e) => { e.stopPropagation(); onText(s.page) }} className="rounded-md bg-slate-100 px-1.5 py-0.5 hover:bg-slate-200">{s.label}</button>)}
                  </div>
                </div>
                <div className="w-20 text-right font-semibold tabular-nums">{eur(p.price)}</div>
              </div>
            ))}
          </Card>
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pdfTemplates.map((t) => (
            <Card key={t.id} className="overflow-hidden">
              <Thumb type={t.type} />
              <div className="p-4">
                <div className="flex items-center justify-between"><span className="font-medium">{t.name}</span><Badge tone={t.type === 'Gutschein' ? 'info' : 'neutral'}>{t.type}</Badge></div>
                <div className="mt-1 text-sm text-muted">{usedBy(t.id).length ? `Verwendet von: ${usedBy(t.id).map((p) => p.name).join(', ')}` : 'Wird nicht verwendet'}</div>
                <div className="mt-3 flex gap-2"><Button variant="primary" className="flex-1" onClick={() => setTpl(t)}>Bearbeiten</Button><Button><Copy size={14} /> Duplizieren</Button></div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Drawer open={!!open} title={open?.name ?? ''} onClose={() => setOpen(null)} footer={<div className="flex gap-2"><Button variant="primary" className="flex-1">Speichern</Button><Button onClick={() => setOpen(null)}>Abbrechen</Button></div>}>
        {open && <ProductForm p={open} onEditTemplate={(id) => setTpl(tplOf(id))} onText={(pg) => { setOpen(null); onText(pg) }} />}
      </Drawer>

      <Drawer open={!!tpl} title={`Vorlage: ${tpl?.name ?? ''}`} onClose={() => setTpl(null)}>
        {tpl && (
          <div className="space-y-4">
            <Thumb type={tpl.type} large />
            <div className="text-sm font-medium">Elemente</div>
            {['Logo', 'Titel', 'Code und QR', 'Gültig bis', 'Leistungen', 'Kontakt', tpl.type === 'Ticket' ? 'Stornobedingungen' : 'AGB'].map((e) => (
              <div key={e} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm">{e}<span className="text-xs text-muted">{['Kontakt', 'AGB', 'Stornobedingungen'].includes(e) ? 'Text aus Shop-Texten' : 'fest'}</span></div>
            ))}
          </div>
        )}
      </Drawer>
    </div>
  )
}

function Thumb({ type, large }: { type: string; large?: boolean }) {
  return (
    <div className={clsx('grid place-items-center bg-slate-100 p-4', large ? 'rounded-xl' : 'border-b border-line')}>
      <div className={clsx('flex aspect-[1/1.414] flex-col gap-2 bg-white p-4 shadow-sm', large ? 'w-48' : 'w-28')}>
        <div className="h-3 w-10 rounded bg-brand/70" />
        <div className="h-3 w-3/4 rounded bg-slate-300" />
        <div className="h-8 w-full rounded bg-brand-soft" />
        <div className="mt-auto flex items-end justify-between"><div className="h-2 w-12 rounded bg-slate-200" /><div className="h-8 w-8 rounded bg-slate-800" /></div>
        <span className="text-[8px] text-muted">{type}</span>
      </div>
    </div>
  )
}

function ProductForm({ p, onEditTemplate, onText }: { p: CatalogItem; onEditTemplate: (id: string) => void; onText: (page: string) => void }) {
  const inp = 'h-11 w-full rounded-lg border border-line px-3 text-sm outline-none focus:border-brand'
  return (
    <div className="space-y-5 text-sm">
      <Link to="/tickets?tab=arten" className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5 hover:bg-slate-50"><span><span className="font-medium">{eur(p.price)}</span>{p.validityMonths ? ` · ${p.validityMonths} Monate gültig` : ''}<span className="block text-xs text-muted">Name, Preis und Verfügbarkeit</span></span><span className="text-brand">Verwalten</span></Link>
      <label className="block">Beschreibung<textarea rows={3} defaultValue={p.description} className="mt-1 w-full rounded-lg border border-line p-3 outline-none focus:border-brand" /></label>
      <section>
        <div className="mb-1 font-medium">Leistungen</div>
        <div className="flex flex-wrap gap-2">{p.features.map((f) => <Badge key={f} tone="info">{f}</Badge>)}<button className="text-brand">+ hinzufügen</button></div>
      </section>
      <section>
        <div className="mb-1 font-medium">PDF-Vorlage</div>
        <div className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">{pdfTemplates.find((t) => t.id === p.templateId)?.name}<Button onClick={() => onEditTemplate(p.templateId)}>Vorlage ansehen</Button></div>
      </section>
      <section>
        <div className="mb-1 font-medium">Wo sieht der Kunde das?</div>
        <div className="space-y-2">{p.shownOn.map((s) => <button key={s.label} onClick={() => onText(s.page)} className="flex w-full items-center justify-between rounded-lg border border-line px-3 py-2 text-left hover:bg-slate-50">{s.label}<span className="text-brand">Texte ansehen</span></button>)}</div>
      </section>
    </div>
  )
}
