import clsx from 'clsx'
import { Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useApp } from '../../state'
import { Card, Segmented, Switch } from '../../ui'
import { footerText, PARTS, type Branding, type ClubData, type Part } from '../members/data'
import LogoPicker from './LogoPicker'

const inp = 'h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-brand disabled:bg-slate-50 disabled:text-muted'
export const swatches = ['#0b5fff', '#0f766e', '#b91c1c', '#7c3aed', '#b45309', '#0f172a']
const FIELD_LABEL: Record<keyof ClubData, string> = { name: 'Vereinsname', street: 'Straße und Nummer', city: 'PLZ und Ort', email: 'E-Mail', phone: 'Telefon', web: 'Website', zvr: 'ZVR-Zahl', iban: 'IBAN', court: 'Gerichtsstand', logo: 'Logo' }

/** Accent colour: the standard colours or any colour of the palette. */
export function AccentPicker({ value, onChange, disabled }: { value: string; onChange: (c: string) => void; disabled?: boolean }) {
  const custom = !swatches.includes(value)
  return (
    <div className="flex flex-wrap items-center gap-2">
      {swatches.map((c) => <button key={c} disabled={disabled} aria-label={`Farbe ${c}`} onClick={() => onChange(c)} className={clsx('grid h-8 w-8 place-items-center rounded-full ring-offset-2 disabled:opacity-50', value === c && 'ring-2 ring-slate-400')} style={{ background: c }}>{value === c && <Check size={14} className="text-white" />}</button>)}
      <label className={clsx('flex h-8 items-center gap-2 rounded-full border border-line pl-1 pr-3 text-xs', disabled ? 'opacity-50' : 'cursor-pointer hover:bg-slate-50', custom && 'ring-2 ring-slate-400 ring-offset-2')}>
        <input type="color" aria-label="Eigene Farbe" disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} className="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-0" />
        Eigene Farbe <span className="tabular-nums text-muted">{value.toUpperCase()}</span>
      </label>
    </div>
  )
}

/**
 * The look of a form version. The club data comes from ONE central place (Einstellungen > Vereinsdaten): here the form only chooses
 * what to show and may override a part for this form alone. In `standard` mode only the layout is edited (template for new forms).
 */
export default function DesignEditor({ design: b, onChange, disabled = false, mode = 'version', extra }: { design: Branding; onChange: (b: Branding) => void; disabled?: boolean; mode?: 'version' | 'standard'; extra?: React.ReactNode }) {
  const { can, club } = useApp()
  const set = (p: Partial<Branding>) => onChange({ ...b, ...p })
  const setShow = (k: Part, v: boolean) => set({ show: { ...b.show, [k]: v } })
  const makeOwn = (k: Part) => set({ own: [...b.own, k] })
  const followClub = (k: Part) => {
    const part = PARTS.find((x) => x.key === k)!
    const reset = Object.fromEntries(part.fields.map((f) => [f, club[f]]))
    set({ ...reset, own: b.own.filter((x) => x !== k) })
  }
  const value = (k: Part) => {
    switch (k) {
      case 'name': return b.name
      case 'address': return [b.street, b.city].filter(Boolean).join(', ')
      case 'contact': return [b.email, b.phone, b.web].filter(Boolean).join(' · ')
      case 'footer': return footerText(b)
      default: return ''
    }
  }
  return (
    <div className="space-y-4">
      {extra}
      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{mode === 'version' ? 'Vereinsdaten in diesem Formular' : 'Was im Kopf steht'}</h3>
          {can('settings.edit.system') && <Link to="/einstellungen?tab=verein" className="text-sm text-brand hover:underline">Vereinsdaten ändern</Link>}
        </div>
        <div className="divide-y divide-line rounded-xl border border-line">
          {PARTS.map((part) => {
            const own = b.own.includes(part.key)
            return (
              <div key={part.key} className="space-y-2 px-4 py-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">{part.label}</span>
                  <span className="flex items-center gap-3">
                    {mode === 'version' && b.show[part.key] && (own
                      ? <button disabled={disabled} onClick={() => followClub(part.key)} className="text-xs text-brand hover:underline disabled:opacity-50">Wie Vereinsdaten</button>
                      : <button disabled={disabled} onClick={() => makeOwn(part.key)} className="text-xs text-brand hover:underline disabled:opacity-50">Überschreiben</button>)}
                    <Switch disabled={disabled} checked={b.show[part.key]} onChange={(v) => setShow(part.key, v)} label={`${part.label} anzeigen`} />
                  </span>
                </div>
                {b.show[part.key] && part.key === 'logo' && (own && mode === 'version'
                  ? <LogoPicker name={b.name} logo={b.logo} accent={b.accent} disabled={disabled} onChange={(logo) => set({ logo })} />
                  : <div className="text-xs text-muted">{b.logo ? 'Logo des Vereins' : 'Kein Logo, die Initialen des Vereins werden gezeigt.'}</div>)}
                {b.show[part.key] && part.key !== 'logo' && (own && mode === 'version'
                  ? <div className="grid gap-2 sm:grid-cols-2">{part.fields.map((k) => <label key={k} className="text-xs text-muted">{FIELD_LABEL[k]}<input disabled={disabled} value={String(b[k] ?? '')} onChange={(e) => set({ [k]: e.target.value } as Partial<Branding>)} className={clsx(inp, 'mt-0.5')} /></label>)}</div>
                  : <div className="text-xs text-muted">{value(part.key) || '–'}</div>)}
                {mode === 'version' && own && <div className="text-[11px] font-medium text-warn">Nur für dieses Formular, folgt nicht den Vereinsdaten</div>}
              </div>
            )
          })}
        </div>
      </Card>
      <Card className="space-y-4 p-5">
        <h3 className="text-sm font-semibold">Gestaltung</h3>
        <div><div className="mb-1 text-sm font-medium">Kopf ausrichten</div><Segmented<Branding['align']> value={b.align} onChange={(align) => !disabled && set({ align })} options={[{ value: 'links', label: 'Links' }, { value: 'mitte', label: 'Mitte' }, { value: 'rechts', label: 'Rechts' }]} /></div>
        <div><div className="mb-1.5 text-sm font-medium">Akzentfarbe</div><AccentPicker value={b.accent} disabled={disabled} onChange={(accent) => set({ accent })} /></div>
      </Card>
    </div>
  )
}
