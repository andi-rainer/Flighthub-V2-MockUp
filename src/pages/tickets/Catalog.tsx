import { ChevronRight, Plus } from 'lucide-react'
import { useState } from 'react'
import { eur } from '../../data'
import { useSession } from '../../session/session'
import { TODAY_ISO, useApp } from '../../state'
import { Badge, Button, ConfirmDelete, Drawer, Row, Section, Switch } from '../../ui'
import { dmy } from '../manifest/data'
import { pdfTemplates } from '../store/data'
import { KIND_NAME, saveCatalogItem, type CatalogItem, type CatalogKind } from './data'
import { field, Field } from './parts'

const perm = 'vouchers.catalog.manage'
const num = (v: string) => Number(v.replace(',', '.'))
const termsText = (i: Pick<CatalogItem, 'validityMonths'>) => (i.validityMonths ? ` · ${i.validityMonths} Monate gültig` : '')

/** Which vouchers and tickets exist and what they cost. A price change starts a new version today; sold vouchers and tickets keep theirs. */
export default function Catalog() {
  const { catalog, setCatalog, vouchers, tickets, can } = useApp()
  const { guarded } = useSession()
  const [editing, setEditing] = useState<CatalogItem | CatalogKind | null>(null)
  const mayEdit = can(perm)
  const sold = (i: CatalogItem) => vouchers.filter((v) => v.typeId === i.id).length + tickets.filter((t) => t.typeId === i.id).length
  const commit = (next: CatalogItem[]) => guarded(perm, () => setCatalog(next))

  return (
    <div className="max-w-3xl space-y-4">
      {(['voucher', 'ticket'] as CatalogKind[]).map((k) => (
        <Section key={k} title={k === 'voucher' ? 'Gutscheine' : 'Tickets'} action={mayEdit && <Button onClick={() => setEditing(k)}><Plus size={14} /> {KIND_NAME[k]}</Button>}>
          {catalog.filter((i) => i.kind === k).map((i) => (
            <Row key={i.id} onClick={() => setEditing(i)}
              label={<span className="flex flex-wrap items-center gap-2">{i.name} {!i.active && <Badge>Ausgeschaltet</Badge>}</span>}
              hint={<><b className="font-semibold text-ink">{eur(i.price)}</b> seit {dmy(i.since)}{termsText(i)}<br />Code {i.prefix}-… · {sold(i)} verkauft</>}>
              {mayEdit && <Switch checked={i.active} label={`${i.name} verfügbar`} onChange={(v) => commit(catalog.map((x) => (x.id === i.id ? { ...x, active: v } : x)))} />}
              <ChevronRight size={16} className="text-muted" />
            </Row>
          ))}
        </Section>
      ))}
      {editing && (
        <ItemDrawer item={editing} sold={typeof editing === 'string' ? 0 : sold(editing)} readOnly={!mayEdit} onClose={() => setEditing(null)}
          onSave={(n) => { const old = catalog.find((x) => x.id === n.id); const saved = saveCatalogItem(old, n, TODAY_ISO); commit(old ? catalog.map((x) => (x.id === n.id ? saved : x)) : [...catalog, saved]); setEditing(null) }}
          onDelete={(id) => { commit(catalog.filter((x) => x.id !== id)); setEditing(null) }} />
      )}
    </div>
  )
}

function ItemDrawer({ item, sold, readOnly, onSave, onDelete, onClose }: { item: CatalogItem | CatalogKind; sold: number; readOnly: boolean; onSave: (i: CatalogItem) => void; onDelete: (id: string) => void; onClose: () => void }) {
  const cur = typeof item === 'string' ? undefined : item
  const kind: CatalogKind = typeof item === 'string' ? item : item.kind
  const [name, setName] = useState(cur?.name ?? '')
  const [nameEn, setNameEn] = useState(cur?.nameEn ?? '')
  const [price, setPrice] = useState(cur ? String(cur.price).replace('.', ',') : '')
  const [months, setMonths] = useState(String(cur?.validityMonths ?? 12))
  const [prefix, setPrefix] = useState(cur?.prefix ?? '')
  const [tpl, setTpl] = useState(cur?.templateId ?? pdfTemplates.find((t) => t.type === KIND_NAME[kind])?.id ?? '')
  const [active, setActive] = useState(cur?.active ?? true)
  const p = num(price), m = Number(months)
  const prefixOk = /^[A-Z0-9]{2,10}$/.test(prefix)
  const valid = name.trim() !== '' && price.trim() !== '' && Number.isFinite(p) && p >= 0 && prefixOk && (kind === 'ticket' || (Number.isInteger(m) && m > 0))
  const changed = !!cur && (p !== cur.price || (kind === 'voucher' && m !== cur.validityMonths))
  const build = (): CatalogItem => ({ id: cur?.id ?? `p-${Date.now()}`, kind, name: name.trim(), nameEn: nameEn.trim(), price: p, validityMonths: kind === 'voucher' ? m : undefined, prefix, templateId: tpl, active, since: cur?.since ?? '', history: cur?.history ?? [], description: cur?.description ?? '', features: cur?.features ?? [], shownOn: cur?.shownOn ?? [] })

  return (
    <Drawer open title={cur ? cur.name : `Neuer ${KIND_NAME[kind]}`} onClose={onClose}
      footer={readOnly ? undefined : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>{cur && <ConfirmDelete what={cur.name} blocked={sold > 0 ? `Schon ${sold}-mal verkauft. Schalte die Art stattdessen aus.` : undefined} onConfirm={() => onDelete(cur.id)} />}</div>
          <div className="flex gap-2"><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" disabled={!valid} onClick={() => onSave(build())}>Speichern</Button></div>
        </div>
      )}>
      <fieldset disabled={readOnly} className="space-y-5 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name (Deutsch)"><input value={name} onChange={(e) => setName(e.target.value)} className={`${field} w-full`} /></Field>
          <Field label="Name (English)"><input value={nameEn} onChange={(e) => setNameEn(e.target.value)} className={`${field} w-full`} /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Preis">
            <div className="flex items-center gap-2"><input aria-label="Preis" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className={`${field} w-28 text-right tabular-nums`} /><span className="text-muted">€{changed ? ` · ab heute, ${dmy(TODAY_ISO)}` : ''}</span></div>
          </Field>
          {kind === 'voucher' && <Field label="Gültig"><div className="flex items-center gap-2"><input aria-label="Gültigkeit in Monaten" inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value.replace(/\D/g, ''))} className={`${field} w-20 text-right tabular-nums`} /><span className="text-muted">Monate</span></div></Field>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Code-Präfix"><input aria-label="Code-Präfix" value={prefix} disabled={!!cur} onChange={(e) => setPrefix(e.target.value.toUpperCase())} className={`${field} w-full disabled:opacity-60`} />{!cur && prefix !== '' && !prefixOk && <span className="mt-1 block text-xs text-bad">2 bis 10 Großbuchstaben oder Ziffern</span>}</Field>
          <Field label="PDF-Vorlage"><select value={tpl} onChange={(e) => setTpl(e.target.value)} className={`${field} w-full`}>{pdfTemplates.filter((t) => t.type === KIND_NAME[kind]).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5"><span className="font-medium">Verfügbar (Shop und Personal)</span><Switch checked={active} onChange={setActive} label="Verfügbar" /></div>
        {cur && cur.history.length > 0 && (
          <div>
            <div className="mb-1 font-medium">Frühere Preise</div>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {cur.history.map((h) => <li key={h.until} className="flex items-center justify-between px-3 py-2"><span className="text-muted">{dmy(h.since)} bis {dmy(h.until)}{h.validityMonths ? ` · ${h.validityMonths} Monate` : ''}</span><span className="tabular-nums">{eur(h.price)}</span></li>)}
            </ul>
          </div>
        )}
      </fieldset>
    </Drawer>
  )
}
