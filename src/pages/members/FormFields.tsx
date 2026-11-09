import { Lock } from 'lucide-react'
import { useApp } from '../../state'
import clsx from 'clsx'
import { fillText, isInput, lab, txt, type Branding, type FormField, type FormVersion, type Lang } from './data'
import { ui } from './i18n'

/** The choices a person sees in a selection field. The check-in membership is only given at the tandem check-in, so no form offers it. */
export const choicesOf = (f: FormField, types: { id: string; name: string; checkin?: boolean }[], currentType?: string): string[] =>
  f.options?.kind === 'liste' ? f.options.items : types.filter((t) => !t.checkin && !(f.options?.kind === 'mitgliedschaften' && f.options.exclude.includes(t.id)) && !(f.options?.kind === 'mitgliedschaften' && f.options.hideCurrent && t.name === currentType)).map((t) => t.name)

export const fieldInput = 'h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-brand'

/** Required fields that are still empty. A consent counts only when it is "Ja". */
export const missingFields = (v: FormVersion, values: Record<string, string>) =>
  v.fields.filter(isInput).filter((f) => f.required && !(f.type === 'Zustimmung' ? values[f.label] === 'Ja' : values[f.label]?.trim())).map((f) => f.label)

/** Answers as stored and printed: dates as dd.MM.yyyy, empty values as a dash. */
export const answersOf = (v: FormVersion, values: Record<string, string>) =>
  Object.fromEntries(v.fields.filter(isInput).map((f) => { const x = values[f.label]; return [f.label, !x ? '–' : /^\d{4}-\d{2}-\d{2}$/.test(x) ? x.split('-').reverse().join('.') : x] }))

/** A paragraph of a form as the person reads it online. Highlighted paragraphs (waiver, health declaration) stand out in a box. */
export function Paragraph({ f, design, lang = 'de' }: { f: FormField; design: Branding; lang?: Lang }) {
  return <p className={clsx('whitespace-pre-line text-sm leading-relaxed', f.highlight ? 'rounded-lg border-l-4 bg-slate-50 p-3 text-ink' : 'text-muted')} style={f.highlight ? { borderColor: design.accent } : undefined}>{fillText(txt(f, lang), design)}</p>
}

/**
 * The content of one form version in order: headings, texts and inputs. The same component is used on the public page, at the club on a
 * device and when the data of a paper form is typed in. Known fields come from the member record and cannot be changed or chosen.
 */
export default function FormFields({ version, values, onChange, currentType, locked, lang = 'de' }: { version: FormVersion; values: Record<string, string>; onChange: (label: string, value: string) => void; currentType?: string; locked?: string[]; lang?: Lang }) {
  const { types } = useApp()
  const t = ui(lang)
  const row = (f: FormField) => {
    const v = values[f.label] ?? ''
    if (f.source || locked?.includes(f.label)) {
      return <div className={`${fieldInput} flex items-center justify-between bg-slate-50 text-muted`}><span className="text-ink">{v || '–'}</span><span className="flex items-center gap-1 text-xs"><Lock size={12} /> {f.source ? t.prefilled : t.byClub}</span></div>
    }
    if (f.type === 'Datum') return <input type="date" value={v} onChange={(e) => onChange(f.label, e.target.value)} className={fieldInput} />
    if (f.type === 'Auswahl') {
      return <select value={v} onChange={(e) => onChange(f.label, e.target.value)} className={fieldInput}><option value="">{t.choose}</option>{choicesOf(f, types, currentType).map((o) => <option key={o}>{o}</option>)}</select>
    }
    return <input value={v} onChange={(e) => onChange(f.label, e.target.value)} className={fieldInput} />
  }
  return (
    <div className="space-y-4">
      {version.fields.map((f) => {
        if (f.type === 'Überschrift') return <h3 key={f.id} className="pt-3 text-base font-semibold tracking-tight">{lab(f, lang)}</h3>
        if (f.type === 'Absatz') return <Paragraph key={f.id} f={f} design={version.design} lang={lang} />
        if (f.type === 'Seitenumbruch') return null
        if (f.type === 'Zustimmung' && !f.source && !locked?.includes(f.label)) {
          const on = values[f.label] === 'Ja'
          return (
            <label key={f.id} className={clsx('flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm', on ? 'border-ok bg-ok-soft' : 'border-line')}>
              <input type="checkbox" checked={on} onChange={(e) => onChange(f.label, e.target.checked ? 'Ja' : '')} className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{lab(f, lang)}{f.required ? ' *' : ''}</span>
            </label>
          )
        }
        return <label key={f.id} className="block text-sm font-medium"><span className="mb-1 block">{lab(f, lang)}{f.required && !f.source && !locked?.includes(f.label) ? ' *' : ''}</span>{row(f)}</label>
      })}
    </div>
  )
}
