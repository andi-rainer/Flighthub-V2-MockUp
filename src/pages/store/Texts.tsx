import clsx from 'clsx'
import { Pencil } from 'lucide-react'
import { useState } from 'react'
import { Badge, Card, Segmented } from '../../ui'
import { shopPages, type Block, type Lang } from './data'

type Texts = Record<string, { de: string; en: string }> // key = `${blockId}.${fieldKey}`

export default function Texts({ pageId, onPage }: { pageId: string; onPage: (id: string) => void }) {
  const page = shopPages.find((p) => p.id === pageId) ?? shopPages[0]
  const [lang, setLang] = useState<Lang>('de')
  const [sel, setSel] = useState<string>(page.blocks[0].id)
  const [texts, setTexts] = useState<Texts>({})
  const block = page.blocks.find((b) => b.id === sel) ?? page.blocks[0]

  const val = (b: Block, key: string, l: Lang) => texts[`${b.id}.${key}`]?.[l] ?? b.fields.find((f) => f.key === key)![l]
  const set = (b: Block, key: string, l: Lang, v: string) =>
    setTexts((t) => ({ ...t, [`${b.id}.${key}`]: { de: val(b, key, 'de'), en: val(b, key, 'en'), [l]: v } }))

  const pick = (id: string) => { onPage(id); setSel(shopPages.find((p) => p.id === id)!.blocks[0].id) }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {shopPages.map((p) => (
            <button key={p.id} onClick={() => pick(p.id)} className={clsx('rounded-lg border px-3 py-1.5 text-sm font-medium', p.id === page.id ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface hover:bg-slate-50')}>{p.label}</button>
          ))}
        </div>
        <Segmented<Lang> value={lang} onChange={setLang} options={[{ value: 'de', label: 'Deutsch' }, { value: 'en', label: 'English' }]} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        {/* Faux browser: this is what the customer sees. Click any text to edit it. */}
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line bg-slate-50 px-4 py-2">
            <span className="flex gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-slate-300" /><i className="h-2.5 w-2.5 rounded-full bg-slate-300" /><i className="h-2.5 w-2.5 rounded-full bg-slate-300" /></span>
            <span className="ml-2 flex-1 rounded-md bg-white px-3 py-1 text-xs text-muted">shop.skydive-beispiel.at{page.path}</span>
          </div>
          <div className="space-y-3 bg-slate-100 p-5">
            <p className="text-xs text-muted">Klicke auf einen Bereich, um den Text zu ändern.</p>
            <div className={clsx('grid gap-3', page.blocks.filter((b) => b.kind === 'card').length > 1 && 'sm:grid-cols-3')}>
              {page.blocks.filter((b) => b.kind === 'card').map((b) => <Preview key={b.id} b={b} on={sel === b.id} onClick={() => setSel(b.id)} val={(k) => val(b, k, lang)} />)}
            </div>
            {page.blocks.filter((b) => b.kind !== 'card').map((b) => <Preview key={b.id} b={b} on={sel === b.id} onClick={() => setSel(b.id)} val={(k) => val(b, k, lang)} />)}
          </div>
        </Card>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><Pencil size={15} /> {block.title}</div>
            <p className="mt-1 text-xs text-muted">Seite „{page.label}“ · Änderungen sind sofort links sichtbar.</p>
            <div className="mt-4 space-y-4">
              {block.fields.map((f) => (
                <label key={f.key} className="block text-sm">
                  <span className="mb-1 flex items-center justify-between font-medium">{f.label}<span className="text-xs font-normal text-muted">{lang === 'de' ? 'Deutsch' : 'English'}</span></span>
                  {f.multiline ? (
                    <textarea rows={4} value={val(block, f.key, lang)} onChange={(e) => set(block, f.key, lang, e.target.value)} className="w-full rounded-lg border border-line p-3 outline-none focus:border-brand" />
                  ) : (
                    <input value={val(block, f.key, lang)} onChange={(e) => set(block, f.key, lang, e.target.value)} className="h-11 w-full rounded-lg border border-line px-3 outline-none focus:border-brand" />
                  )}
                </label>
              ))}
            </div>
            {block.alsoIn && (
              <div className="mt-4 rounded-lg bg-warn-soft p-3 text-xs text-amber-900">
                Dieser Text erscheint auch in: {block.alsoIn.map((a) => <Badge key={a} tone="warn">{a}</Badge>)}
              </div>
            )}
          </Card>
        </aside>
      </div>
    </div>
  )
}

function Preview({ b, on, onClick, val }: { b: Block; on: boolean; onClick: () => void; val: (k: string) => string }) {
  const [first, ...rest] = b.fields
  return (
    <button onClick={onClick} className={clsx('block w-full rounded-xl border-2 bg-white p-4 text-left transition', on ? 'border-brand shadow-md' : 'border-transparent hover:border-slate-300', b.kind === 'footer' && 'bg-transparent')}>
      <div className={clsx(b.kind === 'hero' ? 'text-2xl font-semibold' : b.kind === 'footer' ? 'text-xs text-muted' : 'font-semibold')}>{val(first.key)}</div>
      {rest.map((f) => <p key={f.key} className={clsx('mt-1 text-sm text-muted', b.kind === 'legal' && 'line-clamp-2')}>{val(f.key)}</p>)}
      {b.kind === 'card' && <span className="mt-3 inline-block rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white">Weiter</span>}
    </button>
  )
}
