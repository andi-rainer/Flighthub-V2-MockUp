import { ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../ui'
import { LANGS, type Branding, type Lang } from './members/data'
import { ui } from './members/i18n'
import { ClubMark } from './members/LetterHead'

/**
 * Frame of every page without login and menu (application link, tandem check-in): club logo and name, language switch,
 * content. `back` is only for the click dummy and leads back into the administration.
 */
export default function PublicShell({ design, lang, onLang, back, wide, children }: { design: Branding; lang: Lang; onLang: (l: Lang) => void; back: { label: string; to: string }; wide?: boolean; children: ReactNode }) {
  const nav = useNavigate()
  const t = ui(lang)
  return (
    <div className="h-full overflow-y-auto bg-canvas">
      <div className={`mx-auto space-y-4 p-4 md:py-10 ${wide ? 'max-w-2xl' : 'max-w-xl'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3"><ClubMark b={design} size={36} /><div className="text-lg font-semibold tracking-tight">{design.name}</div></div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1 text-xs text-muted sm:inline-flex"><ShieldCheck size={14} /> {t.secure}</span>
            <div className="flex overflow-hidden rounded-lg border border-line bg-surface text-xs font-medium">{LANGS.map((l) => <button key={l.id} onClick={() => onLang(l.id)} aria-pressed={lang === l.id} className={lang === l.id ? 'bg-brand px-2.5 py-1.5 text-white' : 'px-2.5 py-1.5 text-muted hover:bg-slate-50'}>{l.id.toUpperCase()}</button>)}</div>
          </div>
        </div>
        {children}
        <button onClick={() => nav(back.to)} className="block w-full text-center text-xs text-muted hover:text-ink">{back.label}</button>
      </div>
    </div>
  )
}

/** A centred message card (invalid link, already received, ...). */
export function Notice({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <Card className="space-y-2 p-8 text-center"><div className="mx-auto w-fit text-muted">{icon}</div><div className="text-lg font-semibold">{title}</div><p className="text-sm text-muted">{text}</p></Card>
}
