import clsx from 'clsx'
import { footerText, type Branding } from './data'

/** The club's logo, or its initials in the accent colour when no logo was uploaded. */
export function ClubMark({ b, size = 44 }: { b: { name: string; logo: string | null; accent?: string }; size?: number }) {
  const initials = b.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
  return b.logo
    ? <img src={b.logo} alt="" style={{ height: size, maxWidth: size * 3 }} className="shrink-0 object-contain" />
    : <span className="grid shrink-0 place-items-center rounded-lg font-semibold text-white" style={{ width: size, height: size, background: b.accent ?? '#0b5fff', fontSize: size * 0.38 }}>{initials}</span>
}

/**
 * The head of every printed or PDF document: forms, invoices, the public page. Logo, name, address and contact are shown
 * as the club switched them on in the form design, aligned left, centre or right.
 */
export default function LetterHead({ design: b, compact = false }: { design: Branding; compact?: boolean }) {
  const lines = [b.show.name && b.name, b.show.address && [b.street, b.city].filter(Boolean).join(' · '), b.show.contact && [b.email, b.phone, b.web].filter(Boolean).join(' · ')].filter(Boolean) as string[]
  const text = (
    <div className={clsx('min-w-0', b.align === 'mitte' ? 'text-center' : b.align === 'rechts' ? 'text-right' : 'text-left')}>
      {b.show.name && <div className="font-semibold leading-tight" style={{ fontSize: compact ? 13 : 15 }}>{b.name}</div>}
      {lines.slice(b.show.name ? 1 : 0).map((l) => <div key={l} className="text-[10px] leading-snug text-slate-500">{l}</div>)}
    </div>
  )
  const mark = b.show.logo ? <ClubMark b={b} size={compact ? 32 : 44} /> : null
  return (
    <div className="border-b-2 pb-3" style={{ borderColor: b.accent }}>
      {b.align === 'mitte'
        ? <div className="flex flex-col items-center gap-1.5">{mark}{text}</div>
        : <div className={clsx('flex items-center gap-3', b.align === 'rechts' && 'flex-row-reverse')}>{mark}{text}</div>}
    </div>
  )
}

/** Footer line of documents, if the club switched it on. */
export function LetterFoot({ design: b }: { design: Branding }) {
  const t = footerText(b)
  return b.show.footer && t ? <div className="text-center text-[9px] text-slate-400">{t}</div> : null
}
